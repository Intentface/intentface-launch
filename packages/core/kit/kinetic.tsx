import type { CSSProperties, ReactNode } from "react";
import { type Easing, ease, interpolate, lerp, progress, useFrame } from "../engine/index.js";
import { useBaseline } from "./baseline.js";

export type SlamProps = {
  children: ReactNode;
  /** Frame it lands. Put it on a beat. */
  at: number;
  /** Frames from invisible to settled (default 16, about half a beat at 120 BPM). */
  duration?: number;
  /** Starting scale: >1 slams down onto the page, <1 punches out of it. */
  from?: number;
  /** Starting offset in em, [x, y]. */
  offset?: [number, number];
  /** Starting blur in em. */
  blur?: number;
  /** Frame it leaves (a quick fade and lift, never a reversed entrance). */
  exit?: number;
  exitDuration?: number;
  easing?: Easing;
  /**
   * Variable-font axes from → to as it lands, on the same curve:
   * `{ wght: [300, 820] }`. With string children and `axesEvery`, letter by
   * letter, that many frames apart.
   */
  axes?: Record<string, [number, number]>;
  axesEvery?: number;
  /** A word the next cut interrupts before it can be read: left out of the reading check. */
  cutOff?: boolean;
  style?: CSSProperties;
};

const variation = (axes: Record<string, [number, number]>, p: number) =>
  Object.entries(axes)
    .map(([axis, [from, to]]) => `"${axis}" ${lerp(from, to, p).toFixed(1)}`)
    .join(", ");

/**
 * One kinetic word or phrase: lands on a frame with scale, blur and a short
 * fade, and holds. The building block for type that cuts on the beat. It
 * scales about its baseline, so the line does not judder on the pixel grid.
 */
export function Slam({
  children,
  at,
  duration = 16,
  from = 1.35,
  offset = [0, 0],
  blur = 0.12,
  exit,
  exitDuration = 10,
  easing = ease.expo,
  axes,
  axesEvery,
  cutOff,
  style,
}: SlamProps) {
  const frame = useFrame();
  const baseline = useBaseline();
  if (frame < at || (exit !== undefined && frame >= exit + exitDuration)) return null;
  const p = progress(frame, at, duration, easing);
  const fade = progress(frame, at, Math.min(6, duration), ease.soft);
  const out = exit === undefined ? 0 : progress(frame, exit, exitDuration, ease.in);
  const letters = axes && axesEvery !== undefined && typeof children === "string";
  const content = letters
    ? Array.from(children as string).map((ch, i) => (
        <span
          key={i}
          style={{ fontVariationSettings: variation(axes, progress(frame, at + i * axesEvery, duration, easing)) }}
        >
          {ch}
        </span>
      ))
    : children;
  return (
    <span
      data-launch-check={cutOff ? "off" : undefined}
      style={{
        display: "inline-block",
        position: "relative",
        whiteSpace: "pre",
        opacity: fade * (1 - out),
        transform: `translate(${lerp(offset[0], 0, p)}em, ${lerp(offset[1], 0, p) - out * 0.15}em) scale(${lerp(from, 1, p)})`,
        transformOrigin: baseline.origin(),
        filter: p < 0.999 ? `blur(${(1 - p) * blur}em)` : undefined,
        fontVariationSettings: axes && !letters ? variation(axes, p) : undefined,
        ...style,
      }}
    >
      {content}
      {from !== 1 && baseline.probe}
    </span>
  );
}

/** A number counting from `from` to `to`, in tabular figures so it does not jitter. */
export function Count({
  from = 0,
  to,
  at = 0,
  duration = 30,
  easing = ease.out,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
  style,
}: {
  from?: number;
  to: number;
  at?: number;
  duration?: number;
  easing?: Easing;
  format?: (n: number) => string;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const value = interpolate(frame, [at, at + duration], [from, to], { easing });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(value)}</span>;
}

/** Log-space interpolation, for zoom and altitude: every doubling takes the same time. */
export function logLerp(frame: number, input: [number, number], output: [number, number], easing: Easing = ease.inOut) {
  const t = interpolate(frame, input, [0, 1], { easing });
  return Math.exp(lerp(Math.log(output[0]), Math.log(output[1]), t));
}

export type SweepProps = {
  children: string;
  /** Frame the top slice starts. */
  at: number;
  /** Horizontal slices (default 9). */
  rows?: number;
  /** Frames between one slice and the next, top to bottom (default 3). */
  stagger?: number;
  /** Frames each slice takes to sweep across (default 26). */
  duration?: number;
  /** How far each slice slides in from the left, in em (default 0.06). */
  slide?: number;
  /** The light band running just ahead of each slice's edge, or `null` for none. */
  glint?: string | null;
  easing?: Easing;
  /** Frame it leaves: a quick fade and lift. */
  exit?: number;
  exitDuration?: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * A title built in horizontal slices that sweep in left to right, top to
 * bottom, each with a band of light just ahead of its edge, like a glint over
 * a cell that answers. Takes its font and colour from `style` or its parent.
 */
export function Sweep({
  children,
  at,
  rows = 9,
  stagger = 3,
  duration = 26,
  slide = 0.06,
  glint = "rgba(255, 255, 255, 0.3)",
  easing = ease.out,
  exit,
  exitDuration = 10,
  style,
  className,
}: SweepProps) {
  const frame = useFrame();
  if (exit !== undefined && frame >= exit + exitDuration) return null;
  const out = exit === undefined ? 0 : progress(frame, exit, exitDuration, ease.in);
  return (
    <div
      className={className}
      style={{
        position: "relative",
        // As wide as the text, so the sweep and its glint run over the letters, not the line.
        width: "fit-content",
        whiteSpace: "pre",
        opacity: 1 - out,
        transform: out ? `translateY(${-out * 0.15}em)` : undefined,
        ...style,
      }}
    >
      {/* Sizes the block; the slices draw it. */}
      <div style={{ visibility: "hidden" }}>{children}</div>
      {Array.from({ length: rows }, (_, i) => {
        const p = progress(frame, at + i * stagger, duration, easing);
        if (p <= 0) return null;
        // The edge runs from 0 to past 1, so its soft tail clears the last letter.
        const edge = p * 1.25;
        const mask = `linear-gradient(90deg, #000 ${(edge - 0.2) * 100}%, transparent ${edge * 100}%)`;
        return (
          <div
            key={i}
            aria-hidden={i < rows - 1}
            // The text is checked once, on the last slice to arrive; the others are copies of it.
            data-launch-check={i < rows - 1 ? "off" : undefined}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(${(i / rows) * 100}% -10% ${100 - ((i + 1) / rows) * 100}% -10%)`,
              transform: `translateX(${-(1 - p) * slide}em)`,
            }}
          >
            {glint && p < 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${(edge - 0.4) * 100}%`,
                  width: "40%",
                  background: `linear-gradient(90deg, transparent, ${glint}, transparent)`,
                }}
              />
            )}
            <div style={{ position: "absolute", inset: 0, WebkitMaskImage: mask, maskImage: mask }}>{children}</div>
          </div>
        );
      })}
    </div>
  );
}
