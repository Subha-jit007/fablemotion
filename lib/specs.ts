import fs from "fs";
import path from "path";
import { validateSpec, totalDuration } from "../spec/schema.mjs";

const VIDEOS_DIR = path.join(process.cwd(), "videos");

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

export function listVideos() {
  if (!fs.existsSync(VIDEOS_DIR)) return [];
  return fs
    .readdirSync(VIDEOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const name = f.replace(/\.json$/, "");
      try {
        const spec = JSON.parse(fs.readFileSync(path.join(VIDEOS_DIR, f), "utf8"));
        return {
          name,
          title: spec.title ?? name,
          format: spec.format ?? "landscape",
          scenes: spec.scenes?.length ?? 0,
          seconds: Math.round(totalDuration(spec) / (spec.fps ?? 30)),
        };
      } catch {
        return { name, title: name, format: "?", scenes: 0, seconds: 0 };
      }
    });
}

export function getVideo(name: string) {
  const file = path.join(VIDEOS_DIR, `${slugify(name)}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function saveVideo(name: string, spec: unknown) {
  const parsed = validateSpec(spec);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues };
  }
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  const slug = slugify(name);
  fs.writeFileSync(
    path.join(VIDEOS_DIR, `${slug}.json`),
    JSON.stringify(parsed.data, null, 2)
  );
  return { ok: true as const, name: slug, spec: parsed.data };
}
