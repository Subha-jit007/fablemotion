// gen-sfx — synthesize the procedural engine's sound palette from scratch.
// No downloaded samples: every SFX is an oscillator + envelope written to a
// 16-bit mono WAV. Retro-arcade voice (chip blips, impacts, a distressed
// wail) to match the pixel aesthetic — deliberately NOT cartoon/kids music.
//
//   node scripts/gen-sfx.mjs   →   public/audio/*.wav
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
fs.mkdirSync(OUT, { recursive: true });

const osc = {
  square: (ph) => (ph % 1 < 0.5 ? 1 : -1),
  saw: (ph) => 2 * (ph % 1) - 1,
  tri: (ph) => {
    const p = ph % 1;
    return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
  },
  sine: (ph) => Math.sin(ph * 2 * Math.PI),
};

/** One enveloped oscillator sweep. f0→f1 exponential glide, optional vibrato + noise. */
function tone({ dur, f0, f1 = f0, type = "square", vol = 0.6, attack = 0.005, release = 0.06, vibF = 0, vibA = 0, noise = 0 }) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  const aN = Math.max(1, attack * SR);
  const rN = Math.max(1, release * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = i / n;
    const f = f0 * Math.pow(f1 / f0, k) + (vibA ? Math.sin(t * 2 * Math.PI * vibF) * vibA : 0);
    ph += f / SR;
    let s = osc[type](ph) * (1 - noise) + (noise ? (Math.random() * 2 - 1) * noise : 0);
    let env = 1;
    if (i < aN) env = i / aN;
    else if (i > n - rN) env = (n - i) / rN;
    out[i] = s * env * vol;
  }
  return out;
}

const mix = (...arrs) => {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
};

function writeWav(name, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
}

// ---- the palette, one sound per bot behavior ----
const SFX = {
  // startled "!" — rising chip blip
  startle: tone({ dur: 0.13, f0: 420, f1: 980, type: "square", vol: 0.55, release: 0.07 }),
  // soft footfall while walking
  step: tone({ dur: 0.045, f0: 175, f1: 135, type: "tri", vol: 0.3, attack: 0.002, release: 0.035 }),
  // sharper, grittier footfall while running scared
  runstep: tone({ dur: 0.04, f0: 260, f1: 190, type: "square", vol: 0.32, attack: 0.002, release: 0.03, noise: 0.25 }),
  // box hits the pile — low sine thump + a crunchy noise transient
  thud: mix(
    tone({ dur: 0.16, f0: 130, f1: 42, type: "sine", vol: 0.75, attack: 0.001, release: 0.12 }),
    tone({ dur: 0.05, f0: 320, f1: 90, type: "square", vol: 0.35, noise: 0.7, attack: 0.001, release: 0.04 })
  ),
  // panicked wail — square with fast vibrato + grit
  scream: tone({ dur: 0.95, f0: 470, f1: 540, type: "square", vol: 0.5, vibF: 17, vibA: 75, attack: 0.02, release: 0.22, noise: 0.12 }),
  // defeated, lost — slow descending tone, melancholy not comedic
  lost: tone({ dur: 0.85, f0: 340, f1: 120, type: "tri", vol: 0.46, vibF: 5, vibA: 12, attack: 0.02, release: 0.32 }),
};

for (const [name, samples] of Object.entries(SFX)) writeWav(`${name}.wav`, samples);

// ---- robotic BGM: a tense, driving minor-key chip loop (seamless 4s) ----
// A minor: pulsing root bass + a nervous square arpeggio + a soft noise hat.
// Deliberately moody/mechanical, never a bouncy kids jingle.
function bgmLoop() {
  const step = 0.125; // 16th at 120bpm-ish
  const steps = 32; // 4.0s loop
  const out = new Float32Array(Math.floor(steps * step * SR));
  const place = (arr, startSec) => {
    const off = Math.floor(startSec * SR);
    for (let i = 0; i < arr.length && off + i < out.length; i++) out[off + i] += arr[i];
  };
  const A2 = 110, C3 = 130.81, E3 = 164.81, A3 = 220, C4 = 261.63, E4 = 329.63;
  const arp = [A3, C4, E4, C4, A3, E4, C4, A3];
  const bass = [A2, A2, 87.31 /*F2*/, 98 /*G2*/]; // A A F G — minor tension
  for (let s = 0; s < steps; s++) {
    const t = s * step;
    // arpeggio every 16th
    place(tone({ dur: step * 0.9, f0: arp[s % arp.length], type: "square", vol: 0.11, attack: 0.004, release: 0.04 }), t);
    // bass on every quarter (4 steps)
    if (s % 4 === 0) place(tone({ dur: step * 3.6, f0: bass[(s / 4) % bass.length], type: "saw", vol: 0.15, attack: 0.005, release: 0.12 }), t);
    // off-beat noise hat
    if (s % 2 === 1) place(tone({ dur: 0.03, f0: 8000, type: "square", vol: 0.05, noise: 0.9, attack: 0.001, release: 0.025 }), t);
  }
  return out;
}
writeWav("bgm.wav", bgmLoop());

console.log(`wrote ${Object.keys(SFX).length} SFX + bgm → public/audio/`);
