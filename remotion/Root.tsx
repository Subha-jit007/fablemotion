import React from "react";
import { Composition } from "remotion";
import { SpecVideo } from "./SpecVideo";
import { FORMATS, totalDuration, specSchema } from "../spec/schema.mjs";
import demoJson from "../videos/fable-is-back.json";
import type { Spec } from "./types";

const demo = demoJson as unknown as Spec;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SpecVideo"
      component={SpecVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ spec: demo }}
      calculateMetadata={({ props }) => {
        const spec = specSchema.parse(props.spec);
        const size = FORMATS[spec.format];
        return {
          durationInFrames: totalDuration(spec),
          fps: spec.fps,
          width: size.width,
          height: size.height,
          props: { spec },
        };
      }}
    />
  );
};
