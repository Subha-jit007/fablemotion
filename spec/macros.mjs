// FABLEMOTION MACROS — the v1 scene types, re-expressed as Score fragments.
// Proof that the 9 types were compositions all along. compileLegacy() keeps every
// existing videos/*.json working on the v2 stage unchanged.
import { validateScore } from "./score.mjs";

const INTENT_FOR = {
  title: "hook", kinetic: "punch", statement: "build", counter: "reveal",
  list: "build", code: "build", chart: "reveal", compare: "reveal", logo: "outro",
};

// Each macro: (scene, idPrefix) → { cast: {id→element}, beats: [beat] }
const MACROS = {
  title: (s, p) => ({
    cast: {
      [`${p}rule`]: { kind: "shape", shape: "rule", size: 120 },
      [`${p}t`]: { kind: "text", role: "display", content: s.text, accent: "last-word" },
      ...(s.sub ? { [`${p}sub`]: { kind: "text", role: "caption", content: s.sub } } : {}),
    },
    beats: [{
      intent: "hook", durationInFrames: s.durationInFrames,
      moves: [
        { verb: "enter", cast: `${p}rule`, ease: "rise", delay: 8 },
        { verb: "enter", cast: `${p}t`, ease: "spring", dir: "up" },
        ...(s.sub ? [{ verb: "enter", cast: `${p}sub`, ease: "settle", delay: 18, dir: "up" }] : []),
      ],
    }],
  }),

  // one punch beat per word — the cycling was always beats in disguise
  kinetic: (s, p) => {
    const per = Math.max(15, Math.floor(s.durationInFrames / s.words.length));
    const cast = {}, beats = [];
    s.words.forEach((w, i) => {
      cast[`${p}w${i}`] = {
        kind: "text", role: "mega", content: w,
        accent: i % 2 === 1 ? "all" : "none",
      };
      beats.push({
        intent: "punch", durationInFrames: per, transition: "cut",
        moves: [{ verb: "enter", cast: `${p}w${i}`, ease: "snap" }],
      });
    });
    return { cast, beats };
  },

  statement: (s, p) => ({
    cast: {
      [`${p}t`]: {
        kind: "text", role: "headline", content: s.lines.join("\n"), align: "left",
        accent: s.accentLine != null ? `line:${s.accentLine}` : "none",
      },
    },
    beats: [{
      intent: "build", durationInFrames: s.durationInFrames,
      moves: [{ verb: "enter", cast: `${p}t`, ease: "rise", dir: "up" }],
    }],
  }),

  counter: (s, p) => ({
    cast: {
      [`${p}n`]: {
        kind: "counter", value: s.value, label: s.label,
        prefix: s.prefix, suffix: s.suffix, decimals: s.decimals ?? 0,
      },
    },
    beats: [{
      intent: "reveal", durationInFrames: s.durationInFrames,
      moves: [{ verb: "enter", cast: `${p}n`, ease: "drift" }],
    }],
  }),

  list: (s, p) => ({
    cast: {
      ...(s.title ? { [`${p}k`]: { kind: "text", role: "kicker", content: s.title } } : {}),
      [`${p}l`]: { kind: "list", items: s.items },
    },
    beats: [{
      intent: "build", durationInFrames: s.durationInFrames,
      moves: [
        ...(s.title ? [{ verb: "enter", cast: `${p}k`, ease: "settle", at: "top" }] : []),
        { verb: "enter", cast: `${p}l`, ease: "rise", delay: 10, dir: "left" },
      ],
    }],
  }),

  code: (s, p) => ({
    cast: { [`${p}c`]: { kind: "code", code: s.code, title: s.title } },
    beats: [{
      intent: "build", durationInFrames: s.durationInFrames,
      moves: [{ verb: "enter", cast: `${p}c`, ease: "settle" }],
    }],
  }),

  chart: (s, p) => ({
    cast: {
      ...(s.title ? { [`${p}k`]: { kind: "text", role: "kicker", content: s.title } } : {}),
      [`${p}g`]: { kind: "chart", data: s.data },
    },
    beats: [{
      intent: "reveal", durationInFrames: s.durationInFrames,
      moves: [
        ...(s.title ? [{ verb: "enter", cast: `${p}k`, ease: "settle", at: "top" }] : []),
        { verb: "enter", cast: `${p}g`, ease: "rise", delay: 8 },
      ],
    }],
  }),

  compare: (s, p) => ({
    cast: {
      ...(s.title ? { [`${p}k`]: { kind: "text", role: "kicker", content: s.title } } : {}),
      [`${p}v`]: { kind: "compare", left: s.left, right: s.right },
    },
    beats: [{
      intent: "reveal", durationInFrames: s.durationInFrames,
      moves: [
        ...(s.title ? [{ verb: "enter", cast: `${p}k`, ease: "settle", at: "top" }] : []),
        { verb: "enter", cast: `${p}v`, ease: "rise", delay: 6 },
      ],
    }],
  }),

  logo: (s, p) => ({
    cast: {
      [`${p}ring`]: { kind: "shape", shape: "ring", size: 620 },
      [`${p}t`]: { kind: "text", role: "display", content: s.text },
      ...(s.tagline ? { [`${p}tag`]: { kind: "text", role: "kicker", content: s.tagline } } : {}),
    },
    beats: [{
      intent: "outro", durationInFrames: s.durationInFrames,
      moves: [
        { verb: "enter", cast: `${p}ring`, ease: "drift", delay: 4 },
        { verb: "enter", cast: `${p}t`, ease: "pop" },
        ...(s.tagline ? [{ verb: "enter", cast: `${p}tag`, ease: "settle", delay: 20, dir: "up" }] : []),
      ],
    }],
  }),
};

/** v1 Spec → v2 Score. Throws if the result doesn't validate (it must). */
export function compileLegacy(spec) {
  const cast = {};
  const beats = [];
  spec.scenes.forEach((scene, i) => {
    const frag = MACROS[scene.type](scene, `s${i}-`);
    Object.assign(cast, frag.cast);
    beats.push(...frag.beats);
  });
  const score = {
    version: 2,
    meta: {
      title: spec.title,
      format: spec.format ?? "landscape",
      fps: spec.fps ?? 30,
      theme: spec.theme ?? { preset: "paper" },
      backdrop: spec.backdrop ?? "drift",
    },
    cast,
    acts: [{ name: "main", beats }],
  };
  const parsed = validateScore(score);
  if (!parsed.success) {
    throw new Error(`compileLegacy produced invalid score: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export { INTENT_FOR, MACROS };
