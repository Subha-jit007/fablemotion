# FABLEMOTION

Prompt-to-motion studio. Describe a launch video in a sentence — an agent composes a **scene
spec** (JSON), Remotion films it live in the browser, one click renders the MP4. The aesthetic is
trained on the model-announcement style: warm paper, oversized serif, spring word-reveals, hero
stats. Colorful, never the dark-AI cliché.

## Run it

```sh
npm install
npm run dev          # → http://localhost:3711
```

- `/` — landing page (the hero *is* a live render of `videos/fable-is-back.json`)
- `/studio` — chat with the agent, watch the preview, save to library, render MP4

## Two ways to direct

### 1. Web agent (needs an Anthropic API key — optional)

Click **key** in the studio header and paste an `sk-ant-…` key (stored in your browser's
localStorage, sent only to your own local server). Or set `ANTHROPIC_API_KEY` in `.env.local` to
share one server-side. Model defaults to `claude-opus-4-8`; override with `FABLEMOTION_MODEL`.

### 2. Claude Code over MCP (no API key needed)

Your Claude Code session *is* the director — its own intelligence composes the spec, so the
Anthropic key is genuinely optional.

If you open Claude Code inside this folder, the bundled `.mcp.json` registers the server
automatically. From anywhere else:

```sh
claude mcp add fablemotion -- node E:/Projects/fablemotion/mcp/server.mjs
```

Then just ask, e.g. *"make a 20-second launch reel for my portfolio"*. The session will:

1. `get_style_guide` — load the motion-director training (aesthetic + spec format)
2. `save_video` — validate + save the spec; replies with a live studio preview link
3. `render_video` — export the MP4 with Remotion

Other tools: `list_videos`, `get_video`. Keep `npm run dev` running to watch previews at
`http://localhost:3711/studio?video=<name>`.

## The engine

- `spec/schema.mjs` — the scene-spec DSL (Zod). Single source of truth shared by the Remotion
  composition, the API routes, and the MCP server.
- `remotion/` — the composition. 9 scene types: `title`, `kinetic`, `statement`, `counter`,
  `list`, `code`, `chart`, `compare`, `logo`. Three themes: `paper`, `ink`, `candy`. Formats:
  landscape / portrait / square.
- `agent/system-prompt.md` — the "training": aesthetic rules, pacing rules, DSL reference,
  output contract. Served to the web agent as its system prompt and to Claude Code via the
  `get_style_guide` MCP tool. Edit this file to retrain the director.
- `videos/` — the library (plain JSON specs; web and MCP share it)
- `public/renders/` — rendered MP4s

## Notes

- First ever render downloads headless Chrome (~one-time, a few minutes).
- `npm run remotion:studio` opens Remotion Studio for frame-by-frame scene development.
- Render from the CLI: `npx remotion render remotion/index.ts SpecVideo out.mp4 --props=<file>`
  where the props file is `{ "spec": { … } }`.
