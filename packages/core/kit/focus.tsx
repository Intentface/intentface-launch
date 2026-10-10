import { type CSSProperties, type ReactNode, useId } from "react";
import {
  ease,
  overshootEase,
  progress,
  type SpringConfig,
  type SpringTarget,
  springTo,
  useFrame,
  useVideoInfo,
} from "../engine/index.js";
import { type Rect, useCameraView, type View } from "./camera.js";
import type { Point } from "./cursor.js";

export type FocusProps = {
  children?: ReactNode;
  /**
   * What stays sharp, in output pixels. To follow a rect inside a `Camera`,
   * map it with `toScreen(rect, cameraAt(keys, frame, w, h), w, h)`.
   */
  area: Rect;
  /** Blur at the frame's edge, in output pixels (default 14). 0 for fade only. */
  blur?: number;
  /** How far the background colour covers the edge, 0 to 1 (default 0.55). */
  fade?: number;
  /** The colour faded towards: the shot's background (default black). */
  color?: string;
  /** Width of the falloff beyond the area, as a fraction of the area's half size (default 0.9). */
  feather?: number;
  style?: CSSProperties;
};

/** A content rect as it lands on the output through a camera view (no rotation). */
export function toScreen(rect: Rect, view: View, width: number, height: number): Rect {
  return {
    x: (rect.x - view.x) * view.zoom + width / 2,
    y: (rect.y - view.y) * view.zoom + height / 2,
    width: rect.width * view.zoom,
    height: rect.height * view.zoom,
  };
}

/**
 * Depth around what matters in a flat shot: outside a feathered ellipse around
 * `area`, everything behind this layer blurs and fades towards the background,
 * more the further it is, like a lens focused on the subject. Put it over the
 * shot's UI (after it in the tree, before overlay text that must stay sharp).
 * The blur is three stacked backdrop filters with widening sharp cores, so it
 * grows with distance instead of stepping at one edge.
 */
export function Focus({ children, area, blur = 14, fade = 0.55, color = "#000", feather = 0.9, style }: FocusProps) {
  const { width, height } = useVideoInfo();
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  // Ellipse radii: the area's half size, never smaller than a sliver of the frame. The sharp core
  // of each layer is `start` × the ellipse through the area's corners (√2 × the radii); every
  // layer reaches full strength at (1 + feather) × that ellipse.
  const rx = Math.max(area.width / 2, width * 0.04);
  const ry = Math.max(area.height / 2, height * 0.04);
  const mask = (start: number) => {
    const g = `radial-gradient(${rx * (1 + feather) * Math.SQRT2}px ${ry * (1 + feather) * Math.SQRT2}px at ${cx}px ${cy}px, transparent ${(start * 100) / (1 + feather)}%, black 100%)`;
    return { maskImage: g, WebkitMaskImage: g };
  };
  const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
  return (
    <div style={{ position: "absolute", inset: 0, ...style }}>
      {children}
      {blur > 0 &&
        [0.9, 1.25, 1.6].map((start) => (
          <div key={start} style={{ ...layer, ...mask(start), backdropFilter: `blur(${blur / 3}px)` }} />
        ))}
      {fade > 0 && <div style={{ ...layer, ...mask(1), background: color, opacity: fade }} />}
    </div>
  );
}

/**
 * The region a full-frame layer must cover, in the coordinates it is drawn in.
 * Outside a Camera that is the frame. Inside one it is the content the camera
 * sees at this frame, with room for rotation, so a dim layer laid in content
 * space still reaches every edge of the picture while the camera moves.
 */
function useCover(): Rect & { zoom: number } {
  const { width, height } = useVideoInfo();
  const view = useCameraView();
  if (!view) return { x: 0, y: 0, width, height, zoom: 1 };
  const r = (Math.hypot(width, height) / 2 / view.zoom) * 1.1;
  return { x: view.x - r, y: view.y - r, width: r * 2, height: r * 2, zoom: view.zoom };
}

/** A target that moves between rects: each change springs from where it is, as `springTo` does. */
export type AreaStop = { at: number; area: Rect };

/** The rect at `frame`: a fixed one, or stops eased into one another on springs. */
export function areaAt(area: Rect | AreaStop[], frame: number, fps: number, spring: SpringConfig): Rect {
  if (!Array.isArray(area)) return area;
  const along = (key: keyof Rect) =>
    springTo(
      frame,
      fps,
      area.map((s) => ({ at: s.at, to: s.area[key] })),
      spring,
    );
  return { x: along("x"), y: along("y"), width: along("width"), height: along("height") };
}

export type SpotlightProps = {
  /**
   * What stays lit: a rect, or stops it travels between (`[{ at, area }]`).
   * Inside a Camera, content pixels (it follows the UI as the camera moves);
   * outside one, output pixels.
   */
  area: Rect | AreaStop[];
  /** Frame the dim starts to come in (default 0). */
  at?: number;
  /** Frames the dim takes to come in (default 18, `ease.soft`). */
  duration?: number;
  /** Frame it starts to lift again. */
  exit?: number;
  /** Frames it takes to lift (default 12: closes are quicker than opens). */
  exitDuration?: number;
  /** How dark the rest gets, 0 to 1 (default 0.6). */
  dim?: number;
  /** Colour it dims towards (default black; the shot's background on a light UI). */
  color?: string;
  /** Corner radius of the cut-out (default 16): the element's own, plus `padding`. */
  radius?: number;
  /** Room around the area (default 12), so the lit element does not touch the dim. */
  padding?: number;
  /** Softness of the cut-out's edge, in output pixels at any zoom (default 24). */
  feather?: number;
  /** How the cut-out moves between stops (default 30 frames, no bounce). */
  spring?: SpringConfig;
};

/**
 * Dim everything except one rounded rect: the "look here" of a UI demo. The
 * cut-out can travel between elements (one spring per change, so a retarget
 * keeps its speed) and its edge is feathered, so it reads as light rather
 * than a hole punched in a sheet. Put it after the UI it dims. For depth
 * instead of darkness use `Focus`; to raise the element itself, `Lift`; to
 * push in on it, the Camera.
 */
export function Spotlight({
  area,
  at = 0,
  duration = 18,
  exit,
  exitDuration = 12,
  dim = 0.6,
  color = "#000",
  radius = 16,
  padding = 12,
  feather = 24,
  spring = { duration: 30 },
}: SpotlightProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const cover = useCover();
  const id = useId();
  const amount =
    progress(frame, at, duration, ease.soft) *
    (exit === undefined ? 1 : 1 - progress(frame, exit, exitDuration, ease.soft));
  if (amount <= 0) return null;
  const r = areaAt(area, frame, fps, spring);
  const blur = feather / 2 / cover.zoom;
  const box = { x: cover.x, y: cover.y, width: cover.width, height: cover.height };
  return (
    <svg
      aria-hidden
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <filter id={`${id}f`} filterUnits="userSpaceOnUse" {...box}>
          <feGaussianBlur stdDeviation={blur} />
        </filter>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" {...box}>
          <rect {...box} fill="white" />
          <rect
            x={r.x - padding}
            y={r.y - padding}
            width={r.width + padding * 2}
            height={r.height + padding * 2}
            rx={radius + padding}
            fill="black"
            filter={blur > 0.05 ? `url(#${id}f)` : undefined}
          />
        </mask>
      </defs>
      <rect {...box} fill={color} opacity={dim * amount} mask={`url(#${id}m)`} />
    </svg>
  );
}

export type LiftProps = {
  /** The element, laid out where it sits in the UI (a copy over the original, or a `Snapshot` with `api.isolate`). */
  children: ReactNode;
  /** Where the element is, in the same coordinates: the lift scales from its centre and its shadow takes its shape. */
  rect: Rect;
  /** Frame it starts to rise. */
  at: number;
  /** Frame it settles back down. */
  release?: number;
  /** Scale at the top of the lift (default 1.04: a card, not a zoom). */
  scale?: number;
  /** Pixels it rises (default 10). */
  rise?: number;
  /** The element's corner radius, for the shadow (default 12). */
  radius?: number;
  /** Shadow strength at the top, 0 to 1 (default 0.35). */
  shadow?: number;
  /** How dark the rest gets (default 0.45). 0 lifts without dimming. */
  dim?: number;
  /** Colour the rest dims towards (default black). */
  color?: string;
  /** The rise (default 27 frames with a 0.12 bounce: the positive state may settle; the return lands flat). */
  spring?: SpringConfig;
};

/**
 * Isolate and lift: one element rises off the page on a spring, a little
 * larger, with a soft shadow growing under it, while the rest dims on its own
 * slower clock. The UI equivalent of picking a card up to show it. Put it
 * after the UI in the tree: it draws the dim, then the shadow, then the
 * children on top.
 */
export function Lift({
  children,
  rect,
  at,
  release,
  scale = 1.04,
  rise = 10,
  radius = 12,
  shadow = 0.35,
  dim = 0.45,
  color = "#000",
  spring = { duration: 27, bounce: 0.12 },
}: LiftProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const cover = useCover();
  const targets: SpringTarget[] = [
    { at, to: 0 },
    { at, to: 1 },
  ];
  if (release !== undefined) targets.push({ at: release, to: 0, spring: { duration: 21 } });
  const lift = springTo(frame, fps, targets, spring);
  const dark =
    progress(frame, at, 24, ease.soft) * (release === undefined ? 1 : 1 - progress(frame, release, 18, ease.soft));
  const up = Math.max(0, lift);
  const transform = `translateY(${-rise * lift}px) scale(${1 + (scale - 1) * lift})`;
  const origin = `${rect.x + rect.width / 2}px ${rect.y + rect.height / 2}px`;
  return (
    <>
      {dim > 0 && dark > 0 && (
        <div
          style={{
            position: "absolute",
            left: cover.x,
            top: cover.y,
            width: cover.width,
            height: cover.height,
            background: color,
            opacity: dim * dark,
            pointerEvents: "none",
          }}
        />
      )}
      {up > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            borderRadius: radius,
            transform,
            boxShadow: `0 ${4 * up}px ${12 * up}px rgb(0 0 0 / ${shadow * 0.5 * Math.min(1, up)}), 0 ${26 * up}px ${64 * up}px rgb(0 0 0 / ${shadow * Math.min(1, up)})`,
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, transformOrigin: origin, transform, pointerEvents: "none" }}>
        {children}
      </div>
    </>
  );
}

export type CalloutPlacement =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "top"
  | "bottom";

const DIRECTIONS: Record<CalloutPlacement, [number, number]> = {
  "top-left": [-1, -1],
  "top-right": [1, -1],
  "bottom-left": [-1, 1],
  "bottom-right": [1, 1],
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

export type CalloutProps = {
  /** The label: a few words naming what the target is. */
  children: ReactNode;
  /** What it points at: a point, or a rect (the line starts on its edge). Content pixels inside a Camera. */
  target: Point | Rect;
  /** Frame the dot lands; the line draws from it, then the label arrives. */
  at?: number;
  /** Frame it fades out (quietly, in place). */
  exit?: number;
  /**
   * Where the label goes from the target (default "auto": diagonally toward
   * the side of the frame with more room, from where the target is at this
   * frame; give one when the camera crosses the target during the callout,
   * or it may change sides).
   */
  placement?: CalloutPlacement | "auto";
  /** Length of the leader's first leg, in output pixels (default 96). */
  length?: number;
  /** Length of the horizontal run into the label on a diagonal (default 36). */
  run?: number;
  /** Frames the line takes to draw (default 18). */
  draw?: number;
  /** Line, dot and label text colour (default white). */
  color?: string;
  /** Label fill (default near-black). `"none"` for bare text. */
  background?: string;
  /** A darker edge around the line and dot, so a white line still reads over white UI (default translucent black; `"none"` to drop it). */
  halo?: string;
  /** Label size in output pixels at any zoom (default 30; 28 is the floor for text a viewer reads at 1080p). */
  fontSize?: number;
  /** Line width in output pixels (default 3). */
  lineWidth?: number;
  style?: CSSProperties;
};

/**
 * A label with a leader line to what it names: the dot lands on the target,
 * the line draws out from it, and the label arrives at the line's end, sliding
 * a little along it. Sizes are on-screen pixels, so it stays readable at any
 * camera zoom while its position follows the content.
 */
export function Callout({
  children,
  target,
  at = 0,
  exit,
  placement = "auto",
  length = 96,
  run = 36,
  draw = 18,
  color = "#fff",
  background = "rgb(17 17 17 / 0.88)",
  halo = "rgb(0 0 0 / 0.3)",
  fontSize = 30,
  lineWidth = 3,
  style,
}: CalloutProps) {
  const frame = useFrame();
  const { width, height } = useVideoInfo();
  const view = useCameraView();
  const s = 1 / (view?.zoom ?? 1);
  const out = exit === undefined ? 0 : progress(frame, exit, 9, ease.soft);
  if (frame < at || out >= 1) return null;
  const rect = "width" in target ? target : null;
  const c = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : target;
  let dir: [number, number];
  if (placement === "auto") {
    const screen = view ? { x: (c.x - view.x) * view.zoom + width / 2, y: (c.y - view.y) * view.zoom + height / 2 } : c;
    dir = [screen.x > width / 2 ? -1 : 1, screen.y > height / 2 ? -1 : 1];
  } else dir = DIRECTIONS[placement];
  const [sx, sy] = dir;
  const diagonal = sx !== 0 && sy !== 0;
  const start = rect
    ? { x: c.x + (sy === 0 ? (sx * rect.width) / 2 : (sx * rect.width) / 4), y: c.y + (sy * rect.height) / 2 }
    : c;
  const leg = length * s;
  const elbow = diagonal
    ? { x: start.x + (sx * leg) / Math.SQRT2, y: start.y + (sy * leg) / Math.SQRT2 }
    : { x: start.x + sx * leg, y: start.y + sy * leg };
  const end = diagonal ? { x: elbow.x + sx * run * s, y: elbow.y } : elbow;
  const dot = progress(frame, at, 12, overshootEase(0.25));
  const line = progress(frame, at + 4, draw, ease.out);
  const label = progress(frame, at + 4 + draw * 0.6, 15, ease.out);
  const gap = 10 * s;
  // The label's anchor: beside the run's end, or centred over or under a vertical leader.
  const anchor = sx === 0 ? `translate(-50%, ${sy < 0 ? "-100%" : "0"})` : `translate(${sx < 0 ? "-100%" : "0"}, -50%)`;
  const slide = (1 - label) * 10 * s;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: 1 - out }}>
      <svg
        aria-hidden
        width={1}
        height={1}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
        }}
      >
        {[halo, color].map((stroke, i) =>
          stroke === "none" ? null : (
            <g key={i}>
              {line > 0 && (
                <path
                  d={`M${start.x} ${start.y}L${elbow.x} ${elbow.y}L${end.x} ${end.y}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={(lineWidth + (i ? 0 : 3)) * s}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - line}
                />
              )}
              <circle cx={start.x} cy={start.y} r={(6 + (i ? 0 : 1.5)) * s * dot} fill={stroke} />
              <circle
                cx={start.x}
                cy={start.y}
                r={12 * s * dot}
                fill="none"
                stroke={stroke}
                strokeOpacity={i ? 0.6 : 0.5}
                strokeWidth={(i ? 2 : 4) * s}
              />
            </g>
          ),
        )}
      </svg>
      {label > 0 && (
        <div
          style={{
            position: "absolute",
            left: sx === 0 ? end.x : end.x + sx * gap,
            top: sx === 0 ? end.y + sy * gap : end.y,
            transform: `${anchor} translate(${-sx * slide}px, ${sx === 0 ? -sy * slide : 0}px)`,
            opacity: label,
            filter: label < 0.999 ? `blur(${(1 - label) * 2 * s}px)` : undefined,
            whiteSpace: "nowrap",
            fontSize: fontSize * s,
            lineHeight: 1.2,
            fontWeight: 500,
            color,
            background,
            padding: background === "none" ? 0 : "0.32em 0.66em",
            borderRadius: "0.5em",
            ...style,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
