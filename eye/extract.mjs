// THE EYE — extract.mjs: render a Score once (half scale) and pull one still
// per beat at its visual peak (~62% in). Zero-dep besides remotion + ffmpeg.
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { flattenBeats } from "../spec/score.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, windowsHide: true, cwd: ROOT, ...opts });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`))
    );
  });

/** Beat peak frames: start + 62% of duration (springs have settled, pre-exit). */
export function peakFrames(score) {
  const peaks = [];
  let start = 0;
  for (const beat of flattenBeats(score)) {
    peaks.push(start + Math.min(beat.durationInFrames - 3, Math.round(beat.durationInFrames * 0.62)));
    start += beat.durationInFrames;
  }
  return peaks;
}

/**
 * extractStills(score, outDir) → { stills: [{beat, frame, path}], video }
 * Renders at 0.5 scale for speed; stills are plenty for a taste critique.
 */
export async function extractStills(score, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const propsFile = path.join(os.tmpdir(), `fm-eye-props-${Date.now()}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ score }));
  const video = path.join(outDir, "eye-preview.mp4");

  await run("npx", [
    "remotion", "render", "remotion/index.ts", "ScoreVideo",
    JSON.stringify(video), `--props=${JSON.stringify(propsFile)}`, "--scale=0.5", "--log=error",
  ]);

  const peaks = peakFrames(score);
  const select = peaks.map((f) => `eq(n\\,${f})`).join("+");
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-i", JSON.stringify(video),
    "-vf", `"select='${select}'"`, "-vsync", "0",
    JSON.stringify(path.join(outDir, "beat-%d.png")),
  ]);

  fs.rmSync(propsFile, { force: true });
  return {
    video,
    stills: peaks.map((frame, i) => ({
      beat: i,
      frame,
      path: path.join(outDir, `beat-${i + 1}.png`),
    })),
  };
}
