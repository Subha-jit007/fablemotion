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
import type { Scene, Spec, Theme } from "./types";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'Cascadia Code', Consolas, 'Courier New', monospace";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

// ---------- shared pieces ----------

const useEnterExit = (duration: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [duration - 12, duration - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, fps, enter, exit };
};

const Backdrop: React.FC<{ theme: Theme; mode: Spec["backdrop"] }> = ({
  theme,
  mode,
}) => {
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
      <AbsoluteFill
        style={{ backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: "multiply" }}
      />
    </AbsoluteFill>
  );
};

const Frame: React.FC<{ theme: Theme; children: React.ReactNode; exit: number }> = ({
  theme,
  children,
  exit,
}) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      padding: "7%",
      color: theme.fg,
      opacity: exit,
    }}
  >
    {children}
  </AbsoluteFill>
);

const WordReveal: React.FC<{
  text: string;
  theme: Theme;
  size: number;
  delay?: number;
  italicAccent?: boolean;
}> = ({ text, theme, size, delay = 0, italicAccent = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily: SERIF,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.02em",
        textAlign: "center",
        maxWidth: "94%",
      }}
    >
      {words.map((word, i) => {
        const s = spring({
          frame: frame - delay - i * 4,
          fps,
          config: { damping: 16, stiffness: 130, mass: 0.6 },
        });
        const accent = italicAccent && i === words.length - 1 && words.length > 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              transform: `translateY(${(1 - s) * 70}px)`,
              opacity: s,
              fontStyle: accent ? "italic" : "normal",
              color: accent ? theme.accent : theme.fg,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const Kicker: React.FC<{ theme: Theme; children: React.ReactNode; opacity?: number }> = ({
  theme,
  children,
  opacity = 1,
}) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: 26,
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      color: theme.accent,
      opacity,
      marginBottom: 42,
      fontWeight: 600,
    }}
  >
    {children}
  </div>
);

// ---------- scenes ----------

const TitleScene: React.FC<{ s: Extract<Scene, { type: "title" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  const subIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const rule = spring({ frame: frame - 8, fps, config: { damping: 40 } });
  return (
    <Frame theme={theme} exit={exit}>
      <div
        style={{
          width: 120,
          height: 5,
          background: theme.accent,
          transform: `scaleX(${rule})`,
          marginBottom: 56,
        }}
      />
      <WordReveal text={s.text} theme={theme} size={130} />
      {s.sub && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            marginTop: 48,
            color: theme.fg,
            opacity: subIn * 0.72,
            transform: `translateY(${(1 - subIn) * 24}px)`,
            maxWidth: "70%",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {s.sub}
        </div>
      )}
    </Frame>
  );
};

const KineticScene: React.FC<{ s: Extract<Scene, { type: "kinetic" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  const per = Math.floor((s.durationInFrames - 12) / s.words.length);
  const idx = Math.min(Math.floor(frame / per), s.words.length - 1);
  const local = frame - idx * per;
  const pop = spring({ frame: local, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } });
  const colorful = idx % 2 === 1;
  return (
    <Frame theme={theme} exit={exit}>
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: colorful ? "italic" : "normal",
          fontSize: 220,
          letterSpacing: "-0.03em",
          color: colorful ? theme.accent : theme.fg,
          transform: `scale(${0.72 + pop * 0.28}) rotate(${(1 - pop) * (colorful ? -2 : 2)}deg)`,
          opacity: Math.min(1, pop * 1.4),
          textAlign: "center",
        }}
      >
        {s.words[idx]}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 70 }}>
        {s.words.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? 34 : 10,
              height: 10,
              borderRadius: 6,
              background: i <= idx ? theme.accent : theme.soft,
              transition: "none",
            }}
          />
        ))}
      </div>
    </Frame>
  );
};

const StatementScene: React.FC<{
  s: Extract<Scene, { type: "statement" }>;
  theme: Theme;
}> = ({ s, theme }) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  return (
    <Frame theme={theme} exit={exit}>
      <div style={{ textAlign: "left", width: "88%" }}>
        {s.lines.map((line, i) => {
          const sp = spring({
            frame: frame - i * 9,
            fps,
            config: { damping: 20, stiffness: 110 },
          });
          const accented = s.accentLine === i;
          return (
            <div key={i} style={{ overflow: "hidden", padding: "0.06em 0" }}>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 96,
                  lineHeight: 1.12,
                  letterSpacing: "-0.02em",
                  fontStyle: accented ? "italic" : "normal",
                  color: accented ? theme.accent : theme.fg,
                  transform: `translateY(${(1 - sp) * 110}%)`,
                }}
              >
                {line}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

const CounterScene: React.FC<{ s: Extract<Scene, { type: "counter" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, enter, exit } = useEnterExit(s.durationInFrames);
  const progress = spring({ frame, fps, config: { damping: 44, stiffness: 40 }, durationInFrames: Math.min(70, s.durationInFrames - 20) });
  const shown = (s.value * progress).toFixed(s.decimals);
  return (
    <Frame theme={theme} exit={exit}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 300,
          letterSpacing: "-0.04em",
          color: theme.accent,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {s.prefix ?? ""}
        {Number(shown).toLocaleString("en-US", {
          minimumFractionDigits: s.decimals,
          maximumFractionDigits: s.decimals,
        })}
        <span style={{ fontSize: 160, fontStyle: "italic" }}>{s.suffix ?? ""}</span>
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 34,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginTop: 46,
          opacity: enter * 0.75,
          fontWeight: 600,
        }}
      >
        {s.label}
      </div>
    </Frame>
  );
};

const ListScene: React.FC<{ s: Extract<Scene, { type: "list" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  return (
    <Frame theme={theme} exit={exit}>
      <div style={{ width: "84%" }}>
        {s.title && <Kicker theme={theme}>{s.title}</Kicker>}
        {s.items.map((item, i) => {
          const sp = spring({
            frame: frame - 10 - i * 8,
            fps,
            config: { damping: 18, stiffness: 120 },
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 38,
                padding: "26px 0",
                borderBottom: `2px solid ${theme.soft}`,
                transform: `translateX(${(1 - sp) * 60}px)`,
                opacity: sp,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 30,
                  color: theme.accent,
                  minWidth: 66,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: SERIF, fontSize: 58, letterSpacing: "-0.01em" }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

const CodeScene: React.FC<{ s: Extract<Scene, { type: "code" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, exit } = useEnterExit(s.durationInFrames);
  const typeFrames = Math.max(10, s.durationInFrames - 40);
  const chars = Math.floor(
    interpolate(frame, [12, 12 + typeFrames], [0, s.code.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const cursorOn = Math.floor(frame / 14) % 2 === 0;
  return (
    <Frame theme={theme} exit={exit}>
      <div
        style={{
          width: "82%",
          background: "#141210",
          borderRadius: 22,
          boxShadow: "0 40px 90px rgba(20,15,10,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "22px 30px",
            borderBottom: "1px solid #2A2622",
          }}
        >
          {[theme.accent, theme.accent2, "#C9BFA9"].map((c, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
          ))}
          <span
            style={{
              fontFamily: MONO,
              color: "#8F8779",
              fontSize: 24,
              marginLeft: 16,
            }}
          >
            {s.title ?? "terminal"}
          </span>
        </div>
        <pre
          style={{
            fontFamily: MONO,
            fontSize: 32,
            lineHeight: 1.65,
            color: "#F0E9DA",
            padding: "38px 44px",
            margin: 0,
            whiteSpace: "pre-wrap",
            minHeight: 200,
          }}
        >
          {s.code.slice(0, chars)}
          <span style={{ opacity: cursorOn ? 1 : 0, color: theme.accent }}>▌</span>
        </pre>
      </div>
    </Frame>
  );
};

const ChartScene: React.FC<{ s: Extract<Scene, { type: "chart" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  const max = Math.max(...s.data.map((d) => d.value));
  return (
    <Frame theme={theme} exit={exit}>
      {s.title && <Kicker theme={theme}>{s.title}</Kicker>}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 54,
          height: "52%",
          width: "80%",
          justifyContent: "center",
        }}
      >
        {s.data.map((d, i) => {
          const grow = spring({
            frame: frame - 8 - i * 6,
            fps,
            config: { damping: 22, stiffness: 90 },
          });
          const h = (d.value / max) * 100 * grow;
          const hot = d.value === max;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                flex: 1,
                maxWidth: 200,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 44,
                  marginBottom: 18,
                  opacity: grow,
                  fontStyle: hot ? "italic" : "normal",
                  color: hot ? theme.accent : theme.fg,
                }}
              >
                {d.value.toLocaleString("en-US")}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${h}%`,
                  background: hot ? theme.accent : theme.fg,
                  borderRadius: "14px 14px 0 0",
                  opacity: hot ? 1 : 0.82,
                }}
              />
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 26,
                  marginTop: 20,
                  opacity: 0.7,
                  fontWeight: 600,
                }}
              >
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

const CompareScene: React.FC<{ s: Extract<Scene, { type: "compare" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  const left = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 100 } });
  const right = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 100 } });
  const bar = spring({ frame: frame - 22, fps, config: { damping: 40 } });
  const Cell = ({
    v,
    label,
    sp,
    dir,
    accent,
  }: {
    v: string;
    label: string;
    sp: number;
    dir: number;
    accent: boolean;
  }) => (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        transform: `translateX(${(1 - sp) * 120 * dir}px)`,
        opacity: sp,
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 190,
          letterSpacing: "-0.03em",
          color: accent ? theme.accent : theme.fg,
          fontStyle: accent ? "italic" : "normal",
          lineHeight: 1,
        }}
      >
        {v}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 30,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginTop: 34,
          opacity: 0.7,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
  return (
    <Frame theme={theme} exit={exit}>
      {s.title && <Kicker theme={theme}>{s.title}</Kicker>}
      <div style={{ display: "flex", alignItems: "center", width: "92%", gap: 40 }}>
        <Cell v={s.left.value} label={s.left.label} sp={left} dir={-1} accent={false} />
        <div
          style={{
            width: 4,
            height: 260,
            background: theme.soft,
            transform: `scaleY(${bar})`,
          }}
        />
        <Cell v={s.right.value} label={s.right.label} sp={right} dir={1} accent />
      </div>
    </Frame>
  );
};

const LogoScene: React.FC<{ s: Extract<Scene, { type: "logo" }>; theme: Theme }> = ({
  s,
  theme,
}) => {
  const { frame, fps, exit } = useEnterExit(s.durationInFrames);
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const ring = spring({ frame: frame - 4, fps, config: { damping: 30, stiffness: 60 } });
  const tag = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  return (
    <Frame theme={theme} exit={exit}>
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `3px solid ${theme.accent}`,
          transform: `scale(${0.4 + ring * 0.8})`,
          opacity: (1 - ring) * 0.9,
        }}
      />
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 150,
          letterSpacing: "-0.02em",
          transform: `scale(${0.8 + pop * 0.2})`,
          opacity: pop,
        }}
      >
        {s.text}
      </div>
      {s.tagline && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: 28,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: theme.accent,
            marginTop: 44,
            opacity: tag,
            fontWeight: 600,
          }}
        >
          {s.tagline}
        </div>
      )}
    </Frame>
  );
};

const SceneSwitch: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  switch (scene.type) {
    case "title":
      return <TitleScene s={scene} theme={theme} />;
    case "kinetic":
      return <KineticScene s={scene} theme={theme} />;
    case "statement":
      return <StatementScene s={scene} theme={theme} />;
    case "counter":
      return <CounterScene s={scene} theme={theme} />;
    case "list":
      return <ListScene s={scene} theme={theme} />;
    case "code":
      return <CodeScene s={scene} theme={theme} />;
    case "chart":
      return <ChartScene s={scene} theme={theme} />;
    case "compare":
      return <CompareScene s={scene} theme={theme} />;
    case "logo":
      return <LogoScene s={scene} theme={theme} />;
  }
};

export const SpecVideo: React.FC<{ spec: Spec }> = ({ spec }) => {
  const theme = resolveTheme(spec) as Theme;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Backdrop theme={theme} mode={spec.backdrop} />
      <Series>
        {spec.scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
            <SceneSwitch scene={scene} theme={theme} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
