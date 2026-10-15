import { useId } from "react";
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
  look = "solid",
}: {
  keys: CursorKey[];
  /**
   * \`solid\` (default): a white arrow with a dark edge, as on a desktop.
   * \`frosted\`: an arrow of frosted glass that blurs and brightens what is
   * under it, with a hairline edge and a soft shadow, for light, glossy UI
   * (and over shaders: it blurs the canvas under it too).
   * \`glass\`: an arrow of clear liquid glass that refracts what is under it
   * (DOM, video, shader canvases): bent in at its rim, a little magnified
   * inside, the colours fringing where it bends, a specular rim and a soft
   * shadow. For material and shader shots, where a cursor should be made of
   * the same stuff as the film.
   */
  look?: "solid" | "frosted" | "glass";
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
      {look === "frosted" ? (
        <Frosted size={size} press={press} />
      ) : look === "glass" ? (
        <LiquidGlass size={size} press={press} />
      ) : (
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
          <path d={ARROW} fill="#fafafa" stroke="#18181c" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

/** The arrow, its tip at (6.5, 3.2) in a 32 × 32 box. */
const ARROW = "M6.5 3.2v22.6l5.6-5.3 3.6 8.4 4-1.7-3.5-8.2h7.9z";
const ARROW_POINTS: [number, number][] = [
  [6.5, 3.2],
  [6.5, 25.8],
  [12.1, 20.5],
  [15.7, 28.9],
  [19.7, 27.2],
  [16.2, 19],
  [24.1, 19],
];

/**
 * The frosted arrow: glass clipped to the arrow's shape, blurring and
 * brightening what is under it, a sheen across it, a hairline edge, and a soft
 * shadow that tucks in as it presses.
 */
function Frosted({ size, press }: { size: number; press: number }) {
  const k = size / 32;
  const clip = `path("M${ARROW_POINTS.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join(" L")} Z")`;
  const lift = (press - 0.86) / 0.14;
  const box = {
    position: "absolute" as const,
    left: -size * 0.2,
    top: -size * 0.1,
    width: size,
    height: size,
    transform: `scale(${press})`,
    transformOrigin: "20% 10%",
  };
  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{
          ...box,
          transform: `translate(${size * (0.04 + 0.05 * lift)}px, ${size * (0.07 + 0.08 * lift)}px) scale(${press})`,
          filter: `blur(${size * 0.07}px)`,
          opacity: 0.55,
        }}
        aria-hidden
      >
        <path d={ARROW} fill="rgb(16 18 28 / 0.55)" />
      </svg>
      <div
        style={{
          ...box,
          clipPath: clip,
          backdropFilter: `blur(${(size * 0.16).toFixed(1)}px) saturate(1.5) brightness(1.1)`,
          background:
            "linear-gradient(155deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.32) 55%, rgb(235 240 255 / 0.5))",
        }}
      />
      <svg width={size} height={size} viewBox="0 0 32 32" style={box} aria-hidden>
        <path d={ARROW} fill="none" stroke="rgb(22 24 34 / 0.42)" strokeWidth="0.9" strokeLinejoin="round" />
        <path
          d={ARROW}
          fill="none"
          stroke="rgb(255 255 255 / 0.9)"
          strokeWidth="0.7"
          strokeLinejoin="round"
          transform="translate(0.35 0.45) scale(0.985)"
        />
      </svg>
    </>
  );
}

/** The distance from p to the segment ab, and the segment's closest point. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { d: Math.hypot(px - cx, py - cy), cx, cy };
}

/** Whether p is inside the polygon (even-odd). */
function inside(px: number, py: number, poly: [number, number][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The arrow's centre of area, in its 32 × 32 box: what the glass magnifies about. */
const ARROW_CENTRE = (() => {
  let a = 0;
  let cx = 0;
  let cy = 0;
  ARROW_POINTS.forEach(([x0, y0], i) => {
    const [x1, y1] = ARROW_POINTS[(i + 1) % ARROW_POINTS.length];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  });
  return [cx / (3 * a), cy / (3 * a)] as const;
})();

/** Texels of the displacement map: one map serves every size (it is stretched to the box). */
const MAP = 128;
/** Px of the 32-unit box the rim's bend reaches in from the edge. */
const RIM = 5.2;
/** How much the middle magnifies (0.14: things under it look 1.16× as big). */
const ZOOM = 0.14;
let glassMap: string | null = null;

/**
 * The glass's displacement map: for each point of the arrow, where it sees
 * through to, as offsets in red (x) and green (y) around mid grey, in units
 * of the largest offset. At the rim it looks out past the edge along the
 * edge's normal, on a lens's curve (steep at the edge, flat inside); inside,
 * it looks a little toward the middle, magnifying. Outside the arrow it is
 * neutral. Drawn once, in the 32-unit box.
 */
function displacementMap() {
  if (glassMap) return glassMap;
  const canvas = document.createElement("canvas");
  canvas.width = MAP;
  canvas.height = MAP;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(MAP, MAP);
  const reach = RIM + ZOOM * 16;
  for (let j = 0; j < MAP; j++) {
    for (let i = 0; i < MAP; i++) {
      const x = ((i + 0.5) / MAP) * 32;
      const y = ((j + 0.5) / MAP) * 32;
      let ox = 0;
      let oy = 0;
      if (inside(x, y, ARROW_POINTS)) {
        let best = { d: Number.POSITIVE_INFINITY, cx: x, cy: y };
        ARROW_POINTS.forEach(([ax, ay], k) => {
          const [bx, by] = ARROW_POINTS[(k + 1) % ARROW_POINTS.length];
          const s = toSegment(x, y, ax, ay, bx, by);
          if (s.d < best.d) best = s;
        });
        const t = Math.max(0, 1 - best.d / RIM);
        // A lens's profile: the bend grows steeply toward the edge.
        const bend = RIM * (1 - Math.sqrt(1 - t * t));
        const nx = best.d > 1e-6 ? (best.cx - x) / best.d : 0;
        const ny = best.d > 1e-6 ? (best.cy - y) / best.d : 0;
        ox = nx * bend + (ARROW_CENTRE[0] - x) * ZOOM;
        oy = ny * bend + (ARROW_CENTRE[1] - y) * ZOOM;
      }
      const o = (j * MAP + i) * 4;
      img.data[o] = Math.round(128 + 127 * Math.max(-1, Math.min(1, ox / reach)));
      img.data[o + 1] = Math.round(128 + 127 * Math.max(-1, Math.min(1, oy / reach)));
      img.data[o + 2] = 128;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  glassMap = canvas.toDataURL("image/png");
  return glassMap;
}

/**
 * The liquid-glass arrow: a backdrop filter that displaces what is under the
 * arrow by its map (red, green and blue each a little further, so the bend
 * fringes in colour), clipped to the arrow; a specular rim lit from the top
 * left with a faint dark edge opposite, so it reads on light grounds and
 * dark; and a soft shadow that tucks in as it presses.
 */
function LiquidGlass({ size, press }: { size: number; press: number }) {
  const id = `glass-${useId().replace(/:/g, "")}`;
  const k = size / 32;
  const clip = `path("M${ARROW_POINTS.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join(" L")} Z")`;
  const lift = (press - 0.86) / 0.14;
  // feDisplacementMap moves by scale × (value − 0.5): the map's unit is `reach` in the 32-unit box.
  const scale = 2 * (RIM + ZOOM * 16) * k;
  const box = {
    position: "absolute" as const,
    left: -size * 0.2,
    top: -size * 0.1,
    width: size,
    height: size,
    transform: `scale(${press})`,
    transformOrigin: "20% 10%",
  };
  const channel = (c: 0 | 1 | 2, s: number, name: string) => [
    <feDisplacementMap
      key={`${name}-d`}
      in="SourceGraphic"
      in2="map"
      scale={s}
      xChannelSelector="R"
      yChannelSelector="G"
      result={`${name}-moved`}
    />,
    <feColorMatrix
      key={`${name}-c`}
      in={`${name}-moved`}
      type="matrix"
      // Keeps only channel c (and alpha): the three moved copies are put back together with screen.
      values={[0, 1, 2]
        .map((row) => [0, 1, 2, 3, 4].map((col) => (row === c && col === c ? 1 : 0)).join(" "))
        .concat("0 0 0 1 0")
        .join("  ")}
      result={name}
    />,
  ];
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage
            href={displacementMap()}
            x="0"
            y="0"
            width={size}
            height={size}
            preserveAspectRatio="none"
            result="map"
          />
          {channel(0, scale, "r")}
          {channel(1, scale * 1.07, "g")}
          {channel(2, scale * 1.14, "b")}
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" />
        </filter>
      </svg>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{
          ...box,
          transform: `translate(${size * (0.03 + 0.04 * lift)}px, ${size * (0.06 + 0.07 * lift)}px) scale(${press})`,
          filter: `blur(${size * 0.08}px)`,
          opacity: 0.32,
        }}
        aria-hidden
      >
        <path d={ARROW} fill="rgb(10 12 20 / 0.6)" />
      </svg>
      <div
        style={{
          ...box,
          clipPath: clip,
          backdropFilter: `url(#${id}) brightness(1.05) saturate(1.15)`,
          // The glass's body: a breath of light, brightest toward the light.
          background:
            "linear-gradient(160deg, rgb(255 255 255 / 0.2), rgb(255 255 255 / 0.03) 42%, rgb(255 255 255 / 0.02) 70%, rgb(255 255 255 / 0.12))",
        }}
      />
      <svg width={size} height={size} viewBox="0 0 32 32" style={box} aria-hidden>
        <defs>
          <linearGradient id={`${id}-rim`} x1="6" y1="3" x2="22" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.65" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="6" y1="3" x2="22" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0c0e16" stopOpacity="0.05" />
            <stop offset="1" stopColor="#0c0e16" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path d={ARROW} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="0.7" strokeLinejoin="round" />
        <path
          d={ARROW}
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth="0.95"
          strokeLinejoin="round"
          transform="translate(0.3 0.4) scale(0.982)"
        />
        {/* A glint down the long edge, where the light catches the rim. */}
        <path d="M7.6 6.2v9.4" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.55" strokeLinecap="round" />
      </svg>
    </>
  );
}
