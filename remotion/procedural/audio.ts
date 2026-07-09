// PROCEDURAL/audio — behavior-driven sound cues. The soundtrack is DERIVED
// from what the character does and what the physics does, not hand-placed:
//  - a startle blip on every startle state
//  - repeated wails while it screams, PLUS an extra scream on each heavy box
//    that crushes down onto it (impact-synced panic)
//  - a defeated tone when it goes lost
//  - footsteps whose rate/timbre follow walk vs run speed
//  - one impact thud per box, at the exact frame the sim shows it landing
// Same config → same cues, forever (the physics timeline is memoized).
import { landings } from "./physics";
import type { ProceduralConfig } from "./ProceduralVideo";

export type Cue = { frame: number; sound: string; volume: number; rate?: number };

const WALK_SPEED = 0.4;
const RUN_SPEED = 2.6;

export function deriveCues(c: ProceduralConfig): Cue[] {
  const cues: Cue[] = [];
  const total = Math.round(c.fps * c.durationInSeconds);
  let screamFrom = Infinity;

  for (const sc of c.sprites ?? []) {
    // -- emotional beats from the state machine --
    const tl = sc.stateTimeline ?? [];
    tl.forEach((st, i) => {
      const until = tl[i + 1]?.at ?? total;
      if (st.name === "startle") cues.push({ frame: st.at, sound: "startle", volume: 0.6 });
      else if (st.name === "scream") {
        screamFrom = Math.min(screamFrom, st.at);
        for (let f = st.at + 40; f < until; f += 190) cues.push({ frame: f, sound: "scream", volume: 0.7 });
      } else if (st.name === "lost") cues.push({ frame: st.at, sound: "lost", volume: 0.72 });
    });

    // -- footsteps from the scripted path: cadence & timbre track speed --
    const path = sc.path;
    if (path)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const dur = b.at - a.at;
        if (dur <= 0) continue;
        const speed = Math.abs(b.x - a.x) / dur;
        if (speed <= WALK_SPEED) continue;
        const running = speed > RUN_SPEED;
        const every = running ? 5 : 10;
        for (let f = a.at + every; f < b.at; f += every)
          cues.push({ frame: f, sound: running ? "runstep" : "step", volume: running ? 0.3 : 0.22 });
      }
  }

  // -- box impacts: one thud each, and a fresh scream when a heavy block
  //    crushes down while the bot is already screaming underneath --
  if (c.physics) {
    for (const L of landings(c.physics, total, c.width)) {
      cues.push({ frame: L.frame, sound: "thud", volume: L.heavy ? 0.62 : 0.45, rate: L.heavy ? 0.8 : 1 + (L.box % 3) * 0.08 });
      if (L.heavy && L.frame >= screamFrom) cues.push({ frame: L.frame + 3, sound: "scream", volume: 0.62 });
    }
  }

  return cues.sort((a, b) => a.frame - b.frame);
}
