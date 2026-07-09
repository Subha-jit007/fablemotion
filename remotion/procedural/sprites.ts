// PROCEDURAL/sprites — decoupled canvas painters. Every class renders from a
// data schema + frame index. No images, no saved assets: text is the 5×7
// bitmap font, characters are integer matrices, scenery is math and loops.
import { GLYPHS } from "../ScoreVideo";
import { blink, floatSin, progress, EASE, stateAt, pathX } from "./anim";

export type Ctx2D = CanvasRenderingContext2D;

// ---------- pixel text (shared by everything) ----------

export function measurePixelText(text: string, cell: number) {
  const gapX = cell * 0.28;
  const charW = 5 * cell + 4 * gapX;
  return { width: text.length * (charW + cell) - cell, height: 7 * cell + 6 * gapX, charW, gapX };
}

/** Draw dot-matrix text; `lit` (0..1) lights glyphs left→right; glow via shadowBlur. */
export function drawPixelText(
  g: Ctx2D,
  text: string,
  x: number,
  y: number,
  cell: number,
  color: string,
  { glow = 0, lit = 1, align = "center" as "left" | "center" } = {}
) {
  const chars = text.toUpperCase().split("");
  const m = measurePixelText(text, cell);
  let cx = align === "center" ? x - m.width / 2 : x;
  const litCount = Math.ceil(chars.length * lit);
  g.save();
  g.fillStyle = color;
  if (glow > 0) {
    g.shadowColor = color;
    g.shadowBlur = glow;
  }
  chars.forEach((ch, ci) => {
    const rows = GLYPHS[ch] ?? GLYPHS[" "];
    if (ci < litCount) {
      rows.forEach((row, ri) => {
        for (let bit = 0; bit < 5; bit++) {
          if ((row >> (4 - bit)) & 1) {
            g.fillRect(cx + bit * (cell + m.gapX), y + ri * (cell + m.gapX), cell, cell);
          }
        }
      });
    }
    cx += m.charW + cell;
  });
  g.restore();
}

// ---------- Marquee / sign component ----------

export type MarqueeSpec = {
  text: string;
  x: number;
  y: number; // center of the sign
  cell: number; // pixel size of the lettering
  textColor: string;
  panel?: { color: string; pad: number; glow: number; bulbs?: boolean }; // omit = bare text
  glow?: number; // text glow when panel-less
  blinkRate?: number; // frames; 0/undefined = steady
  appearAt?: number; // frame it pops in
  scroll?: { width: number; pxPerFrame: number }; // horizontal ticker window
};

export function drawMarquee(g: Ctx2D, s: MarqueeSpec, frame: number) {
  if (s.appearAt != null && frame < s.appearAt) return;
  const pop = s.appearAt != null ? progress(frame, s.appearAt, 18, EASE.outBack) : 1;
  const on = s.blinkRate ? blink(frame, s.blinkRate) : true;
  const m = measurePixelText(s.text, s.cell);

  g.save();
  g.translate(s.x, s.y);
  g.scale(pop, pop);

  if (s.panel) {
    const w = m.width + s.panel.pad * 2;
    const h = m.height + s.panel.pad * 2;
    g.save();
    g.shadowColor = s.panel.color;
    g.shadowBlur = s.panel.glow;
    g.fillStyle = s.panel.color;
    const r = Math.min(24, h * 0.18);
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
    g.restore();
    if (s.panel.bulbs) {
      // chase lights around the border — the frame index IS the chase clock
      g.fillStyle = s.textColor;
      const step = s.cell * 2.2;
      const perimeter = Math.floor((2 * (w + h)) / step);
      for (let i = 0; i < perimeter; i++) {
        if ((i + Math.floor(frame / 6)) % 3 !== 0) continue;
        const d = i * step;
        let bx: number, by: number;
        if (d < w) [bx, by] = [d - w / 2, -h / 2];
        else if (d < w + h) [bx, by] = [w / 2, d - w - h / 2];
        else if (d < 2 * w + h) [bx, by] = [w / 2 - (d - w - h), h / 2];
        else [bx, by] = [-w / 2, h / 2 - (d - 2 * w - h)];
        g.fillRect(bx - s.cell * 0.3, by - s.cell * 0.3, s.cell * 0.6, s.cell * 0.6);
      }
    }
  }

  if (on) {
    if (s.scroll) {
      // ticker: clip a window, march the text left, wrap seamlessly
      const gap = s.cell * 10;
      const span = m.width + gap;
      const off = -((frame * s.scroll.pxPerFrame) % span);
      g.beginPath();
      g.rect(-s.scroll.width / 2, -m.height, s.scroll.width, m.height * 2);
      g.clip();
      for (let k = 0; k <= Math.ceil(s.scroll.width / span) + 1; k++) {
        drawPixelText(g, s.text, off + k * span - s.scroll.width / 2 + m.width / 2, -m.height / 2, s.cell, s.textColor, {
          glow: s.glow ?? 0,
        });
      }
    } else {
      drawPixelText(g, s.text, 0, -m.height / 2, s.cell, s.textColor, {
        glow: s.panel ? 0 : (s.glow ?? 0),
        lit: s.appearAt != null ? progress(frame, s.appearAt, 26, EASE.linear) : 1,
      });
    }
  }
  g.restore();
}

// ---------- Background scenery generator (math + loops, zero images) ----------

export type ScenerySpec = {
  kind: "ladder" | "grid" | "skyline";
  x: number;
  y: number; // top-left
  width: number;
  height: number;
  rungs?: number;
  dot: number; // dot size
  gap: number; // dot spacing
  color: string;
  opacity: number;
  seed?: number;
};

const dotLine = (g: Ctx2D, x0: number, y0: number, x1: number, y1: number, dot: number, gap: number) => {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.floor(len / gap));
  for (let i = 0; i <= n; i++) {
    g.fillRect(x0 + ((x1 - x0) * i) / n - dot / 2, y0 + ((y1 - y0) * i) / n - dot / 2, dot, dot);
  }
};

export function drawScenery(g: Ctx2D, s: ScenerySpec) {
  g.save();
  g.globalAlpha = s.opacity;
  g.fillStyle = s.color;
  if (s.kind === "ladder") {
    // converging dotted rails + rungs — the tweet's "building" silhouette
    const topInset = s.width * 0.22;
    dotLine(g, s.x + topInset, s.y, s.x, s.y + s.height, s.dot, s.gap);
    dotLine(g, s.x + s.width - topInset, s.y, s.x + s.width, s.y + s.height, s.dot, s.gap);
    const rungs = s.rungs ?? 6;
    for (let r = 0; r < rungs; r++) {
      const t = (r + 0.5) / rungs;
      const inset = topInset * (1 - t);
      dotLine(g, s.x + inset, s.y + s.height * t, s.x + s.width - inset, s.y + s.height * t, s.dot, s.gap);
    }
  } else if (s.kind === "grid") {
    for (let y = s.y; y <= s.y + s.height; y += s.gap)
      for (let x = s.x; x <= s.x + s.width; x += s.gap) g.fillRect(x, y, s.dot, s.dot);
  } else {
    // skyline: seeded column heights with punched-out windows
    let h = 0.4;
    const cols = Math.floor(s.width / (s.gap * 4));
    for (let c = 0; c < cols; c++) {
      h = Math.min(1, Math.max(0.25, h + (Math.sin((c + (s.seed ?? 1)) * 12.9898) * 43758.5453) % 0.3));
      const bh = s.height * h;
      for (let y = s.y + s.height - bh; y < s.y + s.height; y += s.gap)
        for (let x = s.x + c * s.gap * 4; x < s.x + (c + 1) * s.gap * 4 - s.gap; x += s.gap)
          if (Math.floor((x + y) / s.gap) % 5 !== 0) g.fillRect(x, y, s.dot, s.dot);
    }
  }
  g.restore();
}

// ---------- Pixel character blueprint (stateful matrix entity) ----------

export type SpriteSpec = {
  /** named states → full integer matrix (0 empty, 1..n palette indices) */
  matrixStates?: Record<string, number[][]>;
  /**
   * OR a composable rig: torso states (the face/emotion) stacked on leg frames
   * (the gait). Leg frame is picked automatically from horizontal speed:
   * stand · walk-a/walk-b · run-a/run-b. This is what makes a character ALIVE —
   * emotion and locomotion animate independently.
   */
  compose?: { torsos: Record<string, number[][]>; legs: Record<string, number[][]> };
  /** palette index → css color, or "igGradient" for the Instagram gradient */
  palette: Record<number, string>;
  x: number;
  y: number; // BOTTOM-center anchor (characters stand on things)
  cell: number;
  stateTimeline: { at: number; name: string }[];
  /** scripted locomotion: piecewise-linear x over frames; facing follows velocity */
  path?: { at: number; x: number }[];
  float?: { amplitude: number; frequency: number };
  /** comic-strip speech: pixel text in a cream bubble above the head */
  emotes?: { at: number; until: number; text: string; blinkRate?: number }[];
  /** frantic pinned-under-the-pile mode: torso thrashes, last `pinnedRows` stay put */
  struggle?: { startAt: number; until?: number; ampX: number; ampY: number; frequency: number; pinnedRows: number };
  /** pile weight squashes the body toward the feet: amount 0 (normal) → 1 (crushed flat) */
  crush?: { keys: { at: number; amount: number }[] };
};

const flipMatrix = (m: number[][]) => m.map((row) => [...row].reverse());
const WALK_SPEED = 0.4; // px/frame — slower than this is standing
const RUN_SPEED = 2.6;

const igGradient = (g: Ctx2D, x: number, y: number, w: number, h: number) => {
  const grad = g.createLinearGradient(x, y + h, x + w, y);
  grad.addColorStop(0, "#FFDC80");
  grad.addColorStop(0.25, "#F77737");
  grad.addColorStop(0.5, "#E1306C");
  grad.addColorStop(0.75, "#C13584");
  grad.addColorStop(1, "#5851DB");
  return grad;
};

/** `pass` lets the pipeline layer the character UNDER the boxes but its
 *  speech bubbles OVER them — a scream you can't read isn't a scream. */
export function drawSprite(g: Ctx2D, s: SpriteSpec, frame: number, pass: "body" | "emotes" | "all" = "all") {
  // -- locomotion: position, velocity, facing, gait --
  const x = pathX(s.path, s.x, frame);
  const vx = x - pathX(s.path, s.x, frame - 1);
  const speed = Math.abs(vx);
  const moving = speed > WALK_SPEED;
  const running = speed > RUN_SPEED;
  const facingLeft = vx < -WALK_SPEED;

  // -- pick the frame's matrix: torso emotion × leg gait, or a flat state --
  const states = s.matrixStates ?? {};
  const state = stateAt(frame, s.stateTimeline, Object.keys(s.compose?.torsos ?? states)[0]);
  let matrix: number[][];
  if (s.compose) {
    const torso = s.compose.torsos[state] ?? Object.values(s.compose.torsos)[0];
    const cycle = Math.floor(frame / (running ? 4 : 7)) % 2 === 0 ? "a" : "b";
    const legName = moving ? `${running ? "run" : "walk"}-${cycle}` : "stand";
    const legs = s.compose.legs[legName] ?? s.compose.legs.stand;
    matrix = [...torso, ...legs];
  } else {
    matrix = states[state];
  }
  if (facingLeft) matrix = flipMatrix(matrix);

  const rows = matrix.length;
  const cols = matrix[0].length;
  const w = cols * s.cell;
  const h = rows * s.cell;
  const originX = x - w / 2;
  const originY = s.y - h;

  // idle breathing when still; step-bounce when moving (feet stay planted)
  const floatY = moving
    ? -Math.abs(Math.sin(frame * (running ? 0.8 : 0.45))) * s.cell * (running ? 0.5 : 0.3)
    : s.float
      ? floatSin(frame, 0, s.float.amplitude, s.float.frequency)
      : 0;

  // running lean: rotate around the feet, into the direction of travel
  const lean = running ? Math.sign(vx) * 0.12 : moving ? Math.sign(vx) * 0.05 : 0;
  g.save();
  if (lean) {
    g.translate(x, s.y);
    g.rotate(lean);
    g.translate(-x, -s.y);
  }

  // dust puffs kicked up behind the feet while running — pure frame math
  if (running && pass !== "emotes") {
    for (let k = 0; k < 3; k++) {
      const age = ((frame * 2 + k * 9) % 26) / 26;
      g.save();
      g.globalAlpha = (1 - age) * 0.5;
      g.fillStyle = "#F5EDD6";
      const back = -Math.sign(vx);
      g.fillRect(
        x + back * (w / 2 + 8 + age * 34 + k * 10),
        s.y - 8 - age * 18 - k * 4,
        s.cell * (0.7 - age * 0.4),
        s.cell * (0.7 - age * 0.4)
      );
      g.restore();
    }
  }

  // struggle: torso offset ramps up and thrashes; legs (pinnedRows) never move
  let torsoDX = 0;
  let torsoDY = 0;
  const st = s.struggle;
  const struggling = st && frame >= st.startAt && (st.until == null || frame < st.until);
  if (struggling) {
    const ramp = progress(frame, st.startAt, 40, EASE.outCubic);
    const t = frame - st.startAt;
    // two incommensurate sines + a hard jitter every 9 frames = frantic, not smooth
    torsoDX = ramp * (Math.sin(t * st.frequency) * st.ampX + Math.sin(t * st.frequency * 2.7) * st.ampX * 0.4);
    torsoDY = ramp * (-Math.abs(Math.sin(t * st.frequency * 1.3)) * st.ampY + (t % 9 === 0 ? -st.ampY * 0.3 : 0));
  }

  const gradient = igGradient(g, originX, originY, w, h);
  const pinnedFrom = struggling ? rows - st.pinnedRows : rows;

  // crush: the pile compresses the body toward the planted feet (squash & widen).
  // A tiny frame-tied wobble sells the "still being pressed" feeling.
  const crush = s.crush ? pathX(s.crush.keys.map((k) => ({ at: k.at, x: k.amount })), 0, frame) : 0;
  const bodyDraw = pass !== "emotes";
  g.save();
  if (crush > 0) {
    const wob = 1 + Math.sin(frame * 0.4) * 0.02 * crush;
    g.translate(x, s.y);
    g.scale((1 + crush * 0.22) * wob, 1 - crush * 0.55);
    g.translate(-x, -s.y);
  }

  for (let r = 0; bodyDraw && r < rows; r++) {
    const pinned = r >= pinnedFrom;
    const dx = pinned || !struggling ? 0 : torsoDX * ((pinnedFrom - r) / pinnedFrom); // legs anchored, head widest
    const dy = pinned || !struggling ? 0 : torsoDY;
    for (let c = 0; c < cols; c++) {
      const v = matrix[r][c];
      if (!v) continue;
      const color = s.palette[v];
      g.fillStyle = color === "igGradient" ? gradient : color;
      g.fillRect(originX + c * s.cell + dx, originY + r * s.cell + dy + floatY, s.cell - 1, s.cell - 1);
    }
  }

  // comic sweat pixels while struggling or running scared
  if ((struggling || running) && bodyDraw) {
    const t = struggling ? frame - st.startAt : frame;
    g.fillStyle = "#9AD8FF";
    for (const side of [-1, 1]) {
      const arc = (t * 3) % 30;
      if (arc < 22) {
        g.fillRect(
          x + side * (w / 2 + 6 + arc * 1.2) + torsoDX,
          originY + torsoDY + arc * 1.6 - 10,
          s.cell * 0.5,
          s.cell * 0.5
        );
      }
    }
  }
  g.restore(); // crush
  g.restore(); // lean

  // -- emote bubbles: upright (never lean), above the head, pop + blink --
  for (const e of pass === "body" ? [] : (s.emotes ?? [])) {
    if (frame < e.at || frame >= e.until) continue;
    if (e.blinkRate && !blink(frame, e.blinkRate, 0.7)) continue;
    const pop = progress(frame, e.at, 10, EASE.outBack);
    const cell = Math.max(4, s.cell * 0.55);
    const m = measurePixelText(e.text, cell);
    const bw = m.width + cell * 4;
    const bh = m.height + cell * 3;
    const bx = x + w * 0.4;
    const by = originY + torsoDY + floatY - bh - cell * 2 + Math.sin(frame * 0.15) * 3;
    g.save();
    g.translate(bx, by + bh / 2);
    g.scale(pop, pop);
    g.translate(-bx, -(by + bh / 2));
    g.fillStyle = "#F5EDD6";
    g.beginPath();
    g.roundRect(bx - bw / 2, by, bw, bh, cell);
    g.fill();
    // tail pointing at the head
    g.beginPath();
    g.moveTo(bx - cell, by + bh);
    g.lineTo(bx - cell * 2.4, by + bh + cell * 1.6);
    g.lineTo(bx + cell * 0.5, by + bh);
    g.closePath();
    g.fill();
    drawPixelText(g, e.text, bx, by + cell * 1.5, cell, "#0D0B09");
    g.restore();
  }
}
