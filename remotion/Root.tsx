import React from "react";
import { Composition } from "remotion";
import { SpecVideo } from "./SpecVideo";
import { ScoreVideo } from "./ScoreVideo";
import { FORMATS, totalDuration, specSchema } from "../spec/schema.mjs";
import { scoreSchema, totalDuration as scoreDuration } from "../spec/score.mjs";
import { ProceduralVideo, configDuration } from "./procedural/ProceduralVideo";
import type { ProceduralConfig } from "./procedural/ProceduralVideo";
import demoJson from "../videos/fable-is-back.json";
import marqueeJson from "../videos/fable-is-back-marquee.json";
import igPileJson from "../videos/procedural/ig-under-the-pile.json";
import type { Spec, Score } from "./types";

const demo = demoJson as unknown as Spec;
const marquee = marqueeJson as unknown as Score;
const igPile = igPileJson as unknown as ProceduralConfig;

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
      <Composition
        id="ProceduralVideo"
        component={ProceduralVideo}
        durationInFrames={1200}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{ config: igPile }}
        calculateMetadata={({ props }) => ({
          durationInFrames: configDuration(props.config),
          fps: props.config.fps,
          width: props.config.width,
          height: props.config.height,
          props,
        })}
      />
      <Composition
        id="ScoreVideo"
        component={ScoreVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ score: marquee }}
        calculateMetadata={({ props }) => {
          const score = scoreSchema.parse(props.score) as Score;
          const size = FORMATS[score.meta.format];
          return {
            durationInFrames: scoreDuration(score),
            fps: score.meta.fps,
            width: size.width,
            height: size.height,
            props: { score },
          };
        }}
      />
    </>
  );
};
