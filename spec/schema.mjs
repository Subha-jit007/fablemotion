// FABLEMOTION scene-spec DSL — the single source of truth.
// Imported by the Remotion composition, the Next.js API routes, and the MCP server.
import { z } from "zod";

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export const THEME_PRESETS = {
  // Anthropic-launch paper: ivory, ink, clay
  paper: { bg: "#F7F2E9", fg: "#1A1714", accent: "#D97757", accent2: "#2F6FED", soft: "#EAE2D3" },
  // Deep ink with warm accents — dark but never the moody AI cliché
  ink: { bg: "#171512", fg: "#F3EEE3", accent: "#E8845E", accent2: "#7FB4A2", soft: "#262220" },
  // Saturated candy — for playful launches
  candy: { bg: "#FFF3E8", fg: "#241A33", accent: "#F0426B", accent2: "#5B3DF5", soft: "#FFE3CC" },
  // Retro cinema marquee — the Fable-5 launch-film look: warm black, glowing cream, pixel red
  marquee: { bg: "#0D0B09", fg: "#F5EDD6", accent: "#D94F41", accent2: "#D97757", soft: "#2B2620" },
};

const colors = z.object({
  bg: z.string(),
  fg: z.string(),
  accent: z.string(),
  accent2: z.string(),
  soft: z.string(),
});

const base = { durationInFrames: z.number().int().min(20).max(1200).default(90) };

const titleScene = z.object({
  type: z.literal("title"),
  text: z.string().min(1).max(90),
  sub: z.string().max(140).optional(),
  ...base,
});

const kineticScene = z.object({
  type: z.literal("kinetic"),
  words: z.array(z.string().min(1).max(24)).min(2).max(8),
  ...base,
});

const statementScene = z.object({
  type: z.literal("statement"),
  lines: z.array(z.string().min(1).max(60)).min(1).max(5),
  accentLine: z.number().int().min(0).optional(),
  ...base,
});

const counterScene = z.object({
  type: z.literal("counter"),
  value: z.number(),
  label: z.string().max(80),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(12).optional(),
  decimals: z.number().int().min(0).max(2).default(0),
  ...base,
});

const listScene = z.object({
  type: z.literal("list"),
  title: z.string().max(60).optional(),
  items: z.array(z.string().min(1).max(70)).min(2).max(6),
  ...base,
});

const codeScene = z.object({
  type: z.literal("code"),
  title: z.string().max(60).optional(),
  code: z.string().min(1).max(700),
  ...base,
});

const chartScene = z.object({
  type: z.literal("chart"),
  title: z.string().max(70).optional(),
  data: z
    .array(z.object({ label: z.string().max(24), value: z.number().min(0) }))
    .min(2)
    .max(6),
  ...base,
});

const compareScene = z.object({
  type: z.literal("compare"),
  title: z.string().max(70).optional(),
  left: z.object({ label: z.string().max(30), value: z.string().max(16) }),
  right: z.object({ label: z.string().max(30), value: z.string().max(16) }),
  ...base,
});

const logoScene = z.object({
  type: z.literal("logo"),
  text: z.string().min(1).max(40),
  tagline: z.string().max(90).optional(),
  ...base,
});

export const sceneSchema = z.discriminatedUnion("type", [
  titleScene,
  kineticScene,
  statementScene,
  counterScene,
  listScene,
  codeScene,
  chartScene,
  compareScene,
  logoScene,
]);

export const specSchema = z.object({
  title: z.string().min(1).max(80),
  format: z.enum(["landscape", "portrait", "square"]).default("landscape"),
  fps: z.number().int().min(24).max(60).default(30),
  theme: z
    .object({
      preset: z.enum(["paper", "ink", "candy", "marquee"]).default("paper"),
      colors: colors.partial().optional(),
    })
    .default({ preset: "paper" }),
  backdrop: z.enum(["drift", "grain", "none"]).default("drift"),
  scenes: z.array(sceneSchema).min(1).max(20),
});

export function resolveTheme(spec) {
  const preset = THEME_PRESETS[spec.theme?.preset ?? "paper"];
  return { ...preset, ...(spec.theme?.colors ?? {}) };
}

export function totalDuration(spec) {
  return spec.scenes.reduce((sum, s) => sum + (s.durationInFrames ?? 90), 0);
}

export function validateSpec(raw) {
  return specSchema.safeParse(raw);
}
