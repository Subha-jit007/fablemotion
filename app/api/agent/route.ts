import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { validateSpec } from "../../../spec/schema.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = process.env.FABLEMOTION_MODEL ?? "claude-opus-4-8";

function systemPrompt() {
  return fs.readFileSync(path.join(process.cwd(), "agent", "system-prompt.md"), "utf8");
}

function extractSpec(text: string) {
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

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-anthropic-key") || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No Anthropic API key. Add one in Settings — or skip the key entirely and drive this studio from Claude Code via the MCP server (see README).",
      },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Body must be { messages, spec? }" }, { status: 400 });
  }

  const history = body.messages
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
    .map((m: { role: "user" | "assistant"; content: string }) => ({
      role: m.role,
      content: m.content,
    }));

  if (body.spec) {
    const last = history[history.length - 1];
    last.content = `Current spec in the studio:\n\`\`\`json\n${JSON.stringify(
      body.spec,
      null,
      2
    )}\n\`\`\`\n\n${last.content}`;
  }

  const client = new Anthropic({ apiKey });

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
      ],
      messages: history,
    });
    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      return NextResponse.json({ reply: "The model declined this request. Try rephrasing.", spec: null });
    }

    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const { spec, issues } = extractSpec(text);
    const reply = text.replace(/```(?:json)?\s*\n[\s\S]*?```/g, "").trim();

    return NextResponse.json({
      reply: reply || "Done — spec updated.",
      spec,
      issues,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error: ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: "Agent request failed." }, { status: 500 });
  }
}
