import { type CSSProperties, type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { formatOklch, mixColor, toOklch } from "../engine/color.js";
import { random } from "../engine/motion.js";
import { waitFor } from "../engine/timeline.js";

/*
 * A sheet of paper that bends: the shared core of `PageFlip` (a book's leaf
 * turning on its spine) and `transitions.pageCurl` (a whole shot peeling off).
 *
 * The bent sheet is a developable surface: straight lines on it (generators,
 * at angle `alpha` to the sheet's v axis, so a corner can lead) stay straight,
 * and across them it follows a curve whose angle is `bend(w)`. It is cut into
 * strips along the generators, each flat, so each is one CSS `matrix3d` (a
 * homography computed here, perspective included, with no 3D context in the
 * DOM). Each strip is a flat container clipped to its projected polygon that
 * holds, in order: a copy of whatever lies beneath, blurred by the strip's
 * own height above it (what a frosted sheet does to things seen through it),
 * and the sheet's face, transformed. Strips are opaque, so they overlap their
 * neighbours by a pixel and no seam shows. Shadows are one canvas, redrawn
 * every frame from the strips and copied into each strip's view of beneath,
 * so a shadow is seen through a translucent sheet too.
 */

// --- Paper --------------------------------------------------------------------------

export type Paper = {
  /** Light that passes straight through, 0 (opaque) to 1 (clear): how much of what lies beneath shows. */
  seeThrough: number;
  /** Light the sheet scatters on through itself, 0 to 1: how brightly a lifted sheet glows where light falls on its other side. */
  glow: number;
  /** The sheet's colour. */
  color: string;
  /** Blur of what lies directly under it, flat on it, in px. */
  blur: number;
  /** Extra blur of what lies under it per px of gap between them (a sheet lifted 100 px over text blurs it by `blur + 100 × scatter`). */
  scatter: number;
  /** Fine grain in the sheet, 0 to 1. A fixed, seeded texture: it moves with the sheet and never flickers. */
  grain: number;
  /** An image (URL in the launch folder) multiplied over the sheet, for a paper of your own. */
  texture?: string;
  /** How strongly `texture` shows, 0 to 1 (default 0.5). */
  textureAmount: number;
  /** Specular sheen along the bend, 0 to 1. */
  sheen: number;
  /** How tight the sheen is: 6 is satin, 80 is gloss. */
  gloss: number;
  /** Mirror-like reflection where the sheet is seen at a grazing angle (plastic film), 0 to 1. */
  reflect: number;
  /** The print on the other side, seen mirrored through the sheet, 0 to 1 (1: as much as the paper lets through). */
  showThrough: number;
  /** Strength of the shadow it casts, 0 to 1. Light that gets through the sheet lightens the shadow and tints it the sheet's colour. */
  shadow: number;
  /** A highlight along the sheet's edges, 0 to 1. */
  edge: number;
};

export type PaperPreset = "film" | "vellum" | "parchment" | "paper" | "smoke" | "graphite" | "black";

/**
 * The papers, by how much light they let through. Light: `film` is thin
 * clear plastic (what is beneath stays sharp; the sheet shows only as a sheen
 * and a bright edge), `vellum` is frosted (beneath shows clearly but blurs
 * as the sheet lifts, and a lifted sheet glows with light coming through),
 * `parchment` is warmer and less clear, `paper` is book paper (opaque but for
 * a faint shadow of the other side's print). Dark: `smoke` is smoked film
 * (beneath stays sharp, dimmed; the sheet shows as a sheen and a rim of
 * light), `graphite` is dark frosted vellum (light lines beneath glow through
 * it, softening as it lifts), `black` is black paper.
 */
export const papers: Record<PaperPreset, Paper> = {
  film: {
    seeThrough: 0.93,
    glow: 0.05,
    color: "#ffffff",
    blur: 0,
    scatter: 0,
    grain: 0,
    textureAmount: 0.5,
    sheen: 0.55,
    gloss: 70,
    reflect: 0.5,
    showThrough: 1,
    shadow: 0.22,
    edge: 0.55,
  },
  vellum: {
    seeThrough: 0.46,
    glow: 0.6,
    color: "#f3f3ef",
    blur: 1.1,
    scatter: 0.032,
    grain: 0.22,
    textureAmount: 0.5,
    sheen: 0.2,
    gloss: 14,
    reflect: 0.08,
    showThrough: 0.75,
    shadow: 0.42,
    edge: 0.25,
  },
  parchment: {
    seeThrough: 0.38,
    glow: 0.55,
    color: "#f0e6d0",
    blur: 1.6,
    scatter: 0.04,
    grain: 0.4,
    textureAmount: 0.5,
    sheen: 0.1,
    gloss: 9,
    reflect: 0.03,
    showThrough: 0.8,
    shadow: 0.52,
    edge: 0.18,
  },
  paper: {
    seeThrough: 0.06,
    glow: 0.18,
    color: "#fbfaf6",
    blur: 2.5,
    scatter: 0.06,
    grain: 0.16,
    textureAmount: 0.5,
    sheen: 0.05,
    gloss: 6,
    reflect: 0,
    showThrough: 0.7,
    shadow: 0.72,
    edge: 0.12,
  },
  smoke: {
    seeThrough: 0.6,
    glow: 0.03,
    color: "#0b0b0d",
    blur: 0,
    scatter: 0,
    grain: 0,
    textureAmount: 0.5,
    sheen: 0.5,
    gloss: 60,
    reflect: 0.5,
    showThrough: 1,
    shadow: 0.45,
    edge: 0.5,
  },
  graphite: {
    seeThrough: 0.5,
    glow: 0.25,
    color: "#18181b",
    blur: 0.9,
    scatter: 0.035,
    grain: 0.3,
    textureAmount: 0.5,
    sheen: 0.22,
    gloss: 16,
    reflect: 0.14,
    showThrough: 0.75,
    shadow: 0.5,
    edge: 0.35,
  },
  black: {
    seeThrough: 0.03,
    glow: 0.05,
    color: "#0e0e10",
    blur: 2.5,
    scatter: 0.12,
    grain: 0.14,
    textureAmount: 0.5,
    sheen: 0.12,
    gloss: 10,
    reflect: 0.06,
    showThrough: 0.6,
    shadow: 0.8,
    edge: 0.22,
  },
};

/** A paper by name, by how much it lets through (0 opaque to 1 clear, between the light presets), or as overrides on a preset. */
export type PaperSpec = PaperPreset | number | (Partial<Paper> & { preset?: PaperPreset });

const clear: Paper = { ...papers.film, seeThrough: 1, glow: 0, shadow: 0.08, sheen: 0.5 };
const scales = {
  light: [
    { ...papers.paper, seeThrough: 0, glow: 0.1, shadow: 0.8 },
    papers.paper,
    papers.parchment,
    papers.vellum,
    papers.film,
    clear,
  ],
  dark: [
    { ...papers.black, seeThrough: 0 },
    papers.black,
    papers.graphite,
    papers.smoke,
    { ...papers.smoke, seeThrough: 1, color: "#16161a" },
  ],
};

/**
 * The paper that lets `seeThrough` of the light through, 0 (opaque) to 1
 * (clear): between the presets, so one number runs from book paper through
 * parchment and vellum to film, or (`"dark"`) from black paper through
 * graphite to smoked film.
 */
export function paperFor(seeThrough: number, tone: "light" | "dark" = "light"): Paper {
  const scale = scales[tone];
  const t = Math.max(0, Math.min(1, seeThrough));
  let i = 0;
  while (i < scale.length - 2 && scale[i + 1].seeThrough < t) i++;
  const a = scale[i];
  const b = scale[i + 1];
  const k = (t - a.seeThrough) / (b.seeThrough - a.seeThrough);
  const mix = (key: keyof Paper) => (a[key] as number) + ((b[key] as number) - (a[key] as number)) * k;
  return {
    seeThrough: t,
    glow: mix("glow"),
    color: mixColor(a.color, b.color, k),
    blur: mix("blur"),
    scatter: mix("scatter"),
    grain: mix("grain"),
    textureAmount: 0.5,
    sheen: mix("sheen"),
    gloss: mix("gloss"),
    reflect: mix("reflect"),
    showThrough: mix("showThrough"),
    shadow: mix("shadow"),
    edge: mix("edge"),
  };
}

/** A `PaperSpec` as a full `Paper`. */
export function resolvePaper(spec: PaperSpec | undefined, fallback: Paper = papers.paper): Paper {
  if (spec === undefined) return fallback;
  if (typeof spec === "string") return papers[spec];
  if (typeof spec === "number") return paperFor(spec);
  const { preset, ...rest } = spec;
  const base = preset ? papers[preset] : rest.seeThrough !== undefined ? paperFor(rest.seeThrough) : fallback;
  return { ...base, ...rest };
}

// --- Geometry -----------------------------------------------------------------------

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The shape of a bent sheet, in its own units: u across from its hinge edge
 * (0 to `width`), v along it (0 to `height`). `w = u cos alpha - (v - pivot) sin alpha`
 * runs across the generators. Up to `start` the sheet is flat and turned
 * `hinge` radians about the line u = 0 (0 lies on the floor, π lies flipped
 * over on the other side); beyond it the curve turns by `bend(w)` radians,
 * which is 0 at `start` and constant after `end`.
 */
export type CurlShape = {
  width: number;
  height: number;
  alpha: number;
  pivot: number;
  hinge: number;
  start: number;
  end: number;
  bend: (w: number) => number;
};

/**
 * Where the sheet lies at rest, in the root's pixels: its (0, 0), the
 * directions its u and v axes point, and how the content laid out on it maps
 * to (u, v): `u = m[0]·x + m[1]·y + m[2]`, `v = m[3]·x + m[4]·y + m[5]`.
 */
export type Placement = {
  origin: [number, number];
  u: [number, number];
  v: [number, number];
  content: [number, number, number, number, number, number];
};

/** The camera: straight above (x, y) at `distance` px, looking down. */
export type Eye = { x: number; y: number; distance: number };

export type Band = {
  w0: number;
  w1: number;
  /** Content → root pixels, a 3×3 homography (row-major). */
  hom: number[];
  /** The same for art floating `d` px above the side facing the camera (negative: behind it, the far side's art). */
  lift: (d: number) => number[];
  /** How far a point 1 px above the side facing the camera moves sideways: its tilt (0 flat, 1 on edge). */
  tilt: number;
  /** The strip's bounds in content pixels, padded for art floating off it. */
  box: Region;
  /** The strip's outline on screen, in root pixels. */
  poly: [number, number][];
  /** Its corners in the world (root pixels, z up toward the camera), for shadows. */
  world: V3[];
  /** Distance from the camera to its middle: strips are painted far to near. */
  depth: number;
  /** Which side faces the camera. */
  facing: "front" | "back";
  /** Mean height above the floor. */
  z: number;
};

export type Shade = { at: number; dark: number; light: number };

export type CurlLayout = {
  bands: Band[];
  /** Shading across the sheet, as stops along w (0 to 1 between `w0` and `w1`). */
  shade: Shade[];
  /** The gradient line in content pixels that `shade` runs along. */
  line: [number, number, number, number];
  /** How backlit the free edge (u = width) is, 0 to 1. */
  edgeGlow: number;
  /** Content → root pixels for the sheet lying flat (for the flat part's clip). */
  flatPoly: [number, number][] | null;
};

export type Light = {
  /** Direction toward the light (normalised): x right, y down, z up toward the camera. */
  dir: V3;
  /** How soft its shadows are: penumbra width per px of height (default 0.16, a large window). */
  softness: number;
};

export const defaultLight: Light = { dir: norm([-0.42, -0.55, 1]), softness: 0.16 };

/** Sutherland-Hodgman: keep the part of `poly` where f(p) ≥ 0. */
function clipPoly(poly: [number, number][], f: (p: [number, number]) => number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export type LayoutOptions = {
  /** The largest turn across one strip, in radians (default 5°). */
  maxStep?: number;
  /** The widest strip in sheet units (default 70). */
  maxLen?: number;
  /** How far strips overlap their neighbours, in sheet units (default 1). */
  overlap?: number;
  /** Leave out the flat part when it lies on the floor (a transition draws it itself). */
  skipFlat?: boolean;
  light?: Light;
  paper: Paper;
  /** How much the page under a lifted sheet lights its underside, 0 to 1 (default 0.7: a light page; 0.15 for a dark one). */
  bounce?: number;
};

/** Lay out a bent sheet: its strips, their homographies and outlines, and its shading. */
export function layoutCurl(shape: CurlShape, place: Placement, eye: Eye, options: LayoutOptions): CurlLayout {
  const { width: W, height: H, alpha, pivot: vp, hinge } = shape;
  const { maxStep = (5 * Math.PI) / 180, maxLen = 70, overlap = 1, skipFlat = false, paper } = options;
  const light = options.light ?? defaultLight;
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const cp = Math.cos(hinge);
  const sp = Math.sin(hinge);
  const N0: V3 = [ca * cp, -sa, ca * sp];
  const D: V3 = [sa * cp, ca, sa * sp];
  const M: V3 = [-sp, 0, cp];
  const wOf = (u: number, v: number) => u * ca - (v - vp) * sa;
  const ws = [wOf(0, 0), wOf(W, 0), wOf(0, H), wOf(W, H)];
  const wLo = Math.min(...ws);
  const wHi = Math.max(...ws);
  // The bend is integrated from where it really starts, even past the sheet's edge: material beyond a
  // fold that has left the sheet has still gone round the roll. Only the strip cuts stay on the sheet.
  const s0 = shape.start;
  const s1 = Math.max(shape.end, s0);

  // The cross-section, sampled finely and integrated: a point at w is a·N0 + b·M (+ ℓ·D along the generator).
  const n = 240;
  const sw: number[] = [];
  const sb: number[] = [];
  const sa_: number[] = [];
  const sbb: number[] = [];
  let a = s0;
  let b = 0;
  for (let k = 0; k <= n; k++) {
    const w = s0 + ((s1 - s0) * k) / n;
    if (k > 0) {
      const mid = shape.bend(w - (s1 - s0) / n / 2);
      const dw = (s1 - s0) / n;
      a += dw * Math.cos(mid);
      b += dw * Math.sin(mid);
    }
    sw.push(w);
    sb.push(k === 0 ? 0 : shape.bend(w));
    sa_.push(a);
    sbb.push(b);
  }
  const betaEnd = sb[n];
  const cross = (w: number): [number, number, number] => {
    if (w <= s0) return [w, 0, 0];
    if (w >= s1) return [sa_[n] + (w - s1) * Math.cos(betaEnd), sbb[n] + (w - s1) * Math.sin(betaEnd), betaEnd];
    const f = ((w - s0) / (s1 - s0)) * n;
    const k = Math.min(n - 1, Math.floor(f));
    const t = f - k;
    return [sa_[k] + (sa_[k + 1] - sa_[k]) * t, sbb[k] + (sbb[k + 1] - sbb[k]) * t, sb[k] + (sb[k + 1] - sb[k]) * t];
  };

  // Strip edges: the flat part is one strip, the bend is cut where it has turned maxStep or run maxLen, the straight tail is one.
  const edges = [wLo];
  if (s0 > wLo + 0.5 && s0 < wHi - 0.5) edges.push(s0);
  let last = Math.max(s0, wLo);
  let lastBeta = s0 >= wLo ? 0 : shape.bend(wLo);
  for (let k = 1; k < n; k++) {
    if (sw[k] <= wLo + 0.5 || sw[k] >= wHi - 0.5) continue;
    if (Math.abs(sb[k] - lastBeta) >= maxStep || sw[k] - last >= maxLen) {
      edges.push(sw[k]);
      last = sw[k];
      lastBeta = sb[k];
    }
  }
  if (s1 < wHi - 0.5 && s1 > wLo + 0.5 && s1 > last + 0.5) edges.push(s1);
  edges.push(wHi);

  const [m0, m1, m2, m3, m4, m5] = place.content;
  const [ox, oy] = place.origin;
  const [eux, euy] = place.u;
  const [evx, evy] = place.v;
  const f = eye.distance;
  const eyeP: V3 = [eye.x, eye.y, f];
  const toWorld = (p: V3): V3 => [ox + p[0] * eux + p[1] * evx, oy + p[0] * euy + p[1] * evy, p[2]];
  const toWorldDir = (p: V3): V3 => [p[0] * eux + p[1] * evx, p[0] * euy + p[1] * evy, p[2]];
  const project = (p: V3): [number, number] => {
    const k = 1 / (1 - p[2] / f);
    return [(p[0] - (eye.x * p[2]) / f) * k, (p[1] - (eye.y * p[2]) / f) * k];
  };
  const rect: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];

  const bands: Band[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const w0 = edges[i];
    const w1 = edges[i + 1];
    if (w1 - w0 < 0.25) continue;
    const flat = w1 <= s0 + 1e-6;
    if (flat && skipFlat && Math.abs(hinge) < 1e-9) continue;
    const [a0, b0] = cross(w0);
    const [a1, b1] = cross(w1);
    const ta = (a1 - a0) / (w1 - w0);
    const tb = (b1 - b0) / (w1 - w0);
    // Local point = K + w·G + ℓ·D, with w and ℓ linear in (u, v).
    const G = add(mul(N0, ta), M, tb);
    const K = add(add([0, vp, 0], N0, a0 - w0 * ta), M, b0 - w0 * tb);
    const P0 = add(K, add(mul(G, sa), D, -ca), vp);
    const Pu = add(mul(G, ca), D, sa);
    const Pv = add(mul(G, -sa), D, ca);
    const world = (u: number, v: number) => toWorld(add(add(P0, Pu, u), Pv, v));
    // Content → world, then the camera's projection.
    const Wc = toWorld(P0);
    const Wu = toWorldDir(Pu);
    const Wv = toWorldDir(Pv);
    const C = add(add(Wc, Wu, m2), Wv, m5);
    const Cx = add(mul(Wu, m0), Wv, m3);
    const Cy = add(mul(Wu, m1), Wv, m4);
    const kx = eye.x / f;
    const ky = eye.y / f;
    const homFrom = (c: V3) => [
      Cx[0] - kx * Cx[2],
      Cy[0] - kx * Cy[2],
      c[0] - kx * c[2],
      Cx[1] - ky * Cx[2],
      Cy[1] - ky * Cy[2],
      c[1] - ky * c[2],
      -Cx[2] / f,
      -Cy[2] / f,
      1 - c[2] / f,
    ];
    const hom = homFrom(C);
    const lo = i === 0 ? w0 : w0 - overlap;
    const hi = i === edges.length - 2 ? w1 : w1 + overlap;
    let uv = clipPoly(rect, (p) => wOf(p[0], p[1]) - lo);
    uv = clipPoly(uv, (p) => hi - wOf(p[0], p[1]));
    if (uv.length < 3) continue;
    const corners = uv.map((p) => world(p[0], p[1]));
    // The strip in content pixels (with room for art floating off it), so each face element is only as big as its strip.
    const det = m0 * m4 - m1 * m3 || 1;
    const cx = uv.map(([u, v]) => (m4 * (u - m2) - m1 * (v - m5)) / det);
    const cy = uv.map(([u, v]) => (-m3 * (u - m2) + m0 * (v - m5)) / det);
    const pad = 14;
    const cx0 = Math.floor(Math.min(...cx)) - pad;
    const cy0 = Math.floor(Math.min(...cy)) - pad;
    const box = {
      x: cx0,
      y: cy0,
      width: Math.ceil(Math.max(...cx)) + pad - cx0,
      height: Math.ceil(Math.max(...cy)) + pad - cy0,
    };
    const poly = corners.map(project);
    const mid = mul(
      corners.reduce((s, p) => add(s, p), [0, 0, 0] as V3),
      1 / corners.length,
    );
    const len = Math.hypot(ta, tb) || 1;
    const normal = toWorldDir(add(mul(N0, -tb / len), M, ta / len));
    const toEye = add(eyeP, mid, -1);
    const facing = dot(normal, toEye) >= 0 ? "front" : "back";
    const seen = facing === "front" ? normal : mul(normal, -1);
    bands.push({
      w0,
      w1,
      hom,
      // Art floating `d` px off the side facing the camera: shifted by d times that side's tilt.
      lift: (d: number) => (d === 0 ? hom : homFrom(add(C, [seen[0], seen[1], 0], d))),
      tilt: Math.hypot(seen[0], seen[1]),
      box,
      poly,
      world: corners,
      depth: Math.hypot(toEye[0], toEye[1], toEye[2]),
      facing,
      z: mid[2],
    });
  }
  bands.sort((p, q) => q.depth - p.depth);

  // Shading across the sheet, sampled along w, for the face's gradients. The sheet's own light is
  // what it reflects of the sky and the key light on the side facing the camera, plus what it lets
  // through (glow) from the other side: the key light, the sky, and the page under it bouncing light
  // up once there is a gap. Relative to the same sheet lying flat, which is how the stacks draw it.
  const L = light.dir;
  const lc = (W / 2) * sa + (H / 2 - vp) * ca;
  const T = paper.seeThrough;
  const R = Math.max(0.04, 1 - T);
  const A = 0.66;
  const Dk = 0.34;
  const bounce = options.bounce ?? 0.7;
  const flatE = R * (A + Dk * Math.max(0, L[2]));
  const halfway = (V: V3) => norm(add(L, V));
  const flatSpec = (V: V3) => dot([0, 0, 1], halfway(V)) ** paper.gloss;
  // The sheet's own brightness, so a light only lifts a dark sheet as much as its colour lets it.
  const own = R * Math.min(1, toOklch(paper.color)[0] ** 3 * 1.05);
  const lightAt = (w: number) => {
    const [aa, bb, beta] = cross(w);
    const local = add(add(add([0, vp, 0], D, lc), N0, aa), M, bb);
    const P = toWorld(local);
    const V = norm(add(eyeP, P, -1));
    let N = toWorldDir(add(mul(N0, -Math.sin(beta)), M, Math.cos(beta)));
    if (dot(N, V) < 0) N = mul(N, -1);
    const kd = Math.max(0, dot(N, L));
    const kb = Math.max(0, -dot(N, L));
    const skyF = (1 + N[2]) / 2;
    const skyB = (1 - N[2]) / 2;
    const gap = smoothstep(0, 60, P[2]);
    const behind = A * (skyB + bounce * gap * (1 - skyB)) + Dk * kb;
    const E = R * (A * skyF + Dk * kd) + paper.glow * behind;
    const s = E / flatE;
    const spec = paper.sheen * Math.max(0, Math.max(0, dot(N, halfway(V))) ** paper.gloss - flatSpec(V));
    const nv = Math.max(0, dot(N, V));
    const fres = paper.reflect * Math.max(0, (1 - nv) ** 4 - (1 - V[2]) ** 4);
    const lift = s > 1 ? (own * (s - 1)) / Math.max(0.05, 1 - own) : 0;
    return {
      dark: clamp((1 - s) * R * 0.85, 0, 0.8),
      light: clamp(lift + spec + fres, 0, 0.92),
      through: paper.glow * behind * gap,
    };
  };
  const shade: Shade[] = [];
  const stops = 72;
  for (let k = 0; k <= stops; k++) {
    const w = wLo + ((wHi - wLo) * k) / stops;
    const { dark, light: l } = lightAt(w);
    shade.push({ at: k / stops, dark, light: l });
  }
  // The gradient line in content pixels: w increases along (gx, gy).
  const gx = m0 * ca - m3 * sa;
  const gy = m1 * ca - m4 * sa;
  const g0 = m2 * ca - (m5 - vp) * sa;
  const gg = gx * gx + gy * gy || 1;
  const along = (w: number): [number, number] => [((w - g0) * gx) / gg, ((w - g0) * gy) / gg];
  const [x1, y1] = along(wLo);
  const [x2, y2] = along(wHi);
  const tip = lightAt(wHi - 2);
  const flatPoly =
    s0 > wLo + 0.5 && Math.abs(hinge) < 1e-9
      ? clipPoly(rect, (p) => s0 + overlap - wOf(p[0], p[1])).map((p) => project(toWorld([p[0], p[1], 0])))
      : null;
  return {
    bands,
    shade,
    line: [x1, y1, x2, y2],
    edgeGlow: clamp(tip.through * 1.6),
    flatPoly,
  };
}

/** A homography that first moves its input by (x, y): for an element placed at (x, y) in content pixels. */
export const homAt = (h: number[], x: number, y: number) => [
  h[0],
  h[1],
  h[0] * x + h[1] * y + h[2],
  h[3],
  h[4],
  h[3] * x + h[4] * y + h[5],
  h[6],
  h[7],
  h[6] * x + h[7] * y + h[8],
];

/** A 3×3 homography as CSS `matrix3d`, for an element whose transform origin is its top left. */
export function homToCss(h: number[]): string {
  const v = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  return `matrix3d(${v.map((x) => +x.toFixed(9)).join(",")})`;
}

/** A CSS `polygon()` through points, moved by (-dx, -dy). */
export const polygonCss = (pts: [number, number][], dx = 0, dy = 0) =>
  `polygon(${pts.map(([x, y]) => `${(x - dx).toFixed(2)}px ${(y - dy).toFixed(2)}px`).join(",")})`;

// --- Grain ----------------------------------------------------------------------------

let grain: string | null = null;

/** A 256 px tile of fine paper grain, drawn once from a seeded random: the same on every frame and in every worker. */
export function grainTile(): string | null {
  if (grain || typeof document === "undefined") return grain;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const rnd = random("paper-grain");
  // Fine, even speckle, light and dark, with a faint fibre running one way so it reads as paper, not noise.
  const fibre = new Float32Array(size);
  for (let y = 0; y < size; y++) fibre[y] = rnd() - 0.5;
  for (let i = 0; i < size * size; i++) {
    const y = Math.floor(i / size);
    const n = (rnd() - 0.5) * 0.8 + (rnd() - 0.5) * 0.4 + fibre[y] * 0.06;
    const v = n > 0 ? 255 : 0;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = Math.min(255, Math.abs(n) * 150);
  }
  ctx.putImageData(img, 0, 0);
  grain = canvas.toDataURL("image/png");
  const image = new Image();
  image.src = grain;
  waitFor(
    image.decode().catch(() => undefined),
    "paper grain",
  );
  return grain;
}

const decoded = new Set<string>();
function decode(url: string | undefined) {
  if (!url || decoded.has(url) || typeof Image === "undefined") return;
  decoded.add(url);
  const image = new Image();
  image.src = url;
  waitFor(
    image.decode().catch(() => undefined),
    `paper texture ${url}`,
  );
}

// --- The face of a sheet ----------------------------------------------------------------

/** One layer of a page's art, floating `depth` px above the paper (negative: sunk below it). */
export type ArtLayer = { node: ReactNode; depth?: number };

/**
 * What is printed on one side of a sheet: any React node, or art in layers
 * at different depths, which shift against each other in parallax as the
 * sheet tilts (a few px of depth reads as a display floating in the page).
 */
export type PageContent = ReactNode | { layers: ArtLayer[] };

const isLayered = (c: PageContent): c is { layers: ArtLayer[] } =>
  typeof c === "object" && c !== null && !Array.isArray(c) && "layers" in c && Array.isArray(c.layers);

/** A page's content as layers. */
export const artLayers = (content: PageContent): ArtLayer[] =>
  content === null || content === undefined || content === false
    ? []
    : isLayered(content)
      ? content.layers
      : [{ node: content as ReactNode, depth: 0 }];

/** Whether a page's content is layered display art (it redraws when a leaf lands on or off it). */
export const isDisplay = (content: PageContent) => isLayered(content);

export type FaceSide = { node?: PageContent; reflect?: boolean };

export type FaceProps = {
  width: number;
  height: number;
  paper: Paper;
  /** The side facing the camera, and the side behind it (seen through, mirrored). */
  top: FaceSide;
  under: FaceSide;
  /** The content-space reflection that turns one side's layout into the other's (CSS `matrix(…)`). */
  reflection: string;
  /** Shading gradients by id (from `ShadeDefs`), when the sheet is bent. */
  shadeIds?: { dark: string; light: string; glow?: string };
  /** Darken the hinge edge, like paper curving into a book's binding: "left" or "right" in content pixels. */
  gutter?: { side: "left" | "right"; amount: number };
  /** The paper's colour under the print is opaque (a base page, not a sheet). */
  solid?: boolean;
  /** Frames since the top side's display art redrew (an e-ink refresh), while it is redrawing. */
  refresh?: number;
  style?: CSSProperties;
};

const fill: CSSProperties = { position: "absolute", inset: 0 };

/** How long an e-ink redraw takes, in frames at 60 fps: a negative frame, then the art dithering in. */
export const REFRESH_FRAMES = 9;

/**
 * The pieces of one side of a sheet, bottom up: the other side's art seen
 * through it, the paper (colour, grain, texture), this side's art, and the
 * finish (gutter, shading, edge). `frame(depth)` places each piece: one box
 * for a flat page, a homography per depth for a strip of a bent one.
 */
function faceParts({
  width,
  height,
  paper,
  top,
  under,
  reflection,
  shadeIds,
  gutter,
  solid,
  refresh,
  wrap,
  snap,
}: FaceProps & {
  wrap: (depth: number, nodes: ReactNode[], key: number) => ReactNode;
  snap?: (depth: number) => number;
}): ReactNode[] {
  const tile = paper.grain > 0 ? grainTile() : null;
  decode(paper.texture);
  const T = solid ? 0 : paper.seeThrough;
  // The other side's print is seen through the paper's body: as much as passes straight through.
  const through = clamp(paper.showThrough * (0.08 + 0.92 * T));
  const parts: { depth: number; node: ReactNode }[] = [];
  const art = (side: FaceSide, sign: 1 | -1, opacity: number, blur: number, key: string, style?: CSSProperties) => {
    if (opacity <= 0.004) return;
    artLayers(side.node).forEach((layer, i) => {
      parts.push({
        // The far side's art is faint: no parallax for it, so it shares the paper's element.
        depth: sign < 0 ? 0 : (layer.depth ?? 0),
        node: (
          <div
            key={`${key}${i}`}
            style={{
              ...fill,
              opacity: opacity < 1 ? opacity : undefined,
              filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
              ...style,
            }}
          >
            {side.reflect ? (
              <div style={{ ...fill, transformOrigin: "0 0", transform: reflection }}>{layer.node}</div>
            ) : (
              layer.node
            )}
          </div>
        ),
      });
    });
  };
  parts.push({
    depth: 0,
    node: (
      <div key="paper" style={fill}>
        <div style={{ ...fill, background: paper.color, opacity: 1 - T }} />
        {tile && (
          <div
            style={{
              ...fill,
              backgroundImage: `url(${tile})`,
              backgroundSize: "256px 256px",
              opacity: paper.grain * (solid ? 0.5 : 1),
            }}
          />
        )}
        {paper.texture && (
          <div
            style={{
              ...fill,
              // Quoted: a data URL or a path with brackets or spaces breaks an unquoted url().
              backgroundImage: `url(${JSON.stringify(paper.texture)})`,
              backgroundSize: "cover",
              mixBlendMode: "multiply",
              opacity: paper.textureAmount,
            }}
          />
        )}
        {refresh !== undefined && refresh < 2.5 && (
          // The negative frame of an e-ink redraw: the page goes pale for a moment, the art dark on it.
          <div style={{ ...fill, background: "#d6d3ca", opacity: 0.42 * (1 - refresh / 2.5) }} />
        )}
      </div>
    ),
  });
  // The far side's print, seen through the paper's body: a ghost on it, a little soft on frosted papers.
  art(under, -1, through, paper.blur * 0.7, "u");
  if (refresh !== undefined && refresh < 2.5) {
    art(top, 1, 0.7, 0, "n", { filter: "invert(1)" });
  } else if (refresh !== undefined && refresh < REFRESH_FRAMES) {
    // Then the art dithers into place, the last of the negative ghosting off underneath.
    const level = (refresh - 2.5) / (REFRESH_FRAMES - 2.5);
    art(top, 1, 0.3 * (1 - level), 0, "g", { filter: "invert(1)", ...ditherMask(1 - level) });
    art(top, 1, 1, 0, "t", ditherMask(level));
  } else {
    art(top, 1, 1, 0, "t");
  }
  parts.push({
    depth: 0,
    node: (
      <div key="finish" style={fill}>
        {gutter && gutter.amount > 0 && (
          <div
            style={{
              ...fill,
              background: `linear-gradient(to ${gutter.side === "left" ? "right" : "left"}, rgba(0,0,0,${0.2 * gutter.amount}) 0px, rgba(0,0,0,${0.07 * gutter.amount}) ${width * 0.035}px, rgba(255,255,255,${0.05 * gutter.amount}) ${width * 0.09}px, rgba(0,0,0,0) ${width * 0.16}px)`,
            }}
          />
        )}
        {shadeIds && (
          <svg width={width} height={height} style={{ ...fill, overflow: "visible" }} aria-hidden>
            <rect width={width} height={height} fill={`url(#${shadeIds.dark})`} />
            <rect width={width} height={height} fill={`url(#${shadeIds.light})`} />
            {shadeIds.glow && <rect width={width} height={height} fill={`url(#${shadeIds.glow})`} />}
          </svg>
        )}
        {paper.edge > 0 && (
          <div
            style={{
              ...fill,
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,${0.55 * paper.edge}), inset 0 0 0 0.5px rgba(0,0,0,${0.12 * paper.edge * (1 - T)})`,
            }}
          />
        )}
      </div>
    ),
  });
  // Neighbouring pieces at one depth share an element: fewer layers for the compositor to keep.
  const groups: { depth: number; nodes: ReactNode[] }[] = [];
  for (const part of parts) {
    const depth = snap ? snap(part.depth) : part.depth;
    const last = groups[groups.length - 1];
    if (last && last.depth === depth) last.nodes.push(part.node);
    else groups.push({ depth, nodes: [part.node] });
  }
  return groups.map((g, i) => wrap(g.depth, g.nodes, i));
}

/** One side of a sheet lying flat, as it is seen: the other side's art through it, the paper, its grain, the art, its shading. */
export function Face({ style, ...props }: FaceProps) {
  const { width, height } = props;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height, ...style }}>
      {faceParts({
        ...props,
        wrap: (_, nodes, key) => (
          <div key={key} style={fill}>
            {nodes}
          </div>
        ),
      })}
    </div>
  );
}

// An ordered (Bayer) dither, as mask tiles for each of 17 levels: an e-ink panel's redraw.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dithers: string[] = [];
function ditherMask(level: number): CSSProperties {
  const k = Math.round(clamp(level) * 16);
  if (k >= 16) return {};
  if (typeof document === "undefined") return { opacity: 0 };
  if (!dithers.length) {
    for (let l = 0; l <= 16; l++) {
      const c = document.createElement("canvas");
      c.width = 4;
      c.height = 4;
      const ctx = c.getContext("2d");
      if (!ctx) return {};
      for (let i = 0; i < 16; i++) {
        if (BAYER[i] < l) {
          ctx.fillStyle = "#000";
          ctx.fillRect(i % 4, Math.floor(i / 4), 1, 1);
        }
      }
      dithers.push(c.toDataURL("image/png"));
      const image = new Image();
      image.src = dithers[l];
      waitFor(
        image.decode().catch(() => undefined),
        "dither",
      );
    }
  }
  const image = `url(${dithers[k]})`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: "3px 3px",
    WebkitMaskSize: "3px 3px",
    maskRepeat: "repeat",
    imageRendering: "pixelated",
  } as CSSProperties;
}

/** The shading gradients a bent sheet's faces point at: dark and light across the bend, and the backlit free edge. */
function ShadeDefs({
  ids,
  layout,
  glowLine,
}: {
  ids: { dark: string; light: string; glow: string };
  layout: CurlLayout;
  glowLine: [number, number, number, number];
}) {
  const [x1, y1, x2, y2] = layout.line;
  const line = { gradientUnits: "userSpaceOnUse", x1, y1, x2, y2 } as const;
  const [gx1, gy1, gx2, gy2] = glowLine;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id={ids.dark} {...line}>
          {layout.shade.map((s) => (
            <stop key={s.at} offset={s.at} stopColor="#000" stopOpacity={+s.dark.toFixed(4)} />
          ))}
        </linearGradient>
        <linearGradient id={ids.light} {...line}>
          {layout.shade.map((s) => (
            <stop key={s.at} offset={s.at} stopColor="#fff" stopOpacity={+s.light.toFixed(4)} />
          ))}
        </linearGradient>
        <linearGradient id={ids.glow} gradientUnits="userSpaceOnUse" x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.6} stopColor="#fff" stopOpacity={+(layout.edgeGlow * 0.12).toFixed(4)} />
          <stop offset={1} stopColor="#fff" stopOpacity={+(layout.edgeGlow * 0.45).toFixed(4)} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// --- Shadows ------------------------------------------------------------------------------

/** `color` with its linear light scaled by `k` (in OKLab that scales L, a and b by the cube root of k). */
export function lightThrough(color: string, k: number): string {
  const [l, c, h] = toOklch(color);
  const s = Math.cbrt(Math.max(0, k));
  return formatOklch([l * s, c * s, h, 1]);
}

export type Region = { x: number; y: number; width: number; height: number };

/** Canvas pixels per CSS pixel for shadows: they are soft, so 1 is enough at any output scale (and saves GPU memory at 4K). */
const SHADOW_SCALE = 1;

/**
 * Draw the shadows a bent sheet casts on the floor (z = 0): each strip
 * projected along the light, blurred by its height (a soft penumbra that
 * tightens where the sheet nears the floor), plus an ambient darkening under
 * it that is strongest where it touches down. In the colour of the light
 * that gets through the sheet, to be multiplied over what lies beneath.
 */
function drawShadows(
  canvas: HTMLCanvasElement,
  region: Region,
  bands: Band[],
  paper: Paper,
  light: Light,
  strength: number,
  tinted?: Region,
) {
  const dpr = SHADOW_SCALE;
  const w = Math.ceil(region.width * dpr);
  const h = Math.ceil(region.height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  const T = paper.seeThrough;
  const L = light.dir;
  const occlusion = (1 - T) * paper.shadow * strength;
  if (occlusion <= 0.002) return;
  const path = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = (x - region.x) * dpr;
      const py = (y - region.y) * dpr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };
  // Coverage adds up: neighbouring strips, each blurred, sum to the blur of the whole, with no seam between them.
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "#fff";
  for (const band of bands) {
    const z = band.z;
    // Lying flat on the floor, a sheet casts nothing to see; lifted a few pixels, its shadow is darkest and tightest.
    const lift = smoothstep(0, 3, z);
    if (lift <= 0) continue;
    // Key light: projected along the light, the penumbra widening with height.
    const key = band.world.map((p): [number, number] => [p[0] - (L[0] * p[2]) / L[2], p[1] - (L[1] * p[2]) / L[2]]);
    ctx.filter = `blur(${((0.4 + light.softness * z) * dpr).toFixed(2)}px)`;
    ctx.globalAlpha = clamp(occlusion * 0.75 * lift);
    path(key);
    ctx.fill();
    // Ambient: the sky the sheet hides from the floor straight under it, darkest close to the floor.
    ctx.filter = `blur(${((1 + 0.4 * z) * dpr).toFixed(2)}px)`;
    ctx.globalAlpha = clamp(occlusion * 0.4 * lift * (1 / (1 + z / 160)));
    path(band.world.map((p): [number, number] => [p[0], p[1]]));
    ctx.fill();
  }
  // Light through the sheet tints its shadow: black for opaque paper, the sheet's colour scaled by
  // what passes for the rest. Multiplied, that tints what it falls on; where it falls past `tinted`
  // (onto a surface outside this layer, which multiply cannot reach) it is a plain dark of the same strength.
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-in";
  const k = clamp(T + paper.glow * 0.3);
  ctx.fillStyle = lightThrough(paper.color, k);
  const inside = tinted ?? region;
  const ix = (inside.x - region.x) * dpr;
  const iy = (inside.y - region.y) * dpr;
  const iw = inside.width * dpr;
  const ih = inside.height * dpr;
  ctx.fillRect(ix, iy, iw, ih);
  if (tinted) {
    ctx.fillStyle = `rgba(0,0,0,${(1 - k * toOklch(paper.color)[0] ** 3).toFixed(3)})`;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(ix, iy, iw, ih);
    ctx.fill("evenodd");
  }
  ctx.globalCompositeOperation = "source-over";
}

// --- The sheet ------------------------------------------------------------------------------

export type CurlSheetProps = {
  layout: CurlLayout;
  paper: Paper;
  /** The content's size: the page, or the frame. */
  width: number;
  height: number;
  /** The sheet's two sides, laid out in content pixels. `back` is laid out as seen from its own side; `reflection` maps it. */
  front?: PageContent;
  back?: PageContent;
  reflection: string;
  /** What lies beneath the sheet, drawn crisp under it (in root pixels). Omit when the parent draws it. */
  under?: ReactNode;
  /** The same, for the strips' blurred views of it (a translucent sheet). */
  underCopy?: ReactNode;
  /** The area shadows may fall on, in root pixels. */
  region: Region;
  /**
   * Where the shadow can be multiplied over what it falls on (the pages: drawn in this layer). Past
   * it, a surface outside this layer gets a plain dark shadow. Default: all of `region`.
   */
  tinted?: Region;
  light?: Light;
  /** Shadow strength multiplier (default 1). */
  shadow?: number;
  /** Gutter shading at the hinge edge of the sheet's faces (in content pixels, whichever side is shown). */
  gutter?: FaceProps["gutter"];
  /** Give every strip a view of what is beneath (a translucent sheet). Default: when the paper lets anything through. */
  seeThrough?: boolean;
};

/**
 * A bent sheet over what lies beneath: the shadow it casts, then its strips
 * far to near, each a view of beneath (blurred by its height) under the
 * sheet's face.
 */
export function CurlSheet({
  layout,
  paper,
  width,
  height,
  front,
  back,
  reflection,
  under,
  underCopy,
  region,
  light = defaultLight,
  shadow = 1,
  gutter,
  seeThrough,
  tinted,
}: CurlSheetProps) {
  const id = useId().replace(/:/g, "");
  const ids = { dark: `${id}-d`, light: `${id}-l`, glow: `${id}-g` };
  const master = useRef<HTMLCanvasElement>(null);
  const copies = useRef<({ el: HTMLCanvasElement; box: Region } | null)[]>([]);
  const views = seeThrough ?? (paper.seeThrough > 0.015 && underCopy !== undefined);
  const { bands } = layout;
  copies.current.length = bands.length;

  useLayoutEffect(() => {
    const canvas = master.current;
    if (!canvas) return;
    drawShadows(canvas, region, bands, paper, light, shadow, tinted);
    // Each strip's view of beneath gets only its own piece of the shadow (whole copies would fill GPU memory at 2×).
    for (const copy of copies.current) {
      if (!copy) continue;
      const { el, box } = copy;
      const w = Math.max(1, Math.round(box.width * SHADOW_SCALE));
      const h = Math.max(1, Math.round(box.height * SHADOW_SCALE));
      if (el.width !== w) el.width = w;
      if (el.height !== h) el.height = h;
      const ctx = el.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, (box.x - region.x) * SHADOW_SCALE, (box.y - region.y) * SHADOW_SCALE, w, h, 0, 0, w, h);
    }
  });

  const canvasStyle: CSSProperties = {
    position: "absolute",
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    mixBlendMode: "multiply",
    pointerEvents: "none",
  };
  // The backlit glow runs in from the free edge (u = width), in content pixels.
  const glowLine = layout.line;
  const T = paper.seeThrough;
  return (
    <>
      {under}
      <canvas ref={master} style={canvasStyle} />
      <ShadeDefs ids={ids} layout={layout} glowLine={freeEdgeLine(glowLine, width, height)} />
      {bands.map((band, i) => {
        const xs = band.poly.map((p) => p[0]);
        const ys = band.poly.map((p) => p[1]);
        const blur = paper.blur + paper.scatter * Math.max(0, band.z);
        const margin = Math.ceil(blur * 3 + 2);
        const bx = Math.floor(Math.min(...xs)) - margin;
        const by = Math.floor(Math.min(...ys)) - margin;
        const bw = Math.ceil(Math.max(...xs)) + margin - bx;
        const bh = Math.ceil(Math.max(...ys)) + margin - by;
        const frontFacing = band.facing === "front";
        const top: FaceSide = frontFacing ? { node: front } : { node: back, reflect: true };
        const behind: FaceSide = frontFacing ? { node: back, reflect: true } : { node: front };
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bx,
              top: by,
              width: bw,
              height: bh,
              overflow: "hidden",
              clipPath: polygonCss(band.poly, bx, by),
            }}
          >
            {views && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  filter: blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : undefined,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -bx,
                    top: -by,
                    width: region.x + region.width,
                    height: region.y + region.height,
                  }}
                >
                  {underCopy}
                  <canvas
                    ref={(el) => {
                      copies.current[i] = el && { el, box: { x: bx, y: by, width: bw, height: bh } };
                    }}
                    style={{ ...canvasStyle, left: bx, top: by, width: bw, height: bh }}
                  />
                </div>
              </div>
            )}
            {faceParts({
              width,
              height,
              paper: views ? paper : { ...paper, seeThrough: 0 },
              top,
              under: behind,
              reflection,
              shadeIds: ids,
              gutter,
              solid: !views && T < 0.015,
              // Art whose parallax here is under a third of a pixel stays with the paper.
              snap: (depth) => (Math.abs(depth) * band.tilt < 0.3 ? 0 : depth),
              wrap: (depth, nodes, key) => (
                <div
                  key={key}
                  style={{
                    position: "absolute",
                    left: -bx,
                    top: -by,
                    width: band.box.width,
                    height: band.box.height,
                    overflow: "hidden",
                    transformOrigin: "0 0",
                    transform: homToCss(homAt(band.lift(depth), band.box.x, band.box.y)),
                  }}
                >
                  <div style={{ position: "absolute", left: -band.box.x, top: -band.box.y, width, height }}>
                    {nodes}
                  </div>
                </div>
              ),
            })}
          </div>
        );
      })}
    </>
  );
}

/** A gradient line from 18% of the way in to the free edge (u = width), in content pixels, from the w line. */
function freeEdgeLine(
  line: [number, number, number, number],
  _w: number,
  _h: number,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = line;
  return [x1 + (x2 - x1) * 0.82, y1 + (y2 - y1) * 0.82, x2, y2];
}
