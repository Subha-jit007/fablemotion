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
    text(fs.readFileSync(path.join(ROOT, "agent", "system-prompt.md"), "utf8"))
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
        const spec = JSON.parse(fs.readFileSync(path.join(VIDEOS, f), "utf8"));
        const secs = Math.round(totalDuration(spec) / (spec.fps ?? 30));
        return `- ${f.replace(/\.json$/, "")} — "${spec.title}" (${spec.format}, ${spec.scenes.length} scenes, ~${secs}s)`;
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
    const parsed = specSchema.safeParse(spec);
    if (!parsed.success) {
      return text(
        `Spec rejected:\n${parsed.error.issues
          .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("\n")}`
      );
    }
    fs.mkdirSync(VIDEOS, { recursive: true });
    const slug = slugify(name);
    fs.writeFileSync(path.join(VIDEOS, `${slug}.json`), JSON.stringify(parsed.data, null, 2));
    const secs = Math.round(totalDuration(parsed.data) / parsed.data.fps);
    return text(
      `Saved '${slug}' (${parsed.data.scenes.length} scenes, ~${secs}s).\nLive preview: ${STUDIO_URL}/studio?video=${slug}\nRender with render_video when the user is happy.`
    );
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
    // The composition takes { spec } as input props; the library file is the bare spec.
    const propsFile = path.join(cacheDir, `props-${stamp}.json`);
    fs.writeFileSync(
      propsFile,
      JSON.stringify({ spec: JSON.parse(fs.readFileSync(specFile, "utf8")) })
    );
    const bin = path.join(
      ROOT,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "remotion.cmd" : "remotion"
    );

    const result = await new Promise((resolve) => {
      const child = spawn(
        bin,
        ["render", "remotion/index.ts", "SpecVideo", outFile, `--props=${propsFile}`],
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
      return text(`Render failed:\n${String(result.log).slice(-3000)}`);
    }
    return text(
      `Rendered: ${outFile}\nServed at: ${STUDIO_URL}/renders/${path.basename(outFile)} (while the studio dev server runs)`
    );
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
