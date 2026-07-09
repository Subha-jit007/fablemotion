// FABLEMOTION PSYCHOLOGY — why choices feel the way they feel.
// Machine-readable so the director agent composes with it and THE EYE judges with it.
// Four dimensions: font, color, image, motion(video). Each mood profile picks from them.

export const FONT_PSYCHOLOGY = {
  serif: "authority, warmth, editorial trust — reads as a considered statement, not an ad",
  sans: "clarity, modernity, neutrality — best for labels, kickers, metadata; never the hero",
  mono: "precision, honesty, engineering — code, numbers, receipts; proof over persuasion",
  pixel: "nostalgia, play, arcade memory — disarms the viewer; premium when lit like a marquee",
  italic: "emphasis with a human voice — one accented word reads as intent, a full line as noise",
};

export const COLOR_PSYCHOLOGY = {
  warmBlack: "#0D0B09-type near-blacks feel like cinema, not doom — warmth keeps dark playful",
  cream: "paper/ivory signals craft, honesty, print heritage — the anti-neon",
  clay: "Anthropic clay/coral = warmth + energy without alarm; the friendly accent",
  red: "urgency and appetite; one red element per beat commands, two compete",
  blue: "trust and calm; cools a hot composition, use as the counterweight accent2",
  saturationLaw: "one saturated accent per beat; the eye follows the loudest color first",
  darkLaw: "dark bg is allowed only when warm-toned and playful — never cold gray-blue moody",
};

export const IMAGE_PSYCHOLOGY = {
  cutout: "chroma-key cutouts read as objects in the room — more real than framed rectangles",
  halftone: "dot-matrix/halftone imagery feels hand-made and mechanical at once; hides fidelity, adds charm",
  mascot: "a recurring character (crab, pig) builds parasocial memory across videos — brand as friend",
  scale: "one oversized element per beat creates hierarchy instantly; equal sizes = no story",
  negativeSpace: "emptiness signals confidence; a crowded frame begs, a sparse frame states",
};

export const MOTION_PSYCHOLOGY = {
  snap: "fast spring-in = confidence, punchlines, reveals",
  settle: "critically-damped ease = calm authority; use for closing statements",
  drift: "slow growth = anticipation; counters and charts earn their number",
  holdRhythm: "a rest beat after two punches resets attention; relentless pace numbs",
  cutVsFade: "hard cuts feel decisive and musical; fades feel reflective — pick per mood, don't mix per beat",
  entranceDirection: "up-enter = optimism/arrival, down-enter = weight/verdict, side = comparison",
};

// ---------- mood profiles — meta.mood targets THE EYE judges against ----------

export const MOODS = {
  launch: {
    feels: "an event; something new just arrived",
    fonts: { hero: "serif", labels: "sans", proof: "mono" },
    theme: "paper or marquee",
    motion: { primary: "snap", cuts: "hard on beats", rhythm: "punch-heavy, one rest" },
    imagery: "one oversized hero element, cutouts over frames",
  },
  playful: {
    feels: "a toy you want to touch",
    fonts: { hero: "pixel", labels: "sans" },
    theme: "candy or marquee",
    motion: { primary: "pop", cuts: "hard", rhythm: "short punches, bouncy enters" },
    imagery: "mascot + halftone; saturated single accents",
  },
  premium: {
    feels: "quiet money; nothing to prove",
    fonts: { hero: "serif", labels: "sans" },
    theme: "paper or ink",
    motion: { primary: "settle", cuts: "fades", rhythm: "long builds, generous rests" },
    imagery: "negative space, one accent, no clutter",
  },
  technical: {
    feels: "a demo by someone who built it",
    fonts: { hero: "mono", labels: "sans", statements: "serif" },
    theme: "ink or paper",
    motion: { primary: "rise", cuts: "hard", rhythm: "build-build-reveal" },
    imagery: "code, charts, real numbers — receipts over adjectives",
  },
  nostalgic: {
    feels: "arcade memory, saturday cartoons, warm static",
    fonts: { hero: "pixel", labels: "mono" },
    theme: "marquee",
    motion: { primary: "pop", cuts: "hard", rhythm: "steady, song-like" },
    imagery: "halftone, marquee glow, pixel mascot",
  },
  urgent: {
    feels: "now or never — but never panicked",
    fonts: { hero: "serif", labels: "sans" },
    theme: "candy or marquee",
    motion: { primary: "snap", cuts: "hard", rhythm: "punch-punch-rest" },
    imagery: "red accent discipline: exactly one red thing per beat",
  },
};

/** Compact brief for prompts (agent + Eye): the psychology of one mood. */
export function moodBrief(mood) {
  const m = MOODS[mood];
  if (!m) return "";
  return [
    `MOOD "${mood}" — ${m.feels}.`,
    `Fonts: ${JSON.stringify(m.fonts)} · Theme: ${m.theme}`,
    `Motion: ${m.motion.primary} enters, ${m.motion.cuts}, rhythm ${m.motion.rhythm}`,
    `Imagery: ${m.imagery}`,
  ].join("\n");
}
