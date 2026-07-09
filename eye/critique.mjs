// THE EYE — critique.mjs: keyless vision critique through the Claude Code CLI
// (same zero-key pattern as bridge.mjs). The critic Reads the beat stills,
// judges them against CANON + psychology, and returns a Zod-validated verdict.
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { lintScore } from "../canon/canon.mjs";
import { moodBrief, FONT_PSYCHOLOGY, COLOR_PSYCHOLOGY, IMAGE_PSYCHOLOGY, MOTION_PSYCHOLOGY } from "../canon/psychology.mjs";
import { validateScore } from "../spec/score.mjs";

export const verdictSchema = z.object({
  overall: z.number().min(0).max(10),
  beats: z.array(
    z.object({
      beat: z.number().int().min(0),
      score: z.number().min(0).max(10),
      violations: z.array(z.string()).default([]),
      note: z.string().max(300).default(""),
    })
  ),
  revisedScore: z.unknown().optional(), // full Score when fixes are needed
});

function buildPrompt(score, stills, threshold) {
  const lint = lintScore(score);
  const mood = score.meta.mood ? moodBrief(score.meta.mood) : "";
  return `You are THE EYE — FABLEMOTION's taste critic. Judge rendered video stills
against the CANON. Be harsh; the bar is "how did they even do that?".

Read these beat-peak stills (one per beat, in order) with your Read tool:
${stills.map((s) => `- beat ${s.beat}: ${s.path}`).join("\n")}

The Score that produced them:
\`\`\`json
${JSON.stringify(score, null, 2)}
\`\`\`

Static lint findings (address every warn): ${JSON.stringify(lint)}
${mood ? `\nTarget mood:\n${mood}\n` : ""}
Psychology reference:
FONT ${JSON.stringify(FONT_PSYCHOLOGY)}
COLOR ${JSON.stringify(COLOR_PSYCHOLOGY)}
IMAGE ${JSON.stringify(IMAGE_PSYCHOLOGY)}
MOTION ${JSON.stringify(MOTION_PSYCHOLOGY)}

Judge each beat 0-10 for: hierarchy (one loud thing), scale confidence,
accent discipline, negative space, mood fit. A beat under ${threshold} needs a fix.

Reply with EXACTLY ONE \`\`\`json fence:
{ "overall": n, "beats": [{ "beat": i, "score": n, "violations": ["..."], "note": "..." }],
  "revisedScore": <the COMPLETE fixed Score — include ONLY if any beat < ${threshold}> }
No prose after the fence.`;
}

function extractVerdict(text) {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try {
      const parsed = verdictSchema.safeParse(JSON.parse(fences[i][1]));
      if (parsed.success) return parsed.data;
    } catch {
      // not JSON — keep looking
    }
  }
  return null;
}

/** critique(score, stills, {threshold}) → verdict (revisedScore validated if present) */
export function critique(score, stills, { threshold = 8, timeoutMs = 240000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
      windowsHide: true,
      cwd: ROOT,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("The Eye took too long."));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", () => {
      clearTimeout(timer);
      const verdict = extractVerdict(out);
      if (!verdict) return reject(new Error(`Eye returned no valid verdict. Tail: ${out.slice(-400) || err.slice(-400)}`));
      if (verdict.revisedScore != null) {
        const revised = validateScore(verdict.revisedScore);
        if (!revised.success) {
          verdict.revisedScore = undefined;
          verdict.revisionError = revised.error.issues.slice(0, 3);
        } else {
          verdict.revisedScore = revised.data;
        }
      }
      resolve(verdict);
    });
    child.stdin.write(buildPrompt(score, stills, threshold));
    child.stdin.end();
  });
}
