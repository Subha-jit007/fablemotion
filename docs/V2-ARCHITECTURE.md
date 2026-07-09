# FABLEMOTION v2 — The Director Architecture

> Remotion renders. HyperFrames writes. FableMotion **directs**.

**Status (5 Jul 2026): implemented and verified.** M1 CANON+Score+macros (6/6 tests) ·
M2 Remotion stage (marquee demo rendered) · M3 THE EYE (keyless loop ran, critiqued 3 beats,
auto-revised the cut) · M4 REEL MEMORY (learn/approve/assets/fixes, gitignored, injected into
bridge + MCP) · psychology layer (`canon/psychology.mjs`, `meta.mood`) · pixel/marquee treatment
(deterministic 5×7 bitmap font). Hosted site deleted — clone-and-run is the product.

## The problem with v1 (and with HyperFrames)

v1 guaranteed taste by *enumerating* it: 9 scene types in `spec/schema.mjs`. That put the
constraint at the **expressiveness** layer — Claude's brain got a menu, not a stage.

HyperFrames made the opposite mistake: arbitrary HTML, infinite ceiling, **no floor**. The
agent writes blind, the renderer prints whatever it gets, and nothing in the system knows
whether the video is good. It's a printer, not a director.

The v2 thesis: **constrain the vocabulary, free the composition, and give judgment eyes.**

```
 prompt ──► CLAUDE (director, keyless via bridge/MCP)
                │ writes
                ▼
            SCORE  ◄──────────── patch ─────────┐
   (intent-level timeline IR, Zod)              │
                │ lint (CANON laws)             │
                ▼                               │
            STAGE(s)                         THE EYE
   remotion/ (local)  hyperframes/ (cloud)   claude vision critiques
                │ renderStill per beat ────────►│ stills vs CANON
                ▼
            final MP4          REEL MEMORY ◄─ approved Scores (few-shot taste)
```

## Layer 1 — CANON (`canon/`)

The taste constitution, split into **tokens** (the only vocabulary the Score may use) and
**laws** (machine-checkable rules). This is where the v1 discipline moves — from scene enum
to design system.

- **Tokens**: `THEME_PRESETS` (paper/ink/candy, unchanged), a type scale (`display`,
  `headline`, `body`, `caption` — per format), named easings (`snap`, `settle`, `drift`,
  `spring`), a spacing grid (12-col regions, safe margins per format), beat-duration bands
  per intent.
- **Laws** (`lintScore(score) → issues[]`): max simultaneous cast on screen, min type size
  per format, fg/bg contrast ≥ 4.5, one accent color per beat (two = flagged), duration
  within intent band, no beat without a `rest` neighbor after two `punch` beats, banned
  patterns from [video-no-dark-ai-cliche]. Pure functions, deterministic, unit-testable —
  same philosophy as the Raft core.

## Layer 2 — SCORE (`spec/score.mjs`)

The new single source of truth. Not a scene enum — a hierarchical timeline IR:

```js
score = {
  meta: { title, format, fps, theme },          // unchanged from v1
  cast: {                                        // named elements, declared once
    hook:   { kind: "text", role: "display", content: "FABLE IS BACK" },
    graph:  { kind: "chart", data: [...] },
    crab:   { kind: "media", src: "clawed.png", cutout: true },
    scene3: { kind: "custom", component: "OrbitRig", props: {...},   // escape hatch:
              declares: { durationInFrames: 120 } },                 // arbitrary TSX, but
  },                                                                 // it MUST declare timing
  acts: [                                        // acts → beats → moves
    { beats: [
      { intent: "hook",                          // hook|build|reveal|punch|rest|outro
        duration: { band: "hook" },              // resolved from CANON bands
        moves: [
          { verb: "enter", cast: "hook", ease: "snap", at: "grid:center" },
          { verb: "emphasize", cast: "hook", ease: "spring", offsetBeats: 0.5 },
        ]},
    ]},
  ],
}
```

- **Verbs**, not scene types: `enter · exit · emphasize · morph · track · mask · follow`.
  Every verb takes a CANON easing token and a grid region. Claude composes ANY scene from
  these — kinetic type, counters, charts, split-screens, things v1 could never express —
  and every combination is still inside the design system.
- **v1 compatibility**: the 9 old scene types become **macros** in `spec/macros.mjs`
  (`title(…) → Score fragment`). `compileLegacy(oldSpec) → score` keeps every
  `videos/*.json` working day one.
- **`custom` cast kind** is the pressure valve: a sandboxed TSX/HTML fragment allowed only
  if it declares its duration and props, so the timeline stays deterministic and seekable.
  This matches HyperFrames' expressiveness without giving up the IR.

## Layer 3 — STAGE (`stage/`)

Pluggable render targets that interpret the Score. The Score is *above* any renderer —
this is the judo move against HyperFrames.

- `stage/remotion/` — today's engine, refactored from "9 components" to a Score
  interpreter: cast kinds are components, verbs are animation hooks, `calculateMetadata`
  still derives size/fps/duration from the Score. Deterministic as before.
- `stage/hyperframes/` — a **compiler**: Score → HyperFrames HTML (`data-start`,
  `data-duration`, GSAP timelines mapped from easing tokens). Their Apache-2.0 renderer
  and Lambda cloud rendering become a free back end. HyperFrames stops being a competitor
  and becomes a target. They own pixels; we own intent.

Because the IR is intent-level, it is **diffable** ("beat 3: punch → reveal"), **lintable**
(CANON laws), and **retargetable** — three things raw HTML can never be.

## Layer 4 — THE EYE (`eye/`) — the layer nobody else has

HyperFrames' agent never sees its own video. Ours watches the dailies.

1. `eye/extract.mjs` — for each beat, `renderStill` at the beat's peak frame (cheap; no
   full render).
2. `eye/critique.mjs` — send stills + CANON + Score to Claude **vision** through the
   existing keyless bridge (`bridge.mjs`, port 3799) or MCP. Output contract (Zod, like
   `validateSpec`):
   ```js
   { beats: [{ beat: 2, score: 6, violations: ["contrast", "two-accents"],
               patch: { /* Score JSON-patch */ } }] }
   ```
3. `eye/loop.mjs` — apply patches → re-lint → re-extract → re-critique. Stop when every
   beat ≥ 8/10 or after 3 rounds. Only then run the full render.

Keyless end-to-end: Claude Code login is both the writer and the critic. Same suuu
pattern that already works, now closed into a perceptual loop.

## Layer 5 — REEL MEMORY (`memory/reel/`) — self-healing, zero data collection

The system gets better from each user's data **without collecting anyone's data**. The
guarantee is structural, not a policy promise: all learning artifacts live inside the
user's own clone, `memory/reel/` is gitignored, and there is no telemetry endpoint anywhere
in the codebase. The only network call in the loop is the user's own Claude session. Your
data trains *your* copy — nobody else's.

Four local signals feed the loop:

1. **Approved work** — every video the user renders/keeps stores its Score + final Eye
   scores in `memory/reel/scores/`. Top-k winners are injected into the agent system
   prompt as few-shot examples. Taste compounds from the user's own shipped work.
2. **Correction diffs** — when the user hand-edits a Score the agent proposed, the
   JSON-patch between proposal and what they kept is a preference signal. Patches are
   stored in `memory/reel/corrections/` and periodically distilled (by the agent itself,
   keyless) into `memory/reel/preferences.md`, appended to the system prompt. The agent
   stops making the same mistake — taste self-heals per user.
3. **Canon auto-tuning** — if the Eye keeps flagging a law the user keeps overriding
   (e.g. they *like* two accents per beat), the law relaxes locally via
   `canon/local.mjs` (gitignored overrides). The shipped CANON stays opinionated; each
   clone drifts toward its owner.
4. **Failure fingerprints** — render/runtime errors are fingerprinted with their eventual
   fix in `memory/reel/fixes.json` (the `remotion.cmd shell:true` class of problem). On
   recurrence the fix auto-applies before retry. The launch script already self-heals the
   bridge; this extends the same idea to the render pipeline.

Combined with THE EYE (which self-heals *quality* per video), REEL MEMORY self-heals the
*system* across videos: quality floor rises with use, per machine, privately.

## Director surfaces (unchanged, extended)

- **MCP** (`mcp/server.mjs`): existing tools + `lint_score`, `critique_render`.
- **Studio** (`/studio`): JSON editor edits the Score; new "Director pass" button runs the
  Eye loop with per-beat scores shown inline.
- **By hand**: Score is still plain JSON — no AI, no key, clone-and-run stays the product.

## Why this beats HyperFrames

| | HyperFrames | FABLEMOTION v2 |
|---|---|---|
| Format | raw HTML (DOM soup diffs) | intent-level IR: lintable, diffable, retargetable |
| Taste floor | none — renders anything | CANON tokens + laws; floor is launch-grade |
| Feedback | renders blind | THE EYE: vision critique loop, keyless |
| Learning | static skills | REEL MEMORY: few-shot from own approved work |
| Their renderer | is the product | is *one of our stages* (free cloud renders) |
| Cost | Lambda infra | zero-key local loop on a Claude Code login |

## Milestones

1. **M1** — `spec/score.mjs` + CANON tokens/laws + `lintScore` + legacy macros + tests.
2. **M2** — Remotion stage interprets the Score (verbs as animation hooks); studio editor
   and player on Score; `videos/*.json` migrated via macros.
3. **M3** — THE EYE: extract → critique → loop through the bridge; MCP `critique_render`;
   verified end-to-end like the 4 Jul HELLO round-trip.
4. **M4** — REEL MEMORY few-shot injection.
5. **M5** (optional, later) — `stage/hyperframes/` compiler for cloud renders.

Windows gotchas carry over: renders spawn `node_modules/.bin/remotion.cmd` with
`shell: true`; JSON spec imports need `as unknown as Spec`.
