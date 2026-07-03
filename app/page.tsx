"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Player, type PlayerRef } from "@remotion/player";
import { SpecVideo } from "../remotion/SpecVideo";
import { FORMATS, totalDuration } from "../spec/schema.mjs";
import demo from "../videos/fable-is-back.json";
import type { Spec } from "../remotion/types";

const spec = demo as unknown as Spec;
const size = FORMATS[spec.format];
const frames = totalDuration(spec);

// cumulative frame boundaries → scene lookup for the HUD
const sceneStarts: number[] = [];
{
  let acc = 0;
  for (const s of spec.scenes) {
    sceneStarts.push(acc);
    acc += s.durationInFrames;
  }
}
const sceneAt = (f: number) => {
  let i = 0;
  while (i + 1 < sceneStarts.length && f >= sceneStarts[i + 1]) i++;
  return i;
};

const TERMINAL_LINES = [
  "> make a 20s launch video for my portfolio",
  "",
  "● fablemotion · get_style_guide()",
  "● fablemotion · save_video('portfolio-launch', …)",
  "",
  "  Saved. 6 scenes, ~21s.",
  "  Live preview → localhost:3711/studio",
  "",
  "● fablemotion · render_video('portfolio-launch')",
  "  Rendered → public/renders/portfolio-launch.mp4",
];

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [typed, setTyped] = useState(0);
  const [hudFrame, setHudFrame] = useState(0);

  // Guarantee the hero is always filming: try native playback, and if the
  // Player won't advance (some browsers stall it), drive frames ourselves.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setHudFrame(e.detail.frame);
    p.addEventListener("frameupdate", onFrame as any);
    p.play();

    let raf = 0;
    const fallback = window.setTimeout(() => {
      const stalled = !p.isPlaying() || p.getCurrentFrame() === 0;
      if (!stalled) return;
      p.pause();
      const t0 = performance.now();
      const drive = (t: number) => {
        const f = Math.floor(((t - t0) / 1000) * spec.fps) % frames;
        p.seekTo(f);
        raf = requestAnimationFrame(drive);
      };
      raf = requestAnimationFrame(drive);
    }, 900);

    return () => {
      window.clearTimeout(fallback);
      cancelAnimationFrame(raf);
      p.removeEventListener("frameupdate", onFrame as any);
    };
  }, []);

  const sceneIdx = sceneAt(hudFrame);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.querySelectorAll<HTMLElement>("[data-reveal] span, [data-fade]").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      setTyped(TERMINAL_LINES.join("\n").length);
      return;
    }

    let cleanup = () => {};
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        // hero words rise
        gsap.fromTo(
          "[data-reveal] span",
          { yPercent: 120, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            stagger: 0.06,
            duration: 1.1,
            ease: "power4.out",
            delay: 0.15,
          }
        );
        gsap.fromTo(
          "[data-hero-card]",
          { y: 80, opacity: 0, rotate: 3 },
          { y: 0, opacity: 1, rotate: -1.5, duration: 1.3, ease: "power4.out", delay: 0.45 }
        );

        // scroll fades
        gsap.utils.toArray<HTMLElement>("[data-fade]").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 60, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 1,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 82%" },
            }
          );
        });

        // numbered rows slide
        gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el, i) => {
          gsap.fromTo(
            el,
            { x: i % 2 ? 90 : -90, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 1,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 85%" },
            }
          );
        });

        // terminal types on scroll into view
        const target = { n: 0 };
        const full = TERMINAL_LINES.join("\n").length;
        gsap.to(target, {
          n: full,
          duration: 4,
          ease: "none",
          snap: { n: 1 },
          onUpdate: () => setTyped(target.n),
          scrollTrigger: { trigger: "[data-terminal]", start: "top 70%" },
        });
      }, rootRef);

      cleanup = () => {
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })();

    return () => cleanup();
  }, []);

  const terminalText = TERMINAL_LINES.join("\n").slice(0, typed);

  return (
    <div ref={rootRef}>
      {/* nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "26px 5vw",
          position: "relative",
          zIndex: 5,
        }}
      >
        <span className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>
          FABLE<em style={{ color: "var(--clay)" }}>MOTION</em>
        </span>
        <Link href="/studio" className="btn ghost" style={{ padding: "10px 22px", fontSize: 14 }}>
          Open studio
        </Link>
      </nav>

      {/* hero */}
      <header
        style={{
          padding: "7vh 5vw 10vh",
          display: "grid",
          gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)",
          gap: "5vw",
          alignItems: "center",
        }}
      >
        <div>
          <div className="kicker" data-fade>
            prompt-to-motion studio
          </div>
          <h1
            className="serif"
            data-reveal
            style={{
              fontSize: "clamp(52px, 6.6vw, 108px)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              margin: "28px 0 34px",
              fontWeight: 400,
            }}
          >
            {"Launch videos,".split(" ").map((w, i) => (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
                <span style={{ display: "inline-block", marginRight: "0.24em" }}>{w}</span>
              </span>
            ))}
            <br />
            {"from a".split(" ").map((w, i) => (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
                <span style={{ display: "inline-block", marginRight: "0.24em" }}>{w}</span>
              </span>
            ))}
            <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
              <span style={{ display: "inline-block", fontStyle: "italic", color: "var(--clay)" }}>
                sentence.
              </span>
            </span>
          </h1>
          <p
            data-fade
            style={{ fontSize: 19, lineHeight: 1.6, maxWidth: 470, opacity: 0.75, marginBottom: 40 }}
          >
            Describe the video. An agent composes the scenes. Remotion films them live in your
            browser. One click renders the MP4.
          </p>
          <div data-fade style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/studio" className="btn">
              Make a video →
            </Link>
            <a href="#mcp" className="btn ghost">
              No API key? Use your terminal
            </a>
          </div>
        </div>

        <div data-hero-card>
          <div
            style={{
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 50px 100px rgba(26,23,20,0.28)",
              border: "1px solid var(--line)",
              background: "var(--paper)",
              position: "relative",
            }}
          >
            <Player
              ref={playerRef}
              component={SpecVideo}
              inputProps={{ spec }}
              durationInFrames={frames}
              fps={spec.fps}
              compositionWidth={size.width}
              compositionHeight={size.height}
              style={{ width: "100%", display: "block" }}
              autoPlay
              loop
              controls={false}
              clickToPlay={false}
              acknowledgeRemotionLicense
            />
            {/* live badge */}
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "var(--ink)",
                background: "rgba(247,242,233,0.85)",
                padding: "5px 12px",
                borderRadius: 999,
                border: "1px solid var(--line)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: "var(--clay)",
                  animation: "fmPulse 1.4s ease-in-out infinite",
                }}
              />
              LIVE RENDER
            </div>
          </div>

          {/* scene HUD — synced to the player */}
          <div style={{ padding: "14px 6px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontFamily: "var(--mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--clay)", textTransform: "uppercase" }}>
                scene {String(sceneIdx + 1).padStart(2, "0")}/{String(spec.scenes.length).padStart(2, "0")} · {spec.scenes[sceneIdx].type}
              </span>
              <span style={{ opacity: 0.5 }}>
                {(hudFrame / spec.fps).toFixed(1)}s / {(frames / spec.fps).toFixed(0)}s
              </span>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {spec.scenes.map((s, i) => {
                const start = sceneStarts[i];
                const local = Math.min(Math.max((hudFrame - start) / s.durationInFrames, 0), 1);
                return (
                  <div
                    key={i}
                    style={{
                      flex: s.durationInFrames,
                      height: 4,
                      borderRadius: 2,
                      background: "var(--soft)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${local * 100}%`,
                        height: "100%",
                        background: i === sceneIdx ? "var(--clay)" : "var(--ink)",
                        opacity: i === sceneIdx ? 1 : 0.55,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <style>{`@keyframes fmPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.35; transform: scale(0.8);} }`}</style>
        </div>
      </header>

      {/* marquee */}
      <div
        style={{
          borderTop: "2px solid var(--ink)",
          borderBottom: "2px solid var(--ink)",
          overflow: "hidden",
          padding: "18px 0",
          whiteSpace: "nowrap",
        }}
      >
        <div className="serif" style={{ display: "inline-block", animation: "fmMarquee 24s linear infinite" }}>
          {[0, 1].map((n) => (
            <span key={n} style={{ fontSize: 30 }}>
              {["TITLE", "KINETIC", "STATEMENT", "COUNTER", "LIST", "CODE", "CHART", "COMPARE", "LOGO"].map(
                (t) => (
                  <span key={t} style={{ margin: "0 26px" }}>
                    {t} <em style={{ color: "var(--clay)" }}>·</em>
                  </span>
                )
              )}
            </span>
          ))}
        </div>
        <style>{`@keyframes fmMarquee { to { transform: translateX(-50%); } }`}</style>
      </div>

      {/* how */}
      <section style={{ padding: "14vh 5vw" }}>
        <div className="kicker" data-fade>
          how it works
        </div>
        {[
          ["01", "Describe", "“A 20 second launch video for my portfolio. Warm, fast, ends on my name.”"],
          ["02", "Watch", "The agent writes a scene spec. The player films it instantly — scrub it, tweak it, argue with it."],
          ["03", "Render", "Remotion exports the MP4. Reels, launch page, wherever."],
        ].map(([n, t, d]) => (
          <div
            key={n}
            data-step
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 1.2fr",
              gap: "3vw",
              alignItems: "baseline",
              padding: "44px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span style={{ fontFamily: "var(--mono)", color: "var(--clay)", fontSize: 22 }}>{n}</span>
            <span className="serif" style={{ fontSize: "clamp(36px,4vw,64px)", letterSpacing: "-0.02em" }}>
              {t}
            </span>
            <span style={{ fontSize: 18, lineHeight: 1.6, opacity: 0.72 }}>{d}</span>
          </div>
        ))}
      </section>

      {/* mcp */}
      <section
        id="mcp"
        style={{
          margin: "0 5vw 14vh",
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: 28,
          padding: "8vh 5vw",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)",
          gap: "5vw",
          alignItems: "center",
        }}
      >
        <div>
          <div className="kicker" data-fade>
            the api key is optional
          </div>
          <h2
            className="serif"
            data-fade
            style={{
              fontSize: "clamp(38px,4.4vw,68px)",
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              margin: "24px 0 28px",
              fontWeight: 400,
            }}
          >
            Your terminal is <em style={{ color: "var(--clay)" }}>the director.</em>
          </h2>
          <p data-fade style={{ fontSize: 18, lineHeight: 1.65, opacity: 0.8, maxWidth: 460 }}>
            Connect Claude Code to the FABLEMOTION MCP server and your session composes, saves and
            renders videos directly — its own intelligence does the directing, so no Anthropic API
            key is needed. Paste a key in the studio only if you want the built-in web agent too.
          </p>
          <pre
            data-fade
            style={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              marginTop: 30,
              padding: "16px 20px",
              background: "#262220",
              borderRadius: 12,
              overflowX: "auto",
            }}
          >
            claude mcp add fablemotion -- node E:/Projects/fablemotion/mcp/server.mjs
          </pre>
        </div>
        <div
          data-terminal
          style={{
            background: "#0F0D0B",
            borderRadius: 16,
            border: "1px solid #33302B",
            minHeight: 320,
            padding: "22px 26px",
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {["var(--clay)", "var(--blue)", "#C9BFA9"].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
            ))}
          </div>
          <pre
            style={{
              fontFamily: "var(--mono)",
              fontSize: 15,
              lineHeight: 1.8,
              color: "#EDE6D6",
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {terminalText}
            <span style={{ color: "var(--clay)" }}>▌</span>
          </pre>
        </div>
      </section>

      {/* footer */}
      <footer
        style={{
          padding: "60px 5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderTop: "2px solid var(--ink)",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <span className="serif" style={{ fontSize: "clamp(40px,6vw,90px)", letterSpacing: "-0.03em" }}>
          FABLE<em style={{ color: "var(--clay)" }}>MOTION</em>
        </span>
        <span style={{ fontSize: 14, opacity: 0.6 }}>Made with springs, not templates.</span>
      </footer>
    </div>
  );
}
