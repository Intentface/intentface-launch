import { type SpringConfig, type SpringTarget, springs, springTo } from "../engine/index.js";

export type Vec = { x: number; y: number };

/**
 * Squash and stretch from velocity. Give it the same position function the
 * element moves by; it differentiates at `frame` and returns a transform that
 * stretches along the direction of travel and squashes across it (area kept:
 * stretch × squash = 1). Inside <MotionBlur> each sample computes its own
 * velocity, so the deformation integrates through the exposure for free.
 */
export function stretch(
  position: (frame: number) => Vec,
  frame: number,
  { intensity = 1, maxBoost = 0.25, refSpeed = 60 }: { intensity?: number; maxBoost?: number; refSpeed?: number } = {},
): string {
  const a = position(frame - 0.5);
  const b = position(frame + 0.5);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const speed = Math.hypot(vx, vy);
  if (speed < 0.01) return "";
  const s = 1 + intensity * Math.min(speed / refSpeed, 1) * maxBoost;
  const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
  return `rotate(${angle}deg) scale(${s}, ${1 / s}) rotate(${-angle}deg)`;
}

export type EdgeStop = {
  /** Frame it sets off for this span. The first stop is where it starts. */
  at: number;
  /** Leading and trailing edge along one axis, in pixels (left and right of a tab, top and bottom of a row). */
  start: number;
  end: number;
};

/**
 * A span whose two edges ride different springs, for tab indicators,
 * selection pills and toggle knobs: the edge facing the direction of travel
 * leaves first and arrives first, so the shape stretches ahead and the other
 * edge catches up. The stretch is a quieter squash and stretch than
 * `stretch()`, and reads as the UI's own physics.
 */
export function edges(
  frame: number,
  fps: number,
  stops: EdgeStop[],
  {
    lead = springs.snappy,
    trail = { stiffness: 150, damping: 25 },
  }: { lead?: SpringConfig; trail?: SpringConfig } = {},
) {
  const starts: SpringTarget[] = [];
  const ends: SpringTarget[] = [];
  stops.forEach((stop, i) => {
    const prev = stops[i - 1];
    // Which way the span travels; growing or shrinking in place leads with both edges.
    const travel = prev ? stop.start - prev.start + (stop.end - prev.end) : 0;
    starts.push({ at: stop.at, to: stop.start, spring: travel > 0 ? trail : lead });
    ends.push({ at: stop.at, to: stop.end, spring: travel < 0 ? trail : lead });
  });
  const start = springTo(frame, fps, starts);
  const end = springTo(frame, fps, ends);
  return { start, end, size: end - start, center: (start + end) / 2 };
}

/**
 * Resistance past a limit, like a scroll view pulled beyond its end: inside
 * [min, max] the value passes through; beyond, it keeps moving at a falling
 * rate and never goes more than `range` past the limit.
 */
export function rubberband(value: number, min: number, max: number, range = (max - min) * 0.15) {
  const give = (over: number) => range * (1 - 1 / (1 + (0.55 * over) / range));
  if (value > max) return max + give(value - max);
  if (value < min) return min - give(min - value);
  return value;
}
