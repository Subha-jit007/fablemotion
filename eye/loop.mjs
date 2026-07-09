#!/usr/bin/env node
// THE EYE — loop.mjs: the self-directing pass no other framework has.
// write → render stills → look → revise → repeat, until every beat passes
// or rounds run out. Keyless: the critic is your Claude Code login.
//
//   node eye/loop.mjs videos/my-film.json [--rounds=2] [--threshold=8]
//
// Output: <name>.eye.json (healed score), eye/out/<name>/round-N/, report.json.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateScore, isScore } from "../spec/score.mjs";
import { validateSpec } from "../spec/schema.mjs";
import { compileLegacy } from "../spec/macros.mjs";
import { lintScore, hasErrors } from "../canon/canon.mjs";
import { extractStills } from "./extract.mjs";
import { critique } from "./critique.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : def;
};

const scorePath = process.argv[2];
if (!scorePath) {
  console.error("usage: node eye/loop.mjs <score.json> [--rounds=2] [--threshold=8]");
  process.exit(1);
}
const ROUNDS = arg("rounds", 2);
const THRESHOLD = arg("threshold", 8);

const raw = JSON.parse(fs.readFileSync(scorePath, "utf8"));
let score;
if (isScore(raw)) {
  const parsed = validateScore(raw);
  if (!parsed.success) throw new Error(`invalid score: ${JSON.stringify(parsed.error.issues[0])}`);
  score = parsed.data;
} else {
  const spec = validateSpec(raw);
  if (!spec.success) throw new Error(`invalid v1 spec: ${JSON.stringify(spec.error.issues[0])}`);
  score = compileLegacy(spec.data);
  console.log("• compiled v1 spec → v2 score");
}

const name = path.basename(scorePath).replace(/\.json$/, "");
const outBase = path.join(ROOT, "eye", "out", name);
const report = { name, threshold: THRESHOLD, rounds: [] };

for (let round = 1; round <= ROUNDS; round++) {
  const lint = lintScore(score);
  if (hasErrors(lint)) {
    console.error("✗ lint errors — not rendering:", lint.filter((i) => i.level === "error"));
    process.exit(1);
  }

  const outDir = path.join(outBase, `round-${round}`);
  console.log(`— round ${round}: rendering stills…`);
  const { stills } = await extractStills(score, outDir);

  console.log(`— round ${round}: the Eye is looking (keyless, via your Claude Code login)…`);
  const verdict = await critique(score, stills, { threshold: THRESHOLD });
  report.rounds.push({ round, overall: verdict.overall, beats: verdict.beats });
  for (const b of verdict.beats) {
    const mark = b.score >= THRESHOLD ? "✓" : "✗";
    console.log(`  ${mark} beat ${b.beat}: ${b.score}/10 ${b.violations.join(", ")} ${b.note}`);
  }

  const failing = verdict.beats.filter((b) => b.score < THRESHOLD);
  if (!failing.length) {
    console.log(`✓ all beats ≥ ${THRESHOLD} — the cut is approved.`);
    break;
  }
  if (!verdict.revisedScore) {
    console.log("✗ beats failing but no valid revision returned — stopping here.");
    break;
  }
  score = verdict.revisedScore;
  console.log(`— applying the Eye's revision, going again.`);
}

const healedPath = scorePath.replace(/\.json$/, ".eye.json");
fs.writeFileSync(healedPath, JSON.stringify(score, null, 2));
fs.mkdirSync(outBase, { recursive: true });
fs.writeFileSync(path.join(outBase, "report.json"), JSON.stringify(report, null, 2));
console.log(`→ healed score: ${healedPath}`);
console.log(`→ report: ${path.join(outBase, "report.json")}`);
