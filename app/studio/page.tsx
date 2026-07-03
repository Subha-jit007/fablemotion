"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Player } from "@remotion/player";
import { SpecVideo } from "../../remotion/SpecVideo";
import { FORMATS, totalDuration, validateSpec } from "../../spec/schema.mjs";
import demo from "../../videos/fable-is-back.json";
import type { Spec } from "../../remotion/types";

type Msg = { role: "user" | "assistant"; content: string };
type LibraryRow = { name: string; title: string; format: string; scenes: number; seconds: number };

const KEY_STORAGE = "fm_anthropic_key";

const panel: React.CSSProperties = {
  background: "#FFFDF8",
  border: "1px solid var(--line)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const panelHead: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--line)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--clay)",
};

function StudioInner() {
  const params = useSearchParams();
  const [spec, setSpec] = useState<Spec>(demo as unknown as Spec);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [render, setRender] = useState<{ busy: boolean; url?: string; error?: string }>({ busy: false });
  const [notice, setNotice] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const size = FORMATS[spec.format];
  const frames = useMemo(() => totalDuration(spec), [spec]);

  const refreshLibrary = useCallback(async () => {
    const r = await fetch("/api/videos").then((r) => r.json()).catch(() => null);
    if (r?.videos) setLibrary(r.videos);
  }, []);

  useEffect(() => {
    setApiKey(localStorage.getItem(KEY_STORAGE) ?? "");
    refreshLibrary();
    const name = params.get("video");
    if (name) {
      fetch(`/api/videos/${name}`)
        .then((r) => r.json())
        .then((r) => r.spec && setSpec(r.spec))
        .catch(() => {});
    }
  }, [params, refreshLibrary]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-anthropic-key": apiKey } : {}),
        },
        body: JSON.stringify({ messages: next, spec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages([...next, { role: "assistant", content: data.error ?? "Something broke." }]);
        if (res.status === 401) setShowKey(true);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply }]);
        if (data.spec) setSpec(data.spec);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error — is the dev server running?" }]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    });
    const data = await res.json();
    setNotice(res.ok ? `Saved as “${data.saved}”` : "Save failed — invalid spec");
    setTimeout(() => setNotice(""), 2500);
    refreshLibrary();
  };

  const doRender = async () => {
    setRender({ busy: true });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) setRender({ busy: false, error: data.error ?? "Render failed" });
      else setRender({ busy: false, url: data.url });
    } catch {
      setRender({ busy: false, error: "Render request failed" });
    }
  };

  const loadVideo = async (name: string) => {
    const r = await fetch(`/api/videos/${name}`).then((r) => r.json());
    if (r.spec) {
      setSpec(r.spec);
      setRender({ busy: false });
    }
  };

  const openJson = () => {
    setJsonDraft(JSON.stringify(spec, null, 2));
    setJsonError("");
    setJsonOpen(true);
  };

  const applyJson = () => {
    try {
      const parsed = validateSpec(JSON.parse(jsonDraft));
      if (!parsed.success) {
        setJsonError(parsed.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(" · "));
        return;
      }
      setSpec(parsed.data as Spec);
      setJsonOpen(false);
    } catch {
      setJsonError("Not valid JSON");
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "14px 22px",
          borderBottom: "2px solid var(--ink)",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" className="serif" style={{ fontSize: 20 }}>
          FABLE<em style={{ color: "var(--clay)" }}>MOTION</em>
        </Link>
        <span className="serif" style={{ fontSize: 17, opacity: 0.75, fontStyle: "italic" }}>
          {spec.title}
        </span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {spec.format} · {spec.scenes.length} scenes · ~{Math.round(frames / spec.fps)}s
        </span>
        <div style={{ flex: 1 }} />
        {notice && <span style={{ fontSize: 13, color: "var(--clay)", fontWeight: 600 }}>{notice}</span>}
        <button className="btn ghost" style={{ padding: "8px 18px", fontSize: 13 }} onClick={openJson}>
          JSON
        </button>
        <button className="btn ghost" style={{ padding: "8px 18px", fontSize: 13 }} onClick={save}>
          Save
        </button>
        <button
          className="btn"
          style={{ padding: "8px 20px", fontSize: 13 }}
          onClick={doRender}
          disabled={render.busy}
        >
          {render.busy ? "Rendering…" : "Render MP4"}
        </button>
        <button
          className="btn ghost"
          style={{ padding: "8px 14px", fontSize: 13, borderStyle: apiKey ? "solid" : "dashed" }}
          onClick={() => setShowKey(true)}
          title="Anthropic API key (optional)"
        >
          {apiKey ? "key ✓" : "key"}
        </button>
      </header>

      {/* body */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "360px minmax(0,1fr) 300px",
          gap: 16,
          padding: 16,
          minHeight: 0,
        }}
      >
        {/* chat */}
        <div style={panel}>
          <div style={panelHead}>director</div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.6 }}>
                Tell the agent what to film. Try:
                <br />
                <em>“A 20s launch video for a coffee app called BREW. Playful, portrait, end on the name.”</em>
                <br />
                <br />
                No API key? Drive this studio from Claude Code instead — the MCP server is in the
                README.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  background: m.role === "user" ? "var(--ink)" : "var(--soft)",
                  color: m.role === "user" ? "var(--paper)" : "var(--ink)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div style={{ fontSize: 13, opacity: 0.55, fontStyle: "italic" }}>composing scenes…</div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Describe the video…"
              rows={2}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 12px",
                fontFamily: "var(--sans)",
                fontSize: 14,
                background: "var(--paper)",
                outline: "none",
              }}
            />
            <button className="btn" style={{ padding: "0 20px" }} onClick={send} disabled={busy}>
              →
            </button>
          </div>
        </div>

        {/* preview */}
        <div style={{ ...panel, background: "var(--paper-deep)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <div
            style={{
              maxWidth: spec.format === "portrait" ? "38vh" : "100%",
              width: spec.format === "portrait" ? undefined : "100%",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(26,23,20,0.25)",
              background: "#000",
            }}
          >
            <Player
              component={SpecVideo}
              inputProps={{ spec }}
              durationInFrames={frames}
              fps={spec.fps}
              compositionWidth={size.width}
              compositionHeight={size.height}
              style={{ width: "100%" }}
              controls
              loop
              autoPlay
            />
          </div>
          {render.url && (
            <a
              href={render.url}
              download
              style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: "var(--clay)" }}
            >
              ⬇ Download {render.url.split("/").pop()}
            </a>
          )}
          {render.error && (
            <div style={{ marginTop: 16, fontSize: 13, color: "#B33", maxWidth: 500 }}>{render.error}</div>
          )}
          {render.busy && (
            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.6 }}>
              Rendering… first ever render also downloads headless Chrome, give it a minute.
            </div>
          )}
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <div style={{ ...panel, flex: 1, minHeight: 0 }}>
            <div style={panelHead}>library</div>
            <div style={{ overflowY: "auto", padding: 8 }}>
              {library.map((v) => (
                <button
                  key={v.name}
                  onClick={() => loadVideo(v.name)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--soft)",
                    padding: "10px 10px",
                  }}
                >
                  <div className="serif" style={{ fontSize: 16 }}>{v.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                    {v.format} · {v.scenes} scenes · ~{v.seconds}s
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ ...panel, maxHeight: "42%" }}>
            <div style={panelHead}>scenes</div>
            <div style={{ overflowY: "auto", padding: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spec.scenes.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--line)",
                    background: "var(--paper)",
                  }}
                >
                  {i + 1} {s.type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* JSON modal */}
      {jsonOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,23,20,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setJsonOpen(false)}
        >
          <div
            style={{ ...panel, width: "min(760px, 92vw)", height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={panelHead}>spec json — edit anything</div>
            <textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                fontFamily: "var(--mono)",
                fontSize: 13,
                padding: 16,
                border: "none",
                outline: "none",
                resize: "none",
                background: "#FFFDF8",
              }}
            />
            {jsonError && (
              <div style={{ padding: "8px 16px", fontSize: 12, color: "#B33" }}>{jsonError}</div>
            )}
            <div style={{ display: "flex", gap: 10, padding: 12, borderTop: "1px solid var(--line)" }}>
              <button className="btn" style={{ padding: "8px 22px", fontSize: 13 }} onClick={applyJson}>
                Apply
              </button>
              <button
                className="btn ghost"
                style={{ padding: "8px 22px", fontSize: 13 }}
                onClick={() => setJsonOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* key modal */}
      {showKey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,23,20,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowKey(false)}
        >
          <div
            style={{ ...panel, width: "min(520px, 92vw)", padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={panelHead}>anthropic api key — optional</div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.75, marginBottom: 16 }}>
                Powers the built-in web agent. Stored only in this browser (localStorage), sent only
                to your own local server. Skip it entirely by driving the studio from Claude Code
                over MCP — your session becomes the director, no key involved.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                  background: "var(--paper)",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  className="btn"
                  style={{ padding: "9px 22px", fontSize: 13 }}
                  onClick={() => {
                    localStorage.setItem(KEY_STORAGE, apiKey.trim());
                    setShowKey(false);
                  }}
                >
                  Save key
                </button>
                <button
                  className="btn ghost"
                  style={{ padding: "9px 22px", fontSize: 13 }}
                  onClick={() => {
                    localStorage.removeItem(KEY_STORAGE);
                    setApiKey("");
                    setShowKey(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  return (
    <Suspense>
      <StudioInner />
    </Suspense>
  );
}
