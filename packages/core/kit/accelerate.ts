/**
 * Abundance by acceleration (creative-direction skill): the first items land
 * at reading speed, then the speed rises linearly until the cut, and the next
 * shot picks the motion up at that speed and brakes into its framing. Pure
 * functions of the frame, so rows land in order and any frame renders alone.
 */

export type AccelerateOptions = {
  /** Frame the first item lands. */
  start: number;
  /** Frames between items at reading speed, before the ramp (about a beat). */
  every: number;
  /** Frame the speed starts to rise (after two to four items have been read). */
  rampAt: number;
  /** Items landed by `length`, the cut: the speed rises just enough to get there. */
  total: number;
  /** Frame of the cut, where the speed is highest. */
  length: number;
};

export type Acceleration = {
  /**
   * Where the front is at frame `t`, in items: item `i` lands as it passes
   * `i`, so 0 at `start`. Linear before `start` (negative), so a camera that
   * follows it never kinks; `count` is the clamped, whole version.
   */
  position(t: number): number;
  /** How many items have landed by frame `t` (0 before `start`). */
  count(t: number): number;
  /** The frame item `i` lands on (fractional). Strictly increasing, so items land in order. */
  landsAt(i: number): number;
  /** Items per frame at `t`: `1 / every` until `rampAt`, then rising linearly. Times an item's size in screen pixels, the speed at the cut to hand to `brake`. */
  speed(t: number): number;
  /**
   * The front for a camera to follow, in items: holds at `after` until the
   * front reaches it, then follows, rounding into the move over about `soft`
   * items instead of setting off with a jolt.
   */
  follow(t: number, options?: { after?: number; soft?: number }): number;
  /** The ramp's acceleration, in items per frame per frame. */
  acceleration: number;
};

/**
 * Items landing a few at reading speed, then faster and faster:
 *
 *   const run = accelerate({ start: 24, every: 34, rampAt: 112, total: 51, length: 240 });
 *   row i answers at run.landsAt(i); the camera follows rowY(run.follow(f, { after: 3 }))
 *   at the cut the sheet moves at run.speed(240) × rowHeight × zoom px a frame: `brake` from there.
 *
 * Put `<MotionBlur when={[[rampAt + 30, length]]}>` over the ramp, and give
 * it enough real items to fill the run.
 */
export function accelerate({ start, every, rampAt, total, length }: AccelerateOptions): Acceleration {
  if (every <= 0) throw new Error("accelerate: `every` must be more than 0 frames");
  const ramp = Math.max(start, rampAt);
  if (length <= ramp) throw new Error(`accelerate: the ramp (from ${ramp}) must start before \`length\` (${length})`);
  const v0 = 1 / every;
  const steady = (length - start) * v0;
  const a = (2 * (total - 1 - steady)) / (length - ramp) ** 2;
  if (a < 0)
    throw new Error(
      `accelerate: at one item every ${every} frames, ${Math.floor(steady) + 1} items land by frame ${length} without a ramp; \`total\` (${total}) must be more`,
    );
  const before = (ramp - start) * v0;
  const position = (t: number) => (t - start) * v0 + (t > ramp ? 0.5 * a * (t - ramp) ** 2 : 0);
  return {
    position,
    count: (t) => (t < start ? 0 : Math.floor(position(t) + 1e-9) + 1),
    landsAt: (i) => {
      if (i <= before) return start + i * every;
      const rest = i - before;
      if (a === 0) return ramp + rest / v0;
      return ramp + (-v0 + Math.sqrt(v0 * v0 + 2 * a * rest)) / a;
    },
    speed: (t) => v0 + (t > ramp ? a * (t - ramp) : 0),
    follow: (t, { after = 0, soft = 1 } = {}) => {
      // A smooth max(position, after): a hyperbola with asymptotes at both.
      const d = position(t) - after;
      return after + (d + Math.sqrt(d * d + soft * soft)) / 2;
    },
    acceleration: a,
  };
}

export type BrakeOptions = {
  /** Speed it arrives with at frame 0, in units per frame (px, or items): the last shot's speed at the cut. */
  speed: number;
  /** Frames the brake takes. */
  frames: number;
  /** Speed it keeps after the brake, so it never quite stops (default 0). */
  cruise?: number;
  /** Where it is when the brake ends (default 0): the framing it decelerates into. */
  to?: number;
};

export type Brake = {
  /** Position at frame `t`: `to` when the brake ends, drifting on at `cruise` after. */
  position(t: number): number;
  /** Speed at frame `t`, from `speed` down to `cruise`. */
  speed(t: number): number;
  /** Where it is at frame 0. */
  from: number;
  /** Distance covered during the brake. */
  distance: number;
};

/**
 * The shot after an acceleration: it enters at the speed the last one cut at
 * and slows into its framing, the speed falling as (1 − t/frames)², so it
 * eases into `cruise` with no bump. Before frame 0 it runs on at `speed`.
 *
 *   const b = brake({ speed: exitSpeed / zoom, frames: 40, cruise: 0.35, to: rowY(44) });
 *   <Camera keys={[{ at: 0, view: { x, y: b.position(frame), zoom } }]}>
 */
export function brake({ speed, frames, cruise = 0, to = 0 }: BrakeOptions): Brake {
  if (frames <= 0) throw new Error("brake: `frames` must be more than 0");
  const travelled = (t: number) => {
    if (t <= 0) return speed * t;
    const k = Math.min(t, frames);
    return cruise * t + ((speed - cruise) * frames * (1 - (1 - k / frames) ** 3)) / 3;
  };
  const distance = travelled(frames);
  const from = to - distance;
  return {
    position: (t) => from + travelled(t),
    speed: (t) => (t <= 0 ? speed : t >= frames ? cruise : cruise + (speed - cruise) * (1 - t / frames) ** 2),
    from,
    distance,
  };
}
