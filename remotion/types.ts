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
  theme: { preset: "paper" | "ink" | "candy"; colors?: Partial<Theme> };
  backdrop: "drift" | "grain" | "none";
  scenes: Scene[];
};
