import { validateSpec, totalDuration } from "../spec/schema.mjs";
import { EMBEDDED_VIDEOS } from "./embedded";

// fs is unavailable on Cloudflare Workers — fall back to the embedded library there.
function tryFs() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const dir = path.join(process.cwd(), "videos");
    if (fs.existsSync(dir)) return { fs, path, dir };
  } catch {
    /* filesystem-less host */
  }
  return null;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

function row(name: string, spec: any) {
  return {
    name,
    title: spec.title ?? name,
    format: spec.format ?? "landscape",
    scenes: spec.scenes?.length ?? 0,
    seconds: Math.round(totalDuration(spec) / (spec.fps ?? 30)),
  };
}

export function listVideos() {
  const io = tryFs();
  if (!io) return Object.entries(EMBEDDED_VIDEOS).map(([name, spec]) => row(name, spec));
  return io.fs
    .readdirSync(io.dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const name = f.replace(/\.json$/, "");
      try {
        return row(name, JSON.parse(io.fs.readFileSync(io.path.join(io.dir, f), "utf8")));
      } catch {
        return { name, title: name, format: "?", scenes: 0, seconds: 0 };
      }
    });
}

export function getVideo(name: string) {
  const slug = slugify(name);
  const io = tryFs();
  if (!io) return EMBEDDED_VIDEOS[slug] ?? null;
  const file = io.path.join(io.dir, `${slug}.json`);
  if (!io.fs.existsSync(file)) return EMBEDDED_VIDEOS[slug] ?? null;
  return JSON.parse(io.fs.readFileSync(file, "utf8"));
}

export function saveVideo(name: string, spec: unknown) {
  const parsed = validateSpec(spec);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues };
  }
  const io = tryFs();
  if (!io) {
    return { ok: false as const, readonly: true, error: [] };
  }
  const slug = slugify(name);
  io.fs.writeFileSync(
    io.path.join(io.dir, `${slug}.json`),
    JSON.stringify(parsed.data, null, 2)
  );
  return { ok: true as const, name: slug, spec: parsed.data };
}
