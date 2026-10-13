/**
 * Pure timing maths. Everything here is a function of the frame number, so a
 * frame renders identically in the studio, in a render worker that starts in
 * the middle of the video, and on the tenth re-render.
 */

export type Easing = (t: number) => number;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** CSS-compatible cubic-bezier easing, solved for x by bisection. */
export function bezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const axis = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (value) => {
    const x = clamp01(value);
    if (x === 0 || x === 1) return x;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (axis(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return axis((lo + hi) / 2, y1, y2);
  };
}

const out = bezier(0.22, 1, 0.36, 1);
const expo = bezier(0.16, 1, 0.3, 1);

/**
 * The motion vocabulary. MOTION.md says when to use which. The token names
 * (`settle`, `glide`, `swap`, `exit`, `pop`, `linear`) are the ones a
 * personality picks from (`motion()`); `out`, `expo`, `in` and `inOut` are the
 * same curves by shape, kept for the scenes that already use them.
 */
export const ease = {
  linear: (t: number) => clamp01(t),
  /** Default entrance: fast start, long settle. Same curve as the site's text reveal. */
  out,
  /** Exits and things leaving frame. */
  in: bezier(0.55, 0, 1, 0.45),
  /** Camera moves and anything that travels across the frame. */
  inOut: bezier(0.65, 0, 0.35, 1),
  /** Gentle, for fades and colour. */
  soft: bezier(0.25, 0.1, 0.25, 1),
  /** In-place exchanges where nothing travels: icon and text swaps, cross-fades, pulses in a loop. */
  swap: bezier(0.42, 0, 0.58, 1),
  /** Very long tail, for hero reveals that should feel expensive. */
  expo,
  /** Overshoots by 10% and settles back (`overshootEase(0.1)`). Playful accents only; a brand may rule it out. */
  pop: bezier(0.34, 1.56, 0.64, 1),
  /** Token name for `expo` (expo out): premium entrances, panels landing. Most of the move is over in the first third. */
  settle: expo,
  /** Token name for `out` (quint out): the general default, and camera moves that should set off at once. */
  glide: out,
  /**
   * Quint in: leaving frame. Starts slower than `in` and is still accelerating
   * at the last frame, so whatever leaves is gone at speed, not drifting out.
   */
  exit: bezier(0.64, 0, 0.78, 0),
} satisfies Record<string, Easing>;

export type EaseName = keyof typeof ease;

const overshoots = new Map<number, Easing>();

/**
 * An entrance that passes its target once by `amount` (0.04 = 4% of the
 * distance) and settles back, landing exactly at the end of the move. The
 * bigger the overshoot, the earlier it peaks: 2% peaks at 70% of the move,
 * 25% at half. Unlike a spring, it never rings, and it lands when the
 * duration says.
 */
export function overshootEase(amount = 0.04): Easing {
  const target = Math.max(0, Math.min(1, amount));
  const cached = overshoots.get(target);
  if (cached) return cached;
  // The y of a cubic bezier through (0.34, y1) and (0.64, 1), by its parameter.
  const peak = (y1: number) => {
    let max = 0;
    for (let i = 1; i < 200; i++) {
      const t = i / 200;
      max = Math.max(max, 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t + t ** 3);
    }
    return max - 1;
  };
  let lo = 1;
  let hi = 5;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (peak(mid) < target) lo = mid;
    else hi = mid;
  }
  const easing = bezier(0.34, (lo + hi) / 2, 0.64, 1);
  overshoots.set(target, easing);
  return easing;
}

export type InterpolateOptions = {
  easing?: Easing;
  /** Clamp outside the input range (default) or extrapolate linearly. */
  clamp?: boolean;
};

/**
 * Map `value` through piecewise segments: interpolate(frame, [0, 30, 60], [0, 1, 0]).
 * Easing applies per segment.
 */
export function interpolate(
  value: number,
  input: readonly number[],
  output: readonly number[],
  { easing = ease.linear, clamp = true }: InterpolateOptions = {},
): number {
  if (input.length !== output.length || input.length < 2) {
    throw new Error("interpolate: input and output need the same length (2+)");
  }
  const last = input.length - 1;
  if (clamp) {
    if (value <= input[0]) return output[0];
    if (value >= input[last]) return output[last];
  }
  let i = 0;
  while (i < last - 1 && value > input[i + 1]) i++;
  const span = input[i + 1] - input[i];
  const raw = span === 0 ? 1 : (value - input[i]) / span;
  const t = clamp ? easing(raw) : raw;
  return output[i] + (output[i + 1] - output[i]) * t;
}

/** 0 → 1 over `duration` frames starting at `start`. The workhorse for reveals. */
export function progress(frame: number, start: number, duration: number, easing = ease.out) {
  return interpolate(frame, [start, start + duration], [0, 1], { easing });
}

/**
 * A spring, as physics (`stiffness`, `damping`, `mass`) or as feel:
 * `{ duration, bounce }`, where `duration` is in frames (so it can come from
 * `t.beats(1)`) and `bounce` runs from 0 (no overshoot) to about 0.3 (a
 * visible one); negative values are slower than critical. Same model as
 * SwiftUI's `spring(duration:bounce:)`.
 */
export type SpringConfig =
  | { stiffness?: number; damping?: number; mass?: number }
  | { duration: number; bounce?: number };

/** Natural frequency (per second) and damping ratio of a config. */
function physics(config: SpringConfig, fps: number) {
  if ("duration" in config) {
    const bounce = Math.max(-0.95, Math.min(0.95, config.bounce ?? 0));
    return { w0: (2 * Math.PI * fps) / config.duration, zeta: bounce >= 0 ? 1 - bounce : 1 / (1 + bounce) };
  }
  const { stiffness = 170, damping = 26, mass = 1 } = config;
  return { w0: Math.sqrt(stiffness / mass), zeta: damping / (2 * Math.sqrt(stiffness * mass)) };
}

/** Displacement from rest `t` seconds after starting at `x0` with velocity `v0` (per second). */
function response(t: number, w0: number, zeta: number, x0: number, v0: number) {
  if (Math.abs(zeta - 1) < 1e-3) return Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-zeta * w0 * t) * (x0 * Math.cos(wd * t) + ((v0 + zeta * w0 * x0) / wd) * Math.sin(wd * t));
  }
  const root = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + root;
  const r2 = -zeta * w0 - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  return (x0 - c2) * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

/** The derivative of `response`: speed (per second) `t` seconds in. */
function responseSpeed(t: number, w0: number, zeta: number, x0: number, v0: number) {
  if (Math.abs(zeta - 1) < 1e-3) return Math.exp(-w0 * t) * (v0 - w0 * (v0 + w0 * x0) * t);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const b = (v0 + zeta * w0 * x0) / wd;
    return Math.exp(-zeta * w0 * t) * (v0 * Math.cos(wd * t) - (x0 * wd + zeta * w0 * b) * Math.sin(wd * t));
  }
  const root = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + root;
  const r2 = -zeta * w0 - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  return r1 * (x0 - c2) * Math.exp(r1 * t) + r2 * c2 * Math.exp(r2 * t);
}

/** Seconds until a move from rest stays within `within` of its distance from the target. */
function settleTime(w0: number, zeta: number, within: number) {
  // Underdamped: the decay envelope bounds the swing. Otherwise the approach is monotonic.
  const off =
    zeta < 0.999
      ? (t: number) => Math.exp(-zeta * w0 * t) / Math.sqrt(1 - zeta * zeta)
      : (t: number) => Math.abs(response(t, w0, zeta, -1, 0));
  let lo = 0;
  let hi = 1 / w0;
  while (off(hi) > within) hi *= 2;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (off(mid) > within) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Closed-form damped spring from 0 to 1, `frame` frames after it starts.
 * No integration state, so any frame can be evaluated on its own.
 * `velocity` is the speed it starts with, in fractions of the distance per frame.
 */
export function spring(frame: number, fps: number, config: SpringConfig = {}, velocity = 0): number {
  if (frame <= 0) return 0;
  const { w0, zeta } = physics(config, fps);
  return 1 + response(frame / fps, w0, zeta, -1, velocity * fps);
}

/** The speed of `spring` at `frame`, in fractions of the distance per frame. */
export function springVelocity(frame: number, fps: number, config: SpringConfig = {}, velocity = 0): number {
  if (frame <= 0) return 0;
  const { w0, zeta } = physics(config, fps);
  return responseSpeed(frame / fps, w0, zeta, -1, velocity * fps) / fps;
}

/**
 * A moving position that lands on whole pixels: `value` while it is on its way, `target` rounded
 * once it is within `within` pixels of it. Text held on a fractional position renders soft, and
 * rounding every frame instead makes a spring's slow tail step a whole pixel at a time (measured:
 * 0.28 px of judder on a re-centring line, 0.035 px with this). `target` is where the move is
 * going, the `to` of the change under way.
 *
 *   const x = landed(springTo(frame, fps, keys, spring), keys.at(-1).to)
 */
export function landed(value: number, target: number, within = 0.2): number {
  return Math.abs(value - target) < within ? Math.round(target) : value;
}

/**
 * Frames until a spring from rest stays within `within` (a fraction of the
 * distance) of where it is going: when the next beat can start without the
 * last move still visibly settling.
 */
export function settleFrames(config: SpringConfig = {}, fps = 60, within = 0.01): number {
  const { w0, zeta } = physics(config, fps);
  return settleTime(w0, zeta, within) * fps;
}

/** What `springTo` moves: one number, or several channels at once (a point `[x, y]`, a size). */
export type SpringValue = number | readonly number[];

export type SpringTarget<T extends SpringValue = number> = {
  /** Frame the value sets off for `to`. The first target is where it starts. */
  at: number;
  to: T;
  /** A kick at `at`, in units per frame: the speed a released drag or a flick hands over. */
  velocity?: T;
  /** This change's spring, instead of the shared one. */
  spring?: SpringConfig;
};

/** One channel of multi-channel targets, as scalar targets. */
function channel(targets: SpringTarget<readonly number[]>[], c: number): SpringTarget[] {
  return targets.map((t) => {
    if (t.to.length !== targets[0].to.length)
      throw new Error("springTo: every target needs the same number of channels");
    return { at: t.at, to: t.to[c], velocity: t.velocity?.[c], spring: t.spring };
  });
}

/**
 * A value that changes target many times: the sum of one spring response per
 * change. Changing target mid-flight keeps the speed it had, so nothing stops
 * dead at a waypoint, and it stays a pure function of the frame.
 *
 *   springTo(frame, fps, [{ at: 0, to: 0 }, { at: 30, to: 1 }, { at: 42, to: 0.4 }], springs.snappy)
 *
 * A point (or any list of numbers) moves channel by channel on the same springs:
 *
 *   const [x, y] = springTo(frame, fps, [{ at: 0, to: [200, 540] }, { at: 30, to: [960, 300] }], springs.snappy)
 *
 * A release from a drag: start where it was let go, moving as it was, and head for rest.
 *
 *   springTo(frame, fps, [{ at: r, to: here, velocity: speed }, { at: r, to: rest }])
 *
 * For a colour, `springColor` (in OKLCH).
 */
export function springTo(frame: number, fps: number, targets: SpringTarget[], config?: SpringConfig): number;
export function springTo(
  frame: number,
  fps: number,
  targets: SpringTarget<readonly number[]>[],
  config?: SpringConfig,
): number[];
export function springTo(
  frame: number,
  fps: number,
  targets: SpringTarget[] | SpringTarget<readonly number[]>[],
  config: SpringConfig = {},
): number | number[] {
  if (targets.length === 0) throw new Error("springTo: needs at least one target");
  if (typeof targets[0].to !== "number") {
    const many = targets as SpringTarget<readonly number[]>[];
    return many[0].to.map((_, c) => springTo(frame, fps, channel(many, c), config));
  }
  return springScalar(frame, fps, targets as SpringTarget[], config);
}

function springScalar(frame: number, fps: number, targets: SpringTarget[], config: SpringConfig): number {
  let value = targets[0].to;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const t = (frame - target.at) / fps;
    if (t <= 0) continue;
    const { w0, zeta } = physics(target.spring ?? config, fps);
    if (i > 0) value += (target.to - targets[i - 1].to) * (1 + response(t, w0, zeta, -1, 0));
    if (target.velocity) value += response(t, w0, zeta, 0, target.velocity * fps);
  }
  return value;
}

/**
 * The speed of `springTo` at `frame`, in units per frame: what a motion hands
 * over at a cut (`velocity` on the next shot's first target), or what sizes a
 * stretch or a blur by how fast something moves. Per channel for a point.
 */
export function springToVelocity(frame: number, fps: number, targets: SpringTarget[], config?: SpringConfig): number;
export function springToVelocity(
  frame: number,
  fps: number,
  targets: SpringTarget<readonly number[]>[],
  config?: SpringConfig,
): number[];
export function springToVelocity(
  frame: number,
  fps: number,
  targets: SpringTarget[] | SpringTarget<readonly number[]>[],
  config: SpringConfig = {},
): number | number[] {
  if (targets.length === 0) throw new Error("springToVelocity: needs at least one target");
  if (typeof targets[0].to !== "number") {
    const many = targets as SpringTarget<readonly number[]>[];
    return many[0].to.map((_, c) => springToVelocity(frame, fps, channel(many, c), config));
  }
  return speedScalar(frame, fps, targets as SpringTarget[], config);
}

function speedScalar(frame: number, fps: number, targets: SpringTarget[], config: SpringConfig): number {
  let speed = 0;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const t = (frame - target.at) / fps;
    if (t <= 0) continue;
    const { w0, zeta } = physics(target.spring ?? config, fps);
    if (i > 0) speed += (target.to - targets[i - 1].to) * responseSpeed(t, w0, zeta, -1, 0);
    if (target.velocity) speed += responseSpeed(t, w0, zeta, 0, target.velocity * fps);
  }
  return speed / fps;
}

const settled = new Map<number, number>();

/**
 * A spring as an easing, so it fits anywhere an easing does (`interpolate`,
 * `progress`, Camera and Cursor keys) and still arrives when the key says.
 * `bounce` 0 is a spring's shape without overshoot: a soft start and a long
 * settle, like `ease.out`; 0.1 to 0.2 overshoots slightly before landing.
 * Negative values, as in `spring`, are slower than critical: a quicker start
 * and a longer, flatter approach.
 */
export function springEase(bounce = 0): Easing {
  const b = Math.max(-0.95, Math.min(0.9, bounce));
  const zeta = b >= 0 ? 1 - b : 1 / (1 + b);
  // Where the response stays within 1% of rest, in units of 1/w0: that point becomes t = 1.
  let end = settled.get(zeta);
  if (end === undefined) {
    end = settleTime(1, zeta, 0.01);
    settled.set(zeta, end);
  }
  const u = end;
  const at = (t: number) => 1 + response(t * u, 1, zeta, -1, 0);
  // Spread the last 1% over the move, so it lands exactly on 1 without a jump.
  const miss = 1 - at(1);
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : at(t) + t * miss);
}

/** Named spring configs for `spring(frame, fps, springs.snappy)`. */
export const springs = {
  /** Slow, no overshoot. */
  gentle: { stiffness: 90, damping: 20 },
  /** Fast, a hint of overshoot. */
  snappy: { stiffness: 320, damping: 30 },
  /** Visible bounce: playful accents. */
  bouncy: { stiffness: 240, damping: 14 },
  /** Large objects and devices: slow to start, no overshoot. */
  heavy: { stiffness: 120, damping: 32, mass: 2 },
} satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof springs;

/**
 * Any spring as feel: `{ duration, bounce }` with `duration` in frames at
 * `fps`. The same spring, not an approximation: `spring(f, fps, a)` and
 * `spring(f, fps, springFeel(a, fps))` agree on every frame.
 */
export function springFeel(config: SpringConfig, fps: number): { duration: number; bounce: number } {
  if ("duration" in config) return { duration: config.duration, bounce: config.bounce ?? 0 };
  const { w0, zeta } = physics(config, fps);
  return { duration: (2 * Math.PI * fps) / w0, bounce: zeta <= 1 ? 1 - zeta : 1 / zeta - 1 };
}

/**
 * The `springs` presets in the duration-and-bounce vocabulary LAUNCH.md
 * teaches, in frames at this frame rate (a duration in frames cannot be a
 * fixed preset): `springsAt(60).snappy` is about `{ duration: 21, bounce: 0.16 }`.
 * Pass a tempo (`tempo(120, 60)`) or a frame rate.
 */
export function springsAt(clock: number | Beat) {
  const fps = typeof clock === "number" ? clock : clock.fps;
  return {
    gentle: springFeel(springs.gentle, fps),
    snappy: springFeel(springs.snappy, fps),
    bouncy: springFeel(springs.bouncy, fps),
    heavy: springFeel(springs.heavy, fps),
  } satisfies Record<SpringName, SpringConfig>;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic PRNG. Same seed, same sequence, in every worker. */
export function random(seed: number | string): () => number {
  let h = typeof seed === "number" ? seed >>> 0 : 2166136261;
  if (typeof seed === "string") {
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SnapOptions = {
  /** Which grid line: the nearest (default), the next one at or after, or the one at or before. */
  mode?: "nearest" | "next" | "prev";
  /** Split each beat into 2 or 4. */
  subdivision?: 1 | 2 | 4;
  /** Snap to beats (default) or only to bar downbeats. */
  grid?: "beat" | "downbeat";
};

const round = (x: number, mode: SnapOptions["mode"]) =>
  mode === "next" ? Math.ceil(x - 1e-6) : mode === "prev" ? Math.floor(x + 1e-6) : Math.round(x);

/**
 * Musical time. Pick a tempo whose beat is a whole number of frames
 * (at 60 fps: 90, 100, 120, 144 BPM) so cuts land exactly on the beat.
 */
export function tempo(bpm: number, fps: number, beatsPerBar = 4) {
  const perBeat = (60 / bpm) * fps;
  return {
    bpm,
    fps,
    framesPerBeat: perBeat,
    whole: Number.isInteger(perBeat),
    beats: (n: number) => Math.round(n * perBeat),
    bars: (n: number) => Math.round(n * beatsPerBar * perBeat),
    seconds: (s: number) => Math.round(s * fps),
    /** Beat position of a frame, fractional: 2.5 is halfway between beats 2 and 3. */
    at: (frame: number) => frame / perBeat,
    /** The frame of the grid line nearest to (or after, or before) `frame`. */
    snap: (frame: number, { mode = "nearest", subdivision = 1, grid = "beat" }: SnapOptions = {}) => {
      const step = grid === "downbeat" ? perBeat * beatsPerBar : perBeat / subdivision;
      return Math.round(round(frame / step, mode) * step);
    },
  };
}

/** A tempo (`tempo()`), or anything else that knows its beat in frames. */
export type Beat = { framesPerBeat: number; fps: number };

const DURATIONS = { xs: 6, s: 12, m: 18, l: 30, xl: 48 };
const STAGGERS = { tight: 2, default: 4, loose: 8 };

/** Frames at 30 fps, scaled to `fps`, never under one frame. */
const scaled = <K extends string>(table: Record<K, number>, fps: number) =>
  Object.fromEntries(
    Object.entries(table).map(([k, v]) => [k, Math.max(1, Math.round(((v as number) * fps) / 30))]),
  ) as Record<K, number>;

const beatOf = (clock: number | Beat) => (typeof clock === "number" ? undefined : clock);

export type Durations = Record<keyof typeof DURATIONS, number>;

/**
 * Named durations, so scenes say how long a move is by what it is, not by a
 * number: `xs` 6, `s` 12, `m` 18, `l` 30, `xl` 48 frames at 30 fps (0.2 to
 * 1.6 s), scaled to the frame rate. `xs` for a press or a colour change, `s`
 * for small UI (a badge, a tooltip), `m` for a panel or a word, `l` for a hero
 * entrance or a camera move, `xl` for a reveal that should feel expensive.
 * Given a tempo, `beat(n)` is `n` beats in whole frames, for moves that
 * should last as long as the music says.
 */
export function durations(clock: number): Durations;
export function durations(clock: Beat): Durations & { beat: (n?: number) => number };
export function durations(clock: number | Beat) {
  const beat = beatOf(clock);
  const table = scaled(DURATIONS, beat ? beat.fps : (clock as number));
  return beat ? { ...table, beat: (n = 1) => Math.round(n * beat.framesPerBeat) } : table;
}

export type Staggers = Record<keyof typeof STAGGERS, number>;

/**
 * Named staggers, the frames between one unit and the next: `tight` 2,
 * `default` 4, `loose` 8 at 30 fps, scaled to the frame rate. Words and
 * letters of one line take `tight` (2 to 4 frames at 60 fps keeps a headline
 * under about 18 frames); `default` and `loose` space rows and cards. Given a tempo,
 * also `onBeat` and `halfBeat`, for separate elements that each land on the
 * music (cards, list items, callouts), never letters of one word.
 */
export function staggers(clock: number): Staggers;
export function staggers(clock: Beat): Staggers & { onBeat: number; halfBeat: number };
export function staggers(clock: number | Beat) {
  const beat = beatOf(clock);
  const table = scaled(STAGGERS, beat ? beat.fps : (clock as number));
  return beat
    ? { ...table, onBeat: Math.round(beat.framesPerBeat), halfBeat: Math.round(beat.framesPerBeat / 2) }
    : table;
}

type DurationName = keyof Durations;
type StaggerName = keyof Staggers | "onBeat" | "halfBeat";

/**
 * Motion personalities: one easing family, spring, duration and stagger that
 * a video picks once, so its moves feel like one hand made them.
 * - `premium`: long settles (`settle` in, `glide` across), heavy springs, elements on the beat.
 * - `energetic`: short `out` entrances, snappy springs, elements on the beat.
 * - `playful`: `pop` entrances that overshoot, bouncy springs, elements on the half beat.
 * All three stagger words `tight`: a slower word stagger reads as slow type, not as a personality.
 */
export const personalities = {
  premium: {
    enter: "settle",
    move: "glide",
    exit: "exit",
    spring: "heavy",
    duration: "l",
    exitDuration: "s",
    stagger: "tight",
    step: "onBeat",
  },
  energetic: {
    enter: "out",
    move: "inOut",
    exit: "exit",
    spring: "snappy",
    duration: "s",
    exitDuration: "xs",
    stagger: "tight",
    step: "onBeat",
  },
  playful: {
    enter: "pop",
    move: "out",
    exit: "in",
    spring: "bouncy",
    duration: "m",
    exitDuration: "s",
    stagger: "tight",
    step: "halfBeat",
  },
} satisfies Record<
  string,
  {
    enter: EaseName;
    move: EaseName;
    exit: EaseName;
    spring: SpringName;
    duration: DurationName;
    exitDuration: DurationName;
    stagger: StaggerName;
    step: StaggerName;
  }
>;

export type Personality = keyof typeof personalities;

/**
 * A personality resolved for one video: easings as functions, the spring in
 * frames, durations and staggers in frames.
 *
 *   const m = motion("premium", t);
 *   progress(frame, at, m.duration, m.enter);
 *   springTo(frame, fps, keys, m.spring);
 *   cards.map((c, i) => m.at(i, start));   // one card per beat
 *
 * `stagger` spaces units inside one element (words, letters); `step`
 * spaces separate elements, on the beat. Without a tempo, `step` assumes 120 BPM.
 */
export function motion(name: Personality, clock: number | Beat) {
  const p = personalities[name];
  const beat = beatOf(clock) ?? { fps: clock as number, framesPerBeat: (clock as number) / 2 };
  const d = durations(beat);
  const s = staggers(beat);
  return {
    name,
    enter: ease[p.enter] as Easing,
    move: ease[p.move] as Easing,
    exit: ease[p.exit] as Easing,
    spring: springsAt(beat)[p.spring],
    duration: d[p.duration],
    exitDuration: d[p.exitDuration],
    stagger: s[p.stagger],
    step: s[p.step],
    /** Frame the `i`th separate element arrives, `step` apart from `start`. */
    at: (i: number, start = 0) => start + i * s[p.step],
    durations: d,
    staggers: s,
  };
}

/** A replayed passage of the music (`audio.edit`), by beat index. */
export type BeatEdit = { replay: [number, number]; times?: number; crossfade?: number };

/** Seconds before a beat where a replay's seam is cut, so the beat's attack comes whole from the passage that follows. */
export const SEAM_LEAD = 0.008;

/**
 * The pieces of the source track an `audio.edit` plays, in order (beat
 * indices of beats.json; negative ones count back from the first beat at the
 * track's tempo, as `beats --seams` lists them): `from` and
 * `to` in source seconds (the last piece runs to the end), `at` where each
 * starts in the edited track, and the `crossfade` ending on its leading seam
 * (0 where the piece carries straight on from the one before).
 */
export function editPieces(beats: number[], edit: BeatEdit[]) {
  if (beats.length < 2) throw new Error("audio.edit: beats.json has too few beats");
  // Before the first beat found and after the last, the grid carries on at the track's tempo.
  const period = (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
  const time = (n: number) => {
    if (!Number.isInteger(n)) throw new Error(`audio.edit: beat ${n} is not a whole beat`);
    const t =
      n < 0
        ? beats[0] + n * period
        : n >= beats.length
          ? beats[beats.length - 1] + (n - beats.length + 1) * period
          : beats[n];
    return Math.max(0, t - SEAM_LEAD);
  };
  const pieces: { from: number; to: number; at: number; crossfade: number }[] = [];
  let cursor = 0;
  let at = 0;
  for (const e of [...edit].sort((a, b) => a.replay[1] - b.replay[1])) {
    const [from, to] = [time(e.replay[0]), time(e.replay[1])];
    if (to <= from) throw new Error(`audio.edit: replay [${e.replay.join(", ")}] runs backwards`);
    if (to > cursor) {
      pieces.push({ from: cursor, to, at, crossfade: 0 });
      at += to - cursor;
      cursor = to;
    }
    for (let n = 0; n < (e.times ?? 1); n++) {
      pieces.push({ from, to, at, crossfade: e.crossfade ?? 0.03 });
      at += to - from;
    }
  }
  // After its last replay a passage carries on into the source, which follows it without a seam.
  pieces.push({ from: cursor, to: Number.POSITIVE_INFINITY, at, crossfade: 0 });
  return pieces;
}

/** Beat times (seconds) after an `audio.edit`: each replayed passage brings its beats again, and later beats move later. */
export function editBeats<T extends { beats: number[]; downbeats: number[] }>(detected: T, edit: BeatEdit[] = []): T {
  if (!edit.length) return detected;
  const pieces = editPieces(detected.beats, edit);
  const map = (list: number[]) =>
    pieces.flatMap((p) => list.filter((t) => t >= p.from && t < p.to).map((t) => p.at + (t - p.from)));
  return { ...detected, beats: map(detected.beats), downbeats: map(detected.downbeats) };
}

/**
 * Detected beats (from `pnpm launch beats`) as frames. Use when the track
 * drifts from its nominal tempo: cut on `grid.beat(16)` instead of `tempo().beats(16)`.
 * Pass the video's `audio.edit` and the grid follows the lengthened track.
 */
export function beatGrid(
  detected: { beats: number[]; downbeats: number[] },
  fps: number,
  offset = 0,
  edit: BeatEdit[] = [],
) {
  detected = editBeats(detected, edit);
  const frames = (list: number[]) => list.map((t) => (t - offset) * fps);
  const beats = frames(detected.beats);
  const downbeats = frames(detected.downbeats);
  const at = (list: number[], n: number) => {
    if (list.length === 0) throw new Error("beats.json has no beats");
    return Math.round(list[Math.max(0, Math.min(list.length - 1, n))]);
  };
  /** Fractional index of `frame` in `list`, extrapolating past the ends at the edge spacing. */
  const position = (list: number[], frame: number) => {
    if (list.length < 2) return 0;
    let i = 0;
    while (i < list.length - 2 && frame > list[i + 1]) i++;
    return i + (frame - list[i]) / (list[i + 1] - list[i]);
  };
  const lines = (subdivision: number) =>
    beats.flatMap((b, i) =>
      i === beats.length - 1
        ? [b]
        : Array.from({ length: subdivision }, (_, k) => b + ((beats[i + 1] - b) * k) / subdivision),
    );
  return {
    /** Frame of the nth beat (0-based). */
    beat: (n: number) => at(beats, n),
    /** Frame of the nth bar's downbeat. */
    bar: (n: number) => at(downbeats, n),
    /** Frames between beat a and beat b: a shot's duration. */
    span: (a: number, b: number) => at(beats, b) - at(beats, a),
    /** Beat position of a frame, fractional. */
    at: (frame: number) => position(beats, frame),
    /** The frame of the detected grid line nearest to (or after, or before) `frame`. */
    snap: (frame: number, { mode = "nearest", subdivision = 1, grid = "beat" }: SnapOptions = {}) => {
      const list = grid === "downbeat" ? downbeats : lines(subdivision);
      if (list.length === 0) throw new Error("beats.json has no beats");
      const i = Math.max(0, Math.min(list.length - 1, round(position(list, frame), mode)));
      return Math.round(list[i]);
    },
  };
}

/**
 * Quiet stretches in a track's energy (from beats.json), longer than
 * `minDuration` seconds: candidates for the silence before a reveal. Quiet is
 * relative to the music around it (the median over `window` seconds either
 * side), so a breakdown in a quiet intro counts as well as one before a drop.
 */
export function findBreaths(
  energy: { rate: number; values: number[] },
  { minDuration = 0.5, below = 0.35, window = 3 }: { minDuration?: number; below?: number; window?: number } = {},
) {
  const { rate, values } = energy;
  const reach = Math.round(window * rate);
  const around = (i: number) => {
    const near = values.slice(Math.max(0, i - reach), i + reach + 1).sort((a, b) => a - b);
    return near[near.length >> 1];
  };
  const breaths: { start: number; end: number; depth: number }[] = [];
  let start = -1;
  let low = 1;
  values.forEach((v, i) => {
    const ratio = v / Math.max(around(i), 1e-9);
    const quiet = ratio < below;
    if (quiet && start < 0) {
      start = i;
      low = 1;
    }
    if (quiet) low = Math.min(low, ratio);
    if ((!quiet || i === values.length - 1) && start >= 0) {
      const end = quiet ? i + 1 : i;
      if ((end - start) / rate >= minDuration) breaths.push({ start: start / rate, end: end / rate, depth: 1 - low });
      start = -1;
    }
  });
  return breaths;
}
