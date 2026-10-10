import type { CSSProperties, ReactNode } from "react";
import { clearArea } from "../engine/formats.js";
import { ease, interpolate, springEase } from "../engine/motion.js";
import { useFrame, useVideoInfo } from "../engine/timeline.js";

export type EndCardProps = {
  /** The mark, as an element (an SVG, an <img>). It lands on `hit`, exactly at rest. */
  logo?: ReactNode;
  /** One line: what the product does for the viewer. */
  claim?: string;
  /** The action: "Try it free", "Join the beta". Drawn as a button. */
  cta?: string;
  /** Where to go, as the viewer would type it: "acme.com/launch". */
  url?: string;
  /**
   * Frame in the shot where the logo locks, meant for a downbeat and the
   * sonic logo's hit: `beatGrid(beats, fps).snap(f, { grid: "downbeat" })`
   * (or `tempo(bpm, fps).snap(…)`), minus the shot's start. The logo's
   * anticipation runs in the frames before it, so give the shot room for that.
   */
  hit: number;
  /** Frames between the claim, the CTA and the URL landing after the logo (default 0.13 s). */
  stagger?: number;
  /** Text colour (default white). */
  color?: string;
  /** Button fill (default `color`) and its text (default `background` or black). */
  accent?: string;
  accentText?: string;
  /** Fill behind the card (default none: the shot's own background shows). */
  background?: string;
  font?: string;
  /** Logo height in pixels at 1080p (default 120). */
  logoSize?: number;
  /** Claim size in pixels at 1080p (default 64). */
  claimSize?: number;
};

/**
 * A brand-neutral end card: logo, claim, CTA and URL, centred in the area
 * clear of the safe margin (and of TikTok, Reels and Shorts' UI in 9:16).
 * The logo comes in over the beat before `hit` (anticipation, then the
 * action) and locks on it; the claim, CTA and URL land one `stagger` apart
 * after it; everything then holds to the end of the shot. Sizes scale with
 * the frame's short side and pass `check`: 64 px claim, 36 px CTA, 32 px URL.
 */
export function EndCard({
  logo,
  claim,
  cta,
  url,
  hit,
  stagger,
  color = "#fff",
  accent,
  accentText,
  background,
  font = 'Inter, "Helvetica Neue", Arial, system-ui, sans-serif',
  logoSize = 120,
  claimSize = 64,
}: EndCardProps) {
  const frame = useFrame();
  const { fps, width, height } = useVideoInfo();
  const unit = Math.min(width, height) / 1080;
  const area = clearArea({ width, height });
  const gap = stagger ?? Math.round(fps * 0.13);
  const approach = Math.round(fps * 0.4);

  // The logo: fades in over the first part of the approach, settles into place exactly on the hit.
  const logoIn = interpolate(frame, [hit - approach, hit], [0, 1], { easing: springEase(0.12) });
  const logoOpacity = interpolate(frame, [hit - approach, hit - approach * 0.4], [0, 1], { easing: ease.out });
  const logoBlur = interpolate(frame, [hit - approach, hit], [10, 0], { easing: ease.out });

  /** Each following element: rises a short way and fades in over 0.35 s, from its own start. */
  const land = (i: number): CSSProperties => {
    const start = hit + gap * i;
    const p = interpolate(frame, [start, start + Math.round(fps * 0.35)], [0, 1], { easing: springEase(0.08) });
    const o = interpolate(frame, [start, start + Math.round(fps * 0.2)], [0, 1], { easing: ease.out });
    return { opacity: o, transform: `translateY(${(1 - p) * 28 * unit}px)` };
  };

  let order = 0;
  return (
    <div style={{ position: "absolute", inset: 0, background, fontFamily: font, color }}>
      <div
        style={{
          position: "absolute",
          left: area.x,
          top: area.y,
          width: area.width,
          height: area.height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 40 * unit,
        }}
      >
        {logo && (
          <div
            style={{
              height: logoSize * unit,
              display: "flex",
              alignItems: "center",
              opacity: logoOpacity,
              transform: `scale(${0.86 + 0.14 * logoIn})`,
              filter: logoBlur > 0.05 ? `blur(${logoBlur * unit}px)` : undefined,
            }}
          >
            {logo}
          </div>
        )}
        {claim && (
          <div
            style={{
              ...land(++order),
              fontSize: claimSize * unit,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: Math.min(area.width, 18 * claimSize * unit),
              textWrap: "balance",
            }}
          >
            {claim}
          </div>
        )}
        {(cta || url) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * unit }}>
            {cta && (
              <div
                style={{
                  ...land(++order),
                  fontSize: 36 * unit,
                  fontWeight: 600,
                  padding: `${18 * unit}px ${40 * unit}px`,
                  borderRadius: 999,
                  background: accent ?? color,
                  color: accentText ?? background ?? "#000",
                }}
              >
                {cta}
              </div>
            )}
            {url && <div style={{ ...land(++order), fontSize: 32 * unit, fontWeight: 500 }}>{url}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
