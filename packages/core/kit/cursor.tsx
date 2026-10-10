import {
  type Easing,
  ease,
  interpolate,
  progress,
  type Sound,
  type SpringConfig,
  springs,
  springTo,
  useFrame,
  useVideoInfo,
} from "../engine/index.js";
import { type Rect, useCameraView } from "./camera.js";

export type Point = { x: number; y: number };

export type CursorKey = {
  /** Frame the cursor arrives, and clicks if `click`. With `hover`, the click frame: it arrives `hover` frames earlier. */
  at: number;
  /** A point, or a rect whose centre it aims for. */
  to: Point | Rect;
  /** Click on arrival (at `at`). */
  click?: boolean;
  /**
   * Frames it rests on the target before `at`: it arrives at `at - hover`,
   * dwells, and clicks (or sets off) at `at`. A hand reads the target before
   * it clicks; without a rest, a click straight off a move looks like a
   * script. 10 to 20 frames for a deliberate click. Keeps `at` on the beat, so
   * a retimed hover never moves the click or its sound.
   */
  hover?: number;
  /** How far the path bows, as a fraction of the distance (default 0.12). Negative bows the other way. */
  arc?: number;
  /**
   * Frames the move takes, ending at its arrival (default: from the previous
   * key's `at`). Longer than the gap, it sets off before the previous move
   * lands and flows through it.
   */
  travel?: number;
  /** Easing of the move (default `ease.inOut`). A drag released at speed wants one that ends moving, like `ease.in`. */
  easing?: Easing;
  /** Hold the button down for this move: pressed when it sets off, released at `at`. Consecutive drags stay held. */
  drag?: boolean;
};

const centre = (p: Point | Rect): Point => ("width" in p ? { x: p.x + p.width / 2, y: p.y + p.height / 2 } : p);

/** Frame the cursor lands on a key's target: `at`, or `hover` frames before it. */
const arrival = (key: CursorKey) => key.at - (key.hover ?? 0);

const moveStart = (keys: CursorKey[], i: number) =>
  keys[i].travel !== undefined ? arrival(keys[i]) - keys[i].travel : keys[i - 1].at;

/**
 * Cursor position at `frame`: eased moves along gentle arcs, the way a hand
 * moves a mouse. Each key adds its move, so moves that overlap blend into one
 * gesture instead of stopping at every waypoint.
 */
export function cursorAt(keys: CursorKey[], frame: number): Point {
  const points = keys.map((k) => centre(k.to));
  let x = points[0].x;
  let y = points[0].y;
  for (let i = 1; i < keys.length; i++) {
    const key = keys[i];
    const start = moveStart(keys, i);
    if (frame <= start) continue;
    const end = arrival(key);
    const t = (key.easing ?? ease.inOut)(Math.min(1, (frame - start) / (end - start || 1)));
    const a = points[i - 1];
    const b = points[i];
    // A quadratic bezier is the straight line plus a bump off it, 2t(1 - t) times the control point's offset.
    const bow = (key.arc ?? 0.12) * 2 * t * (1 - t);
    x += (b.x - a.x) * t - (b.y - a.y) * bow;
    y += (b.y - a.y) * t + (b.x - a.x) * bow;
  }
  return { x, y };
}

/**
 * Frames the button is held, as [press, release] pairs: each `drag` move, with
 * touching ones merged. A drag with `hover` keeps the button down through the
 * rest and releases at `at`.
 */
export function dragWindows(keys: CursorKey[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < keys.length; i++) {
    if (!keys[i].drag) continue;
    const press = moveStart(keys, i);
    const last = out[out.length - 1];
    if (last && press <= last[1]) last[1] = Math.max(last[1], keys[i].at);
    else out.push([press, keys[i].at]);
  }
  return out;
}

/**
 * The frames the cursor clicks: every `click` key's `at`, and with `drags`
 * (default true) each drag's press and release, sorted, each frame once. The one list of
 * frames that the picture (the press, the ring) and the sound share.
 */
export function cursorClicks(keys: CursorKey[], { drags = true }: { drags?: boolean } = {}): number[] {
  const frames = keys.filter((k) => k.click).map((k) => k.at);
  if (drags) for (const [press, release] of dragWindows(keys)) frames.push(press, release);
  // A click that also starts a drag is one press, and one sound.
  return frames.sort((a, b) => a - b).filter((f, i, all) => i === 0 || f !== all[i - 1]);
}

/**
 * A sound on every click of `keys`, ready for a shot's `sfx`:
 *
 *   sfx: cursorSounds(cursor, { src: "audio/sfx/click.wav", peak: -14 })
 *
 * Pass a function to vary them (`(i) => ({ src, hit: i })`, or a softer
 * release). Keys counted from the shot's start give sounds counted from it
 * too; `offset` shifts them when the keys live in a `Sequence` further in.
 */
export function cursorSounds(
  keys: CursorKey[],
  sound: Omit<Sound, "at"> | ((index: number, at: number) => Omit<Sound, "at">),
  { drags = true, offset = 0 }: { drags?: boolean; offset?: number } = {},
): Sound[] {
  return cursorClicks(keys, { drags }).map((at, i) => ({
    ...(typeof sound === "function" ? sound(i, at) : sound),
    at: at + offset,
  }));
}

/**
 * A value the cursor drags directly: while the button is down it is
 * `value(pointer)`, computed from the cursor's position; on release it springs
 * from where it was let go, at the speed it was moving, to `rest(released)`.
 * For sliders, scrubbers and knobs; pass the value through `rubberband()`
 * for a limit that gives.
 */
export function dragValue(
  frame: number,
  fps: number,
  {
    keys,
    value,
    initial,
    rest = (v) => v,
    spring = springs.snappy,
  }: {
    keys: CursorKey[];
    value: (pointer: Point) => number;
    /** The value before the first drag. */
    initial: number;
    /** Where it settles after a release, from where it was let go. */
    rest?: (released: number) => number;
    spring?: SpringConfig;
  },
): number {
  const held = dragWindows(keys).filter(([press]) => frame >= press);
  if (held.length === 0) return initial;
  const [, release] = held[held.length - 1];
  const at = (f: number) => value(cursorAt(keys, f));
  if (frame <= release) return at(frame);
  const here = at(release);
  const speed = (here - at(release - 0.5)) / 0.5;
  return springTo(
    frame,
    fps,
    [
      { at: release, to: here, velocity: speed },
      { at: release, to: rest(here) },
    ],
    spring,
  );
}

/**
 * A synthetic pointer, drawn in the same coordinates as the content it sits
 * in: inside a <Camera> its keys are content pixels and it moves with the UI,
 * but it stays `screenSize` pixels on screen at any zoom. Captures hide the
 * real cursor; this one never jitters.
 */
export function Cursor({
  keys,
  screenSize = 52,
  size,
  appear = 0,
  vanish,
  hidden,
}: {
  keys: CursorKey[];
  /** Size on screen, in video pixels, whatever the camera's zoom (default 52: a desktop-sized cursor vanishes at 1080p). */
  screenSize?: number;
  /** Size in content pixels instead, scaling with the camera. */
  size?: number;
  /** Frame to fade in. */
  appear?: number;
  /** Frame to fade out. */
  vanish?: number;
  /**
   * `true` draws nothing (the keys still drive `dragValue` and `cursorSounds`:
   * a phone demo whose taps make sounds but show no pointer). Or the stretches
   * it is away, as [from, to] pairs: it fades out over 6 frames from `from` and
   * back in over 8 from `to` (while it types, while the camera is elsewhere).
   */
  hidden?: boolean | [number, number][];
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const view = useCameraView();
  size ??= screenSize / (view?.zoom ?? 1);
  const at = cursorAt(keys, frame);
  if (hidden === true) return null;
  const away = (hidden || []).reduce(
    (a, [from, to]) =>
      Math.max(a, Math.min(progress(frame, from, 6, ease.soft), 1 - progress(frame, to, 8, ease.soft))),
    0,
  );
  const opacity =
    progress(frame, appear, 8, ease.soft) *
    (vanish === undefined ? 1 : 1 - progress(frame, vanish, 10, ease.soft)) *
    (1 - away);
  if (opacity <= 0) return null;
  // Most recent click, for the press and the ring.
  // The press starts 4 frames ahead (6 after a hover, which has the time to show it) and lands on `at`.
  const lead = (k: CursorKey) => (k.hover ? Math.min(6, Math.max(4, k.hover)) : 4);
  const click = [...keys].reverse().find((k) => k.click && frame >= k.at - lead(k));
  const since = click ? frame - click.at : Number.POSITIVE_INFINITY;
  const tap = interpolate(since, [-(click ? lead(click) : 4), 0, 6], [1, 0.86, 1], { easing: ease.soft });
  const down = dragWindows(keys).reduce(
    (h, [press, release]) =>
      Math.max(h, Math.min(progress(frame, press - 4, 4, ease.soft), 1 - progress(frame, release, 6, ease.soft))),
    0,
  );
  const press = Math.min(tap, 1 - 0.14 * down);
  const ring = progress(since, 0, fps * 0.45, ease.out);
  return (
    <div style={{ position: "absolute", left: at.x, top: at.y, opacity, pointerEvents: "none", zIndex: 1000 }}>
      {since >= 0 && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: -size,
            top: -size,
            width: size * 2,
            height: size * 2,
            borderRadius: "50%",
            border: `${size * 0.06}px solid rgb(255 255 255 / ${0.7 * (1 - ring)})`,
            transform: `scale(${0.3 + ring * 0.9})`,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{
          position: "absolute",
          left: -size * 0.2,
          top: -size * 0.1,
          transform: `scale(${press})`,
          transformOrigin: "20% 10%",
        }}
        aria-hidden
      >
        <path
          d="M6.5 3.2v22.6l5.6-5.3 3.6 8.4 4-1.7-3.5-8.2h7.9z"
          fill="#fafafa"
          stroke="#18181c"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
