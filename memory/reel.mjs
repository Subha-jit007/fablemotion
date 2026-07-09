// REEL MEMORY — local self-healing. Everything here lives in the user's clone,
// is gitignored, and never leaves the machine. Your data trains YOUR copy:
// approved work becomes few-shot taste, lessons become standing preferences,
// your assets become the director's props closet, failures become known fixes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brief as tasteBrief } from "./taste.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REEL_DIR = path.join(ROOT, "memory", "reel");
const SCORES = path.join(REEL_DIR, "scores");
const PREFS = path.join(REEL_DIR, "preferences.md");
const FIXES = path.join(REEL_DIR, "fixes.json");
const ASSETS = path.join(REEL_DIR, "assets.json");

const ensure = () => fs.mkdirSync(SCORES, { recursive: true });
const readJson = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
};

/** Record an approved video + its Eye verdict. This is how taste compounds. */
export function approve(name, score, verdict = null) {
  ensure();
  const entry = { name, approvedAt: new Date().toISOString(), overall: verdict?.overall ?? null, score, verdict };
  fs.writeFileSync(path.join(SCORES, `${name}.json`), JSON.stringify(entry, null, 2));
  return entry;
}

/** Append a standing lesson (from a user correction or explicit feedback). */
export function learn(lesson) {
  ensure();
  fs.appendFileSync(PREFS, `- ${lesson.trim().replace(/\n/g, " ")} (${new Date().toISOString().slice(0, 10)})\n`);
}

/** Failure fingerprints → fixes that worked. Runtime self-healing. */
export function recordFix(fingerprint, fix) {
  ensure();
  const fixes = readJson(FIXES, {});
  fixes[fingerprint] = { fix, at: new Date().toISOString() };
  fs.writeFileSync(FIXES, JSON.stringify(fixes, null, 2));
}
export const knownFix = (fingerprint) => readJson(FIXES, {})[fingerprint]?.fix ?? null;

/** Index the user's own media in public/ (renders excluded) — the props closet. */
export function indexAssets() {
  ensure();
  const found = [];
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.name === "renders" || f.name.startsWith(".")) continue;
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p, `${rel}${f.name}/`);
      else if (/\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(f.name))
        found.push({ src: `/${rel}${f.name}`, bytes: fs.statSync(p).size });
    }
  };
  const pub = path.join(ROOT, "public");
  if (fs.existsSync(pub)) walk(pub, "");
  fs.writeFileSync(ASSETS, JSON.stringify(found, null, 2));
  return found;
}

/** Top-k approved scores by Eye rating — few-shot examples of this user's taste. */
export function winners(k = 2) {
  if (!fs.existsSync(SCORES)) return [];
  return fs
    .readdirSync(SCORES)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(SCORES, f), null))
    .filter(Boolean)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, k);
}

/**
 * brief() — the self-healing block injected into every director prompt.
 * Empty string on a fresh clone; grows as this user works. Never uploaded.
 */
export function brief({ k = 2 } = {}) {
  const parts = [];
  if (fs.existsSync(PREFS)) {
    const prefs = fs.readFileSync(PREFS, "utf8").trim();
    if (prefs) parts.push(`STANDING PREFERENCES (learned from this user — obey them):\n${prefs}`);
  }
  const assets = readJson(ASSETS, []);
  if (assets.length)
    parts.push(
      `USER ASSETS available for media cast (prefer these over placeholders):\n${assets
        .slice(0, 20)
        .map((a) => `- ${a.src}`)
        .join("\n")}`
    );
  const top = winners(k);
  if (top.length)
    parts.push(
      `PAST APPROVED WORK (this user's taste — imitate its instincts, not its content):\n${top
        .map((w) => `### ${w.name} (eye ${w.overall ?? "?"}/10)\n\`\`\`json\n${JSON.stringify(w.score)}\n\`\`\``)
        .join("\n")}`
    );
  const body = parts.length ? `\n\n=== REEL MEMORY (local, private, self-learned) ===\n${parts.join("\n\n")}` : "";
  // the adaptive Taste Engine's directives ride along on every prompt
  return body + tasteBrief();
}

// CLI: node memory/reel.mjs learn "lesson" | approve <videos/x.json> | assets
const [, , cmd, ...args] = process.argv;
if (cmd === "learn" && args[0]) {
  learn(args.join(" "));
  console.log("learned.");
} else if (cmd === "approve" && args[0]) {
  const file = path.resolve(args[0]);
  const name = path.basename(file).replace(/\.json$/, "");
  approve(name, JSON.parse(fs.readFileSync(file, "utf8")));
  console.log(`approved ${name} into reel memory.`);
} else if (cmd === "assets") {
  console.log(indexAssets());
}
