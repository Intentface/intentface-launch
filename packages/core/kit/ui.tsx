import type { CSSProperties, ReactNode } from "react";
import { ease, progress, useFrame } from "../engine/index.js";
import type { Rect } from "./camera.js";

export type KeyChipTone = "light" | "dark";

const TONES: Record<KeyChipTone, { background: string; color: string; edge: string; border: string; down: string }> = {
  light: {
    background: "#fafafa",
    color: "#18181b",
    edge: "rgb(0 0 0 / 0.22)",
    border: "rgb(0 0 0 / 0.12)",
    down: "rgb(0 0 0 / 0.07)",
  },
  dark: {
    background: "#2a2a2e",
    color: "#fafafa",
    edge: "rgb(0 0 0 / 0.7)",
    border: "rgb(255 255 255 / 0.14)",
    down: "rgb(255 255 255 / 0.08)",
  },
};

export type KeyChipProps = {
  /** The keys, in the order they are held: `["⌘", "K"]`, `["Shift", "⌘", "P"]`. */
  keys: string[];
  /** Frame the chips arrive (default 0: already there). */
  at?: number;
  /** Frame(s) the shortcut lands: the last key goes down on it, the keys before it a few frames earlier. Put it on the beat. */
  press?: number | number[];
  /** Frames the keys stay down (default 10). */
  hold?: number;
  /** Frames between each held key going down (default 3): a hand presses ⌘ before K. */
  stagger?: number;
  /** Frame they fade out (in place). */
  exit?: number;
  /** Key label size in pixels (default 32; 28 is the floor at 1080p). The chips are about 1.6× as tall. */
  size?: number;
  /** Light keycaps (default) or dark. Override pieces with `background`, `color`. */
  tone?: KeyChipTone;
  background?: string;
  color?: string;
  /** Text between the chips (`"+"`, `"then"`); none by default. */
  separator?: ReactNode;
  style?: CSSProperties;
};

/**
 * Keyboard shortcut chips (⌘ K) that can be pressed: each key goes down a
 * little (its lip shrinks, it darkens) on its own frame, the modifiers first,
 * and all come back up together. Arrives with a short rise and settle. For
 * a shortcut the video says out loud, next to the UI it opens.
 */
export function KeyChip({
  keys,
  at = 0,
  press,
  hold = 10,
  stagger = 3,
  exit,
  size = 32,
  tone = "light",
  background,
  color,
  separator,
  style,
}: KeyChipProps) {
  const frame = useFrame();
  const t = TONES[tone];
  const enter = at <= 0 ? 1 : progress(frame, at, 15, ease.out);
  const fade = at <= 0 ? 1 : progress(frame, at, 12, ease.soft);
  const out = exit === undefined ? 0 : progress(frame, exit, 9, ease.soft);
  if (enter <= 0 || out >= 1) return null;
  const presses = press === undefined ? [] : Array.isArray(press) ? press : [press];
  const n = keys.length;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.25,
        fontSize: size,
        lineHeight: 1,
        fontWeight: 500,
        opacity: fade * (1 - out),
        transform: enter < 1 ? `translateY(${(1 - enter) * 8}px) scale(${0.97 + 0.03 * enter})` : undefined,
        filter: enter < 0.999 ? `blur(${(1 - enter) * 2}px)` : undefined,
        ...style,
      }}
    >
      {keys.map((label, i) => {
        // Down in 3 frames landing on its frame, up in 9 after the hold, for each press.
        const depth = presses.reduce((d, p) => {
          const down = p - (n - 1 - i) * stagger;
          return Math.max(
            d,
            Math.min(progress(frame, down - 3, 3, ease.out), 1 - progress(frame, p + hold, 9, ease.out)),
          );
        }, 0);
        return (
          <span key={`${i}-${label}`} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.25 }}>
            {i > 0 && separator !== undefined && <span style={{ opacity: 0.6 }}>{separator}</span>}
            <span
              style={{
                display: "inline-grid",
                placeItems: "center",
                minWidth: "1.6em",
                height: "1.6em",
                padding: "0 0.42em",
                boxSizing: "border-box",
                borderRadius: "0.3em",
                position: "relative",
                background: background ?? t.background,
                color: color ?? t.color,
                border: `1px solid ${t.border}`,
                boxShadow: `0 ${0.1 * (1 - depth * 0.75)}em 0 ${t.edge}`,
                transform: depth > 0 ? `translateY(${0.075 * depth}em) scale(${1 - 0.03 * depth})` : undefined,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {depth > 0 && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    background: t.down,
                    opacity: depth,
                  }}
                />
              )}
              <span style={{ position: "relative" }}>{label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

export type SkeletonBlock = Rect & { radius?: number };

export type SkeletonProps = {
  /** The real content: it takes over from the skeleton at `ready`. */
  children: ReactNode;
  /** Frame the content is ready: the skeleton leaves and the content arrives `trail` frames later. */
  ready: number;
  /** Frame the skeleton itself appears (default 0: already there). */
  at?: number;
  /** The placeholder shapes, in the slot's pixels. Default: `lines`. */
  blocks?: SkeletonBlock[];
  /** Without `blocks`: text lines as fractions of the width (default [1, 0.86, 0.62]). */
  lines?: number[];
  /** Line thickness and spacing, for `lines` (default 22 and 16). */
  lineHeight?: number;
  gap?: number;
  /** Width of the slot for `lines` (default 480). Size it to the content, so nothing shifts at the hand-off. */
  width?: number;
  /** Placeholder colour, and the shimmer's (defaults: translucent greys that work on light and dark). */
  color?: string;
  shimmer?: string;
  /** Frames per shimmer sweep (default 90, linear). */
  cycle?: number;
  /** Frames from skeleton to content (default 24, `ease.swap`, 2 px cross-blur). */
  duration?: number;
  /** Frames the content trails the skeleton's exit (default 3). */
  trail?: number;
  style?: CSSProperties;
};

/**
 * A loading skeleton that hands off to the real content. Blocks shimmer with
 * one band of light that sweeps across all of them (a constant process:
 * linear, its phase from the frame). At `ready` the skeleton cross-fades out
 * with a 2 px blur and the content comes in, in the same slot, a few frames
 * behind so the two never sit at full strength together.
 */
export function Skeleton({
  children,
  ready,
  at = 0,
  blocks,
  lines = [1, 0.86, 0.62],
  lineHeight = 22,
  gap = 16,
  width = 480,
  color = "rgb(128 128 128 / 0.2)",
  shimmer = "rgb(255 255 255 / 0.35)",
  cycle = 90,
  duration = 24,
  trail = 3,
  style,
}: SkeletonProps) {
  const frame = useFrame();
  const shapes: SkeletonBlock[] =
    blocks ??
    lines.map((w, i) => ({
      x: 0,
      y: i * (lineHeight + gap),
      width: w * width,
      height: lineHeight,
      radius: lineHeight / 2,
    }));
  const right = Math.max(...shapes.map((b) => b.x + b.width));
  const bottom = Math.max(...shapes.map((b) => b.y + b.height));
  const skIn = at <= 0 ? 1 : progress(frame, at, 15, ease.soft);
  const skOut = progress(frame, ready, duration, ease.swap);
  const content = progress(frame, ready + trail, duration, ease.swap);
  // The band's centre sweeps from off the left edge to off the right, once per cycle.
  const band = Math.max(80, right * 0.25);
  const phase = (((frame - at) % cycle) + cycle) % cycle;
  const sweep = -band + (phase / cycle) * (right + band * 2);
  const skeleton = skIn * (1 - skOut);
  return (
    <div style={{ display: "grid", ...style }}>
      {skeleton > 0 && (
        <div
          aria-hidden
          style={{
            gridArea: "1 / 1",
            position: "relative",
            width: right,
            height: bottom,
            opacity: skeleton,
            filter: skOut > 0.001 ? `blur(${skOut * 2}px)` : undefined,
          }}
        >
          {shapes.map((b, i) => {
            const c = sweep - b.x;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: b.x,
                  top: b.y,
                  width: b.width,
                  height: b.height,
                  borderRadius: b.radius ?? 8,
                  background: `linear-gradient(100deg, transparent ${c - band}px, ${shimmer} ${c}px, transparent ${c + band}px), ${color}`,
                }}
              />
            );
          })}
        </div>
      )}
      {content > 0 && (
        <div
          style={{
            gridArea: "1 / 1",
            opacity: content,
            filter: content < 0.999 ? `blur(${(1 - content) * 2}px)` : undefined,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
