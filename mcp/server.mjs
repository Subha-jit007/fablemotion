#!/usr/bin/env node
// FABLEMOTION MCP server — lets a Claude Code session act as the motion director.
// The connected model IS the brain here, so no Anthropic API key is needed.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { specSchema, totalDuration } from "../spec/schema.mjs";
import { scoreSchema, isScore, totalDuration as scoreDuration, flattenBeats } from "../spec/score.mjs";
import { compileLegacy } from "../spec/macros.mjs";
import { lintScore } from "../canon/canon.mjs";
import { peakFrames } from "../eye/extract.mjs";
import { approve, brief, indexAssets, recordFix, knownFix } from "../memory/reel.mjs";
import { learnFromEdit, observeApprove } from "../memory/taste.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = path.join(ROOT, "videos");
const STUDIO_URL = process.env.FABLEMOTION_URL ?? "http://localhost:3711";

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
  "untitled";

const text = (t) => ({ content: [{ type: "text", text: t }] });

const server = new McpServer({ name: "fablemotion", version: "0.1.0" });

server.tool(
  "get_style_guide",
  "REQUIRED READING before composing any video. Returns the FABLEMOTION motion-director training: the aesthetic rules, pacing rules, and the full scene-spec JSON format. Call this once at the start of a video task.",
  {},
  async () =>
    text(fs.readFileSync(path.join(ROOT, "agent", "system-prompt.md"), "utf8") + brief())
);

server.tool(
  "list_videos",
  "List all videos in the FABLEMOTION library with title, format, scene count and duration.",
  {},
  async () => {
    const rows = fs
      .readdirSync(VIDEOS)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const raw = JSON.parse(fs.readFileSync(path.join(VIDEOS, f), "utf8"));
        if (isScore(raw)) {
          const secs = Math.round(scoreDuration(raw) / (raw.meta.fps ?? 30));
          return `- ${f.replace(/\.json$/, "")} — "${raw.meta.title}" (v2 score, ${raw.meta.format}, ${flattenBeats(raw).length} beats, ~${secs}s)`;
        }
        const secs = Math.round(totalDuration(raw) / (raw.fps ?? 30));
        return `- ${f.replace(/\.json$/, "")} — "${raw.title}" (${raw.format}, ${raw.scenes.length} scenes, ~${secs}s)`;
      });
    return text(rows.length ? rows.join("\n") : "Library is empty.");
  }
);

server.tool(
  "get_video",
  "Fetch the full JSON spec of a video from the library by name.",
  { name: z.string().describe("Video name, e.g. 'fable-is-back'") },
  async ({ name }) => {
    const file = path.join(VIDEOS, `${slugify(name)}.json`);
    if (!fs.existsSync(file)) return text(`No video named '${name}'. Use list_videos.`);
    return text(fs.readFileSync(file, "utf8"));
  }
);

server.tool(
  "save_video",
  "Validate and save a video spec to the library. Call get_style_guide first if you haven't — it defines the spec format. On success, returns the studio preview URL where the user can watch it live and render it. Overwrites an existing video of the same name.",
  {
    name: z.string().describe("Library name for the video (will be slugified)"),
    spec: z
      .record(z.any())
      .describe("The complete video spec object, matching the format from get_style_guide"),
  },
  async ({ name, spec }) => {
    const schema = isScore(spec) ? scoreSchema : specSchema;
    const parsed = schema.safeParse(spec);
    if (!parsed.success) {
      return text(
        `Spec rejected:\n${parsed.error.issues
          .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n")}`
      );
    }
    // CANON gate: lint before saving; errors block, warns are returned as notes.
    const score = isScore(parsed.data) ? parsed.data : compileLegacy(parsed.data);
    const issues = lintScore(score);
    const errors = issues.filter((i) => i.level === "error");
    if (errors.length)
      return text(`CANON rejects this cut:\n${errors.map((i) => `- [${i.law}] beat ${i.beat}: ${i.msg}`).join("\n")}`);
    fs.mkdirSync(VIDEOS, { recursive: true });
    const slug = slugify(name);
    // adaptive learning: if this overwrites a prior cut, learn from the diff
    const priorFile = path.join(VIDEOS, `${slug}.json`);
    const prior = fs.existsSync(priorFile) ? JSON.parse(fs.readFileSync(priorFile, "utf8")) : null;
    fs.writeFileSync(priorFile, JSON.stringify(parsed.data, null, 2));
    if (prior) learnFromEdit(prior, parsed.data);
    const secs = Math.round(scoreDuration(score) / score.meta.fps);
    const warns = issues.filter((i) => i.level === "warn");
    return text(
      `Saved '${slug}' (${flattenBeats(score).length} beats, ~${secs}s).` +
        (warns.length ? `\nCANON warnings to consider:\n${warns.map((i) => `- [${i.law}] beat ${i.beat}: ${i.msg}`).join("\n")}` : "") +
        `\nLive preview: ${STUDIO_URL}/studio?video=${slug}\nNext: eye_stills to LOOK at your beats before rendering final.`
    );
  }
);

server.tool(
  "lint_score",
  "Run the CANON laws over a v1 spec or v2 score without saving. Returns errors (blocking) and warnings (taste risks). Free and instant — lint before you save.",
  { spec: z.record(z.any()).describe("A complete v1 spec or v2 score object") },
  async ({ spec }) => {
    const schema = isScore(spec) ? scoreSchema : specSchema;
    const parsed = schema.safeParse(spec);
    if (!parsed.success)
      return text(`Invalid:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    const score = isScore(parsed.data) ? parsed.data : compileLegacy(parsed.data);
    const issues = lintScore(score);
    return text(issues.length ? issues.map((i) => `${i.level.toUpperCase()} [${i.law}] beat ${i.beat}: ${i.msg}`).join("\n") : "CANON-clean.");
  }
);

server.tool(
  "eye_stills",
  "THE EYE, in-session: renders one still per beat of a saved video (half scale, fast) and returns the PNG paths. READ those images with your Read tool, judge each beat against the style guide's CANON + psychology, then revise the score and save again. You are the critic — no key, no other model.",
  { name: z.string().describe("Name of a saved video from the library") },
  async ({ name }) => {
    const slug = slugify(name);
    const file = path.join(VIDEOS, `${slug}.json`);
    if (!fs.existsSync(file)) return text(`No video named '${name}'. Save it first.`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const score = isScore(raw) ? scoreSchema.parse(raw) : compileLegacy(specSchema.parse(raw));
    const { extractStills } = await import("../eye/extract.mjs");
    const outDir = path.join(ROOT, "eye", "out", slug, `mcp-${Date.now()}`);
    const { stills } = await extractStills(score, outDir);
    const peaks = peakFrames(score);
    return text(
      `Beat stills ready — Read each PNG and judge it (hierarchy, scale confidence, accent discipline, negative space, mood fit):\n` +
        stills.map((s) => `- beat ${s.beat} (frame ${peaks[s.beat]}): ${s.path}`).join("\n")
    );
  }
);

server.tool(
  "approve_video",
  "Record a finished video into REEL MEMORY (local, gitignored, never uploaded). Approved work becomes few-shot taste for future videos — this is how the studio self-heals toward this user's taste. Call when the user says they're happy with a cut.",
  {
    name: z.string().describe("Name of the saved video"),
    overall: z.number().min(0).max(10).optional().describe("Eye rating if one was made"),
  },
  async ({ name, overall }) => {
    const slug = slugify(name);
    const file = path.join(VIDEOS, `${slug}.json`);
    if (!fs.existsSync(file)) return text(`No video named '${name}'.`);
    const entry = approve(slug, JSON.parse(fs.readFileSync(file, "utf8")), overall != null ? { overall } : null);
    observeApprove(slug);
    indexAssets();
    return text(`'${slug}' entered reel memory (${entry.approvedAt}). Future videos will learn from it.`);
  }
);

server.tool(
  "render_video",
  "Render a saved video to MP4 with Remotion. Takes a minute or two (first ever render also downloads headless Chrome). Returns the output file path and public URL.",
  { name: z.string().describe("Name of a saved video from the library") },
  async ({ name }) => {
    const slug = slugify(name);
    const specFile = path.join(VIDEOS, `${slug}.json`);
    if (!fs.existsSync(specFile)) return text(`No video named '${name}'. Save it first.`);

    const outDir = path.join(ROOT, "public", "renders");
    const cacheDir = path.join(ROOT, ".cache");
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    const stamp = Date.now();
    const outFile = path.join(outDir, `${slug}-${stamp}.mp4`);
    // v1 files render on SpecVideo with { spec }; v2 scores on ScoreVideo with { score }.
    const raw = JSON.parse(fs.readFileSync(specFile, "utf8"));
    const composition = isScore(raw) ? "ScoreVideo" : "SpecVideo";
    const propsFile = path.join(cacheDir, `props-${stamp}.json`);
    fs.writeFileSync(propsFile, JSON.stringify(isScore(raw) ? { score: raw } : { spec: raw }));
    const bin = path.join(
      ROOT,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "remotion.cmd" : "remotion"
    );

    const result = await new Promise((resolve) => {
      const child = spawn(
        bin,
        ["render", "remotion/index.ts", composition, outFile, `--props=${propsFile}`],
        { cwd: ROOT, shell: process.platform === "win32" }
      );
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      child.on("close", (code) => resolve({ code, log }));
      child.on("error", (e) => resolve({ code: -1, log: String(e) }));
    });

    fs.rmSync(propsFile, { force: true });

    if (result.code !== 0 || !fs.existsSync(outFile)) {
      // self-healing: remember failure fingerprints and surface a fix that worked before
      const fingerprint = String(result.log).match(/Error[^\n]{0,120}/)?.[0] ?? `exit-${result.code}`;
      const fix = knownFix(fingerprint);
      if (!fix) recordFix(fingerprint, null);
      return text(
        `Render failed:\n${String(result.log).slice(-3000)}` +
          (fix ? `\n\nREEL MEMORY knows this failure — fix that worked before: ${fix}` : "")
      );
    }
    return text(
      `Rendered: ${outFile}\nServed at: ${STUDIO_URL}/renders/${path.basename(outFile)} (while the studio dev server runs)`
    );
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
