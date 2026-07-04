# FABLEMOTION

**Describe a video in a sentence. Watch it get filmed.**

FABLEMOTION turns plain language into launch-grade motion graphics — the kind that ships with a
product announcement. You write a scene spec (JSON), [Remotion](https://remotion.dev) films it live
in the browser, one click renders the MP4. The look is trained on the model-announcement style:
warm paper, oversized serif, spring word-reveals, hero stats. Colorful — never the dark-AI cliché.

No account. No API key required. It runs entirely on your machine.

```sh
git clone https://github.com/Subha-jit007/fablemotion
cd fablemotion
npm install
npm run dev          # → http://localhost:3711
```

- **`/`** — landing page; the hero is a live render of `videos/fable-is-back.json`
- **`/studio`** — preview any video, edit its JSON, render an MP4, chat with the director

Requires **Node 18+**. First ever render downloads a headless Chrome (one-time, a couple minutes).

---

## Edit videos three ways

### 1. By hand — no AI, no key

The spec *is* the video. Open `/studio`, hit **JSON**, and edit — the preview updates as you type.
Or edit any file in `videos/*.json` directly. The whole grammar is nine scene types (below); you can
author a complete film without touching the agent. This is the floor: it always works, for everyone.

### 2. With Claude Code — no key

Your [Claude Code](https://claude.com/claude-code) session becomes the director; its own intelligence
composes the spec, so an Anthropic key is genuinely optional. Opening Claude Code inside this folder
auto-registers the bundled `.mcp.json`. From anywhere else:

```sh
claude mcp add fablemotion -- node mcp/server.mjs
```

Then just ask — *"a 20s portrait launch reel for my coffee app, playful, end on the name."* The
session will `get_style_guide` → compose → `save_video` → `render_video`. Keep `npm run dev` running
to watch previews at `/studio?video=<name>`. Tools: `get_style_guide`, `list_videos`, `get_video`,
`save_video`, `render_video`.

**Prefer the browser but have no key?** Run the local bridge and the studio links to it:

```sh
node bridge.mjs      # → localhost:3799, powered by your Claude Code login
```

The studio's header pill turns green (*"Claude Code linked · no key"*) and the chat box works — no
API key involved. (Windows: double-click `wake-fablemotion.bat`.)

### 3. With an Anthropic API key — optional

Click **key** in the studio header and paste an `sk-ant-…` key (stored only in your browser), or set
`ANTHROPIC_API_KEY` in `.env.local` for a shared server-side key. Model defaults to `claude-opus-4-8`;
override with `FABLEMOTION_MODEL`.

---

## The scene grammar

Every video is `{ title, format, fps, theme, backdrop, scenes[] }`. `format` is
`landscape` | `portrait` | `square`; `theme.preset` is `paper` | `ink` | `candy`; `backdrop` is
`drift` | `grain` | `none`. Each scene has a `type` and `durationInFrames`:

| type | fields | for |
|---|---|---|
| `title` | `text`, `sub?` | the headline moment (last word auto-italicizes in the accent) |
| `kinetic` | `words` (2–8) | rapid one-word-at-a-time hook |
| `statement` | `lines` (1–5), `accentLine?` | line-by-line manifesto |
| `counter` | `value`, `label`, `prefix?`, `suffix?`, `decimals` | one hero stat counting up |
| `list` | `title?`, `items` (2–6) | numbered lineup |
| `code` | `title?`, `code` | a terminal typing a snippet |
| `chart` | `title?`, `data` (2–6 `{label,value}`) | bar comparison |
| `compare` | `title?`, `left`, `right` (`{label,value}`) | before / after |
| `logo` | `text`, `tagline?` | closing sting |

The full rules — pacing, aesthetic, examples — live in **`agent/system-prompt.md`**. That one file is
the director's training; edit it to change the house style. `spec/schema.mjs` is the Zod source of
truth shared by the composition, the API, and the MCP server, so bad specs are caught everywhere.

## Render

One click in the studio, or from the CLI:

```sh
# props file is { "spec": { …a videos/*.json… } }
npx remotion render remotion/index.ts SpecVideo out.mp4 --props=props.json
```

`npm run remotion:studio` opens Remotion Studio for frame-by-frame work. Renders land in
`public/renders/`.

## Layout

```
spec/schema.mjs        the DSL (Zod) — single source of truth
remotion/              the composition: 9 scene types × 3 themes × 3 formats
agent/system-prompt.md the director's training (aesthetic + pacing + spec contract)
app/                   Next.js studio + landing (/, /studio) + API routes
mcp/server.mjs         MCP server — makes Claude Code the director
bridge.mjs             local no-key bridge for the browser studio
videos/                the library (plain JSON specs)
```

MIT licensed. Made with webs, not templates — by [Subha](https://github.com/Subha-jit007).
