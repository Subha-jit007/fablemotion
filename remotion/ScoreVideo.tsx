import React from "react";
import {
  AbsoluteFill,
  Series,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveTheme } from "../spec/schema.mjs";
import { EASINGS, TYPE_SCALE, FORMAT_TYPE_FACTOR } from "../canon/canon.mjs";
import { flattenBeats } from "../spec/score.mjs";
import type { Theme } from "./types";
import type { Score, Beat, Move, CastElement, Region } from "./types";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'Cascadia Code', Consolas, 'Courier New', monospace";
const FONTS = { serif: SERIF, sans: SANS, mono: MONO };

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

type Ctx = { theme: Theme; format: "landscape" | "portrait" | "square" };

const px = (role: keyof typeof TYPE_SCALE, ctx: Ctx) =>
  Math.round(TYPE_SCALE[role] * FORMAT_TYPE_FACTOR[ctx.format]);

// ---------- pixel treatment: deterministic 5×7 bitmap font, zero assets ----------

export const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
};

const PixelText: React.FC<{
  text: string;
  color: string;
  cell: number; // dot size in px
  glow?: boolean;
  progress?: number; // 0..1 — glyphs light up left to right
}> = ({ text, color, cell, glow, progress = 1 }) => {
  const chars = text.toUpperCase().split("");
  const lit = Math.ceil(chars.length * progress);
  return (
    <div style={{ display: "flex", gap: cell }} aria-label={text}>
      {chars.map((ch, ci) => {
        const rows = GLYPHS[ch] ?? GLYPHS[" "];
        const on = ci < lit;
        return (
          <div key={ci} style={{ display: "flex", flexDirection: "column", gap: Math.max(1, cell * 0.28) }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: Math.max(1, cell * 0.28) }}>
                {[4, 3, 2, 1, 0].map((bit) => {
                  const dot = on && (row >> bit) & 1;
                  return (
                    <div
                      key={bit}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: cell * 0.24,
                        background: dot ? color : "transparent",
                        boxShadow: dot && glow ? `0 0 ${cell * 1.6}px ${color}` : "none",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ---------- shared ----------

const springOf = (frame: number, fps: number, ease?: string) =>
  spring({ frame, fps, config: (EASINGS as any)[ease ?? "settle"] });

const DIR_OFFSET: Record<string, [number, number]> = {
  up: [0, 70],
  down: [0, -70],
  left: [70, 0],
  right: [-70, 0],
};

// ---------- cast renderers ----------

const TextEl: React.FC<{ el: Extract<CastElement, { kind: "text" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  const { theme } = ctx;
  const size = px(el.role, ctx);
  const font = FONTS[el.font ?? (el.role === "kicker" || el.role === "caption" ? "sans" : "serif")];

  if (el.treatment === "pixel") {
    const cell = Math.max(4, Math.round(size / 9));
    const progress = interpolate(local, [0, Math.min(30, 6 * el.content.length)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const color = el.accent === "all" ? theme.accent : theme.fg;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: cell * 2, alignItems: "center" }}>
        {el.content.split("\n").map((line, i) => (
          <PixelText key={i} text={line} color={color} cell={cell} glow={el.glow} progress={progress} />
        ))}
      </div>
    );
  }

  const lines = el.content.split("\n");
  const accentLine = /^line:\d$/.test(el.accent) ? Number(el.accent.slice(5)) : -1;
  if (el.role === "kicker") {
    return (
      <div
        style={{
          fontFamily: font,
          fontSize: size,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: theme.accent,
          fontWeight: 600,
          textShadow: el.glow ? `0 0 ${size}px ${theme.accent}` : "none",
        }}
      >
        {el.content}
      </div>
    );
  }
  return (
    <div style={{ textAlign: el.align, maxWidth: "94%" }}>
      {lines.map((line, li) => {
        const words = line.split(" ");
        return (
          <div key={li} style={{ overflow: "hidden", padding: "0.06em 0" }}>
            <div style={{ fontFamily: font, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {words.map((word, wi) => {
                const s = spring({
                  frame: local - li * 9 - wi * 4,
                  fps,
                  config: { damping: 16, stiffness: 130, mass: 0.6 },
                });
                const isAccent =
                  el.accent === "all" ||
                  li === accentLine ||
                  (el.accent === "last-word" && li === lines.length - 1 && wi === words.length - 1 && words.length > 1);
                return (
                  <span
                    key={wi}
                    style={{
                      display: "inline-block",
                      marginRight: "0.26em",
                      transform: `translateY(${(1 - s) * 70}px)`,
                      opacity: s,
                      fontStyle: isAccent ? "italic" : "normal",
                      color: isAccent ? theme.accent : theme.fg,
                      textShadow: el.glow ? `0 0 ${size * 0.5}px ${isAccent ? theme.accent : theme.fg}` : "none",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CounterEl: React.FC<{ el: Extract<CastElement, { kind: "counter" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  const progress = spring({ frame: local, fps, config: (EASINGS as any).drift, durationInFrames: 70 });
  const shown = (el.value * progress).toFixed(el.decimals);
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: px("mega", ctx) * 1.36,
          letterSpacing: "-0.04em",
          color: ctx.theme.accent,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {el.prefix ?? ""}
        {Number(shown).toLocaleString("en-US", {
          minimumFractionDigits: el.decimals,
          maximumFractionDigits: el.decimals,
        })}
        <span style={{ fontSize: px("display", ctx) * 1.2, fontStyle: "italic" }}>{el.suffix ?? ""}</span>
      </div>
      {el.label && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: px("caption", ctx),
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 46,
            opacity: 0.75,
            fontWeight: 600,
            color: ctx.theme.fg,
          }}
        >
          {el.label}
        </div>
      )}
    </div>
  );
};

const ListEl: React.FC<{ el: Extract<CastElement, { kind: "list" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ width: "84%" }}>
      {el.items.map((item, i) => {
        const sp = spring({ frame: local - 10 - i * 8, fps, config: { damping: 18, stiffness: 120 } });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 38,
              padding: "26px 0",
              borderBottom: `2px solid ${ctx.theme.soft}`,
              transform: `translateX(${(1 - sp) * 60}px)`,
              opacity: sp,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 30, color: ctx.theme.accent, minWidth: 66 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontFamily: SERIF, fontSize: px("body", ctx), letterSpacing: "-0.01em", color: ctx.theme.fg }}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const CodeEl: React.FC<{ el: Extract<CastElement, { kind: "code" }>; ctx: Ctx; local: number; beatDuration: number }> = ({
  el,
  ctx,
  local,
  beatDuration,
}) => {
  const typeFrames = Math.max(10, beatDuration - 40);
  const chars = Math.floor(
    interpolate(local, [12, 12 + typeFrames], [0, el.code.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const cursorOn = Math.floor(local / 14) % 2 === 0;
  return (
    <div style={{ width: "82%", background: "#141210", borderRadius: 22, boxShadow: "0 40px 90px rgba(20,15,10,0.35)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 30px", borderBottom: "1px solid #2A2622" }}>
        {[ctx.theme.accent, ctx.theme.accent2, "#C9BFA9"].map((c, i) => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
        ))}
        <span style={{ fontFamily: MONO, color: "#8F8779", fontSize: 24, marginLeft: 16 }}>{el.title ?? "terminal"}</span>
      </div>
      <pre style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.65, color: "#F0E9DA", padding: "38px 44px", margin: 0, whiteSpace: "pre-wrap", minHeight: 200 }}>
        {el.code.slice(0, chars)}
        <span style={{ opacity: cursorOn ? 1 : 0, color: ctx.theme.accent }}>▌</span>
      </pre>
    </div>
  );
};

const ChartEl: React.FC<{ el: Extract<CastElement, { kind: "chart" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  const max = Math.max(...el.data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 54, height: 460, width: "80%", justifyContent: "center" }}>
      {el.data.map((d, i) => {
        const grow = spring({ frame: local - 8 - i * 6, fps, config: { damping: 22, stiffness: 90 } });
        const h = (d.value / max) * 100 * grow;
        const hot = d.value === max;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", flex: 1, maxWidth: 200 }}>
            <div style={{ fontFamily: SERIF, fontSize: 44, marginBottom: 18, opacity: grow, fontStyle: hot ? "italic" : "normal", color: hot ? ctx.theme.accent : ctx.theme.fg }}>
              {d.value.toLocaleString("en-US")}
            </div>
            <div style={{ width: "100%", height: `${h}%`, background: hot ? ctx.theme.accent : ctx.theme.fg, borderRadius: "14px 14px 0 0", opacity: hot ? 1 : 0.82 }} />
            <div style={{ fontFamily: SANS, fontSize: 26, marginTop: 20, opacity: 0.7, fontWeight: 600, color: ctx.theme.fg }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const CompareEl: React.FC<{ el: Extract<CastElement, { kind: "compare" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  const left = spring({ frame: local - 6, fps, config: { damping: 18, stiffness: 100 } });
  const right = spring({ frame: local - 14, fps, config: { damping: 18, stiffness: 100 } });
  const bar = spring({ frame: local - 22, fps, config: { damping: 40 } });
  const Cell = ({ v, label, sp, dir, accent }: { v: string; label: string; sp: number; dir: number; accent: boolean }) => (
    <div style={{ flex: 1, textAlign: "center", transform: `translateX(${(1 - sp) * 120 * dir}px)`, opacity: sp }}>
      <div style={{ fontFamily: SERIF, fontSize: 190, letterSpacing: "-0.03em", color: accent ? ctx.theme.accent : ctx.theme.fg, fontStyle: accent ? "italic" : "normal", lineHeight: 1 }}>
        {v}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 34, opacity: 0.7, fontWeight: 600, color: ctx.theme.fg }}>
        {label}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", width: "92%", gap: 40 }}>
      <Cell v={el.left.value} label={el.left.label} sp={left} dir={-1} accent={false} />
      <div style={{ width: 4, height: 260, background: ctx.theme.soft, transform: `scaleY(${bar})` }} />
      <Cell v={el.right.value} label={el.right.label} sp={right} dir={1} accent />
    </div>
  );
};

const ShapeEl: React.FC<{ el: Extract<CastElement, { kind: "shape" }>; ctx: Ctx; local: number }> = ({
  el,
  ctx,
  local,
}) => {
  const { fps } = useVideoConfig();
  if (el.shape === "rule") {
    const s = spring({ frame: local, fps, config: { damping: 40 } });
    return <div style={{ width: el.size ?? 120, height: 5, background: ctx.theme.accent, transform: `scaleX(${s})` }} />;
  }
  if (el.shape === "ring") {
    const ring = spring({ frame: local, fps, config: { damping: 30, stiffness: 60 } });
    return (
      <div
        style={{
          position: "absolute",
          width: el.size ?? 620,
          height: el.size ?? 620,
          borderRadius: "50%",
          border: `3px solid ${ctx.theme.accent}`,
          transform: `scale(${0.4 + ring * 0.8})`,
          opacity: (1 - ring) * 0.9,
        }}
      />
    );
  }
  // sign — glowing marquee panel; renders behind siblings in the same region
  const s = spring({ frame: local, fps, config: (EASINGS as any).pop });
  const w = el.size ?? 900;
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: w * 0.42,
        borderRadius: w * 0.045,
        background: "#F5EDD6",
        boxShadow: `0 0 ${w * 0.09}px #F5EDD6AA, 0 0 ${w * 0.2}px #F5EDD644`,
        transform: `scale(${0.85 + s * 0.15})`,
        opacity: s,
      }}
    />
  );
};

const MediaEl: React.FC<{ el: Extract<CastElement, { kind: "media" }> }> = ({ el }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={el.src}
    alt=""
    style={{
      width: el.width ?? 480,
      borderRadius: el.cutout ? 0 : 24,
      boxShadow: el.cutout ? "none" : "0 30px 70px rgba(20,15,10,0.3)",
      imageRendering: el.src.endsWith(".png") ? "pixelated" : "auto",
    }}
  />
);

const CustomEl: React.FC<{ el: Extract<CastElement, { kind: "custom" }> }> = ({ el }) => (
  <div
    style={{ width: el.width, height: el.height, overflow: "hidden" }}
    dangerouslySetInnerHTML={{ __html: el.html }}
  />
);

const CastSwitch: React.FC<{ el: CastElement; ctx: Ctx; local: number; beatDuration: number }> = ({
  el,
  ctx,
  local,
  beatDuration,
}) => {
  switch (el.kind) {
    case "text": return <TextEl el={el} ctx={ctx} local={local} />;
    case "counter": return <CounterEl el={el} ctx={ctx} local={local} />;
    case "list": return <ListEl el={el} ctx={ctx} local={local} />;
    case "code": return <CodeEl el={el} ctx={ctx} local={local} beatDuration={beatDuration} />;
    case "chart": return <ChartEl el={el} ctx={ctx} local={local} />;
    case "compare": return <CompareEl el={el} ctx={ctx} local={local} />;
    case "shape": return <ShapeEl el={el} ctx={ctx} local={local} />;
    case "media": return <MediaEl el={el} />;
    case "custom": return <CustomEl el={el} />;
  }
};

// ---------- beat interpreter ----------

const REGION_FLEX: Record<Region, { justify: string; align: string }> = {
  center: { justify: "center", align: "center" },
  top: { justify: "flex-start", align: "center" },
  bottom: { justify: "flex-end", align: "center" },
  left: { justify: "center", align: "flex-start" },
  right: { justify: "center", align: "flex-end" },
  "top-left": { justify: "flex-start", align: "flex-start" },
  "top-right": { justify: "flex-start", align: "flex-end" },
  "bottom-left": { justify: "flex-end", align: "flex-start" },
  "bottom-right": { justify: "flex-end", align: "flex-end" },
};

const BeatFrame: React.FC<{ beat: Beat; score: Score; ctx: Ctx }> = ({ beat, score, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatExit =
    beat.transition === "fade"
      ? interpolate(frame, [beat.durationInFrames - 12, beat.durationInFrames - 2], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  // group visible moves by region; "sign" shapes float behind their region siblings
  const regions = new Map<Region, Move[]>();
  for (const m of beat.moves) {
    const list = regions.get(m.at) ?? [];
    list.push(m);
    regions.set(m.at, list);
  }

  return (
    <AbsoluteFill style={{ opacity: beatExit }}>
      {[...regions.entries()].map(([region, moves]) => {
        const flex = REGION_FLEX[region];
        return (
          <AbsoluteFill
            key={region}
            style={{
              justifyContent: flex.justify,
              alignItems: flex.align,
              padding: "7%",
              color: ctx.theme.fg,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 40,
                position: "relative",
                maxWidth: "100%",
              }}
            >
              {moves.map((move, i) => {
                const el = score.cast[move.cast];
                if (!el) return null;
                const local = frame - move.delay;
                let enter = 1;
                let offset: [number, number] = [0, 0];
                if (move.verb === "enter") {
                  enter = springOf(local, fps, move.ease);
                  const d = DIR_OFFSET[move.dir ?? ""] ?? [0, 0];
                  offset = [d[0] * (1 - enter), d[1] * (1 - enter)];
                }
                let exitOp = 1;
                if (move.verb === "exit") {
                  exitOp = interpolate(frame, [move.delay, move.delay + 12], [1, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                }
                const scale =
                  move.verb === "emphasize" ? 1 + springOf(local, fps, move.ease ?? "pop") * 0.08 : 1;
                const isFloating = el.kind === "shape" && (el.shape === "ring" || el.shape === "sign");
                return (
                  <div
                    key={i}
                    style={{
                      transform: `translate(${offset[0]}px, ${offset[1]}px) scale(${scale})`,
                      opacity: Math.min(enter, exitOp),
                      display: "flex",
                      justifyContent: "center",
                      ...(isFloating
                        ? { position: "absolute", inset: 0, alignItems: "center", zIndex: 0 }
                        : { position: "relative", zIndex: 1 }),
                    }}
                  >
                    <CastSwitch el={el} ctx={ctx} local={Math.max(0, local)} beatDuration={beat.durationInFrames} />
                  </div>
                );
              })}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- backdrop (shared with v1 look) ----------

const Backdrop: React.FC<{ theme: Theme; mode: string }> = ({ theme, mode }) => {
  const frame = useCurrentFrame();
  if (mode === "none") return null;
  const t = frame / 90;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {mode === "drift" && (
        <>
          <div
            style={{
              position: "absolute",
              width: "55%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.accent}2E 0%, transparent 68%)`,
              left: `${8 + Math.sin(t * 0.7) * 6}%`,
              top: `${-18 + Math.cos(t * 0.5) * 5}%`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "62%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${theme.accent2}24 0%, transparent 66%)`,
              right: `${-6 + Math.cos(t * 0.6) * 7}%`,
              bottom: `${-24 + Math.sin(t * 0.45) * 6}%`,
            }}
          />
        </>
      )}
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: "multiply" }} />
    </AbsoluteFill>
  );
};

// ---------- root ----------

export const ScoreVideo: React.FC<{ score: Score }> = ({ score }) => {
  const theme = resolveTheme({ theme: score.meta.theme }) as Theme;
  const ctx: Ctx = { theme, format: score.meta.format };
  const beats = flattenBeats(score) as Beat[];
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Backdrop theme={theme} mode={score.meta.backdrop} />
      <Series>
        {beats.map((beat, i) => (
          <Series.Sequence key={i} durationInFrames={beat.durationInFrames}>
            <BeatFrame beat={beat} score={score} ctx={ctx} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
