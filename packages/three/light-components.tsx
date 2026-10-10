import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import type { Object3D } from "three";
import { Cone, type ConePose } from "./cone.js";
import {
  Beam,
  type BeamPose,
  Glow,
  type GlowPose,
  type LightColour,
  Ring,
  type RingPose,
  Wave,
  type WavePose,
} from "./light.js";
import { Prism, type PrismPose, type PrismTrace } from "./prism.js";
import { StageContext } from "./stage.js";
import { Smear, type SmearPose } from "./surface-light.js";

/** A pose, or a function of the (fractional) frame that returns one. */
export type PoseOf<P> = P | ((frame: number) => P);

const resolve = <P,>(pose: PoseOf<P>, t: number): P =>
  typeof pose === "function" ? (pose as (frame: number) => P)(t) : pose;

/**
 * Registers a light on the enclosing stage, built once per `key` (its colour
 * options), posed every sample from the latest props.
 */
function useLight<T extends { object: Object3D }>(
  name: string,
  make: () => T,
  key: string,
  pose: (item: T, t: number) => void,
) {
  const stage = useContext(StageContext);
  if (!stage) throw new Error(`<Light.${name}> must be inside <Stage3D>`);
  const latest = useRef(pose);
  latest.current = pose;
  // Rebuilt only when the colour options change; `make` is an inline function.
  const item = useMemo(make, [key]);
  useLayoutEffect(() => stage.add({ object: item.object, update: (t) => latest.current(item, t) }), [stage, item]);
}

const colourKey = (c: LightColour) => JSON.stringify([c.color, c.gradient, c.spectrum]);

type Coloured<P> = LightColour & { pose: PoseOf<P> };

function BeamLight({ pose, ...colour }: Coloured<BeamPose>) {
  useLight(
    "Beam",
    () => new Beam(colour),
    colourKey(colour),
    (b, t) => b.pose(resolve(pose, t)),
  );
  return null;
}

function RingLight({ pose, ...colour }: Coloured<RingPose>) {
  useLight(
    "Ring",
    () => new Ring(colour),
    colourKey(colour),
    (r, t) => r.pose(resolve(pose, t)),
  );
  return null;
}

function WaveLight({ pose, ...colour }: Coloured<WavePose>) {
  useLight(
    "Wave",
    () => new Wave(colour),
    colourKey(colour),
    (w, t) => w.pose(resolve(pose, t)),
  );
  return null;
}

function GlowLight({ pose, color = "#ffffff" }: { pose: PoseOf<GlowPose>; color?: string }) {
  useLight(
    "Glow",
    () => new Glow(color),
    color,
    (g, t) => g.pose(resolve(pose, t)),
  );
  return null;
}

function ConeLight({ pose, ...colour }: Coloured<ConePose>) {
  useLight(
    "Cone",
    () => new Cone(colour),
    colourKey(colour),
    (c, t) => c.pose(resolve(pose, t)),
  );
  return null;
}

function SmearLight({
  pose,
  bands,
  from,
  to,
}: {
  pose: PoseOf<SmearPose>;
  bands?: number;
  from?: number;
  to?: number;
}) {
  useLight(
    "Smear",
    () => new Smear({ bands, from, to }),
    JSON.stringify([bands, from, to]),
    (s, t) => s.pose(resolve(pose, t)),
  );
  return null;
}

function PrismLight({
  pose,
  bands,
  onTrace,
}: {
  pose: PoseOf<PrismPose>;
  bands?: number;
  /** Called with where the light went, every sample. */
  onTrace?: (trace: PrismTrace, t: number) => void;
}) {
  useLight(
    "Prism",
    () => new Prism({ bands }),
    String(bands),
    (p, t) => {
      const trace = p.pose(resolve(pose, t));
      onTrace?.(trace, t);
    },
  );
  return null;
}

/**
 * The stage's lights as components, for scenes with a few of them:
 *
 *   <Light.Beam color="#fff" pose={(f) => ({ from: [0, 0, 0], direction: [1, 0, 0], end: f * 10, width: 6 })} />
 *
 * Each takes its class's colour options as props and `pose`: a pose, or a
 * function of the (fractional) frame called once per sample. For hundreds of
 * lights, build the classes (`new Beam(…)`) in one `useStageItem`.
 */
export const Light = {
  Beam: BeamLight,
  Ring: RingLight,
  Wave: WaveLight,
  Glow: GlowLight,
  Cone: ConeLight,
  Smear: SmearLight,
  Prism: PrismLight,
};
