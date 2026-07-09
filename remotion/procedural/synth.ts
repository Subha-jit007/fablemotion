// PROCEDURAL/synth — generateDynamicVideo(config): direct video synthesis
// from a config object, no timeline UI, no saved assets.
//
// Browser: paints every frame to a canvas and records a WebM via
//   canvas.captureStream + MediaRecorder (real-time), or yields raw frames
//   for custom encoders / live preview scrubbing.
// Node (FableMotion CLI/MCP): shells out to the Remotion renderer for a
//   pixel-perfect 60fps MP4 — same paintFrame, same determinism.
import { paintFrame, configDuration, type ProceduralConfig } from "./ProceduralVideo";

export type SynthResult =
  | { kind: "webm"; blob: Blob }
  | { kind: "frames"; frames: string[] } // base64 PNG per frame
  | { kind: "file"; path: string };

/** Draw one frame onto any canvas — the live-preview scrub hook. */
export function previewFrame(canvas: HTMLCanvasElement, config: ProceduralConfig, frame: number) {
  canvas.width = config.width;
  canvas.height = config.height;
  const g = canvas.getContext("2d");
  if (g) paintFrame(g, config, frame);
}

/** Yield every frame as a base64 PNG (buffer-matrix export path). */
export function* frameBuffers(config: ProceduralConfig): Generator<string> {
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const g = canvas.getContext("2d")!;
  const total = configDuration(config);
  for (let f = 0; f < total; f++) {
    paintFrame(g, config, f);
    yield canvas.toDataURL("image/png").split(",")[1];
  }
}

export async function generateDynamicVideo(
  config: ProceduralConfig,
  { mode = "auto" as "auto" | "webm" | "frames" } = {}
): Promise<SynthResult> {
  const inBrowser = typeof document !== "undefined";

  if (!inBrowser) {
    // Node: delegate to the Remotion renderer (see mcp render_video for the
    // spawn pattern) — kept out of this module so the browser bundle stays clean.
    throw new Error(
      "generateDynamicVideo in Node: render via `npx remotion render remotion/index.ts ProceduralVideo out.mp4 --props=<file>` — same config, same frames."
    );
  }

  if (mode === "frames") {
    return { kind: "frames", frames: [...frameBuffers(config)] };
  }

  // WebM via MediaRecorder: drive the canvas at the config fps in real time.
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const g = canvas.getContext("2d")!;
  const stream = canvas.captureStream(config.fps);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const total = configDuration(config);
  return new Promise((resolve) => {
    rec.onstop = () => resolve({ kind: "webm", blob: new Blob(chunks, { type: "video/webm" }) });
    rec.start();
    let f = 0;
    const tick = () => {
      paintFrame(g, config, f);
      f++;
      if (f < total) setTimeout(tick, 1000 / config.fps);
      else rec.stop();
    };
    tick();
  });
}
