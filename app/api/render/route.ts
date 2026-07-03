import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { validateSpec } from "../../../spec/schema.mjs";
import { slugify } from "../../../lib/specs";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error:
          "Rendering runs locally — Remotion needs headless Chrome, which serverless can't host. Clone the repo, `npm run dev`, and hit Render there (or use the MCP render_video tool).",
      },
      { status: 501 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = validateSpec(body?.spec);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid spec", issues: parsed.error.issues }, { status: 422 });
  }
  const spec = parsed.data;

  const root = process.cwd();
  const cacheDir = path.join(root, ".cache");
  const outDir = path.join(root, "public", "renders");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = Date.now();
  const slug = `${slugify(spec.title)}-${stamp}`;
  const propsFile = path.join(cacheDir, `props-${stamp}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ spec }));
  const outFile = path.join(outDir, `${slug}.mp4`);

  const bin = path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "remotion.cmd" : "remotion"
  );

  const result = await new Promise<{ code: number | null; log: string }>((resolve) => {
    const child = spawn(
      bin,
      ["render", "remotion/index.ts", "SpecVideo", outFile, `--props=${propsFile}`],
      { cwd: root, shell: process.platform === "win32" }
    );
    let log = "";
    child.stdout.on("data", (d) => (log += d.toString()));
    child.stderr.on("data", (d) => (log += d.toString()));
    child.on("close", (code) => resolve({ code, log }));
    child.on("error", (e) => resolve({ code: -1, log: String(e) }));
  });

  fs.rmSync(propsFile, { force: true });

  if (result.code !== 0 || !fs.existsSync(outFile)) {
    return NextResponse.json(
      { error: "Render failed", log: result.log.slice(-4000) },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: `/renders/${slug}.mp4`, file: outFile });
}
