import type { CSSProperties, ReactNode } from "react";
import { springTo, useFrame, useVideoInfo } from "../engine/index.js";

export type MiddleCardProps = {
  /** What fills the frame behind the card: a `Shaders` layer, a `Clip`, a gradient. */
  background: ReactNode;
  /** The card's content, laid out at the card's size (a hero: logo, nav, headline, button). */
  children?: ReactNode;
  /** The card's size and corner radius, in CSS pixels (default 1440 × 810, 44). */
  width?: number;
  height?: number;
  radius?: number;
  /** The card's centre (default the frame's). */
  x?: number;
  y?: number;
  /**
   * What blurs. `card` (default): the card is frosted glass, the background
   * sharp round it and blurred through it. `around`: the card is a window onto
   * the background, sharp, and everything round it is blurred and washed, so
   * the card reads as the subject.
   */
  blur?: "card" | "around";
  /** Blur radius in CSS pixels (default 36 for `card`, 64 for `around`). */
  amount?: number;
  /** The glass's colour (`card`), or the wash over the blurred surround (`around`); any CSS colour, translucent. */
  tint?: string;
  /** A hairline on the card's edge (default a faint light line), or `none`. */
  edge?: string;
  /** The frame it opens on: it rises in from 96% while the blur comes in (default 0: open from the start). */
  at?: number;
  style?: CSSProperties;
};

/**
 * A rounded card in the middle of the frame over a shader (the "hero"
 * template): the background fills the frame, and the card is either frosted
 * glass that blurs it (`blur="card"`) or a sharp window onto it with the
 * surround blurred and washed (`blur="around"`). Content goes in the card at
 * its own size. On `at` it opens: it rises from 96% on a spring with no
 * bounce worth seeing, as the blur comes in over the same 30 frames, so the
 * background defocuses as the card arrives. The blur is the browser's
 * (`backdrop-filter`) over whatever is behind, a WebGPU or WebGL canvas
 * included, so it is exact in stills and renders.
 */
export function MiddleCard({
  background,
  children,
  width = 1440,
  height = 810,
  radius = 44,
  x,
  y,
  blur = "card",
  amount,
  tint,
  edge = "rgb(255 255 255 / 0.22)",
  at = 0,
  style,
}: MiddleCardProps) {
  const frame = useFrame();
  const { fps, width: frameWidth, height: frameHeight } = useVideoInfo();
  const cx = x ?? frameWidth / 2;
  const cy = y ?? frameHeight / 2;
  const open =
    at <= 0
      ? 1
      : springTo(
          frame,
          fps,
          [
            { at: -1, to: 0 },
            { at, to: 1 },
          ],
          { duration: 30, bounce: 0.08 },
        );
  const shown = Math.min(1, Math.max(0, open));
  const scale = 0.96 + 0.04 * open;
  const w = width * scale;
  const h = height * scale;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const r = radius * scale;
  const px = (amount ?? (blur === "card" ? 36 : 64)) * shown;
  const card: CSSProperties = { position: "absolute", left, top, width: w, height: h, borderRadius: r };
  // The card's outline, for cutting it out of the surround.
  const hole = `M${left + r} ${top}H${left + w - r}A${r} ${r} 0 0 1 ${left + w} ${top + r}V${top + h - r}A${r} ${r} 0 0 1 ${left + w - r} ${top + h}H${left + r}A${r} ${r} 0 0 1 ${left} ${top + h - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {background}
      {blur === "around" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `path(evenodd, "M0 0H${frameWidth}V${frameHeight}H0Z${hole}")`,
            backdropFilter: `blur(${px.toFixed(1)}px) saturate(${1 - 0.15 * shown})`,
            background: tint ?? `rgb(255 255 255 / ${(0.28 * shown).toFixed(3)})`,
          }}
        />
      ) : (
        <div
          style={{
            ...card,
            backdropFilter: `blur(${px.toFixed(1)}px) saturate(${1 + 0.2 * shown})`,
            background: tint ?? "rgb(20 16 24 / 0.22)",
            opacity: shown,
            boxShadow: `0 30px 80px -20px rgb(0 0 0 / ${(0.35 * shown).toFixed(3)})`,
          }}
        />
      )}
      {edge !== "none" && (
        <div style={{ ...card, boxShadow: `inset 0 0 0 1.5px ${edge}`, opacity: shown, pointerEvents: "none" }} />
      )}
      <div
        style={{
          position: "absolute",
          left: cx - width / 2,
          top: cy - height / 2,
          width,
          height,
          opacity: shown,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
