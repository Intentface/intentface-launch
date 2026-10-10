import { type CSSProperties, createElement as h, type ReactNode } from "react";
import { type Easing, ease, lerp, type SpringConfig, settleFrames, springs, springTo } from "./motion.js";
import type { Transition, TransitionFrame } from "./video.js";

/*
 * Every transition is `style(p, frame) → { out, in }`: CSS on the outgoing and
 * the incoming shot's wrapper at progress p (0 → 1), and optionally an
 * `overlay(p)` drawn above both (a band of light, the SVG filters the styles
 * point at). Factories take their length in frames first, then options with
 * the easing.
 *
 * Which ones put a filter on the shots (`filters: true`): blur, zoom, whip,
 * displace, luma, chromatic. Over a `Stage3D` shot those stall the renderer
 * under several workers. The mask and transform ones (fade, push, wipe, iris,
 * shape, clock, sweep, zoomInto, honest, matchCut) put no filter on the shots;
 * masks and clip paths over a `Stage3D` are not yet proven under several
 * workers either, so check a render before relying on them there.
 */

/** Plain cross-dissolve. */
export const fade = (frames = 18): Transition => ({
  name: "Dissolve",
  frames,
  style: (p) => ({ out: {}, in: { opacity: ease.soft(p) } }),
});

/** Dissolve with the outgoing shot blurring away. The house transition. */
export const blur = (frames = 24, amount = 24): Transition => ({
  name: "Blur dissolve",
  frames,
  filters: true,
  style: (p) => {
    const t = ease.inOut(p);
    return {
      out: { filter: `blur(${t * amount}px)`, opacity: 1 - t * 0.4 },
      in: { opacity: t, filter: `blur(${(1 - t) * amount * 0.5}px)` },
    };
  },
});

/** Outgoing shot falls back while the next rises in front: depth without 3D. */
export const zoom = (frames = 30): Transition => ({
  name: "Zoom through",
  frames,
  filters: true,
  style: (p) => {
    const t = ease.inOut(p);
    return {
      out: { transform: `scale(${lerp(1, 1.08, t)})`, opacity: 1 - t, filter: `blur(${t * 12}px)` },
      in: { transform: `scale(${lerp(0.94, 1, ease.expo(p))})`, opacity: ease.soft(p) },
    };
  },
});

/** Both shots travel together, like a camera pan. */
export const push = (frames = 36, direction: "left" | "right" | "up" | "down" = "left"): Transition => {
  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  return {
    name: `Push ${direction}`,
    frames,
    style: (p) => {
      const t = ease.inOut(p) * 100;
      return {
        out: { transform: `translate${axis}(${sign * t}%)` },
        in: { transform: `translate${axis}(${sign * (t - 100)}%)` },
      };
    },
  };
};

// --- Shared pieces ---------------------------------------------------------------

/** A point on the frame, in output pixels. */
export type Point = { x: number; y: number };
/** A rect on the frame, in output pixels (the same shape as the kit's `Rect`). */
export type Box = { x: number; y: number; width: number; height: number };
export type Direction = "left" | "right" | "up" | "down";

// Filter and clip ids must be unique on the page. Videos are built once per
// page, in the same order in every worker, so a counter is stable enough.
let instances = 0;
const uid = (kind: string) => `launch-${kind}-${++instances}`;

const px = (v: number | string) => (typeof v === "number" ? `${v}px` : v);
const masked = (image: string): CSSProperties => ({ maskImage: image, WebkitMaskImage: image });
/** Distance from a point to the frame's farthest corner: the radius that covers the frame. */
const coverRadius = (at: Point, { width, height }: TransitionFrame) =>
  Math.hypot(Math.max(at.x, width - at.x), Math.max(at.y, height - at.y));
const centre = ({ width, height }: TransitionFrame): Point => ({ x: width / 2, y: height / 2 });
/** An SVG that takes no room: a home for `<filter>` and `<clipPath>` defs. */
const defs = (...children: ReactNode[]) =>
  h("svg", { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": true }, h("defs", null, ...children));

/**
 * A straight wipe as a CSS mask, at progress `e` (0 hidden, 1 shown):
 * `angle` is the direction the edge travels (0 to the right, 90 down),
 * `feather` the soft edge in pixels. Sized by the element it masks, so it
 * works on any layer.
 */
export function wipeMask(e: number, angle = 0, feather = 120): CSSProperties {
  if (e <= 0) return { opacity: 0 };
  if (e >= 1) return {};
  // The edge runs from fully off one side (its feather included) to fully off the other.
  const tail = `calc(${e * 100}% + ${(e - 1) * feather}px)`;
  const lead = `calc(${e * 100}% + ${e * feather}px)`;
  return masked(`linear-gradient(${angle + 90}deg, #000 ${tail}, transparent ${lead})`);
}

/**
 * A circle growing from `at` as a CSS mask, at progress `e`: 0 a point, 1 the
 * farthest corner covered. `at` in pixels or any CSS length ("50%").
 */
export function circleMask(
  e: number,
  at: { x: number | string; y: number | string } = { x: "50%", y: "50%" },
  feather = 2,
): CSSProperties {
  if (e <= 0) return { opacity: 0 };
  if (e >= 1) return {};
  const tail = `calc(${e * 100}% + ${(e - 1) * feather}px)`;
  const lead = `calc(${e * 100}% + ${e * feather}px)`;
  return masked(
    `radial-gradient(circle farthest-corner at ${px(at.x)} ${px(at.y)}, #000 ${tail}, transparent ${lead})`,
  );
}

/**
 * A clock-hand sweep around `at` as a conic CSS mask, at progress `e`.
 * `start` is where the hand starts, in degrees clockwise from 12 o'clock;
 * `feather` softens the hand's edge, in degrees.
 */
export function clockMask(
  e: number,
  at: { x: number | string; y: number | string } = { x: "50%", y: "50%" },
  { start = 0, feather = 4, clockwise = true }: { start?: number; feather?: number; clockwise?: boolean } = {},
): CSSProperties {
  if (e <= 0) return { opacity: 0 };
  if (e >= 1) return {};
  const a = e * (360 + feather);
  const where = `from ${start}deg at ${px(at.x)} ${px(at.y)}`;
  return masked(
    clockwise
      ? `conic-gradient(${where}, #000 ${a - feather}deg, transparent ${a}deg)`
      : `conic-gradient(${where}, transparent ${360 - a}deg, #000 ${360 - a + feather}deg)`,
  );
}

/** Speed of an easing at p, in progress per unit p: how fast the move is going there. */
const slope = (easing: Easing, p: number) => {
  const d = 0.01;
  const a = Math.max(0, p - d);
  const b = Math.min(1, p + d);
  return (easing(b) - easing(a)) / (b - a);
};

// --- Masks and reveals -------------------------------------------------------------

export type WipeOptions = {
  /** Direction the edge travels, in degrees: 0 to the right, 90 down, 180 to the left. Default 0. */
  angle?: number;
  /** Soft edge, in pixels (default 160). 0 is a hard line. */
  feather?: number;
  easing?: Easing;
};

/** The next shot slides in behind a straight, feathered edge at any angle. No filter. */
export const wipe = (frames = 30, { angle = 0, feather = 160, easing = ease.inOut }: WipeOptions = {}): Transition => ({
  name: `Wipe ${angle}°`,
  frames,
  style: (p) => ({ out: {}, in: wipeMask(easing(p), angle, feather) }),
});

export type IrisOptions = {
  /** Where the circle opens from, in output pixels (default the centre): the button that was clicked. */
  at?: Point;
  /** Soft edge in pixels (default 0: a crisp clip-path circle). */
  feather?: number;
  easing?: Easing;
};

/** The next shot opens in a circle from a point until it covers the frame. No filter. */
export const iris = (frames = 30, { at, feather = 0, easing = ease.inOut }: IrisOptions = {}): Transition => ({
  name: "Iris",
  frames,
  style: (p, frame) => {
    const o = at ?? centre(frame);
    const e = easing(p);
    const reach = coverRadius(o, frame) + feather;
    const r = e * reach;
    if (feather <= 0) return { out: {}, in: { clipPath: `circle(${r}px at ${o.x}px ${o.y}px)` } };
    const image = `radial-gradient(circle ${reach}px at ${o.x}px ${o.y}px, #000 ${Math.max(0, r - feather)}px, transparent ${r}px)`;
    return { out: {}, in: e <= 0 ? { opacity: 0 } : masked(image) };
  },
});

export type ShapeOptions = {
  /** The shape as SVG path data, in its own coordinates (an icon, a logo's silhouette). */
  d: string;
  /** The path's own box, which `at` centres on the frame (default 0 0 24 24, an icon). */
  box?: Box;
  /** Where the shape grows from, in output pixels (default the centre). */
  at?: Point;
  /** Turn while growing, in degrees. */
  rotate?: number;
  /** How far it grows: the shape's smaller side ends at `cover` × the frame's diagonal (default 2.4; raise for thin shapes). */
  cover?: number;
  /** Its smaller side at the start, in pixels (default 8). */
  from?: number;
  easing?: Easing;
};

/**
 * The next shot appears inside a shape that grows from a point (a star, the
 * product's mark) until it covers the frame: an SVG clip path the overlay
 * carries. Growth is exponential, so the shape reads at its small sizes. No filter.
 */
export const shape = (
  frames = 36,
  {
    d,
    box = { x: 0, y: 0, width: 24, height: 24 },
    at,
    rotate = 0,
    cover = 2.4,
    from = 8,
    easing = ease.swap,
  }: ShapeOptions,
): Transition => {
  const id = uid("shape");
  return {
    name: "Shape reveal",
    frames,
    style: (p) => ({ out: {}, in: p <= 0 ? { opacity: 0 } : { clipPath: `url(#${id})` } }),
    overlay: (p, frame) => {
      const o = at ?? centre(frame);
      const side = Math.min(box.width, box.height);
      const first = from / side;
      const end = (cover * Math.hypot(frame.width, frame.height)) / side;
      // From `from` pixels to covering the frame, evenly in log space.
      const e = easing(p);
      const s = first * (end / first) ** e;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const transform = `translate(${o.x} ${o.y}) rotate(${rotate * e}) scale(${s}) translate(${-cx} ${-cy})`;
      return defs(h("clipPath", { id, clipPathUnits: "userSpaceOnUse" }, h("path", { d, transform })));
    },
  };
};

export type ClockOptions = {
  /** The hand's pivot, in output pixels (default the centre). */
  at?: Point;
  /** Where the hand starts, in degrees clockwise from 12 o'clock (default 0). */
  start?: number;
  /** Soft edge on the hand, in degrees (default 6). */
  feather?: number;
  clockwise?: boolean;
  easing?: Easing;
};

/** The next shot sweeps in behind a clock hand: time passing, literally. No filter. */
export const clock = (
  frames = 36,
  { at, start = 0, feather = 6, clockwise = true, easing = ease.inOut }: ClockOptions = {},
): Transition => ({
  name: "Clock wipe",
  frames,
  style: (p, frame) => ({ out: {}, in: clockMask(easing(p), at ?? centre(frame), { start, feather, clockwise }) }),
});

export type ZoomIntoOptions = {
  /** The element in the outgoing shot that becomes the next shot, in output pixels. */
  rect: Box;
  /** Its corner radius on screen, which opens to square corners (default 0). */
  radius?: number;
  easing?: Easing;
};

/**
 * Push into an element that becomes the next scene: the outgoing shot zooms
 * toward `rect` while the incoming shot, framed inside the element, opens out
 * to fill the frame. The zoom runs evenly in log space, so a 10× push does not
 * rush at the start. No filter.
 */
export const zoomInto = (frames = 40, { rect, radius = 0, easing = ease.inOut }: ZoomIntoOptions): Transition => ({
  name: "Zoom into",
  frames,
  style: (p, { width: W, height: H }) => {
    const e = easing(p);
    // The incoming shot covers the element at first: scale k0, window (in its own pixels) of the element's shape.
    const k0 = Math.max(rect.width / W, rect.height / H);
    const zoomTo = 1 / k0;
    const z = zoomTo ** e;
    const f = zoomTo === 1 ? e : (z - 1) / (zoomTo - 1);
    const k = k0 * z;
    const lw = lerp(rect.width / k0, W, f);
    const lh = lerp(rect.height / k0, H, f);
    const cx = lerp(rect.x + rect.width / 2, W / 2, f);
    const cy = lerp(rect.y + rect.height / 2, H / 2, f);
    const r = lerp(radius, 0, f) / k;
    // The outgoing shot scales about the element so the element stays the window's size.
    const s = (lw * k) / rect.width;
    const rx = rect.x + rect.width / 2;
    const ry = rect.y + rect.height / 2;
    return {
      out: { transformOrigin: "0 0", transform: `translate(${cx - rx * s}px, ${cy - ry * s}px) scale(${s})` },
      in: {
        transformOrigin: "0 0",
        transform: `translate(${cx - (W / 2) * k}px, ${cy - (H / 2) * k}px) scale(${k})`,
        clipPath: `inset(${(H - lh) / 2}px ${(W - lw) / 2}px round ${r}px)`,
      },
    };
  },
});

// --- Motion and light ---------------------------------------------------------------

export type WhipOptions = {
  direction?: Direction;
  /** The most blur, in pixels of standard deviation along the move (default 90). */
  blur?: number;
  easing?: Easing;
};

/**
 * A whip pan: both shots travel a frame's width fast, blurred along the move
 * by how fast they go (an SVG gaussian with no spread across it). The blurred
 * edges are made opaque again, so the seam between the shots does not open
 * onto the background. Short: 12 to 18 frames. Filters.
 */
export const whip = (
  frames = 16,
  { direction = "left", blur = 90, easing = ease.inOut }: WhipOptions = {},
): Transition => {
  const id = uid("whip");
  const horizontal = direction === "left" || direction === "right";
  const axis = horizontal ? "X" : "Y";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const sigma = (p: number, frame: TransitionFrame) => {
    // Pixels per frame at p; a 180° shutter smears half of it, a gaussian of a third of that looks right.
    const speed = (slope(easing, p) * (horizontal ? frame.width : frame.height)) / frames;
    return Math.min(blur, speed / 6);
  };
  return {
    name: `Whip ${direction}`,
    frames,
    filters: true,
    style: (p, frame) => {
      const t = easing(p) * 100;
      const filter = sigma(p, frame) >= 0.5 ? `url(#${id})` : undefined;
      return {
        out: { transform: `translate${axis}(${sign * t}%)`, filter },
        in: { transform: `translate${axis}(${sign * (t - 100)}%)`, filter },
      };
    },
    overlay: (p, frame) => {
      const s = sigma(p, frame);
      return defs(
        h(
          "filter",
          { id, x: "-25%", y: "-25%", width: "150%", height: "150%", colorInterpolationFilters: "sRGB" },
          h("feGaussianBlur", { stdDeviation: horizontal ? `${s} 0` : `0 ${s}` }),
          // Blur fades each shot's edge into transparency, so the seam would open onto the background.
          // The colour there is still the edge's: doubling the alpha makes the seam opaque and keeps a soft overlap.
          h("feComponentTransfer", null, h("feFuncA", { type: "linear", slope: 2 })),
        ),
      );
    },
  };
};

export type SweepOptions = {
  /** Direction the band travels, in degrees: 0 to the right (default 15, a slight diagonal). */
  angle?: number;
  /** The light's colour (default white). */
  color?: string;
  /** Half-width of the band, in pixels (default 260). */
  width?: number;
  /** How bright, 0 to 1 and beyond (default 0.9). */
  strength?: number;
  easing?: Easing;
};

/**
 * A band of light crosses the frame and the cut happens under it: the next
 * shot is wiped in along the band's centre, with an edge softer than the band,
 * so the seam is never seen. The band adds as light (`plus-lighter`). Light
 * crosses at an even speed, so the default easing is the gentle `ease.swap`;
 * `ease.inOut` leaves it off screen for the first and last quarter. No filter.
 */
export const sweep = (
  frames = 36,
  { angle = 15, color = "#fff", width = 260, strength = 0.9, easing = ease.swap }: SweepOptions = {},
): Transition => {
  const feather = width * 0.9;
  /** Where the band's centre is along the gradient line, in pixels, and that line's length. */
  const place = (p: number, { width: W, height: H }: TransitionFrame) => {
    const a = ((angle + 90) * Math.PI) / 180;
    const length = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
    const margin = width + feather / 2;
    return { c: lerp(-margin, length + margin, easing(p)), length };
  };
  return {
    name: "Light sweep",
    frames,
    blend: "plus-lighter",
    style: (p, frame) => {
      const { c } = place(p, frame);
      if (p <= 0) return { out: {}, in: { opacity: 0 } };
      return {
        out: {},
        in: masked(`linear-gradient(${angle + 90}deg, #000 ${c - feather / 2}px, transparent ${c + feather / 2}px)`),
      };
    },
    overlay: (p, frame) => {
      const { c } = place(p, frame);
      // A gaussian-ish falloff from a few stops, so the band has a hot core and a wide glow.
      const stops = [
        [-1, 0],
        [-0.55, 0.12],
        [-0.25, 0.45],
        [0, 1],
        [0.25, 0.45],
        [0.55, 0.12],
        [1, 0],
      ]
        .map(([at, a]) => `color-mix(in srgb, ${color} ${a * 100}%, transparent) ${c + at * width}px`)
        .join(", ");
      return h("div", {
        style: {
          position: "absolute",
          inset: 0,
          opacity: strength,
          background: `linear-gradient(${angle + 90}deg, ${stops})`,
        },
      });
    },
  };
};

// --- Filters -------------------------------------------------------------------------

export type DisplaceOptions = {
  /** Displacement at its strongest, in pixels (default 140). */
  amount?: number;
  /** Size of the noise: lower is broader (default 0.006). */
  frequency?: number;
  octaves?: number;
  /** The noise pattern; same seed, same dissolve. */
  seed?: number;
  easing?: Easing;
};

/**
 * Dissolve through a liquid distortion: the outgoing shot warps more as it
 * fades, the incoming one arrives warped and settles. Seeded fractal noise
 * (feTurbulence) drives an feDisplacementMap. Both shots scale up a little
 * with the warp so its edges never pull in the background. Filters.
 */
export const displace = (
  frames = 30,
  { amount = 140, frequency = 0.006, octaves = 2, seed = 1, easing = ease.inOut }: DisplaceOptions = {},
): Transition => {
  const outId = uid("displace-out");
  const inId = uid("displace-in");
  const filter = (id: string, scale: number) =>
    h(
      "filter",
      { id, x: 0, y: 0, width: "100%", height: "100%", colorInterpolationFilters: "sRGB" },
      h("feTurbulence", { type: "fractalNoise", baseFrequency: frequency, numOctaves: octaves, seed, result: "n" }),
      h("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale, xChannelSelector: "R", yChannelSelector: "G" }),
    );
  return {
    name: "Displace dissolve",
    frames,
    filters: true,
    style: (p, { height }) => {
      const e = easing(p);
      const grow = (d: number) => `scale(${1 + (0.7 * d) / height})`;
      return {
        out: { filter: `url(#${outId})`, transform: grow(amount * e) },
        in: { filter: `url(#${inId})`, transform: grow(amount * (1 - e)), opacity: ease.soft(p) },
      };
    },
    overlay: (p) => {
      const e = easing(p);
      return defs(filter(outId, amount * e), filter(inId, amount * (1 - e)));
    },
  };
};

export type LumaOptions = {
  /** Width of the dissolving edge, as a share of the noise's range (default 0.08). */
  softness?: number;
  /** Size of the noise: lower is larger blotches (default 0.003). */
  frequency?: number;
  octaves?: number;
  seed?: number;
  easing?: Easing;
};

/**
 * A luma dissolve: the next shot appears through seeded fractal noise, the
 * darkest blotches first, like ink spreading. The noise is thresholded at the
 * progress inside an SVG filter that masks the incoming shot. Filters.
 */
export const luma = (
  frames = 36,
  { softness = 0.08, frequency = 0.003, octaves = 3, seed = 1, easing = ease.inOut }: LumaOptions = {},
): Transition => {
  const id = uid("luma");
  // Fractal noise mostly lies in 0.2..0.8; sweep the threshold across that.
  const lo = 0.2;
  const hi = 0.8;
  return {
    name: "Luma dissolve",
    frames,
    filters: true,
    style: (p) => {
      const e = easing(p);
      return { out: {}, in: e <= 0 ? { opacity: 0 } : e >= 1 ? {} : { filter: `url(#${id})` } };
    },
    overlay: (p) => {
      const threshold = lerp(lo - softness, hi + softness, easing(p));
      // alpha = (threshold − noise) / softness, clamped: shown where the noise is below the threshold.
      return defs(
        h(
          "filter",
          { id, x: 0, y: 0, width: "100%", height: "100%", colorInterpolationFilters: "sRGB" },
          h("feTurbulence", { type: "fractalNoise", baseFrequency: frequency, numOctaves: octaves, seed, result: "n" }),
          h("feColorMatrix", {
            in: "n",
            type: "matrix",
            values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0",
            result: "a",
          }),
          h(
            "feComponentTransfer",
            { in: "a", result: "m" },
            h("feFuncA", { type: "linear", slope: -1 / softness, intercept: threshold / softness }),
          ),
          h("feComposite", { in: "SourceGraphic", in2: "m", operator: "in" }),
        ),
      );
    },
  };
};

export type ChromaticOptions = {
  /** Split between the red and blue channels at its widest, in pixels (default 36). */
  offset?: number;
  /** Direction of the split, in degrees (default 0, horizontal). */
  angle?: number;
  easing?: Easing;
};

/**
 * A chromatic split: both shots tear into red, green and blue, offset along
 * `angle`, widest mid-transition while they cross-fade, then lock back
 * together. Glitchy and fast: 12 to 20 frames. Filters.
 */
export const chromatic = (
  frames = 18,
  { offset = 36, angle = 0, easing = ease.inOut }: ChromaticOptions = {},
): Transition => {
  const id = uid("chromatic");
  const channel = (i: number, result: string) =>
    h("feColorMatrix", {
      in: "SourceGraphic",
      type: "matrix",
      values: [0, 1, 2]
        .map((row) => (row === i ? `${row === 0 ? 1 : 0} ${row === 1 ? 1 : 0} ${row === 2 ? 1 : 0} 0 0` : "0 0 0 0 0"))
        .concat("0 0 0 1 0")
        .join(" "),
      result,
    });
  return {
    name: "Chromatic split",
    frames,
    filters: true,
    style: (p, { width }) => {
      const split = Math.sin(Math.PI * easing(p));
      const filter = split > 0.01 ? `url(#${id})` : undefined;
      // Scale up by the split, so the channels shifted off the frame's edges leave no coloured fringe there.
      const transform = `scale(${1 + (offset * split) / width})`;
      return { out: { filter, transform }, in: { filter, transform, opacity: easing(p) } };
    },
    overlay: (p) => {
      const d = (offset / 2) * Math.sin(Math.PI * easing(p));
      const a = (angle * Math.PI) / 180;
      const dx = d * Math.cos(a);
      const dy = d * Math.sin(a);
      return defs(
        h(
          "filter",
          { id, x: "-5%", y: "-5%", width: "110%", height: "110%", colorInterpolationFilters: "sRGB" },
          channel(0, "r"),
          h("feOffset", { in: "r", dx, dy, result: "r2" }),
          channel(1, "g"),
          channel(2, "b"),
          h("feOffset", { in: "b", dx: -dx, dy: -dy, result: "b2" }),
          h("feBlend", { in: "r2", in2: "g", mode: "screen", result: "rg" }),
          h("feBlend", { in: "rg", in2: "b2", mode: "screen" }),
        ),
      );
    },
  };
};

// --- Cuts -------------------------------------------------------------------------------

/**
 * The honest cut: a short dissolve (8 frames) where the edit skips time, so a
 * result that took a minute does not look instant. Use it wherever a demo
 * jumps over waiting (a build, an upload, a long answer). No filter.
 */
export const honest = (frames = 8, { easing = ease.swap }: { easing?: Easing } = {}): Transition => ({
  name: "Time cut",
  frames,
  style: (p) => ({ out: {}, in: { opacity: easing(p) } }),
});

export type MatchCutOptions = {
  /** The element at the end of the outgoing shot, in output pixels. */
  from: Box;
  /** The matching element in the incoming shot, where it settles, in output pixels. */
  to: Box;
  /**
   * How it was moving at the cut: pixels per frame, and `scale` as growth per
   * frame (0.01 is 1% bigger each frame). From `springToVelocity` or the
   * camera's last move.
   */
  velocity?: { x?: number; y?: number; scale?: number };
  /** The settle (default `springs.snappy`). */
  spring?: SpringConfig;
  fps?: number;
  /** How long the settle runs, in frames (default: until the spring is within 0.2% of rest). */
  frames?: number;
};

export type MatchCut = Transition & {
  /** The incoming layer's offset and scale at a frame of its shot (origin top left); identity once settled. */
  pose: (frame: number) => { x: number; y: number; scale: number };
  /** The same as CSS for a layer the shot moves itself (`<div style={cut.at(frame)}>`). */
  at: (frame: number) => CSSProperties;
};

/**
 * A match cut that carries motion across: at the cut, the incoming shot is
 * placed so its element sits exactly where the outgoing shot's was, at the
 * same size, then springs to its own place, starting at the speed the element
 * had. As a transition it moves the whole incoming shot (a hard cut: no
 * overlap), so where the element was smaller in the outgoing shot the whole
 * shot starts smaller than the frame and the background shows around it. A
 * shot whose background must stay put applies `at(frame)` to the element's
 * layer itself and cuts without a transition.
 *
 *   const cut = matchCut({ from: mark(a, "card"), to: mark(b, "card"), velocity: { y: -14 } });
 *   { id: "b", transition: cut, … }
 */
export function matchCut({
  from,
  to,
  velocity = {},
  spring = springs.snappy,
  fps = 60,
  frames,
}: MatchCutOptions): MatchCut {
  const s0 = Math.sqrt((from.width * from.height) / (to.width * to.height));
  const fromX = from.x + from.width / 2;
  const fromY = from.y + from.height / 2;
  const toX = to.x + to.width / 2;
  const toY = to.y + to.height / 2;
  const span = Math.max(1, Math.ceil(frames ?? settleFrames(spring, fps, 0.002)));
  const pose = (frame: number) => {
    if (frame >= span) return { x: 0, y: 0, scale: 1 };
    const settle = (a: number, b: number, v = 0) =>
      springTo(
        Math.max(0, frame),
        fps,
        [
          { at: 0, to: a, velocity: v },
          { at: 0, to: b },
        ],
        spring,
      );
    // What is left of the spring fades over the last 15%, so the end lands exactly on rest.
    const u = Math.max(0, (frame / span - 0.85) / 0.15);
    const fade = 1 - u * u * (3 - 2 * u);
    const scale = 1 + (settle(s0, 1, s0 * (velocity.scale ?? 0)) - 1) * fade;
    const cx = toX + (settle(fromX, toX, velocity.x) - toX) * fade;
    const cy = toY + (settle(fromY, toY, velocity.y) - toY) * fade;
    // The element's centre lands on (cx, cy) at this scale.
    return { x: cx - toX * scale, y: cy - toY * scale, scale };
  };
  const at = (frame: number): CSSProperties => {
    const { x, y, scale } = pose(frame);
    return { transformOrigin: "0 0", transform: `translate(${x}px, ${y}px) scale(${scale})` };
  };
  return {
    name: "Match cut",
    frames: 0,
    span,
    style: (p) => ({ out: {}, in: at(p * span) }),
    pose,
    at,
  };
}
