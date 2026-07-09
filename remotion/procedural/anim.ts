// PROCEDURAL/anim — keyframe-less parameterized animation primitives.
// Everything is a pure function of the frame index: no delta-time, no stored
// state, so any frame can be rendered in isolation (Remotion seeks freely).

export type Easing = (t: number) => number;

export const EASE: Record<string, Easing> = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  outElastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Normalized progress of `frame` through [start, start+duration], eased. */
export const progress = (frame: number, start: number, duration: number, ease: Easing = EASE.outCubic) =>
  ease(Math.min(1, Math.max(0, (frame - start) / duration)));

/** Square-wave blink: on for `duty` of every `rate` frames. `frame % blinkRate` generalized. */
export const blink = (frame: number, rate: number, duty = 0.6) => (frame % rate) / rate < duty;

/** Trigonometric float: baseline + sin(frame·frequency)·amplitude. */
export const floatSin = (frame: number, baseline: number, amplitude: number, frequency: number, phase = 0) =>
  baseline + Math.sin(frame * frequency + phase) * amplitude;

/** Deterministic seeded RNG (mulberry32) — same seed, same video, forever. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Piecewise-linear value along {at, x} keypoints. Pure in frame. */
export function pathX(path: { at: number; x: number }[] | undefined, fallback: number, frame: number) {
  if (!path?.length) return fallback;
  if (frame <= path[0].at) return path[0].x;
  for (let i = 1; i < path.length; i++) {
    if (frame <= path[i].at) {
      const a = path[i - 1];
      const b = path[i];
      const t = (frame - a.at) / Math.max(1, b.at - a.at);
      return a.x + (b.x - a.x) * t;
    }
  }
  return path[path.length - 1].x;
}

/** Frame-indexed state machine: pick the latest state whose `at` has passed. */
export const stateAt = (frame: number, timeline: { at: number; name: string }[], fallback: string) => {
  let current = fallback;
  for (const s of timeline) if (frame >= s.at) current = s.name;
  return current;
};
