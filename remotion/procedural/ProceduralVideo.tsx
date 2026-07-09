// PROCEDURAL/ProceduralVideo — the unified render pipeline. One JSON config in,
// deterministic canvas frames out. No saved assets, no pre-baked scenes:
// text is bitmap math, scenery is loops, characters are matrices, motion is
// physics-lookup + trig. Runs identically in the Remotion renderer, the
// <Player>, and generateDynamicVideo()'s browser recorder.
import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame, Audio, Sequence, staticFile } from "remotion";
import { deriveCues } from "./audio";
import { timelineFor, landings, type PhysicsConfig, type Landing } from "./physics";
import {
  drawMarquee,
  drawScenery,
  drawSprite,
  drawPixelText,
  measurePixelText,
  type Ctx2D,
  type MarqueeSpec,
  type ScenerySpec,
  type SpriteSpec,
} from "./sprites";
import { igBotMatrices } from "./presets";
import { progress, EASE } from "./anim";

// ---------- config schema (all data — safe to ship as JSON) ----------

export type BoxStyle = {
  depth: number; // isometric extrusion in px
  palette: string[]; // face colors cycled per box
  textColor: string;
  cell: number; // label pixel size
};

export type SpriteConfig =
  | (Omit<SpriteSpec, "matrixStates" | "palette"> & { preset: "ig-bot" })
  | SpriteSpec;

export type ProceduralConfig = {
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
  background: {
    color: string;
    dotGrid?: { gap: number; radius: number; color: string; opacity: number };
    scanlines?: { gap: number; opacity: number };
  };
  scenery?: ScenerySpec[];
  marquees?: MarqueeSpec[];
  physics?: PhysicsConfig & { style: BoxStyle };
  sprites?: SpriteConfig[];
};

export const configDuration = (c: ProceduralConfig) => Math.round(c.fps * c.durationInSeconds);

// ---------- background styles ----------

function drawBackground(g: Ctx2D, c: ProceduralConfig) {
  g.fillStyle = c.background.color;
  g.fillRect(0, 0, c.width, c.height);
  const dg = c.background.dotGrid;
  if (dg) {
    g.save();
    g.globalAlpha = dg.opacity;
    g.fillStyle = dg.color;
    for (let y = dg.gap / 2; y < c.height; y += dg.gap)
      for (let x = dg.gap / 2; x < c.width; x += dg.gap) g.fillRect(x, y, dg.radius, dg.radius);
    g.restore();
  }
}

/** CRT scanlines go on TOP of everything — it's a screen, not a wall. */
function drawScanlines(g: Ctx2D, c: ProceduralConfig) {
  const sl = c.background.scanlines;
  if (!sl) return;
  g.save();
  g.globalAlpha = sl.opacity;
  g.fillStyle = "#000000";
  for (let y = 0; y < c.height; y += sl.gap) g.fillRect(0, y, c.width, Math.max(1, sl.gap * 0.4));
  g.restore();
}

// ---------- the falling feature boxes ----------

function drawBoxes(g: Ctx2D, c: ProceduralConfig, frame: number) {
  const p = c.physics;
  if (!p) return;
  const total = configDuration(c);
  const timeline = timelineFor(p, total, c.width);
  const states = timeline[Math.min(frame, timeline.length - 1)];
  const landFrame = new Map(landings(p, total, c.width).map((L) => [L.box, L.frame]));

  p.boxes.forEach((box, i) => {
    const s = states[i];
    if (!s.alive) return;
    const { depth, palette, textColor, cell } = p.style;
    const face = palette[i % palette.length];
    const x = s.x - box.w / 2;
    const y = s.y - box.h / 2;
    // pop-in scale for the first few frames after spawn
    const pop = progress(frame, box.spawnFrame, 10, EASE.outCubic);
    // impact squash: on landing, the block flattens then springs back (weight)
    const landed = landFrame.get(i);
    const age = landed != null ? frame - landed : -1;
    let sqx = 1;
    let sqy = 1;
    if (age >= 0 && age < 8) {
      const k = age / 8;
      sqy = 0.72 + 0.28 * EASE.outBack(k);
      sqx = 1.22 - 0.22 * EASE.outBack(k);
    }
    g.save();
    // squash anchored at the block's bottom edge (it slams DOWN, not centered)
    g.translate(s.x, s.y + box.h / 2);
    g.scale(pop * sqx, pop * sqy);
    g.translate(-s.x, -(s.y + box.h / 2));

    // isometric extrusion: top face (lighter) and side face (darker), then front
    g.fillStyle = shade(face, 1.25);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + depth, y - depth);
    g.lineTo(x + box.w + depth, y - depth);
    g.lineTo(x + box.w, y);
    g.closePath();
    g.fill();
    g.fillStyle = shade(face, 0.6);
    g.beginPath();
    g.moveTo(x + box.w, y);
    g.lineTo(x + box.w + depth, y - depth);
    g.lineTo(x + box.w + depth, y + box.h - depth);
    g.lineTo(x + box.w, y + box.h);
    g.closePath();
    g.fill();
    g.fillStyle = face;
    g.fillRect(x, y, box.w, box.h);

    const m = measurePixelText(box.label, cell);
    drawPixelText(g, box.label, s.x, s.y - m.height / 2, cell, textColor);
    g.restore();
  });
}

/** Multiply a hex color's channels — cheap top/side face shading. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.min(255, Math.round(v * k));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// ---------- impact FX: screen shake + debris on every landing ----------

/** Sum of decaying jolts from boxes that landed in the last few frames.
 *  sy is biased DOWNWARD — the screen punches down when weight slams in. */
function shakeOffset(c: ProceduralConfig, frame: number): { sx: number; sy: number } {
  if (!c.physics) return { sx: 0, sy: 0 };
  let sx = 0;
  let sy = 0;
  for (const L of landings(c.physics, configDuration(c), c.width)) {
    const age = frame - L.frame;
    if (age < 0 || age >= 9) continue;
    const decay = 1 - age / 9;
    const mag = (L.heavy ? 17 : 9) * decay;
    sx += Math.sin(age * 3.1) * mag * (L.box % 2 ? 1 : -1);
    sy += Math.abs(Math.cos(age * 2.3)) * mag * 0.85; // downward jolt
  }
  return { sx, sy };
}

/** Debris pixels flung up-and-out from each fresh impact, arced by gravity. */
function drawImpactDebris(g: Ctx2D, c: ProceduralConfig, frame: number) {
  if (!c.physics) return;
  const cell = c.physics.style.cell;
  for (const L of landings(c.physics, configDuration(c), c.width)) {
    const age = frame - L.frame;
    if (age < 0 || age > 16) continue;
    const count = L.heavy ? 9 : 6;
    for (let k = 0; k < count; k++) {
      const dir = (k / count) * Math.PI - Math.PI; // fan upward
      const speed = (L.heavy ? 7 : 5) + (k % 3);
      const px = L.x + Math.cos(dir) * speed * age;
      const py = L.y + Math.sin(dir) * speed * age + 0.32 * age * age; // gravity
      if (py > L.y + 6) continue; // fallen back to the ground
      g.save();
      g.globalAlpha = Math.max(0, 1 - age / 16);
      g.fillStyle = k % 2 ? "#F5EDD6" : c.physics.style.palette[L.box % c.physics.style.palette.length];
      const sz = cell * (1 - age / 22);
      g.fillRect(px, py, sz, sz);
      g.restore();
    }
  }
}

// ---------- sprite config resolution ----------

function resolveSprite(sc: SpriteConfig): SpriteSpec {
  if ("preset" in sc && sc.preset === "ig-bot") {
    const { preset, ...rest } = sc;
    return { ...igBotMatrices(), ...rest };
  }
  return sc as SpriteSpec;
}

// ---------- frame painter (pure: ctx + config + frame) ----------

export function paintFrame(g: Ctx2D, c: ProceduralConfig, frame: number) {
  drawBackground(g, c); // fixed screen — shake happens to the world inside it
  const { sx, sy } = shakeOffset(c, frame);
  g.save();
  g.translate(sx, sy);
  for (const s of c.scenery ?? []) drawScenery(g, s);
  for (const sc of c.sprites ?? []) drawSprite(g, resolveSprite(sc), frame, "body");
  drawBoxes(g, c, frame);
  drawImpactDebris(g, c, frame);
  for (const sc of c.sprites ?? []) drawSprite(g, resolveSprite(sc), frame, "emotes"); // bubbles over the pile
  for (const m of c.marquees ?? []) drawMarquee(g, m, frame);
  g.restore();
  drawScanlines(g, c);
}

// ---------- behavior-driven audio (see audio.ts) ----------

const AudioTrack: React.FC<{ config: ProceduralConfig }> = ({ config }) => {
  const cues = useMemo(() => deriveCues(config), [config]);
  return (
    <>
      {/* robotic BGM bed, looped low under the whole film */}
      <Audio src={staticFile("audio/bgm.wav")} volume={0.16} loop />
      {cues.map((cue, i) => (
        <Sequence key={i} from={cue.frame} name={cue.sound}>
          <Audio src={staticFile(`audio/${cue.sound}.wav`)} volume={cue.volume} playbackRate={cue.rate ?? 1} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- Remotion composition ----------

export const ProceduralVideo: React.FC<{ config: ProceduralConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g) paintFrame(g, config, frame);
  }, [frame, config]);
  return (
    <>
      <canvas
        ref={ref}
        width={config.width}
        height={config.height}
        style={{ width: "100%", height: "100%" }}
      />
      <AudioTrack config={config} />
    </>
  );
};
