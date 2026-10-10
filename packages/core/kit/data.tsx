import { type CSSProperties, type ReactNode, useId } from "react";
import {
  type Easing,
  ease,
  interpolate,
  overshootEase,
  progress,
  type SpringConfig,
  spring,
  springTo,
  useFrame,
  useVideoInfo,
} from "../engine/index.js";

/**
 * Proof visuals: numbers that grow, lines that draw, a before and an after,
 * one thing beating another on a clock. Brand-neutral: colours come from
 * props (default `currentColor` and neutral greys), fonts are inherited, and
 * every number is set in tabular figures so it does not jitter as it counts.
 */

const tabular: CSSProperties = { fontVariantNumeric: "tabular-nums" };
const defaultFormat = (n: number) => Math.round(n).toLocaleString("en-US");

export type Bar = {
  label: ReactNode;
  value: number;
  /** This bar's colour (default: the chart's `color`). Give the hero bar the accent and the rest a grey. */
  color?: string;
};

export type BarsProps = {
  data: Bar[];
  /** Frame the first bar starts to grow. */
  at?: number;
  /** Frames between bars (default 4). */
  stagger?: number;
  /** The grow (default 36 frames with a 0.08 bounce: a bar arriving at its value may settle a little). */
  spring?: SpringConfig;
  /** The value of a full-length bar (default: the largest). */
  max?: number;
  /** `"right"`: rows with labels on the left (default; long labels read). `"up"`: columns, labels under. */
  direction?: "right" | "up";
  /** Size of the whole chart in pixels (default 1000 × 480). */
  width?: number;
  height?: number;
  /** Bar colour (default `currentColor`). */
  color?: string;
  /** Faint track behind each bar, or `"none"` (default a translucent grey). */
  track?: string;
  /** Gap between bars as a fraction of a bar's slot (default 0.35). */
  gap?: number;
  /** Label column width for `"right"`, in pixels (default 28% of the width). */
  labelWidth?: number;
  /** The value label's text (default rounded with thousands separators). `null` hides them. */
  format?: ((value: number) => string) | null;
  /** Text size (default 30). */
  fontSize?: number;
  style?: CSSProperties;
};

/**
 * Bars that grow to their values one after another, each on its own spring,
 * with its value counting up at its end. The count follows the bar but never
 * reads past the real value while the spring settles.
 */
export function Bars({
  data,
  at = 0,
  stagger = 4,
  spring: config = { duration: 36, bounce: 0.08 },
  max,
  direction = "right",
  width = 1000,
  height = 480,
  color = "currentColor",
  track = "rgb(128 128 128 / 0.14)",
  gap = 0.35,
  labelWidth,
  format = defaultFormat,
  fontSize = 30,
  style,
}: BarsProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const top = max ?? Math.max(...data.map((d) => d.value));
  const n = data.length;
  const horizontal = direction === "right";
  const labels = horizontal ? (labelWidth ?? width * 0.28) : fontSize * 1.8;
  // For "up", room above the tallest bar for its value.
  const head = horizontal ? 0 : format ? fontSize * 1.6 : 0;
  const valueRoom = horizontal && format ? fontSize * 4 : 0;
  const span = horizontal ? width - labels - valueRoom : height - labels - head;
  const slot = (horizontal ? height : width) / n;
  const thick = slot * (1 - gap);
  return (
    <div style={{ position: "relative", width, height, fontSize, lineHeight: 1.2, ...style }}>
      {data.map((d, i) => {
        const grow = spring(frame - at - i * stagger, fps, config);
        const len = (d.value / top) * span * Math.max(0, grow);
        const shown = Math.min(d.value, d.value * grow);
        const fill = d.color ?? color;
        const along = i * slot + (slot - thick) / 2;
        const valueIn = progress(frame, at + i * stagger + 4, 12, ease.soft);
        if (horizontal) {
          return (
            <div key={i}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: along,
                  width: labels - fontSize * 0.6,
                  height: thick,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  textAlign: "right",
                  opacity: progress(frame, at + i * stagger, 12, ease.soft),
                }}
              >
                {d.label}
              </div>
              {track !== "none" && (
                <div
                  style={{
                    position: "absolute",
                    left: labels,
                    top: along,
                    width: span,
                    height: thick,
                    borderRadius: Math.min(thick / 2, 12),
                    background: track,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: labels,
                  top: along,
                  width: len,
                  height: thick,
                  borderRadius: Math.min(thick / 2, 12),
                  background: fill,
                }}
              />
              {format && (
                <div
                  style={{
                    ...tabular,
                    position: "absolute",
                    left: labels + len + fontSize * 0.5,
                    top: along,
                    height: thick,
                    display: "flex",
                    alignItems: "center",
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                    opacity: valueIn,
                  }}
                >
                  {format(shown)}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={i}>
            {track !== "none" && (
              <div
                style={{
                  position: "absolute",
                  left: along,
                  top: head,
                  width: thick,
                  height: span,
                  borderRadius: Math.min(thick / 2, 12),
                  background: track,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: along,
                top: head + span - len,
                width: thick,
                height: len,
                borderRadius: Math.min(thick / 2, 12),
                background: fill,
              }}
            />
            {format && (
              <div
                style={{
                  ...tabular,
                  position: "absolute",
                  left: along - slot * 0.5,
                  width: thick + slot,
                  top: head + span - len - fontSize * 1.5,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  opacity: valueIn,
                }}
              >
                {format(shown)}
              </div>
            )}
            <div
              style={{
                position: "absolute",
                left: along - slot * 0.5,
                width: thick + slot,
                top: height - labels + fontSize * 0.4,
                textAlign: "center",
                opacity: progress(frame, at + i * stagger, 12, ease.soft),
              }}
            >
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type LineChartProps = {
  /** Values at even steps, or [x, y] pairs with increasing x. */
  points: number[] | [number, number][];
  /** Frame it starts drawing. */
  at?: number;
  /** Frames to draw from the first point to the last (default 60). */
  duration?: number;
  /** How the head moves along x (default `ease.inOut`: the line accelerates out of its start and lands on its last point). */
  easing?: Easing;
  /** Size in pixels (default 1000 × 480). */
  width?: number;
  height?: number;
  /** The value range of the y axis (default: the data's, with 8% headroom; pass `min: 0` for a zero baseline). */
  min?: number;
  max?: number;
  /** Line colour (default `currentColor`). */
  color?: string;
  /** Line width in pixels (default 5). */
  strokeWidth?: number;
  /** Fill under the line, fading down (default true). */
  area?: boolean;
  /** A dot riding the head of the line, with a ring that pulses once when it lands (default true). */
  dot?: boolean;
  /** The head's value beside the dot, counting as it draws (`(v) => \`${v}%\``). Off by default. */
  format?: (value: number) => string;
  /** Faint horizontal grid lines (default 4; 0 for none). */
  grid?: number;
  /** Curve through the points (default true: monotone, so it never overshoots the data). */
  smooth?: boolean;
  /** Text size for `format` (default 30). */
  fontSize?: number;
  style?: CSSProperties;
};

/** Monotone cubic (Fritsch–Carlson) through the points, sampled densely: smooth, and never above or below the data between points. */
function curve(pts: [number, number][], smooth: boolean, steps = 24): [number, number][] {
  if (!smooth || pts.length < 3) return pts;
  const n = pts.length;
  const d = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (p[0] - pts[i][0] || 1));
  const m = pts.map((_, i) =>
    i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = x1 - x0;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
      const h10 = t ** 3 - 2 * t ** 2 + t;
      const h01 = -2 * t ** 3 + 3 * t ** 2;
      const h11 = t ** 3 - t ** 2;
      out.push([x0 + dx * t, h00 * y0 + h10 * dx * m[i] + h01 * y1 + h11 * dx * m[i + 1]]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

/**
 * A line chart that draws on from left to right, as data arriving: the head
 * moves along x, so time on screen maps to time in the data. A fading area
 * fills under the drawn part, and a dot rides the head (with its value, if
 * asked), pulsing once when the line lands.
 */
export function LineChart({
  points,
  at = 0,
  duration = 60,
  easing = ease.inOut,
  width = 1000,
  height = 480,
  min,
  max,
  color = "currentColor",
  strokeWidth = 5,
  area = true,
  dot = true,
  format,
  grid = 4,
  smooth = true,
  fontSize = 30,
  style,
}: LineChartProps) {
  const frame = useFrame();
  const id = useId();
  const data: [number, number][] = points.map((p, i) => (Array.isArray(p) ? p : [i, p]));
  const ys = data.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const room = (hi - lo || 1) * 0.08;
  const y0 = min ?? lo - room;
  const y1 = max ?? hi + room;
  const x0 = data[0][0];
  const x1 = data[data.length - 1][0];
  // Inset by the stroke and the dot, so neither is clipped at the edges.
  const pad = strokeWidth * 2 + 8;
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (width - pad * 2);
  const sy = (y: number) => pad + (1 - (y - y0) / (y1 - y0 || 1)) * (height - pad * 2);
  const dense = curve(data, smooth).map(([x, y]) => [sx(x), sy(y)] as [number, number]);
  const p = progress(frame, at, duration, easing);
  const headX = dense[0][0] + (dense[dense.length - 1][0] - dense[0][0]) * p;
  const drawn: [number, number][] = [dense[0]];
  for (let i = 1; i < dense.length; i++) {
    const [ax, ay] = dense[i - 1];
    const [bx, by] = dense[i];
    if (bx <= headX) drawn.push(dense[i]);
    else {
      drawn.push([headX, ay + ((by - ay) * (headX - ax)) / (bx - ax || 1)]);
      break;
    }
  }
  const head = drawn[drawn.length - 1];
  const line = drawn.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const baseY = height - pad;
  const headValue = y0 + (1 - (head[1] - pad) / (height - pad * 2)) * (y1 - y0);
  const landed = frame - (at + duration);
  const pulse = landed >= 0 ? progress(landed, 0, 30, ease.out) : 0;
  const visible = frame >= at;
  return (
    <div style={{ position: "relative", width, height, color, ...style }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="1" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: grid }, (_, i) => {
          const y = pad + ((height - pad * 2) * (i + 1)) / grid;
          return <line key={i} x1={0} x2={width} y1={y} y2={y} stroke="rgb(128 128 128 / 0.2)" strokeWidth={1} />;
        })}
        {visible && area && drawn.length > 1 && (
          <path d={`${line}L${head[0].toFixed(2)} ${baseY}L${drawn[0][0].toFixed(2)} ${baseY}Z`} fill={`url(#${id})`} />
        )}
        {visible && drawn.length > 1 && (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {visible && dot && (
          <>
            {pulse > 0 && pulse < 1 && (
              <circle
                cx={head[0]}
                cy={head[1]}
                r={strokeWidth * (1.6 + pulse * 4)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                opacity={1 - pulse}
              />
            )}
            <circle
              cx={head[0]}
              cy={head[1]}
              r={strokeWidth * 1.6 * progress(frame, at, 9, ease.out)}
              fill="currentColor"
            />
          </>
        )}
      </svg>
      {visible && format && (
        <div
          style={{
            ...tabular,
            position: "absolute",
            left: head[0] + strokeWidth * 3,
            top: head[1] - fontSize * 1.6,
            fontSize,
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: progress(frame, at, 12, ease.soft),
          }}
        >
          {format(headValue)}
        </div>
      )}
    </div>
  );
}

export type BeforeAfterProps = {
  /** The left layer (what it was), and the right (what it is now). Both laid out at the full size. */
  before: ReactNode;
  after: ReactNode;
  /** Size in pixels (default 1280 × 720). */
  width?: number;
  height?: number;
  /**
   * Where the divider is, 0 (all after) to 1 (all before): a fixed split, or
   * stops it springs between (`[{ at: 0, to: 1 }, { at: 30, to: 0.5 }]`).
   */
  split?: number | { at: number; to: number }[];
  /** How the divider moves between stops (default 36 frames, no bounce). */
  spring?: SpringConfig;
  /** Corner labels for the two sides (e.g. `["Before", "After"]`); each fades with how much of its side shows. */
  labels?: [ReactNode, ReactNode];
  /** Divider colour (default white). */
  color?: string;
  /** Show the round handle on the divider (default true). */
  handle?: boolean;
  /** Label size (default 28). */
  fontSize?: number;
  style?: CSSProperties;
};

/**
 * Before and after, split by a divider that moves: the before layer is
 * clipped to the left of the divider over the after. Drive the divider with
 * stops (a sweep across, a hold, a settle at the middle); the spring keeps
 * its speed through each change.
 */
export function BeforeAfter({
  before,
  after,
  width = 1280,
  height = 720,
  split = 0.5,
  spring: config = { duration: 36 },
  labels,
  color = "#fff",
  handle = true,
  fontSize = 28,
  style,
}: BeforeAfterProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const s = typeof split === "number" ? split : springTo(frame, fps, split, config);
  const x = Math.max(0, Math.min(1, s)) * width;
  const chip: CSSProperties = {
    position: "absolute",
    top: fontSize * 0.8,
    padding: "0.3em 0.7em",
    borderRadius: "0.5em",
    background: "rgb(0 0 0 / 0.55)",
    color: "#fff",
    fontSize,
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };
  // Each label shows while its side has room for it.
  const room = (px: number) => interpolate(px, [fontSize * 4, fontSize * 8], [0, 1], { easing: ease.soft });
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", inset: 0 }}>{after}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${width - x}px 0 0)` }}>{before}</div>
      {labels && (
        <>
          <div style={{ ...chip, left: fontSize * 0.8, opacity: room(x) }}>{labels[0]}</div>
          <div style={{ ...chip, right: fontSize * 0.8, opacity: room(width - x) }}>{labels[1]}</div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: x - 1.5,
          top: 0,
          width: 3,
          height,
          background: color,
          boxShadow: "0 0 12px rgb(0 0 0 / 0.35)",
        }}
      />
      {handle && (
        <div
          style={{
            position: "absolute",
            left: x - 28,
            top: height / 2 - 28,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: color,
            boxShadow: "0 4px 16px rgb(0 0 0 / 0.3)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2.2" aria-hidden>
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

export type Lane = {
  label: ReactNode;
  /** The real time it takes, in seconds: what the timer shows when it finishes. */
  seconds: number;
  /** Frames it takes on screen (default: `seconds` at the video's frame rate, i.e. real time). Compress a slow lane and the timer still runs to its real time. */
  frames?: number;
  /** This lane's bar colour (default: the race's `color`). */
  color?: string;
};

export type SpeedRaceProps = {
  lanes: Lane[];
  /** Frame both start. */
  at?: number;
  /** Size in pixels (default 1200 wide; each lane about 2.6 × `fontSize` tall plus a gap). */
  width?: number;
  /** Bar colour (default `currentColor`). Give the hero lane its accent through `Lane.color` and the others a grey. */
  color?: string;
  /** Track behind each bar (default a translucent grey). */
  track?: string;
  /** Colour of the winner's finish accent: its check, its timer, the flash on its bar (default `color`). */
  accent?: string;
  /** How a bar fills against its own time (default linear: honest progress). */
  easing?: Easing;
  /** The timer's text (default one decimal and "s"). */
  format?: (seconds: number) => string;
  /** Text size (default 30). */
  fontSize?: number;
  style?: CSSProperties;
};

/**
 * Two (or more) lanes racing the same task: each bar fills over its own
 * time while its timer runs, and stops on the real time when it finishes.
 * The fastest finisher gets the accent: its bar flashes, a check pops in
 * beside it and its time takes the accent colour. Slower lanes just stop.
 */
export function SpeedRace({
  lanes,
  at = 0,
  width = 1200,
  color = "currentColor",
  track = "rgb(128 128 128 / 0.16)",
  accent,
  easing = ease.linear,
  format = (s) => `${s.toFixed(1)} s`,
  fontSize = 30,
  style,
}: SpeedRaceProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const spans = lanes.map((l) => l.frames ?? l.seconds * fps);
  const best = spans.indexOf(Math.min(...spans));
  const bar = fontSize * 0.5;
  const timerWidth = fontSize * 5;
  const checkSize = fontSize * 1.1;
  return (
    <div style={{ display: "grid", gap: fontSize * 1.1, width, fontSize, lineHeight: 1.2, ...style }}>
      {lanes.map((lane, i) => {
        const span = spans[i];
        const p = progress(frame, at, span, easing);
        // Real time: the timer runs linearly to the lane's own seconds, whatever its bar's easing.
        const elapsed = Math.max(0, Math.min(1, (frame - at) / span)) * lane.seconds;
        const done = frame >= at + span;
        const win = i === best;
        const since = frame - (at + span);
        const flash = win && done ? 1 - progress(since, 0, 24, ease.out) : 0;
        const check = win ? progress(since, 0, 18, overshootEase(0.25)) : 0;
        const hot = win ? progress(since, 0, 12, ease.soft) : 0;
        const fill = lane.color ?? color;
        const tint = accent ?? fill;
        return (
          <div key={i} style={{ display: "grid", gap: fontSize * 0.4 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 500 }}>{lane.label}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: fontSize * 0.35 }}>
                {win && check > 0 && (
                  <svg
                    width={checkSize}
                    height={checkSize}
                    viewBox="0 0 24 24"
                    aria-hidden
                    style={{ transform: `scale(${check})`, color: tint, alignSelf: "center" }}
                  >
                    <circle cx="12" cy="12" r="11" fill="currentColor" />
                    <path
                      d="M7 12.5l3.2 3.2L17 9"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - progress(since, 5, 18, ease.out)}
                    />
                  </svg>
                )}
                <span
                  style={{
                    ...tabular,
                    minWidth: timerWidth,
                    textAlign: "right",
                    fontWeight: 600,
                    position: "relative",
                  }}
                >
                  <span style={{ opacity: done && !win ? 0.75 : 1 }}>{format(frame < at ? 0 : elapsed)}</span>
                  {hot > 0 && (
                    <span style={{ position: "absolute", inset: 0, color: tint, opacity: hot }}>{format(elapsed)}</span>
                  )}
                </span>
              </span>
            </div>
            <div
              style={{
                position: "relative",
                height: bar,
                borderRadius: bar / 2,
                background: track,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${p * 100}%`,
                  borderRadius: bar / 2,
                  background: fill,
                }}
              />
              {flash > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: bar / 2,
                    background: "#fff",
                    opacity: flash * 0.6,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
