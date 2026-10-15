import type { ReactNode } from "react";
import {
  type CurlShape,
  CurlSheet,
  defaultLight,
  type Light,
  layoutCurl,
  type PaperSpec,
  type Placement,
  polygonCss,
  resolvePaper,
} from "./paper.js";

/** Which edge (or corner) of the frame lifts first. */
export type CurlFrom = "right" | "left" | "top" | "bottom" | "top-right" | "bottom-right" | "top-left" | "bottom-left";

export type PageCurlOptions = {
  /** The edge or corner that lifts first (default "bottom-right": the corner a hand would take). */
  from?: CurlFrom;
  /** The sheet's paper (default "paper": opaque, glowing a little where light comes through its back). */
  paper?: PaperSpec;
  /** The tightest radius of the curl, as a share of the frame's shorter side (default 0.1). */
  radius?: number;
  /** Degrees the fold leans when a corner leads (default 24). */
  lean?: number;
  /** The camera's distance above the frame, in px (default 2.6 × its width): nearer is more perspective. */
  distance?: number;
  /** Direction toward the light, x right, y down, z up (default from the top left, high). */
  light?: [number, number, number];
  /** Strength of the shadow the sheet casts on the next shot, 0 to 1.5 (default 1). */
  shadow?: number;
};

const deg = Math.PI / 180;
const ramp = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const goneAt = new Map<string, number>();

/** Whether two convex polygons do not overlap: some edge of one has the whole other on its outer side. */
function apart(a: [number, number][], b: [number, number][]) {
  const separates = (p: [number, number][], q: [number, number][]) => {
    // Winding of p, so "outer" is the same side for every edge.
    let area = 0;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      area += x1 * y2 - x2 * y1;
    }
    const s = Math.sign(area) || 1;
    return p.some(([x1, y1], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      return q.every(([x, y]) => s * ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) < 0);
    });
  };
  return separates(a, b) || separates(b, a);
}

/**
 * The outgoing shot as a sheet of paper peeling away: its edge or corner
 * lifts, the fold sweeps across and the sheet rolls back over itself until
 * it has left the frame, its back (paper, with a ghost of the print through
 * it) showing as it turns over, its shadow soft on the next shot and tight
 * along the fold. `e` runs 0 (flat) to 1 (gone), already eased.
 */
export function PageCurl({
  e,
  width,
  height,
  out,
  in: incoming,
  from = "bottom-right",
  paper: paperSpec = "paper",
  radius = 0.1,
  lean = 24,
  distance,
  light: lightDir,
  shadow = 1,
}: PageCurlOptions & { e: number; width: number; height: number; out: ReactNode; in: ReactNode }) {
  const paper = resolvePaper(paperSpec);
  const edge = from.includes("right") ? "right" : from.includes("left") ? "left" : from;
  // The corner with the largest w bends first: negative alpha leads with the bottom one.
  const corner = from.includes("-") ? (from.startsWith("top") ? 1 : -1) : 0;
  const along = edge === "right" || edge === "left";
  const W = along ? width : height;
  const H = along ? height : width;
  const place: Placement =
    edge === "right"
      ? { origin: [0, 0], u: [1, 0], v: [0, 1], content: [1, 0, 0, 0, 1, 0] }
      : edge === "left"
        ? { origin: [width, 0], u: [-1, 0], v: [0, 1], content: [-1, 0, width, 0, 1, 0] }
        : edge === "bottom"
          ? { origin: [0, 0], u: [0, 1], v: [1, 0], content: [0, 1, 0, 1, 0, 0] }
          : { origin: [0, height], u: [0, -1], v: [1, 0], content: [0, -1, height, 1, 0, 0] };
  const reflection = along ? `matrix(-1,0,0,1,${width},0)` : `matrix(1,0,0,-1,0,${height})`;

  // The fold sweeps from the free edge to past the far one, rolling over a curl that loosens as it goes.
  const alpha = corner * lean * deg;
  const sa = Math.abs(Math.sin(alpha));
  const wLo = -(H / 2) * sa;
  const wHi = W * Math.cos(alpha) + (H / 2) * sa;
  const rAt = (k: number) => radius * Math.min(width, height) * (0.75 + 0.9 * k);
  const thetaAt = (k: number) => lerp(150, 176, Math.min(1, k * 2.2)) * deg;
  const r = rAt(e);
  const theta = thetaAt(e);
  const light: Light = lightDir
    ? {
        dir: (() => {
          const l = Math.hypot(...lightDir) || 1;
          return [lightDir[0] / l, lightDir[1] / l, lightDir[2] / l] as [number, number, number];
        })(),
        softness: defaultLight.softness,
      }
    : defaultLight;
  const eye = { x: width / 2, y: height / 2, distance: distance ?? 2.6 * width };
  const shapeAt = (fold: number, rr: number, th: number): CurlShape => ({
    width: W,
    height: H,
    alpha,
    pivot: H / 2,
    hinge: 0,
    start: fold,
    end: fold + 2 * rr * th,
    bend: (w) => th * ramp((w - fold) / (2 * rr * th)),
  });
  // Where the fold is when the sheet has just left the frame (with a margin for its soft shadow), found once.
  const key = `${width}x${height}:${from}:${radius}:${lean}:${eye.distance}`;
  let gone = goneAt.get(key);
  if (gone === undefined) {
    const rr = rAt(1);
    const th = thetaAt(1);
    const margin = 0.25 * rr;
    const box: [number, number][] = [
      [-margin, -margin],
      [width + margin, -margin],
      [width + margin, height + margin],
      [-margin, height + margin],
    ];
    const outside = (fold: number) =>
      layoutCurl(shapeAt(fold, rr, th), place, eye, {
        paper,
        light,
        skipFlat: true,
        maxStep: 10 * deg,
        maxLen: 400,
      }).bands.every((b) => apart(b.poly, box));
    let lo = wLo - 4 * rr * th; // surely gone
    let hi = wHi; // surely there
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      if (outside(mid)) lo = mid;
      else hi = mid;
    }
    gone = lo;
    goneAt.set(key, gone);
  }
  const fold = lerp(wHi, gone, e);
  const shape = shapeAt(fold, r, theta);
  const layout = layoutCurl(shape, place, eye, {
    paper,
    light,
    skipFlat: true,
    maxStep: 5 * deg,
    maxLen: 140,
    bounce: 0.4,
  });
  const frame = { x: 0, y: 0, width, height };
  // Under the sheet: the next shot, and the part of this one still lying flat.
  const under = (
    <>
      <div style={{ position: "absolute", inset: 0 }}>{incoming}</div>
      {layout.flatPoly && layout.flatPoly.length > 2 && (
        <div style={{ position: "absolute", inset: 0, clipPath: polygonCss(layout.flatPoly) }}>{out}</div>
      )}
    </>
  );
  return (
    <div data-launch-check="off" style={{ position: "absolute", inset: 0 }}>
      <CurlSheet
        layout={layout}
        paper={paper}
        width={width}
        height={height}
        front={out}
        reflection={reflection}
        under={under}
        underCopy={under}
        region={frame}
        tinted={frame}
        light={light}
        shadow={shadow}
        // Copies of both shots in every strip cost; only a sheet you can see through needs them.
        seeThrough={paper.seeThrough >= 0.1}
      />
    </div>
  );
}
