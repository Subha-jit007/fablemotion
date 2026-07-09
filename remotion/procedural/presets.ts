// PROCEDURAL/presets — factory-built matrix characters. A preset returns the
// same schema users can hand-write, so "ig-bot" and a hand-drawn 8-bit crab
// are the same kind of citizen.
//
// The ig-bot is a composable rig: TORSOS carry emotion (idle → startle →
// scream → lost), LEGS carry locomotion (stand · walk · run). drawSprite
// stacks torso+legs per frame, so the character acts and moves independently.

const grid = (rows: number, cols: number) => Array.from({ length: rows }, () => new Array(cols).fill(0));
const set = (m: number[][], r: number, cols: number[], v: number) => cols.forEach((c) => (m[r][c] = v));

const COLS = 14;

/** Gradient rounded-square body shell, rows 0..13, with the camera dot. */
function shell(): number[][] {
  const m = grid(14, COLS);
  for (let r = 0; r <= 13; r++) {
    const inset = r === 0 || r === 13 ? 2 : r === 1 || r === 12 ? 1 : 0;
    for (let c = inset; c < COLS - inset; c++) m[r][c] = 1;
  }
  m[1][10] = m[1][11] = m[2][10] = m[2][11] = 2; // camera dot
  return m;
}

// ---------- torsos (the face is the performance) ----------

function torsoIdle() {
  const m = shell();
  set(m, 4, [5, 6, 7, 8], 2); // calm lens ring
  for (const r of [5, 6, 7, 8]) m[r][4] = m[r][9] = 2;
  set(m, 9, [5, 6, 7, 8], 2);
  return m;
}

function torsoStartle() {
  const m = shell();
  set(m, 3, [4, 5], 2); // brows shoot up
  set(m, 3, [8, 9], 2);
  set(m, 5, [5, 6, 7, 8], 2); // eye wide open: ring + filled core
  for (const r of [6, 7, 8]) m[r][4] = m[r][9] = 2;
  set(m, 6, [6, 7], 2);
  set(m, 7, [6, 7], 2);
  set(m, 9, [5, 6, 7, 8], 2);
  set(m, 11, [6, 7], 2); // little "o" mouth
  return m;
}

function torsoScream() {
  const m = shell();
  // arms flung up-and-out
  m[3][0] = m[2][0] = m[1][1] = 1;
  m[3][13] = m[2][13] = m[1][12] = 1;
  // eyes squeezed shut (diagonal slashes)
  m[4][4] = m[5][5] = 2;
  m[4][9] = m[5][8] = 2;
  // wide-open screaming mouth: white rim, dark throat
  set(m, 7, [5, 6, 7, 8], 2);
  for (const r of [8, 9]) {
    m[r][4] = 2;
    set(m, r, [5, 6, 7, 8], 4);
    m[r][9] = 2;
  }
  set(m, 10, [5, 6, 7, 8], 2);
  return m;
}

function torsoLost() {
  const m = shell();
  set(m, 6, [4, 5], 2); // half-lidded, flat eyes
  set(m, 6, [8, 9], 2);
  m[8][3] = 5; // one tear
  m[10][3] = 5;
  set(m, 11, [5, 6, 7, 8], 2); // flat, defeated mouth
  return m;
}

// ---------- legs (the gait is the effort) ----------

function legsStand() {
  const m = grid(4, COLS);
  for (let r = 0; r <= 2; r++) {
    set(m, r, [3, 4], 3);
    set(m, r, [9, 10], 3);
  }
  set(m, 3, [2, 3, 4], 3);
  set(m, 3, [9, 10, 11], 3);
  return m;
}

function legsWalkA() {
  // stride apart
  const m = grid(4, COLS);
  set(m, 0, [4, 5], 3);
  set(m, 0, [8, 9], 3);
  set(m, 1, [3, 4], 3);
  set(m, 1, [9, 10], 3);
  set(m, 2, [2, 3], 3);
  set(m, 2, [10, 11], 3);
  set(m, 3, [1, 2, 3], 3);
  set(m, 3, [10, 11, 12], 3);
  return m;
}

function legsWalkB() {
  // stride together (passing pose)
  const m = grid(4, COLS);
  for (let r = 0; r <= 2; r++) {
    set(m, r, [5, 6], 3);
    set(m, r, [7, 8], 3);
  }
  set(m, 3, [4, 5, 6], 3);
  set(m, 3, [7, 8, 9], 3);
  return m;
}

function legsRunA() {
  // front leg reaching, back leg kicked up — full flight
  const m = grid(4, COLS);
  set(m, 0, [5, 6], 3);
  set(m, 0, [9, 10], 3); // back thigh
  set(m, 1, [4, 5], 3);
  set(m, 1, [10, 11], 3); // back shin up behind
  set(m, 2, [3, 4], 3);
  set(m, 3, [1, 2, 3], 3); // front foot planted far forward
  return m;
}

function legsRunB() {
  // gather: both legs tucked under the body
  const m = grid(4, COLS);
  set(m, 0, [5, 6], 3);
  set(m, 0, [8, 9], 3);
  set(m, 1, [5, 6], 3);
  set(m, 1, [8, 9], 3);
  set(m, 2, [6, 7], 3);
  set(m, 3, [5, 6, 7], 3);
  return m;
}

export function igBotMatrices() {
  return {
    compose: {
      torsos: { idle: torsoIdle(), startle: torsoStartle(), scream: torsoScream(), lost: torsoLost() },
      legs: { stand: legsStand(), "walk-a": legsWalkA(), "walk-b": legsWalkB(), "run-a": legsRunA(), "run-b": legsRunB() },
    },
    palette: { 1: "igGradient", 2: "#FFFFFF", 3: "#F5EDD6", 4: "#40101B", 5: "#9AD8FF" },
  };
}
