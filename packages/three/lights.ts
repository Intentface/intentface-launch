import { type Easing, ease, lerp } from "@intentface-launch/core";
import type { Vec3 } from "./lens.js";

/** A soft box: a rectangular light that gives broad, even highlights and soft shadows. */
export type SoftBox = {
  position: Vec3;
  target?: Vec3;
  width: number;
  height: number;
  intensity?: number;
  color?: string;
  /** Casts shadows onto a <Floor shadow>. Default: true for the first light. */
  shadow?: boolean;
};

const v = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * A strip light that travels across the product: the highlight runs over the
 * glossy faces and edges as it passes. Before `at` it waits at `from`, after
 * `at + duration` it rests at `to`. Speed is the motion token: a duration and
 * an easing (default `ease.inOut`, a crossing move).
 */
export function sweep({
  from,
  to,
  at = 0,
  duration,
  easing = ease.inOut,
  target = [0, 0, 0],
  width = 300,
  height = 2400,
  intensity = 4,
  color,
}: {
  from: Vec3;
  to: Vec3;
  at?: number;
  duration: number;
  easing?: Easing;
  target?: Vec3;
  width?: number;
  height?: number;
  intensity?: number;
  color?: string;
}): (frame: number) => SoftBox {
  return (f) => ({
    position: v(from, to, easing((f - at) / duration)),
    target,
    width,
    height,
    intensity,
    color,
  });
}

/**
 * The classic three lights around `target`, for a camera looking along −z:
 * a big key high on one side, a dim fill low on the other, and a rim from
 * behind that draws a bright line along the top and side edges.
 */
export function threePoint(
  target: Vec3 = [0, 0, 0],
  {
    distance = 1800,
    key = 2.5,
    fill = 0.6,
    rim = 3,
    side = -1,
  }: { distance?: number; key?: number; fill?: number; rim?: number; side?: 1 | -1 } = {},
): SoftBox[] {
  const [x, y, z] = target;
  return [
    {
      position: [x + side * distance * 0.6, y + distance * 0.7, z + distance],
      target,
      width: distance * 1.3,
      height: distance * 0.5,
      intensity: key,
      shadow: true,
    },
    {
      position: [x - side * distance, y - distance * 0.2, z + distance * 0.7],
      target,
      width: distance * 0.6,
      height: distance * 0.9,
      intensity: fill,
    },
    ...rimLight(target, { distance, intensity: rim, side: -side as 1 | -1 }),
  ];
}

/**
 * Light from behind and above: it only catches edges facing away from the
 * camera, so panels get a thin bright outline that separates them from a dark
 * background.
 */
export function rimLight(
  target: Vec3 = [0, 0, 0],
  {
    distance = 1800,
    intensity = 3,
    side = 1,
    color,
  }: { distance?: number; intensity?: number; side?: 1 | -1; color?: string } = {},
): SoftBox[] {
  const [x, y, z] = target;
  return [
    {
      position: [x + side * distance * 0.5, y + distance * 0.8, z - distance * 0.8],
      target,
      width: distance * 1.4,
      height: distance * 0.12,
      intensity,
      color,
    },
  ];
}

/** Wide and soft from above the camera, the default key. */
export const keyLight = (target: Vec3 = [0, 0, 0], intensity = 2.5): SoftBox => ({
  position: [target[0] - 900, target[1] + 1100, target[2] + 1400],
  target,
  width: 2400,
  height: 900,
  intensity,
  shadow: true,
});
