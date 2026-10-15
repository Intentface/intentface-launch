import type { CSSProperties, ReactNode } from "react";
import { toOklch } from "../engine/color.js";
import { useFrame } from "../engine/timeline.js";
import {
  type CurlShape,
  CurlSheet,
  clamp,
  defaultLight,
  Face,
  isDisplay,
  type Light,
  layoutCurl,
  type PageContent,
  type Paper,
  type PaperSpec,
  papers,
  REFRESH_FRAMES,
  resolvePaper,
} from "./paper.js";

export type Leaf = {
  /**
   * The leaf's front: the right-hand page before it turns, laid out at the
   * page's size with its spine on the left. Any React node, or art in layers
   * (`{ layers: [{ depth: -2, node }, { depth: 0, node }, { depth: 5, node }] }`)
   * that float `depth` px above the page and shift in parallax as it turns.
   */
  front?: PageContent;
  /** Its back: the left-hand page once turned, laid out as that page (spine on the right). */
  back?: PageContent;
  /** This leaf's paper, over the book's `paper`. */
  paper?: PaperSpec;
};

export type PageFlipProps = {
  /** One page's size in px; the spread is twice as wide. */
  width: number;
  height: number;
  /** The page on the left that never turns (the inside cover). */
  left?: PageContent;
  /** The leaves on the right, top first. Turning leaf 0 lays its back over `left`. */
  leaves: Leaf[];
  /** The page under every leaf on the right (the last page). */
  right?: PageContent;
  /**
   * How far the book has turned, in leaves: 0 shut on the first spread, 2.35
   * is two leaves over and the third 35% of the way. Drive it from the frame
   * (`interpolate`, `springTo`); a function of the frame also tells the leaf
   * which way it is going.
   */
  turn: number | ((frame: number) => number);
  /** Which way a leaf in flight is going, when `turn` is a number (default "forward": right to left). */
  direction?: "forward" | "back";
  /** The leaves' paper (default "paper"): a preset, a see-through amount from 0 to 1, or overrides. */
  paper?: PaperSpec;
  /** The colour of the two pages that never turn (default a warm white). */
  pageColor?: string;
  /** Degrees the turning leaf leans as it goes, the bottom corner leading (default 9; negative: the top leads). */
  lean?: number;
  /** How much the leaf bends as it turns, 0 (a stiff card) to 1.5 (default 1). */
  curl?: number;
  /** The camera's distance above the spread, in px (default 2.2 × the spread's width): nearer is more perspective. */
  distance?: number;
  /** Direction toward the light, x right, y down, z up (default from the top left, high). */
  light?: [number, number, number];
  /** How soft shadows are: penumbra px per px of height (default 0.16). */
  softness?: number;
  /** Strength of the shadows the leaf casts, 0 to 1.5 (default 1). */
  shadow?: number;
  /** The book's shadow on the surface under it, 0 to 1 (default 0.8). */
  dropShadow?: number;
  /** Shading into the spine on every page, 0 to 1 (default 0.8). */
  gutter?: number;
  /** Visible thickness of the page block at the edges, in px (default 3). */
  thickness?: number;
  /**
   * The surface under the book, as CSS (`"#16171a"`): seen through a
   * translucent leaf where it lifts past the book's edge. Without it, the
   * surface there shows unblurred.
   */
  surface?: string;
  /**
   * Pages whose art is in layers are displays (e-ink): when a leaf lands, the
   * top display on each side redraws once over this many frames: a negative
   * flash, then the art dithering into place (default 9; 0 for none). Needs
   * `turn` as a function of the frame, to know when it landed.
   */
  refresh?: number;
  /** Measure the pages' text with `check` (default false: page content, not overlay copy). */
  check?: boolean;
  style?: CSSProperties;
};

// --- How a leaf turns -------------------------------------------------------------------

type Key = [number, number];

/** Smooth through keys (cubic Hermite, Catmull-Rom tangents): no kinks, so the motion has none. */
function through(keys: Key[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const [x0, y0] = keys[i];
  const [x1, y1] = keys[i + 1];
  const slope = (j: number) => {
    const a = keys[Math.max(0, j - 1)];
    const b = keys[Math.min(keys.length - 1, j + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const h = x1 - x0;
  const s = (t - x0) / h;
  const m0 = (i === 0 ? 0 : slope(i)) * h;
  const m1 = (i + 1 === keys.length - 1 ? 0 : slope(i + 1)) * h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * m1;
}

const deg = Math.PI / 180;

// A hand lifts the outer edge (the edge leads and curls up while the spine end
// still lies flat), carries the leaf over in an arch, lets go; the spine end
// lands first and the outer edge floats down last, trailing.
const HINGE: Key[] = [
  [0, 0],
  [0.07, 1.5],
  [0.25, 26],
  [0.45, 78],
  [0.62, 126],
  [0.78, 163],
  [0.9, 178.5],
  [1, 180],
];
// The inner half reverses first while the outer half still leads: an S travels out along the leaf,
// so it is never a flat card on its way over.
const OUTER: Key[] = [
  [0, 0],
  [0.06, 36],
  [0.17, 70],
  [0.32, 68],
  [0.48, 54],
  [0.6, 38],
  [0.7, 14],
  [0.8, -18],
  [0.9, -18],
  [1, 0],
];
const INNER: Key[] = [
  [0, 0],
  [0.12, 8],
  [0.3, 28],
  [0.42, 22],
  [0.52, 0],
  [0.62, -24],
  [0.74, -26],
  [0.85, -12],
  [0.93, -3],
  [1, 0],
];
const LEAN: Key[] = [
  [0, 0],
  [0.1, 0.75],
  [0.35, 1],
  [0.6, 0.65],
  [0.85, 0.15],
  [1, 0],
];

/** Raised-cosine ramp: 0 to 1 over [0, 1] with no jump in curvature at either end. */
const ramp = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));

/**
 * The shape of a leaf `p` of the way over (0 lying on the right, 1 on the
 * left), turning forward or back. Going back is the forward turn mirrored, so
 * the edge leads whichever way it goes.
 */
export function leafShape(
  p: number,
  width: number,
  height: number,
  { lean = 9, curl = 1, back = false }: { lean?: number; curl?: number; back?: boolean } = {},
): CurlShape {
  const q = back ? 1 - p : p;
  const sign = back ? -1 : 1;
  const hinge = through(HINGE, q) * deg;
  const outer = through(OUTER, q) * deg * curl * sign;
  const inner = through(INNER, q) * deg * curl * sign;
  // Negative: w is largest at the bottom outer corner, so it bends first and leads.
  const alpha = -through(LEAN, q) * lean * deg;
  // Bending starts past the spine's own span of w, so the whole spine stays on the hinge line.
  const ws = (height / 2) * Math.abs(Math.sin(alpha)) + 4;
  const wHi = width * Math.cos(alpha) + (height / 2) * Math.abs(Math.sin(alpha));
  const span = Math.max(1, wHi - ws);
  const ai = ws;
  const bi = ws + span * 0.62;
  const ao = ws + span * 0.32;
  const bo = wHi;
  return {
    width,
    height,
    alpha,
    pivot: height / 2,
    hinge: back ? Math.PI - hinge : hinge,
    start: ai,
    end: bo,
    bend: (w) => inner * ramp((w - ai) / (bi - ai)) + outer * ramp((w - ao) / (bo - ao)),
  };
}

// --- The book ---------------------------------------------------------------------------------

type Layer = { node?: PageContent; behind?: PageContent; paper: Paper; base?: boolean };

/** A stack of pages lying flat, bottom first: each translucent leaf shows the stack under it, blurred by the paper. */
function Stack({
  layers,
  width,
  height,
  gutter,
  refresh,
}: {
  layers: Layer[];
  width: number;
  height: number;
  gutter: Gutter;
  refresh?: number;
}) {
  const reflection = `matrix(-1,0,0,1,${width},0)`;
  // The display that redraws: the top page if it is one, or the first under the translucent sheets on it.
  let redraw = -1;
  for (let i = layers.length - 1; i >= 0; i--) {
    if (isDisplay(layers[i].node)) {
      redraw = i;
      break;
    }
    if (layers[i].base || layers[i].paper.seeThrough < 0.1) break;
  }
  const draw = (i: number): ReactNode => {
    const layer = layers[i];
    if (!layer) return null;
    if (layer.base) {
      return (
        <Face
          width={width}
          height={height}
          paper={layer.paper}
          top={{ node: layer.node }}
          under={{}}
          reflection={reflection}
          gutter={gutter}
          solid
          refresh={i === redraw ? refresh : undefined}
        />
      );
    }
    const T = layer.paper.seeThrough;
    return (
      <>
        {T > 0.015 && (
          <div style={{ position: "absolute", inset: 0, filter: `blur(${layer.paper.blur}px)` }}>{draw(i - 1)}</div>
        )}
        <Face
          width={width}
          height={height}
          paper={layer.paper}
          top={{ node: layer.node }}
          under={{ node: layer.behind, reflect: true }}
          reflection={reflection}
          gutter={gutter}
          refresh={i === redraw ? refresh : undefined}
        />
      </>
    );
  };
  return <>{draw(layers.length - 1)}</>;
}

type Gutter = { side: "left" | "right"; amount: number };

/**
 * An open book or magazine seen from above, whose leaves turn frame by
 * frame: each curls as it goes (the outer edge lifts first and leads, the
 * spine end lands first and the edge floats down last), shaded across its
 * bend, casting a soft shadow that tightens where it nears the page. Leaves
 * can be any paper: `film` (clear plastic: the page beneath stays sharp, the
 * sheet shows as a sheen and an edge), `vellum` and `parchment` (frosted:
 * the page beneath shows blurred, more the higher the sheet lifts, and a
 * lifted sheet glows where light comes through it), `paper` (opaque but for
 * a faint shadow of the other side's print), or any see-through amount
 * between 0 and 1. Page content is ordinary React, laid out at the page's
 * size; it is not checked as overlay copy.
 *
 *   <PageFlip width={560} height={760} left={<Inside />} leaves={[{ front: <P1 />, back: <P2 />, paper: "vellum" }]}
 *     turn={interpolate(frame, [30, 90], [0, 1], { easing: ease.inOut })} />
 *
 * A turn reads at about 2 beats (60 frames at 120 BPM) on `ease.inOut` or a
 * spring with no bounce. Each turning frame draws the pages once per strip
 * of the bend (20 to 40), so keep page content to DOM, not video or 3D.
 */
export function PageFlip({
  width: W,
  height: H,
  left,
  leaves,
  right,
  turn,
  direction = "forward",
  paper: bookPaper = "paper",
  pageColor = "#faf8f3",
  lean = 9,
  curl = 1,
  distance,
  light: lightDir,
  softness = 0.16,
  shadow = 1,
  dropShadow = 0.8,
  gutter = 0.8,
  thickness = 3,
  surface,
  refresh = REFRESH_FRAMES,
  check = false,
  style,
}: PageFlipProps) {
  const frame = useFrame();
  // Frames since a leaf last landed (the turn came to rest on a whole leaf), for the displays' redraw.
  let landed: number | undefined;
  if (typeof turn === "function" && refresh > 0) {
    const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-4;
    for (let k = 0; k < refresh; k++) {
      if (!whole(turn(frame - k))) break;
      if (!whole(turn(frame - k - 1))) {
        landed = (k * REFRESH_FRAMES) / refresh;
        break;
      }
    }
  }
  const at = typeof turn === "function" ? turn(frame) : turn;
  const back =
    typeof turn === "function" ? turn(frame) < turn(frame - 0.5) - 1e-9 || direction === "back" : direction === "back";
  const n = leaves.length;
  const t = clamp(at, 0, n);
  const k = Math.min(n - 1, Math.floor(t));
  const p = t - k;
  const flying = n > 0 && p > 1e-4 && p < 1 - 1e-4;
  const turned = flying ? k : Math.round(t);
  const base = resolvePaper(bookPaper);
  const paperOf = (leaf: Leaf) => (leaf.paper === undefined ? base : resolvePaper(leaf.paper, base));
  const page: Paper = { ...papers.paper, color: pageColor, grain: base.grain > 0 ? 0.12 : 0 };
  const light: Light = {
    dir: lightDir
      ? (() => {
          const l = Math.hypot(...lightDir) || 1;
          return [lightDir[0] / l, lightDir[1] / l, lightDir[2] / l] as [number, number, number];
        })()
      : defaultLight.dir,
    softness,
  };

  // Left: the cover's inside, then each turned leaf with its back up. Right: the last page, then the leaves still to turn.
  const leftLayers: Layer[] = [{ node: left, paper: page, base: true }];
  for (let i = 0; i < turned; i++)
    leftLayers.push({ node: leaves[i].back, behind: leaves[i].front, paper: paperOf(leaves[i]) });
  const rightLayers: Layer[] = [{ node: right, paper: page, base: true }];
  for (let i = n - 1; i >= turned + (flying ? 1 : 0); i--)
    rightLayers.push({ node: leaves[i].front, behind: leaves[i].back, paper: paperOf(leaves[i]) });

  const spread = (copy: boolean) => (
    <Spread
      copy={copy}
      width={W}
      height={H}
      leftLayers={leftLayers}
      rightLayers={rightLayers}
      gutter={gutter}
      dropShadow={dropShadow}
      thickness={thickness}
      surface={surface}
      pageColor={pageColor}
      refresh={landed}
    />
  );

  let sheet: ReactNode = null;
  if (flying) {
    const leaf = leaves[k];
    const paper = paperOf(leaf);
    const shape = leafShape(p, W, H, { lean, curl, back });
    const eye = { x: W, y: H / 2, distance: distance ?? 4.4 * W };
    const layout = layoutCurl(
      shape,
      { origin: [W, 0], u: [1, 0], v: [0, 1], content: [1, 0, 0, 0, 1, 0] },
      eye,
      // A light page under a lifted sheet lights its underside; a black one hardly does.
      { paper, light, maxStep: 4.5 * deg, maxLen: W / 9, bounce: 0.75 * toOklch(pageColor)[0] ** 3 },
    );
    const margin = H * 0.3;
    sheet = (
      <CurlSheet
        layout={layout}
        paper={paper}
        width={W}
        height={H}
        front={leaf.front}
        back={leaf.back}
        reflection={`matrix(-1,0,0,1,${W},0)`}
        under={spread(false)}
        underCopy={spread(true)}
        region={{ x: -margin, y: -margin, width: 2 * W + 2 * margin, height: H + 2 * margin }}
        tinted={{ x: 0, y: 0, width: 2 * W, height: H }}
        light={light}
        shadow={shadow}
        gutter={{ side: "left", amount: gutter }}
      />
    );
  }

  return (
    <div
      data-launch-check={check ? undefined : "off"}
      style={{ position: "relative", width: 2 * W, height: H, ...style }}
    >
      {flying ? sheet : spread(false)}
    </div>
  );
}

function Spread({
  copy,
  width: W,
  height: H,
  leftLayers,
  rightLayers,
  gutter,
  dropShadow,
  thickness,
  surface,
  pageColor,
  refresh,
}: {
  refresh?: number;
  copy: boolean;
  width: number;
  height: number;
  leftLayers: Layer[];
  rightLayers: Layer[];
  gutter: number;
  dropShadow: number;
  thickness: number;
  surface?: string;
  pageColor: string;
}) {
  const th = thickness;
  const block = (side: "left" | "right"): CSSProperties => ({
    position: "absolute",
    top: -th * 0.35,
    height: H + th * 1.1,
    left: side === "left" ? -th : W,
    width: W + th,
    background: `color-mix(in srgb, ${pageColor} 86%, #6b6458)`,
    backgroundImage: `repeating-linear-gradient(${side === "left" ? 90 : 270}deg, rgba(0,0,0,0.12) 0 0.5px, rgba(255,255,255,0.35) 0.5px 1px)`,
    borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
  });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 2 * W, height: H }}>
      {/* In a strip's view of beneath, the surface fills in around the book (the real one is the caller's, outside). */}
      {copy && surface && <div style={{ position: "absolute", inset: -H * 0.6, background: surface }} />}
      {dropShadow > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: `0 1px 2px rgba(0,0,0,${0.3 * dropShadow}), 0 10px 24px rgba(0,0,0,${0.28 * dropShadow}), 0 34px 80px rgba(0,0,0,${0.32 * dropShadow})`,
          }}
        />
      )}
      {th > 0 && (
        <>
          <div style={block("left")} />
          <div style={block("right")} />
        </>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
        <Stack layers={leftLayers} width={W} height={H} gutter={{ side: "right", amount: gutter }} refresh={refresh} />
      </div>
      <div style={{ position: "absolute", left: W, top: 0, width: W, height: H, overflow: "hidden" }}>
        <Stack layers={rightLayers} width={W} height={H} gutter={{ side: "left", amount: gutter }} refresh={refresh} />
      </div>
      {gutter > 0 && (
        <div
          style={{
            position: "absolute",
            left: W - 1,
            top: 0,
            width: 2,
            height: H,
            background: `rgba(0,0,0,${0.18 * gutter})`,
          }}
        />
      )}
    </div>
  );
}
