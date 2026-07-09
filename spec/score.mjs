// FABLEMOTION SCORE — the v2 intent-level timeline IR. Single source of truth.
// A Score = meta + cast (named elements) + acts→beats→moves (verbs on cast).
// Claude composes freely from CANON vocabulary; scenes are emergent, not enumerated.
import { z } from "zod";
import { INTENTS, VERBS, REGIONS, EASINGS, TYPE_SCALE } from "../canon/canon.mjs";
import { MOODS } from "../canon/psychology.mjs";

const castId = z.string().regex(/^[a-z][a-z0-9-]*$/);

// ---------- cast kinds ----------

const textCast = z.object({
  kind: z.literal("text"),
  role: z.enum(Object.keys(TYPE_SCALE)),
  content: z.string().min(1).max(220), // \n allowed → staggered lines
  font: z.enum(["serif", "sans", "mono"]).optional(),
  treatment: z.enum(["clean", "pixel"]).default("clean"), // pixel = dot-matrix bitmap glyphs
  glow: z.boolean().default(false),
  align: z.enum(["left", "center"]).default("center"),
  accent: z.enum(["none", "last-word", "all"]).or(z.string().regex(/^line:\d$/)).default("none"),
});

const counterCast = z.object({
  kind: z.literal("counter"),
  value: z.number(),
  label: z.string().max(80).optional(),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(12).optional(),
  decimals: z.number().int().min(0).max(2).default(0),
});

const listCast = z.object({
  kind: z.literal("list"),
  items: z.array(z.string().min(1).max(70)).min(2).max(6),
});

const codeCast = z.object({
  kind: z.literal("code"),
  code: z.string().min(1).max(700),
  title: z.string().max(60).optional(),
});

const chartCast = z.object({
  kind: z.literal("chart"),
  data: z.array(z.object({ label: z.string().max(24), value: z.number().min(0) })).min(2).max(6),
});

const compareCast = z.object({
  kind: z.literal("compare"),
  left: z.object({ label: z.string().max(30), value: z.string().max(16) }),
  right: z.object({ label: z.string().max(30), value: z.string().max(16) }),
});

const shapeCast = z.object({
  kind: z.literal("shape"),
  shape: z.enum(["rule", "ring", "sign"]), // sign = glowing marquee panel behind siblings
  size: z.number().min(8).max(1200).optional(),
});

const mediaCast = z.object({
  kind: z.literal("media"),
  src: z.string().min(1),
  width: z.number().min(40).max(1920).optional(),
  cutout: z.boolean().default(false),
});

// Escape hatch: arbitrary HTML, but it must stay inside its box and declare nothing async.
const customCast = z.object({
  kind: z.literal("custom"),
  html: z.string().min(1).max(6000),
  width: z.number().min(40).max(1920).optional(),
  height: z.number().min(40).max(1920).optional(),
});

export const castSchema = z.discriminatedUnion("kind", [
  textCast, counterCast, listCast, codeCast, chartCast,
  compareCast, shapeCast, mediaCast, customCast,
]);

// ---------- timeline ----------

const moveSchema = z.object({
  verb: z.enum(VERBS),
  cast: castId,
  ease: z.enum(Object.keys(EASINGS)).optional(), // default per verb in the stage
  at: z.enum(REGIONS).default("center"),
  delay: z.number().int().min(0).max(600).default(0), // frames after beat start
  dir: z.enum(["up", "down", "left", "right"]).optional(),
});

const beatSchema = z.object({
  intent: z.enum(INTENTS),
  durationInFrames: z.number().int().min(15).max(1200),
  transition: z.enum(["cut", "fade"]).default("fade"),
  moves: z.array(moveSchema).min(1).max(12),
});

const actSchema = z.object({
  name: z.string().max(40).optional(),
  beats: z.array(beatSchema).min(1).max(30),
});

export const scoreSchema = z.object({
  version: z.literal(2),
  meta: z.object({
    title: z.string().min(1).max(80),
    format: z.enum(["landscape", "portrait", "square"]).default("landscape"),
    fps: z.number().int().min(24).max(60).default(30),
    theme: z.object({
      preset: z.enum(["paper", "ink", "candy", "marquee"]).default("paper"),
      colors: z.record(z.string()).optional(),
    }).default({ preset: "paper" }),
    backdrop: z.enum(["drift", "grain", "none"]).default("drift"),
    mood: z.enum(Object.keys(MOODS)).optional(), // psychology target the Eye judges against
  }),
  cast: z.record(castId, castSchema),
  acts: z.array(actSchema).min(1).max(8),
});

// ---------- helpers ----------

export const validateScore = (raw) => scoreSchema.safeParse(raw);

export const flattenBeats = (score) => score.acts.flatMap((a) => a.beats);

export const totalDuration = (score) =>
  flattenBeats(score).reduce((sum, b) => sum + b.durationInFrames, 0);

export const isScore = (raw) => raw && raw.version === 2 && !!raw.cast;
