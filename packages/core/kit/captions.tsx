import type { CSSProperties } from "react";
import { type CaptionCue, type CaptionStyle, cueAt } from "../engine/captions.js";
import { clearArea, isVertical } from "../engine/formats.js";
import { useVideoInfo } from "../engine/timeline.js";

/**
 * The caption on screen at the current frame, burned into the picture:
 * centred at the bottom of the area clear of the title-safe margin and, in a
 * 9:16 frame, of TikTok, Reels and Shorts' own UI. White on a dark box, so it
 * reads over any picture; 40 px at 1080p (36 in 9:16). Frame exact: the cue
 * is on from its first frame to its last, with no fade to misread.
 *
 * The Stage draws it over every shot when the video has `burnCaptions`; place
 * it yourself (inside a full-frame layer whose clock is the video's) for another layout.
 */
export function Captions({ cues, style = {} }: { cues: CaptionCue[]; style?: CaptionStyle }) {
  const { absolute, width, height } = useVideoInfo();
  const cue = cueAt(cues, absolute);
  if (!cue) return null;
  const unit = Math.min(width, height) / 1080;
  const vertical = isVertical({ width, height });
  const area = clearArea({ width, height });
  const size = (style.size ?? (vertical ? 36 : 40)) * unit;
  const box: CSSProperties = {
    background: style.box ?? "rgb(0 0 0 / 0.78)",
    color: style.color ?? "#fff",
    fontFamily: style.font ?? 'Inter, "Helvetica Neue", Arial, system-ui, sans-serif',
    fontWeight: style.weight ?? 500,
    fontSize: size,
    lineHeight: 1.3,
    padding: `${0.22 * size}px ${0.5 * size}px`,
    borderRadius: 0.2 * size,
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  return (
    <div
      data-shot="captions"
      style={{
        position: "absolute",
        left: area.x,
        width: area.width,
        top: area.y,
        height: area.height - (style.lift ?? 24) * unit,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div style={box}>
        {cue.lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
