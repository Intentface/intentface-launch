import { type CSSProperties, type ReactNode, type SVGProps, useId } from "react";
import { type Easing, ease, lerp, useFrame, useVideoInfo } from "../engine/index.js";
import { circleMask, clockMask, wipeMask } from "../engine/transitions.js";

/*
 * SVG tools for scenes: strokes that draw on, shapes that morph, filters
 * (goo, displacement, glow, blur-in) and animated reveals. Everything is a
 * function of the frame: timed components take `start` and `duration` in
 * frames from the enclosing shot or Sequence and an `easing`, or a `progress`
 * you drive yourself.
 */

/** When an effect runs: from `start` for `duration` frames, eased; or `progress` (0 → 1) given directly. */
export type Timing = {
  /** Frame it starts, in the enclosing shot or Sequence (default 0). */
  start?: number;
  /** Frames it takes (default 30). */
  duration?: number;
  easing?: Easing;
  /** Drive it yourself instead, 0 → 1 (used as is, not eased). */
  progress?: number;
};

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The eased progress of a `Timing` at the current frame. */
export function useTiming({ start = 0, duration = 30, easing = ease.out, progress }: Timing): number {
  const frame = useFrame();
  if (progress !== undefined) return progress;
  return easing(clamp01((frame - start) / Math.max(1e-6, duration)));
}

// --- Draw-on --------------------------------------------------------------------------

/**
 * Dash props that show the stretch of a stroke from `from` to `to`, as
 * fractions of its length (`pathLength` 1, so it needs no measuring). Spread
 * on any SVG shape: `<circle {...dash(0, p)} … />`.
 */
export function dash(from: number, to: number): SVGProps<SVGPathElement> {
  const a = clamp01(Math.min(from, to));
  const b = clamp01(Math.max(from, to));
  // An empty dash with round caps still draws a dot: hide the stroke instead.
  if (b - a < 1e-4) return { pathLength: 1, strokeDasharray: "0 2", strokeOpacity: 0 };
  return { pathLength: 1, strokeDasharray: `${b - a} 2`, strokeDashoffset: -a };
}

export type DrawOnProps = Timing &
  Omit<SVGProps<SVGPathElement>, "start" | "end" | "progress"> & {
    d: string;
    /** Trim: the stretch of the path that is drawn by the end, as fractions (default 0 → 1). */
    from?: number;
    to?: number;
    /** Only the last `trail` of the drawn stroke shows (a fraction of the path): a comet running along it. */
    trail?: number;
  };

/**
 * A path whose stroke draws on, from `from` to `to` along it, with the
 * timing's easing. Give it a `stroke` and `fill="none"`; place it in an `<svg>`.
 */
export function DrawOn({ d, start, duration, easing, progress, from = 0, to = 1, trail, ...rest }: DrawOnProps) {
  const e = useTiming({ start, duration, easing, progress });
  const head = lerp(from, to, e);
  const tail = trail === undefined ? from : Math.max(from, head - trail);
  return <path d={d} fill="none" {...rest} {...dash(tail, head)} />;
}

// --- Morph ----------------------------------------------------------------------------

type Pt = [number, number];
const SVG = "http://www.w3.org/2000/svg";
const sampled = new Map<string, Pt[]>();
const aligned = new Map<string, Pt[]>();

/** `n` points evenly along a path's length, from a path element that is never attached. Cached per path. */
function sample(d: string, n: number): Pt[] {
  const key = `${n}:${d}`;
  const hit = sampled.get(key);
  if (hit) return hit;
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", d);
  const length = path.getTotalLength();
  const points: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = path.getPointAtLength((length * i) / n);
    points.push([p.x, p.y]);
  }
  sampled.set(key, points);
  return points;
}

const area = (pts: Pt[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/**
 * `b`'s points re-ordered to travel the same way round as `a`'s, starting at
 * the point that keeps the total travel smallest, so the morph does not twist.
 */
function align(a: Pt[], b: Pt[]): Pt[] {
  const n = a.length;
  const wound = Math.sign(area(a)) === Math.sign(area(b)) ? b : [...b].reverse();
  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let k = 0; k < n; k++) {
    let cost = 0;
    for (let i = 0; i < n && cost < bestCost; i++) {
      const [bx, by] = wound[(i + k) % n];
      cost += (a[i][0] - bx) ** 2 + (a[i][1] - by) ** 2;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  return wound.map((_, i) => wound[(i + best) % n]);
}

/**
 * The shape between two closed paths at `t` (0 is `a`, 1 is `b`, exactly as
 * written): both are resampled to `points` points along their length, `b` is
 * turned to start where it best matches `a` and wound the same way, and the
 * points interpolate. For single closed shapes (an icon's outline, a blob, a
 * button); a shape with holes morphs as one outline. Sampling and matching
 * are cached per pair, so a frame costs one pass over the points.
 */
export function morphPath(a: string, b: string, t: number, points = 200): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const from = sample(a, points);
  const key = `${points}:${a}|${b}`;
  let to = aligned.get(key);
  if (!to) {
    to = align(from, sample(b, points));
    aligned.set(key, to);
  }
  let d = "";
  for (let i = 0; i < points; i++) {
    const x = from[i][0] + (to[i][0] - from[i][0]) * t;
    const y = from[i][1] + (to[i][1] - from[i][1]) * t;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

export type MorphProps = Omit<SVGProps<SVGPathElement>, "d"> & {
  /** The shapes in order, as closed path data. */
  paths: string[];
  /** The frame each shape is reached at (one per path); the morph between two runs from one to the next. */
  at?: number[];
  easing?: Easing;
  /** Drive it yourself: a position along `paths`, 0 → paths.length − 1 (1.5 is halfway from the second to the third). */
  progress?: number;
  /** Resolution of the morph (default 200 points). */
  points?: number;
};

/** A path that morphs through `paths`, reaching each at its `at` frame. Place it in an `<svg>`. */
export function Morph({ paths, at, easing = ease.inOut, progress, points, ...rest }: MorphProps) {
  const frame = useFrame();
  let position = progress;
  if (position === undefined) {
    const keys = at ?? paths.map((_, i) => i * 30);
    let i = 0;
    while (i < keys.length - 2 && frame >= keys[i + 1]) i++;
    const span = keys[i + 1] - keys[i];
    position = i + easing(clamp01(span > 0 ? (frame - keys[i]) / span : 1));
  }
  const i = Math.max(0, Math.min(paths.length - 2, Math.floor(position)));
  const d = paths.length < 2 ? paths[0] : morphPath(paths[i], paths[i + 1], position - i, points);
  return <path d={d} {...rest} />;
}

// --- Filters --------------------------------------------------------------------------

/** A filter id unique on the page, safe inside `url(#…)`. */
function useFilterId(kind: string) {
  return `launch-${kind}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

const layerStyle: CSSProperties = { position: "absolute", inset: 0 };

/** Children in a layer (absolute, filling its parent) with `filter` applied, and the filter's defs beside it. */
function Filtered({
  id,
  filter,
  active = true,
  style,
  children,
}: {
  id: string;
  filter: ReactNode;
  active?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
        <defs>{filter}</defs>
      </svg>
      <div style={{ ...layerStyle, ...style, filter: active ? `url(#${id})` : style?.filter }}>{children}</div>
    </>
  );
}

type LayerProps = { children?: ReactNode; style?: CSSProperties };

export type GooProps = {
  /** How far shapes reach for each other, in pixels (default 14). */
  amount?: number;
  /** Edge hardness: higher is crisper (default 24). */
  contrast?: number;
};

/** `<filter>` defs for a gooey merge, for your own `<defs>`. */
export function GooFilter({ id, amount = 14, contrast = 24 }: GooProps & { id: string }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={amount} result="blur" />
      <feColorMatrix
        in="blur"
        type="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${-contrast / 2}`}
        result="goo"
      />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>
  );
}

/**
 * Gooey merge: shapes inside bridge into each other like liquid as they
 * approach (dots joining into a pill, a badge budding off a button). The
 * shapes keep their colour; the bridges take the blend of their neighbours.
 */
export function Goo({ children, style, ...props }: GooProps & LayerProps) {
  const id = useFilterId("goo");
  return (
    <Filtered id={id} filter={<GooFilter id={id} {...props} />} style={style}>
      {children}
    </Filtered>
  );
}

export type DisplaceProps = {
  /** Displacement in pixels (default 24). Animate it from the frame. */
  amount?: number;
  /** Size of the noise: lower is broader (default 0.012). */
  frequency?: number;
  octaves?: number;
  seed?: number;
  /** `fractalNoise` (soft, default) or `turbulence` (sharper, like heat). */
  type?: "fractalNoise" | "turbulence";
  /** A new noise every `boil` frames: the hand-drawn wobble of a line boiling. */
  boil?: number;
};

/** `<filter>` defs for a seeded turbulence displacement. */
export function DisplaceFilter({
  id,
  amount = 24,
  frequency = 0.012,
  octaves = 2,
  seed = 1,
  type = "fractalNoise",
}: Omit<DisplaceProps, "boil"> & { id: string }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type={type} baseFrequency={frequency} numOctaves={octaves} seed={seed} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={amount} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

/** Warps what is inside through seeded noise: heat, water, a line that boils. Deterministic per seed. */
export function Displace({ children, style, boil, seed = 1, ...props }: DisplaceProps & LayerProps) {
  const frame = useFrame();
  const id = useFilterId("displace");
  const s = boil ? seed + Math.floor(frame / boil) : seed;
  return (
    <Filtered
      id={id}
      active={(props.amount ?? 24) !== 0}
      filter={<DisplaceFilter id={id} seed={s} {...props} />}
      style={style}
    >
      {children}
    </Filtered>
  );
}

export type GlowProps = {
  /** Spread of the glow, in pixels (default 18). */
  radius?: number;
  /** Its colour (default: the content's own colours). */
  color?: string;
  /** How strong, 0 → about 3 (default 1). */
  strength?: number;
};

/** `<filter>` defs for a glow under the source. */
export function GlowFilter({ id, radius = 18, color, strength = 1 }: GlowProps & { id: string }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={radius} result="blur" />
      {color && <feFlood floodColor={color} result="tint" />}
      {color && <feComposite in="tint" in2="blur" operator="in" result="blur" />}
      <feComponentTransfer in="blur" result="glow">
        <feFuncA type="linear" slope={strength} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/** A soft glow around what is inside (a light, a selected item, a lit stroke). */
export function Glow({ children, style, ...props }: GlowProps & LayerProps) {
  const id = useFilterId("glow");
  return (
    <Filtered id={id} active={(props.strength ?? 1) > 0} filter={<GlowFilter id={id} {...props} />} style={style}>
      {children}
    </Filtered>
  );
}

export type BlurInProps = Timing &
  LayerProps & {
    /** Blur at the start, in pixels (default 20). */
    amount?: number;
    /** Blur along one axis only: `x` for something arriving sideways, `y` for a drop. */
    axis?: "both" | "x" | "y";
    /** Fade in as it sharpens (default true). */
    fade?: boolean;
    /** Rise into place from this many pixels below (default 0). */
    rise?: number;
  };

/**
 * Arrives out of focus and sharpens: blur (optionally along one axis) running
 * to zero with the timing, fading in. Once sharp the filter is dropped, so
 * text is as crisp as without it.
 */
export function BlurIn({
  children,
  style,
  amount = 20,
  axis = "both",
  fade = true,
  rise = 0,
  start,
  duration = 24,
  easing,
  progress,
}: BlurInProps) {
  const id = useFilterId("blurin");
  const e = useTiming({ start, duration, easing, progress });
  const s = amount * (1 - e);
  const deviation = axis === "x" ? `${s} 0` : axis === "y" ? `0 ${s}` : `${s}`;
  return (
    <Filtered
      id={id}
      active={s > 0.25}
      filter={
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={deviation} />
        </filter>
      }
      style={{
        ...style,
        opacity: fade ? e * ((style?.opacity as number | undefined) ?? 1) : style?.opacity,
        transform: rise ? `translateY(${rise * (1 - e)}px)` : style?.transform,
      }}
    >
      {children}
    </Filtered>
  );
}

// --- Reveals --------------------------------------------------------------------------

type Box = { x: number; y: number; width: number; height: number };

export type MaskRevealProps = Timing &
  LayerProps & {
    /**
     * How it opens: `wipe` (a straight feathered edge), `circle` (from
     * `origin`), `clock` (a hand sweeping round `origin`), `rect` (from `rect`
     * to `to`), or path data for any shape growing from `origin`.
     */
    shape?: "wipe" | "circle" | "clock" | "rect" | { d: string; box?: Box };
    /** Where a circle, clock or shape opens from, in the layer's pixels (default its centre). */
    origin?: { x: number; y: number };
    /** `wipe`: direction of travel in degrees (0 to the right, 90 down). `clock`: start angle from 12 o'clock. */
    angle?: number;
    /** Soft edge: pixels for `wipe` and `circle` (default 80 and 2), degrees for `clock` (default 4). */
    feather?: number;
    /** `rect`: where it opens from (default a point at `origin`) and to (default the whole layer). */
    rect?: Box;
    to?: Box;
    /** `rect`: corner radius (default 0). */
    radius?: number;
    /** The layer's size in pixels, for `rect` and shapes (default the video's). */
    width?: number;
    height?: number;
    /** Hide instead of reveal: runs the same motion backwards. */
    reverse?: boolean;
  };

/**
 * A layer revealed by an animated mask or clip: a wipe, a circle or a clock
 * hand from a point, a rect opening from an element, or any SVG shape growing
 * from a point. No filters, so it is safe over 3D.
 */
export function MaskReveal({
  children,
  style,
  shape = "wipe",
  origin,
  angle = 0,
  feather,
  rect,
  to,
  radius = 0,
  width,
  height,
  reverse = false,
  start,
  duration,
  easing = ease.inOut,
  progress,
}: MaskRevealProps) {
  const video = useVideoInfo();
  const id = useFilterId("reveal");
  const W = width ?? video.width;
  const H = height ?? video.height;
  const o = origin ?? { x: W / 2, y: H / 2 };
  const raw = useTiming({ start, duration, easing, progress });
  const e = reverse ? 1 - raw : raw;
  let mask: CSSProperties = {};
  let defs: ReactNode = null;
  if (shape === "wipe") mask = wipeMask(e, angle, feather ?? 80);
  else if (shape === "circle") mask = circleMask(e, o, feather ?? 2);
  else if (shape === "clock") mask = clockMask(e, o, { start: angle, feather: feather ?? 4 });
  else if (shape === "rect") {
    const a = rect ?? { x: o.x, y: o.y, width: 0, height: 0 };
    const b = to ?? { x: 0, y: 0, width: W, height: H };
    const x = lerp(a.x, b.x, e);
    const y = lerp(a.y, b.y, e);
    const w = lerp(a.width, b.width, e);
    const h = lerp(a.height, b.height, e);
    mask =
      e <= 0 ? { opacity: 0 } : { clipPath: `inset(${y}px ${W - x - w}px ${H - y - h}px ${x}px round ${radius}px)` };
  } else if (e < 1) {
    const box = shape.box ?? { x: 0, y: 0, width: 24, height: 24 };
    const reach = Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y));
    // From 8 pixels across to covering the layer, evenly in log space, so the shape reads while small.
    const first = 8 / Math.min(box.width, box.height);
    const end = (2.4 * reach) / Math.min(box.width, box.height);
    const s = first * (end / first) ** e;
    const transform = `translate(${o.x} ${o.y}) scale(${s}) translate(${-(box.x + box.width / 2)} ${-(box.y + box.height / 2)})`;
    mask = e <= 0 ? { opacity: 0 } : { clipPath: `url(#${id})` };
    defs = (
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <path d={shape.d} transform={transform} />
          </clipPath>
        </defs>
      </svg>
    );
  }
  return (
    <>
      {defs}
      <div style={{ ...layerStyle, ...style, ...mask }}>{children}</div>
    </>
  );
}
