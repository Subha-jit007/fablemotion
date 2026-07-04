// FABLEMOTION — local director bridge. Zero dependencies.
// Lets the LIVE site (fablemotion.subhajitmahata.workers.dev) drive the studio
// through YOUR Claude Code login — no Anthropic API key, no cloud bill.
//
// Run:  node bridge.mjs   (or double-click wake-fablemotion.bat)
// The hosted /studio page probes http://localhost:3799 over loopback and,
// when it finds this bridge, routes the chat here instead of asking for a key.
import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { validateSpec } from "./spec/schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.FABLEMOTION_BRIDGE_PORT || 3799;
const PROMPT_PATH = path.join(__dirname, "agent", "system-prompt.md");

const FALLBACK_PROMPT =
  "You are the FABLEMOTION motion director. Turn the user's request into a " +
  "complete scene spec for the studio. Reply with one short sentence, then " +
  "exactly one ```json fence containing the full spec.";

function loadPrompt() {
  try {
    return fs.readFileSync(PROMPT_PATH, "utf8").trim();
  } catch {
    return FALLBACK_PROMPT;
  }
}

const STUDIO_CONTEXT = `

=== FABLEMOTION STUDIO — LIVE SESSION ===
You are the director inside the studio, speaking through the live website.
Every reply is: ONE short human sentence, then EXACTLY ONE \`\`\`json fence
holding the COMPLETE updated scene spec (the whole object, never a diff).
Honor the aesthetic + DSL rules above. Do not add prose after the fence.`;

function buildPrompt(messages, spec) {
  const soul = loadPrompt();
  const transcript = messages
    .slice(-16)
    .map((m) => (m.role === "user" ? "User: " : "Director: ") + m.content)
    .join("\n\n");
  const current = spec
    ? `\n\nCurrent spec in the studio:\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\``
    : "";
  return `${soul}${STUDIO_CONTEXT}${current}\n\nConversation so far:\n\n${transcript}\n\nReply now — one short sentence, then one complete \`\`\`json spec fence:`;
}

function extractSpec(text) {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try {
      const raw = JSON.parse(fences[i][1]);
      const parsed = validateSpec(raw);
      if (parsed.success) return { spec: parsed.data, issues: null };
      return { spec: null, issues: parsed.error.issues };
    } catch {
      // not JSON — keep looking
    }
  }
  return { spec: null, issues: null };
}

// ---- Claude Code CLI (no API key — uses your subscription login) ----
function directViaCli(messages, spec) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Director took too long (180s). Try a simpler ask."));
    }, 180000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(err.trim() || `claude CLI exited ${code}`));
    });
    child.stdin.write(buildPrompt(messages, spec));
    child.stdin.end();
  });
}

function detectCli() {
  return new Promise((resolve) => {
    const child = spawn("claude", ["--version"], { shell: true, windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? out.trim() : null));
  });
}

// CORS + Chrome Private/Local Network Access so the public hosted page can
// reach this loopback bridge on the visitor's own machine.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-allow-private-network": "true",
  "access-control-allow-local-network": "true",
};

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", ...CORS });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === "GET" && (url.pathname === "/api/status" || url.pathname === "/")) {
    const v = await detectCli();
    return json(res, 200, {
      bridge: "fablemotion",
      cli: !!v,
      version: v,
      prompt: fs.existsSync(PROMPT_PATH),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/agent") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      try {
        const { messages, spec } = JSON.parse(body);
        if (!Array.isArray(messages) || !messages.length)
          return json(res, 400, { error: "Body must be { messages, spec? }" });
        const text = await directViaCli(messages, spec);
        const { spec: nextSpec, issues } = extractSpec(text);
        const reply = text.replace(/```(?:json)?\s*\n[\s\S]*?```/g, "").trim();
        json(res, 200, { reply: reply || "Done — spec updated.", spec: nextSpec, issues });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`\n  FABLEMOTION director bridge  →  http://localhost:${PORT}`);
  console.log(`  prompt: ${fs.existsSync(PROMPT_PATH) ? PROMPT_PATH : "fallback"}`);
  console.log(`  Open the live studio and it will link to this bridge — no API key.\n`);
});
