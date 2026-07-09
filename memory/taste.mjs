// memory/taste.mjs — FableMotion's ADAPTIVE TASTE ENGINE.
//
// The studio learns how Subha wants videos from his BEHAVIOR — the words in his
// prompts and the edits he keeps — not from anyone hand-writing rules. Each
// signal is weighted by recency + repetition, so new direction is adopted fast
// (that's the "too fast adopting" the user asked for: a high learning rate and
// a short half-life mean the latest corrections dominate the brief immediately).
//
// It is NOT model-weight fine-tuning (FableMotion's brain is the Claude Code
// login — its weights aren't ours to train). It is in-context self-adaptation:
// every future director prompt is pre-loaded with the learned taste via brief().
// exportDataset() turns the same observations into JSONL, so IF a real local
// fine-tune is ever wanted, the training set is already being collected.
//
// Fully local: lives in memory/reel/ (gitignored), never uploaded.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "memory", "reel");
const STORE = path.join(DIR, "taste.json");

const nowISO = () => new Date().toISOString();
const ensure = () => fs.mkdirSync(DIR, { recursive: true });

const DEFAULTS = {
  // adoption speed — turned up per Subha's "too fast adopting" ask
  learningRate: 0.7, // 0..1: how hard each new observation bumps a signal
  halfLifeDays: 10, // recency decay: older taste fades unless reinforced
  signals: {}, // id -> { text, weight, count, last, links? }
  log: [], // rolling behavior log (also the fine-tune dataset seed)
};

function load() {
  ensure();
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(STORE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}
function save(state) {
  ensure();
  fs.writeFileSync(STORE, JSON.stringify(state, null, 2));
}

const ageDays = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
const decayed = (sig, halfLife) => sig.weight * Math.pow(0.5, ageDays(sig.last) / halfLife);

/** Reinforce a signal. Fast adoption: weight += learningRate*strength, count++. */
export function reinforce(id, text, { strength = 1, links = [] } = {}) {
  const s = load();
  const cur = s.signals[id] ?? { text, weight: 0, count: 0, last: nowISO(), links };
  // decay the existing weight to "now" before adding, so recency compounds
  const base = decayed({ ...cur }, s.halfLifeDays);
  s.signals[id] = {
    text, // newest phrasing wins
    weight: Math.min(10, base + s.learningRate * strength),
    count: cur.count + 1,
    last: nowISO(),
    links: links.length ? links : cur.links ?? [],
  };
  save(s);
  return s.signals[id];
}

/** Log a behavior event (prompt/edit/approve/reject). Feeds brief + dataset. */
export function logEvent(kind, note, extra = {}) {
  const s = load();
  s.log.push({ at: nowISO(), kind, note, ...extra });
  if (s.log.length > 500) s.log = s.log.slice(-500);
  save(s);
}

// ---------- learn from PROMPTS (what he asks for, in his words) ----------

const PROMPT_SIGNALS = [
  { re: /\bclean|declutter|remove.*(text|marquee|ticker)|minimal\b/i, id: "clean-top",
    text: "Keep it clean — one hero marquee sign, no scrolling tickers or 'NOW SHOWING' clutter; generous negative space." },
  { re: /\balive|walk|run|scream|lost|react|emot|character|feeling\b/i, id: "living-character",
    text: "Characters must be ALIVE — walk/run gaits, startle/scream/lost emotions, speech-bubble emotes, reacting to events; never a static prop." },
  { re: /\b(fall|falling|down|crush|weight|impact|physics|slam|body down)\b/i, id: "physical-weight",
    text: "Falling objects carry weight — screen shake, squash-on-impact, debris, and they visibly crush/press the character." },
  { re: /\b(sound|audio|sfx|bgm|music|scream.*audio|robotic)\b/i, id: "behavior-audio",
    text: "Always score with behavior-derived SFX (impacts/footsteps/screams synced to events) + a robotic minor-key BGM bed." },
  { re: /\b(no cartoon|not cartoon|serious|cinematic)\b/i, id: "no-cartoon-audio",
    text: "Audio is retro-arcade/robotic and cinematic — never cartoon/kids music.", links: ["audio-style-no-cartoon"] },
  { re: /\b(colorful|colourful|alive|vibrant|desi|maximal)\b/i, id: "alive-not-moody",
    text: "Colorful, alive, desi-maximalist — never the dark moody AI-reel cliché.", links: ["video-no-dark-ai-cliche"] },
  { re: /\b(pixel|retro|arcade|8-?bit|marquee|now showing|fable)\b/i, id: "pixel-marquee",
    text: "Fable-5 'NOW SHOWING' marquee look: warm-black, glowing cream sign, pixel-red lettering, dot-matrix type." },
  { re: /\b(instagram|ig|reel|story|feature)\b/i, id: "ig-brand-gag",
    text: "IG feature gags land: feature-boxes as physical objects, a mascot bot that suffers under them — comedic, screenshotable." },
  { re: /\b(unlimited|infinite|more scene|new scene|not.*(limit|template)|variety|any scene)\b/i, id: "unlimited-scenes",
    text: "Never lean on a fixed scene menu — compose every beat fresh from cast+verbs+regions, layer elements, split the frame, use `custom` HTML or the procedural engine. No two scenes interchangeable." },
  { re: /\b(teach|learn|train|adapt|remember|my (taste|style|way))\b/i, id: "self-adapt",
    text: "Keep adapting to Subha's direction — reinforce what he keeps, drop what he cuts, weight the freshest prompt highest." },
];

/** Scan a user prompt and reinforce every taste it expresses. */
export function observePrompt(text) {
  if (!text) return [];
  const hits = [];
  for (const p of PROMPT_SIGNALS)
    if (p.re.test(text)) {
      reinforce(p.id, p.text, { strength: 1, links: p.links });
      hits.push(p.id);
    }
  logEvent("prompt", text.slice(0, 200), { learned: hits });
  return hits;
}

// ---------- learn from EDITS (what he keeps vs what the agent proposed) ----------

const has = (o, k) => o && typeof o === "object" && k in o;

/** Diff a before/after config or Score and reinforce the taste the edit implies. */
export function learnFromEdit(before, after) {
  if (!before || !after) return [];
  const learned = [];
  const bump = (id, text, links) => {
    reinforce(id, text, { strength: 1.4, links }); // edits weigh more than words
    learned.push(id);
  };

  // procedural config domain
  if (has(after, "sprites") || has(after, "physics")) {
    const bM = before.marquees ?? [];
    const aM = after.marquees ?? [];
    const removedNoisy = bM.filter(
      (m) => (m.scroll || /now showing/i.test(m.text || "")) && !aM.some((n) => n.text === m.text)
    );
    if (removedNoisy.length || aM.length < bM.length)
      bump("clean-top", "Keep it clean — he removes scrolling tickers / 'NOW SHOWING' and keeps one hero sign.");

    const aS = (after.sprites ?? [])[0] ?? {};
    const bS = (before.sprites ?? [])[0] ?? {};
    if ((aS.path && !bS.path) || (aS.emotes && !bS.emotes) || (aS.stateTimeline?.length ?? 0) > (bS.stateTimeline?.length ?? 0))
      bump("living-character", "He adds locomotion/emotes/states — characters must act and react, never stand still.");
    if ((aS.crush && !bS.crush) || (aS.struggle && !bS.struggle))
      bump("physical-weight", "He adds crush/struggle — objects must physically press and deform the character.");
  }

  // v2 Score domain
  if (after.version === 2 && has(after, "cast")) {
    if (after.meta?.theme?.preset === "marquee" && before?.meta?.theme?.preset !== "marquee")
      bump("pixel-marquee", "He switches to the marquee theme — favor the warm-black pixel-sign look.");
    if (after.meta?.mood && !before?.meta?.mood)
      bump("mood-led", `He sets meta.mood ("${after.meta.mood}") — direct with an explicit emotional target.`);
  }

  logEvent("edit", `learned ${learned.join(", ") || "nothing new"}`);
  return learned;
}

export function observeApprove(name) {
  reinforce("approved-shape", `Videos like "${name}" are the target — imitate their instincts.`, { strength: 0.8 });
  logEvent("approve", name);
}
export function observeReject(name, why = "") {
  logEvent("reject", `${name} ${why}`.trim());
}

// ---------- the injected brief (auto-adopted every prompt) ----------

/** Top learned directives, recency+repetition weighted, freshest first. */
export function brief({ topK = 10 } = {}) {
  const s = load();
  const ranked = Object.entries(s.signals)
    .map(([id, sig]) => ({ id, sig, score: decayed(sig, s.halfLifeDays) + (ageDays(sig.last) < 1 ? 0.4 : 0) }))
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  if (!ranked.length) return "";
  const lines = ranked.map((x) => {
    const links = x.sig.links?.length ? " " + x.sig.links.map((l) => `[[${l}]]`).join(" ") : "";
    return `- (${x.score.toFixed(1)}) ${x.sig.text}${links}`;
  });
  return (
    `\n\n=== LEARNED TASTE (adaptive, from Subha's prompts & edits — obey, freshest first) ===\n` +
    lines.join("\n")
  );
}

/** JSONL of prompt→approved-video pairs — the seed for a real local fine-tune. */
export function exportDataset(outFile = path.join(DIR, "dataset.jsonl")) {
  const s = load();
  const scoresDir = path.join(DIR, "scores");
  const approved = fs.existsSync(scoresDir)
    ? fs.readdirSync(scoresDir).filter((f) => f.endsWith(".json"))
    : [];
  const prompts = s.log.filter((e) => e.kind === "prompt").map((e) => e.note);
  const lines = approved.map((f, i) => {
    const entry = JSON.parse(fs.readFileSync(path.join(scoresDir, f), "utf8"));
    return JSON.stringify({
      prompt: prompts[i] ?? `Make a FableMotion video like ${entry.name}`,
      completion: entry.score,
    });
  });
  fs.writeFileSync(outFile, lines.join("\n"));
  return { pairs: lines.length, outFile };
}

// ---------- seed: everything THIS session taught the engine ----------

const SESSION_LESSONS = [
  ["clean-top", "Keep it clean — one hero marquee sign, no scrolling tickers or 'NOW SHOWING' clutter; generous negative space.", []],
  ["living-character", "Characters must be ALIVE — walk/run gaits, startle/scream/lost emotions, speech-bubble emotes, reacting to events; never a static prop.", []],
  ["physical-weight", "Falling objects carry weight — screen shake, squash-on-impact, debris, and they visibly crush/press the character.", []],
  ["behavior-audio", "Score every video with behavior-derived SFX (impacts/footsteps/screams synced to events) + a robotic minor-key BGM bed.", []],
  ["no-cartoon-audio", "Audio is retro-arcade/robotic and cinematic — never cartoon/kids music.", ["audio-style-no-cartoon"]],
  ["alive-not-moody", "Colorful, alive, desi-maximalist — never the dark moody AI-reel cliché.", ["video-no-dark-ai-cliche"]],
  ["pixel-marquee", "Fable-5 'NOW SHOWING' marquee look: warm-black, glowing cream sign, pixel-red lettering, dot-matrix type.", []],
  ["ig-brand-gag", "Brand-feature gags land: features as physical falling objects, a mascot that suffers under them — comedic, screenshotable.", []],
  ["unlimited-scenes", "Never lean on a fixed scene menu — compose every beat fresh from cast+verbs+regions, layer elements, split the frame, use `custom` HTML or the procedural engine. No two scenes interchangeable.", []],
];

export function seedSession(reps = 3) {
  for (let r = 0; r < reps; r++)
    for (const [id, text, links] of SESSION_LESSONS) reinforce(id, text, { strength: 1, links });
  logEvent("seed", `seeded ${SESSION_LESSONS.length} session lessons ×${reps}`);
  return SESSION_LESSONS.length;
}

// ---------- CLI ----------
const [, , cmd, ...args] = process.argv;
if (cmd === "seed") console.log(`seeded ${seedSession(Number(args[0]) || 3)} lessons.`);
else if (cmd === "prompt") console.log("learned:", observePrompt(args.join(" ")));
else if (cmd === "brief") console.log(brief() || "(taste engine is empty — run: node memory/taste.mjs seed)");
else if (cmd === "dataset") console.log(exportDataset());
else if (cmd === "config") {
  const s = load();
  if (args[0] && args[1]) {
    s[args[0]] = Number(args[1]);
    save(s);
  }
  console.log({ learningRate: s.learningRate, halfLifeDays: s.halfLifeDays, signals: Object.keys(s.signals).length });
}
