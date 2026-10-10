import { type Easing, ease, lerp, random } from "@intentface-launch/core";
import { apertureFor, type Lens, orbit, type Vec3 } from "./lens.js";

/**
 * A camera placed the way a camera operator thinks about it: what it looks at,
 * how far away, how high (elevation, 90 = straight on to the UI) and from which
 * side (azimuth). Rigs interpolate these, not raw positions, so an orbit stays
 * on its circle and a push stays on its axis.
 */
export type Framing = {
  target: Vec3;
  distance: number;
  elevation: number;
  azimuth?: number;
  fov?: number;
  roll?: number;
  /** Lens opening in world units. Or give `blur` and let the rig pick it. */
  aperture?: number;
  /** Depth of field by effect: a point `depth` units behind the focus plane blurs into a `px` disk (at 1080p). */
  blur?: { px: number; depth: number };
  /** Focus distance from the camera. Default: the target. */
  focus?: number;
};

/** A framing at a frame. `easing` shapes the move that arrives here (as in <Camera> keys). */
export type RigKey = Framing & { at: number; easing?: Easing };

export type LensFn = (frame: number) => Lens;

const OUTPUT_HEIGHT = 1080;

/** The lens for one framing. */
export function frame(f: Framing): Lens {
  const position = orbit(f.target, { distance: f.distance, elevation: f.elevation, azimuth: f.azimuth ?? 0 });
  const lens: Lens = { position, target: f.target, fov: f.fov ?? 30, roll: f.roll ?? 0, focus: f.focus };
  if (f.blur) {
    const focus = f.focus ?? f.distance;
    lens.aperture = apertureFor(f.blur.px, lens, focus + f.blur.depth, OUTPUT_HEIGHT);
  } else lens.aperture = f.aperture ?? 0;
  return lens;
}

const mix = (a: Framing, b: Framing, t: number): Framing => ({
  target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
  // Distance in log space, so a 3× push feels even all the way in.
  distance: Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), t)),
  elevation: lerp(a.elevation, b.elevation, t),
  azimuth: lerp(a.azimuth ?? 0, b.azimuth ?? 0, t),
  fov: lerp(a.fov ?? 30, b.fov ?? 30, t),
  roll: lerp(a.roll ?? 0, b.roll ?? 0, t),
  focus:
    a.focus !== undefined || b.focus !== undefined ? lerp(a.focus ?? a.distance, b.focus ?? b.distance, t) : undefined,
  blur:
    a.blur || b.blur
      ? {
          px: lerp(a.blur?.px ?? 0, b.blur?.px ?? 0, t),
          depth: lerp(a.blur?.depth ?? b.blur?.depth ?? 1, b.blur?.depth ?? a.blur?.depth ?? 1, t),
        }
      : undefined,
  aperture: a.blur || b.blur ? undefined : lerp(a.aperture ?? 0, b.aperture ?? 0, t),
});

/** Framing at a frame, from keys (sorted by `at`). Holds before the first and after the last. */
export function framingAt(keys: RigKey[], f: number): Framing {
  if (keys.length === 0) throw new Error("rig() needs at least one key");
  if (f <= keys[0].at) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (f < b.at) {
      const a = keys[i - 1];
      const t = (b.easing ?? ease.inOut)((f - a.at) / (b.at - a.at));
      return mix(a, b, t);
    }
  }
  return keys[keys.length - 1];
}

export type RigOptions = {
  /** Operator shake on top of the move. */
  handheld?: Handheld;
  /** Frames the look-at point lags behind the framing's target, like a head following. */
  lag?: number;
};

/**
 * A camera move from keyframed framings, for `<Stage3D lens={rig(keys)}>`.
 * Every named move below is a pair of keys; combine keys freely for longer shots.
 * Camera moves default to `ease.inOut` (MOTION.md).
 */
export function rig(keys: RigKey[], options: RigOptions = {}): LensFn {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  let lens: LensFn = (f) => frame(framingAt(sorted, f));
  if (options.lag) {
    const lag = options.lag;
    const aim = follow((f) => framingAt(sorted, f).target, lag);
    const base = lens;
    lens = (f) => ({ ...base(f), target: aim(f) });
  }
  if (options.handheld) lens = handheld(lens, options.handheld);
  return lens;
}

type Move = { at: number; duration: number; easing?: Easing };

const keysFor = (from: Framing, to: Framing, m: Move): RigKey[] => [
  { ...from, at: m.at },
  { ...to, at: m.at + m.duration, easing: m.easing },
];

/** Circle the target: elevation and azimuth move, distance and target hold unless given. */
export const orbitMove = (from: Framing, to: Partial<Framing>, m: Move) => rig(keysFor(from, { ...from, ...to }, m));

/** Move in along the view axis. `amount` is the end distance as a fraction of the start. */
export const pushIn = (from: Framing, m: Move & { amount?: number }) =>
  rig(keysFor(from, { ...from, distance: from.distance * (m.amount ?? 0.7) }, { easing: ease.soft, ...m }));

/** Move out along the view axis. */
export const pullBack = (from: Framing, m: Move & { amount?: number }) =>
  rig(keysFor(from, { ...from, distance: from.distance * (m.amount ?? 1.5) }, { easing: ease.soft, ...m }));

/** A constant spin around the target: `degrees` over the move, linear unless eased. */
export const turntable = (from: Framing, m: Move & { degrees?: number }) =>
  rig(keysFor(from, { ...from, azimuth: (from.azimuth ?? 0) + (m.degrees ?? 360) }, { easing: ease.linear, ...m }));

/**
 * Close and shallow, sliding across the UI: the target travels by `by`, the
 * camera keeps its angle, and only a sliver of the UI is sharp.
 */
export const macroSlide = (from: Framing, m: Move & { by: Vec3 }) => {
  const shallow = { ...from, blur: from.blur ?? { px: 40, depth: from.distance * 0.25 } };
  const [x, y, z] = from.target;
  return rig(
    keysFor(shallow, { ...shallow, target: [x + m.by[0], y + m.by[1], z + m.by[2]] }, { easing: ease.soft, ...m }),
  );
};

/** Straight down on the UI from high up, dropping in with a turn. */
export const topDown = (target: Vec3, m: Move & { from: number; to: number; roll?: [number, number]; fov?: number }) =>
  rig(
    keysFor(
      { target, distance: m.from, elevation: 90, roll: m.roll?.[0] ?? 0, fov: m.fov },
      { target, distance: m.to, elevation: 90, roll: m.roll?.[1] ?? 0, fov: m.fov },
      { easing: ease.out, ...m },
    ),
  );

/**
 * Fly through a point (a gap between panels, a window in the UI): the camera
 * travels from `from` through `through` and on by `beyond` of the same
 * distance, always looking ahead along its path.
 */
export function dollyThrough(
  from: Vec3,
  through: Vec3,
  m: Move & { beyond?: number; fov?: number; blur?: Framing["blur"] },
): LensFn {
  const dir: Vec3 = [through[0] - from[0], through[1] - from[1], through[2] - from[2]];
  const len = Math.hypot(...dir);
  const beyond = m.beyond ?? 0.5;
  const easing = m.easing ?? ease.inOut;
  return (f) => {
    const t = easing((f - m.at) / m.duration);
    const s = lerp(0, 1 + beyond, t);
    const position: Vec3 = [from[0] + dir[0] * s, from[1] + dir[1] * s, from[2] + dir[2] * s];
    const target: Vec3 = [position[0] + dir[0] / len, position[1] + dir[1] / len, position[2] + dir[2] / len];
    const lens: Lens = { position, target, fov: m.fov ?? 40 };
    // Focus on the gap as it approaches, so what is past it stays soft.
    const toGap = Math.max(20, len * (1 - s));
    lens.focus = toGap;
    if (m.blur) lens.aperture = apertureFor(m.blur.px, lens, toGap + m.blur.depth, OUTPUT_HEIGHT);
    return lens;
  };
}

/** One piece after another: each lens function takes over at its `from` frame. */
export function sequence(parts: { from: number; lens: LensFn }[]): LensFn {
  const sorted = [...parts].sort((a, b) => a.from - b.from);
  return (f) => {
    let current = sorted[0];
    for (const p of sorted) if (f >= p.from) current = p;
    return current.lens(f);
  };
}

/**
 * A point that follows `point` with a lag of about `frames`: the average of
 * where it was over the last few lags, weighted towards now. A pure function
 * of the frame (no state), so any frame renders alone.
 */
export function follow(point: (f: number) => Vec3, frames: number): (f: number) => Vec3 {
  const taps = 24;
  const weights = Array.from({ length: taps }, (_, i) => Math.exp(-(i / (taps - 1)) * 3));
  const total = weights.reduce((a, b) => a + b, 0);
  return (f) => {
    const out: Vec3 = [0, 0, 0];
    for (let i = 0; i < taps; i++) {
      const p = point(f - (i / (taps - 1)) * frames * 3);
      const w = weights[i] / total;
      out[0] += p[0] * w;
      out[1] += p[1] * w;
      out[2] += p[2] * w;
    }
    return out;
  };
}

export type Handheld = {
  /** 1 is a steady operator; 2 to 3 is on the move. 0 turns it off. */
  amount?: number;
  /** Speed of the sway. 1 is a slow breath (about 0.3 Hz at 60 fps). */
  speed?: number;
  seed?: string | number;
  fps?: number;
};

/**
 * Smooth operator sway on any lens: a few slow sines with seeded frequencies
 * and phases, on position, aim and roll. Scaled by distance, so it is the same
 * size on screen whether the camera is close or far.
 */
export function handheld(lens: LensFn, { amount = 1, speed = 1, seed = "handheld", fps = 60 }: Handheld = {}): LensFn {
  if (amount === 0) return lens;
  const next = random(seed);
  const channel = () =>
    Array.from({ length: 3 }, (_, i) => ({
      hz: (0.18 + next() * 0.25) * (1 + i * 0.9) * speed,
      phase: next() * Math.PI * 2,
      weight: 1 / (1 + i * 1.6),
    }));
  const channels = Array.from({ length: 7 }, channel);
  const wave = (c: number, f: number) =>
    channels[c].reduce((s, w) => s + Math.sin((f / fps) * w.hz * Math.PI * 2 + w.phase) * w.weight, 0) / 1.6;
  return (f) => {
    const l = lens(f);
    const t = l.target ?? [0, 0, 0];
    const d = Math.hypot(l.position[0] - t[0], l.position[1] - t[1], l.position[2] - t[2]);
    const move = d * 0.004 * amount;
    const aim = d * 0.002 * amount;
    return {
      ...l,
      position: [
        l.position[0] + wave(0, f) * move,
        l.position[1] + wave(1, f) * move,
        l.position[2] + wave(2, f) * move,
      ],
      target: [t[0] + wave(3, f) * aim, t[1] + wave(4, f) * aim, t[2] + wave(5, f) * aim],
      roll: (l.roll ?? 0) + wave(6, f) * 0.25 * amount,
    };
  };
}
