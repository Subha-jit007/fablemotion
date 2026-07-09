// M1 acceptance: Score IR validates, CANON lints, legacy specs compile losslessly.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSpec } from "../spec/schema.mjs";
import { validateScore, totalDuration, flattenBeats, isScore } from "../spec/score.mjs";
import { compileLegacy } from "../spec/macros.mjs";
import { lintScore, hasErrors, contrastRatio, THEME_PRESETS } from "../canon/canon.mjs";
import { MOODS, moodBrief } from "../canon/psychology.mjs";

const VIDEOS = join(import.meta.dirname, "..", "videos");

test("every bundled v1 video compiles to a valid, lint-clean Score", () => {
  const files = readdirSync(VIDEOS).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 4, "expected bundled videos");
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(VIDEOS, f), "utf8"));
    let score;
    if (isScore(raw)) {
      const parsed = validateScore(raw);
      assert.ok(parsed.success, `${f} is not a valid v2 score: ${JSON.stringify(parsed.error?.issues?.[0])}`);
      score = parsed.data;
    } else {
      const spec = validateSpec(raw);
      assert.ok(spec.success, `${f} is not a valid v1 spec`);
      score = compileLegacy(spec.data);
    }
    assert.equal(score.version, 2);
    assert.ok(totalDuration(score) > 0);
    const issues = lintScore(score);
    assert.ok(!hasErrors(issues), `${f}: ${JSON.stringify(issues.filter(i => i.level === "error"))}`);
  }
});

test("kinetic scenes become one punch beat per word", () => {
  const spec = validateSpec({
    title: "k", scenes: [{ type: "kinetic", words: ["A.", "B.", "C."], durationInFrames: 90 }],
  }).data;
  const beats = flattenBeats(compileLegacy(spec));
  assert.equal(beats.length, 3);
  assert.ok(beats.every((b) => b.intent === "punch" && b.transition === "cut"));
});

test("lint catches unknown cast references", () => {
  const score = validateScore({
    version: 2, meta: { title: "x" },
    cast: { hero: { kind: "text", role: "display", content: "Hi" } },
    acts: [{ beats: [{ intent: "hook", durationInFrames: 60, moves: [{ verb: "enter", cast: "ghost" }] }] }],
  });
  assert.ok(score.success);
  const issues = lintScore(score.data);
  assert.ok(issues.some((i) => i.law === "cast-ref" && i.level === "error"));
});

test("lint catches crowding, low contrast, and punch fatigue", () => {
  const cast = {};
  const moves = [];
  for (let i = 0; i < 6; i++) {
    cast[`c${i}`] = { kind: "text", role: "body", content: `x${i}` };
    moves.push({ verb: "enter", cast: `c${i}` });
  }
  const punch = { intent: "punch", durationInFrames: 30, moves: [{ verb: "enter", cast: "c0" }] };
  const score = validateScore({
    version: 2,
    meta: { title: "bad", theme: { preset: "paper", colors: { fg: "#EEE8DC" } } }, // fg ≈ bg
    cast,
    acts: [{ beats: [{ intent: "build", durationInFrames: 90, moves }, punch, punch, punch] }],
  });
  assert.ok(score.success);
  const issues = lintScore(score.data);
  assert.ok(issues.some((i) => i.law === "max-visible-cast" && i.level === "error"));
  assert.ok(issues.some((i) => i.law === "contrast" && i.level === "error"));
  assert.ok(issues.some((i) => i.law === "punch-fatigue"));
});

test("marquee preset passes contrast law", () => {
  const t = THEME_PRESETS.marquee;
  assert.ok(contrastRatio(t.fg, t.bg) >= 4.5);
});

test("every mood profile renders a brief", () => {
  for (const mood of Object.keys(MOODS)) {
    assert.ok(moodBrief(mood).includes(`"${mood}"`));
  }
});
