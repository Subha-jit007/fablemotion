// PROCEDURAL/physics — deterministic Verlet rigid-body sim.
//
// Design constraint: Remotion (and any seekable renderer) asks for frames in
// ARBITRARY order, so a mutable real-time loop is wrong by construction.
// Instead the whole simulation runs ONCE per config (seeded, memoized) and
// rendering frame N is a pure array lookup. Same physics, deterministic output.
import { rng, pathX } from "./anim";

export type BoxSpec = {
  label: string;
  w: number;
  h: number;
  spawnFrame: number;
  x: number; // spawn center-x
  color?: string;
};

/** Infinite-mass collider; give it a `path` to follow a scripted character. */
export type StaticBody = { x: number; y: number; w: number; h: number; path?: { at: number; x: number }[] };

export type PhysicsConfig = {
  gravity: number; // px/frame²
  restitution: number; // 0..1 bounce energy kept
  friction: number; // 0..1 horizontal damping on contact
  floor: number; // y of the ground plane
  seed: number;
  boxes: BoxSpec[];
  staticBodies?: StaticBody[]; // infinite-mass colliders (the bot)
};

export type BodyState = { x: number; y: number; alive: boolean };
export type PhysicsTimeline = BodyState[][]; // [frame][boxIndex]

type Body = { x: number; y: number; px: number; py: number; w: number; h: number; alive: boolean };

const overlap = (a: Body, b: { x: number; y: number; w: number; h: number }) => {
  const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
  const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
  return ox > 0 && oy > 0 ? { ox, oy } : null;
};

/** Run the full sim for `frames` frames. Pure: (config, frames) → timeline. */
export function simulate(config: PhysicsConfig, frames: number, width: number): PhysicsTimeline {
  const rand = rng(config.seed);
  const bodies: Body[] = config.boxes.map((b) => ({
    x: b.x,
    y: -b.h, // spawn just above the top edge
    px: b.x - (rand() - 0.5) * 3, // seeded initial sideways drift
    py: -b.h,
    w: b.w,
    h: b.h,
    alive: false,
  }));
  const statics = config.staticBodies ?? [];
  const timeline: PhysicsTimeline = [];

  for (let f = 0; f < frames; f++) {
    // integrate
    bodies.forEach((body, i) => {
      if (!body.alive && f >= config.boxes[i].spawnFrame) body.alive = true;
      if (!body.alive) return;
      const vx = (body.x - body.px) * 0.995; // light air drag
      const vy = body.y - body.py;
      body.px = body.x;
      body.py = body.y;
      body.x += vx;
      body.y += vy + config.gravity;
    });

    // resolve collisions — a few Gauss-Seidel iterations settle the pile
    for (let iter = 0; iter < 6; iter++) {
      for (const body of bodies) {
        if (!body.alive) continue;

        // floor: clamp + restitution via prev-pos reflection
        const bottom = body.y + body.h / 2;
        if (bottom > config.floor) {
          const vy = body.y - body.py;
          body.y = config.floor - body.h / 2;
          body.py = body.y + vy * config.restitution;
          const vx = body.x - body.px;
          body.px = body.x - vx * (1 - config.friction);
        }
        // walls
        if (body.x - body.w / 2 < 0) body.x = body.w / 2;
        if (body.x + body.w / 2 > width) body.x = width - body.w / 2;

        // static bodies (the bot) — push out along the axis of least overlap;
        // a pathed body is evaluated at THIS frame, so boxes track the actor
        for (const sb of statics) {
          const s = sb.path ? { ...sb, x: pathX(sb.path, sb.x, f) } : sb;
          const hit = overlap(body, s);
          if (!hit) continue;
          if (hit.ox < hit.oy) body.x += body.x < s.x ? -hit.ox : hit.ox;
          else if (body.y < s.y) {
            const vy = body.y - body.py;
            body.y -= hit.oy;
            body.py = body.y + vy * config.restitution;
          } else body.y += hit.oy;
        }
      }

      // pairwise box-vs-box: split the correction between equal masses
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (!b.alive) continue;
          const hit = overlap(a, b);
          if (!hit) continue;
          if (hit.ox < hit.oy) {
            const push = hit.ox / 2;
            if (a.x < b.x) {
              a.x -= push;
              b.x += push;
            } else {
              a.x += push;
              b.x -= push;
            }
          } else {
            const push = hit.oy / 2;
            if (a.y < b.y) {
              a.y -= push;
              b.y += push;
            } else {
              a.y += push;
              b.y -= push;
            }
          }
        }
      }
    }

    timeline.push(bodies.map((b) => ({ x: b.x, y: b.y, alive: b.alive })));
  }
  return timeline;
}

// memoized per config — the sim runs once no matter how frames are seeked
const cache = new Map<string, PhysicsTimeline>();
export function timelineFor(config: PhysicsConfig, frames: number, width: number): PhysicsTimeline {
  const key = JSON.stringify({ config, frames, width });
  let tl = cache.get(key);
  if (!tl) {
    tl = simulate(config, frames, width);
    cache.set(key, tl);
  }
  return tl;
}

/** The frame + place each box first slams to rest. Drives impact FX and thuds. */
export type Landing = { frame: number; box: number; x: number; y: number; w: number; heavy: boolean };
const landCache = new Map<string, Landing[]>();
export function landings(config: PhysicsConfig, frames: number, width: number): Landing[] {
  const key = JSON.stringify({ config, frames, width, v: "land" });
  let out = landCache.get(key);
  if (out) return out;
  const tl = timelineFor(config, frames, width);
  out = [];
  config.boxes.forEach((box, i) => {
    for (let f = box.spawnFrame + 3; f < frames - 1; f++) {
      if (!tl[f]?.[i]?.alive) continue;
      const vPrev = tl[f][i].y - tl[f - 1][i].y;
      const vNext = tl[f + 1][i].y - tl[f][i].y;
      if (vPrev > 4 && vNext < 1.5) {
        out.push({ frame: f, box: i, x: tl[f][i].x, y: tl[f][i].y + box.h / 2, w: box.w, heavy: box.w > 300 });
        break;
      }
    }
  });
  landCache.set(key, out);
  return out;
}
