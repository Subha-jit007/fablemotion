export type SceneBase = { durationInFrames: number };

export type Scene =
  | (SceneBase & { type: "title"; text: string; sub?: string })
  | (SceneBase & { type: "kinetic"; words: string[] })
  | (SceneBase & { type: "statement"; lines: string[]; accentLine?: number })
  | (SceneBase & {
      type: "counter";
      value: number;
      label: string;
      prefix?: string;
      suffix?: string;
      decimals: number;
    })
  | (SceneBase & { type: "list"; title?: string; items: string[] })
  | (SceneBase & { type: "code"; title?: string; code: string })
  | (SceneBase & {
      type: "chart";
      title?: string;
      data: { label: string; value: number }[];
    })
  | (SceneBase & {
      type: "compare";
      title?: string;
      left: { label: string; value: string };
      right: { label: string; value: string };
    })
  | (SceneBase & { type: "logo"; text: string; tagline?: string });

export type Theme = {
  bg: string;
  fg: string;
  accent: string;
  accent2: string;
  soft: string;
};

export type Spec = {
  title: string;
  format: "landscape" | "portrait" | "square";
  fps: number;
  theme: { preset: "paper" | "ink" | "candy" | "marquee"; colors?: Partial<Theme> };
  backdrop: "drift" | "grain" | "none";
  scenes: Scene[];
};

// ---------- v2 Score IR (mirrors spec/score.mjs) ----------

export type Region =
  | "center" | "top" | "bottom" | "left" | "right"
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type CastElement =
  | {
      kind: "text";
      role: "mega" | "display" | "headline" | "body" | "caption" | "kicker";
      content: string;
      font?: "serif" | "sans" | "mono";
      treatment: "clean" | "pixel";
      glow: boolean;
      align: "left" | "center";
      accent: string; // "none" | "last-word" | "all" | "line:N"
    }
  | { kind: "counter"; value: number; label?: string; prefix?: string; suffix?: string; decimals: number }
  | { kind: "list"; items: string[] }
  | { kind: "code"; code: string; title?: string }
  | { kind: "chart"; data: { label: string; value: number }[] }
  | { kind: "compare"; left: { label: string; value: string }; right: { label: string; value: string } }
  | { kind: "shape"; shape: "rule" | "ring" | "sign"; size?: number }
  | { kind: "media"; src: string; width?: number; cutout: boolean }
  | { kind: "custom"; html: string; width?: number; height?: number };

export type Move = {
  verb: "enter" | "exit" | "emphasize" | "hold";
  cast: string;
  ease?: string;
  at: Region;
  delay: number;
  dir?: "up" | "down" | "left" | "right";
};

export type Beat = {
  intent: "hook" | "build" | "reveal" | "punch" | "rest" | "outro";
  durationInFrames: number;
  transition: "cut" | "fade";
  moves: Move[];
};

export type Score = {
  version: 2;
  meta: {
    title: string;
    format: "landscape" | "portrait" | "square";
    fps: number;
    theme: { preset: "paper" | "ink" | "candy" | "marquee"; colors?: Partial<Theme> };
    backdrop: "drift" | "grain" | "none";
    mood?: string;
  };
  cast: Record<string, CastElement>;
  acts: { name?: string; beats: Beat[] }[];
};
