// FABLEMOTION CANON — the taste constitution.
// Tokens are the only vocabulary a Score may use; laws are machine-checkable rules.
// Pure functions, no I/O: lintScore(score) is deterministic and unit-testable.
import { FORMATS, THEME_PRESETS } from "../spec/schema.mjs";

export { FORMATS, THEME_PRESETS };

// ---------- tokens ----------

// Named spring configs — the proven v1 feel, now addressable by name.
export const EASINGS = {
  settle: { damping: 200 },
  spring: { damping: 16, stiffness: 130, mass: 0.6 },
  snap: { damping: 13, stiffness: 170, mass: 0.7 },
  rise: { damping: 20, stiffness: 110 },
  drift: { damping: 44, stiffness: 40 },
  pop: { damping: 14, stiffness: 120, mass: 0.8 },
};

// Type roles in px at landscape scale; STAGE multiplies by format factor.
export const TYPE_SCALE = {
  mega: 220,
  display: 130,
  headline: 96,
  body: 58,
  caption: 34,
  kicker: 26,
};

export const FORMAT_TYPE_FACTOR = { landscape: 1, portrait: 0.82, square: 0.9 };

// Layout regions — a Score never speaks in pixels.
export const REGIONS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

// Frames at 30fps; scaled by fps/30 at lint time.
export const BEAT_BANDS = {
  hook: [40, 110],
  build: [60, 200],
  reveal: [45, 160],
  punch: [18, 80],
  rest: [30, 100],
  outro: [45, 170],
};

export const INTENTS = Object.keys(BEAT_BANDS);
export const VERBS = ["enter", "exit", "emphasize", "hold"];

// ---------- laws ----------

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const flatBeats = (score) => score.acts.flatMap((a) => a.beats);

/**
 * lintScore(score) → issues[{ law, level: "error"|"warn", beat, msg }]
 * `beat` is the flattened beat index, or -1 for score-level issues.
 * Errors mean "do not render"; warns mean "the Eye should look hard here".
 */
export function lintScore(score) {
  const issues = [];
  const push = (law, level, beat, msg) => issues.push({ law, level, beat, msg });
  const beats = flatBeats(score);
  const fpsScale = (score.meta.fps ?? 30) / 30;

  // contrast — resolved theme fg on bg must pass 4.5:1
  const preset = THEME_PRESETS[score.meta.theme?.preset ?? "paper"];
  const theme = { ...preset, ...(score.meta.theme?.colors ?? {}) };
  if (contrastRatio(theme.fg, theme.bg) < 4.5)
    push("contrast", "error", -1, `fg/bg contrast ${contrastRatio(theme.fg, theme.bg).toFixed(2)} < 4.5`);

  let punchRun = 0;
  beats.forEach((beat, i) => {
    // empty-beat
    if (!beat.moves.length) push("empty-beat", "error", i, "beat has no moves");

    // cast-refs — every move points at declared cast
    for (const m of beat.moves)
      if (!score.cast[m.cast])
        push("cast-ref", "error", i, `move references unknown cast "${m.cast}"`);

    // max-visible-cast
    const visible = new Set(beat.moves.filter((m) => m.verb !== "exit").map((m) => m.cast));
    if (visible.size > 5)
      push("max-visible-cast", "error", i, `${visible.size} elements on screen (max 5)`);

    // duration-band per intent
    const [lo, hi] = BEAT_BANDS[beat.intent].map((f) => Math.round(f * fpsScale));
    if (beat.durationInFrames < lo || beat.durationInFrames > hi)
      push("duration-band", "warn", i,
        `${beat.intent} beat is ${beat.durationInFrames}f, band is ${lo}–${hi}f`);

    // accent-discipline — at most 2 emphasized elements per beat
    const emphasized = beat.moves.filter((m) => m.verb === "emphasize").length;
    if (emphasized > 2)
      push("accent-discipline", "warn", i, `${emphasized} emphasize moves (max 2)`);

    // punch-fatigue — three punches need a rest
    punchRun = beat.intent === "punch" ? punchRun + 1 : 0;
    if (punchRun === 3) push("punch-fatigue", "warn", i, "3 consecutive punch beats; add a rest");

    // orphan cast — referenced cast should enter or hold in this beat
    for (const id of visible) {
      const anchored = beat.moves.some(
        (m) => m.cast === id && (m.verb === "enter" || m.verb === "hold")
      );
      if (!anchored)
        push("orphan-cast", "warn", i, `"${id}" is used but never enters/holds in this beat`);
    }
  });

  // copy-discipline — terse text, always
  for (const [id, el] of Object.entries(score.cast)) {
    if (el.kind === "text" && (el.role === "mega" || el.role === "display")) {
      const longest = Math.max(...el.content.split(/\s+/).map((w) => w.length));
      if (el.role === "mega" && longest > 16)
        push("copy-discipline", "warn", -1, `cast "${id}": mega word "${longest} chars" won't fit`);
      if (el.content.length > 90)
        push("copy-discipline", "warn", -1, `cast "${id}": ${el.role} copy over 90 chars`);
    }
  }

  return issues;
}

export const hasErrors = (issues) => issues.some((i) => i.level === "error");
