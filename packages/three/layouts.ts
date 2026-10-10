import { lerp } from "@intentface-launch/core";
import type { Vec3 } from "./lens.js";
import type { Pose } from "./panel.js";

/**
 * Arrangements of several panels, as poses for panel `i` of `n`. They are
 * resting places: animate between them with `mixPose(a, b, t)`, staggered by
 * index, so a stack fans out or a grid explodes into depth.
 */

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const at = (i: number, n: number) => (n <= 1 ? 0.5 : i / (n - 1));

/** Panels piled towards the camera, each `gap` in front and `offset` beside the last. Panel 0 at the back. */
export function stack(
  i: number,
  n: number,
  { gap = 40, offset = [0, 0] as [number, number], origin = [0, 0, 0] as Vec3 } = {},
): Pose {
  const k = i - (n - 1) / 2;
  return { position: add(origin, [offset[0] * k, offset[1] * k, gap * k]), rotation: [0, 0, 0] };
}

/**
 * A hand of cards: panels on an arc around a pivot `radius` below their
 * centres, `spread` degrees from first to last, each turned to follow the arc.
 */
export function fan(
  i: number,
  n: number,
  { spread = 36, radius = 2000, lift = 6, origin = [0, 0, 0] as Vec3 } = {},
): Pose {
  const angle = lerp(-spread / 2, spread / 2, at(i, n));
  const r = (angle * Math.PI) / 180;
  const pos: Vec3 = [Math.sin(r) * radius, Math.cos(r) * radius - radius, i * lift];
  return { position: add(origin, pos), rotation: [0, 0, -angle] };
}

/** Rows and columns, centred, with a gentle tilt towards the camera from the edges. */
export function grid(
  i: number,
  n: number,
  { columns = 3, cell = [480, 300] as [number, number], gap = 40, curve = 0, origin = [0, 0, 0] as Vec3 } = {},
): Pose {
  const rows = Math.ceil(n / columns);
  const c = i % columns;
  const r = Math.floor(i / columns);
  const x = (c - (columns - 1) / 2) * (cell[0] + gap);
  const y = ((rows - 1) / 2 - r) * (cell[1] + gap);
  // `curve` (degrees) bends the grid into a shallow bowl: edge columns come forward and turn in.
  const u = columns > 1 ? (c - (columns - 1) / 2) / ((columns - 1) / 2) : 0;
  const z = Math.sin((Math.abs(u) * curve * Math.PI) / 180) * (cell[0] + gap) * 0.5;
  return { position: add(origin, [x, y, z]), rotation: [0, -u * curve, 0] };
}

/**
 * Layers of one UI pulled apart in depth, as in an exploded drawing: layer 0
 * (the base) stays, each next one `gap` in front. `turn` swings the whole
 * assembly so the separation reads.
 */
export function exploded(i: number, _n: number, { gap = 80, origin = [0, 0, 0] as Vec3 } = {}): Pose {
  return { position: add(origin, [0, 0, i * gap]) };
}

/** Pose between `a` and `b`. */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const v = (x: Vec3 | undefined, y: Vec3 | undefined): Vec3 => {
    const p = x ?? [0, 0, 0];
    const q = y ?? [0, 0, 0];
    return [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
  };
  return {
    position: v(a.position, b.position),
    rotation: v(a.rotation, b.rotation),
    scale: lerp(a.scale ?? 1, b.scale ?? 1, t),
    opacity: lerp(a.opacity ?? 1, b.opacity ?? 1, t),
  };
}

/** Pose `b` placed relative to `a`: offsets add, rotations add. */
export const offsetPose = (a: Pose, by: Pose): Pose => ({
  position: add(a.position ?? [0, 0, 0], by.position ?? [0, 0, 0]),
  rotation: add(a.rotation ?? [0, 0, 0], by.rotation ?? [0, 0, 0]),
  scale: (a.scale ?? 1) * (by.scale ?? 1),
  opacity: (a.opacity ?? 1) * (by.opacity ?? 1),
});
