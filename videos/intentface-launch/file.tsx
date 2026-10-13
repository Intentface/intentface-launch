import { ease, interpolate, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import type { ReactNode } from "react";
import { VIDEO_CUES } from "./hero3d";
import { T } from "./timing";
import { SHAPES, TodoAny } from "./todo-app";

// The video becomes a file: player controls come up over the finished app at
// its last frame, and the frame shrinks into the rendered file with its name.
// In the 4:5 cut the video is the app's 4:5 layout, and the file is named as
// `render` names that shape. On the film's clock.

const SANS = '"Intent Sans", "Helvetica Neue", Arial, sans-serif';
const INK = "#fafafa";
const MUTED = "rgb(255 255 255 / 0.55)";

/** Content laid out at its own size, scaled. */
const Fit = ({ w, h, scale, children }: { w: number; h: number; scale: number; children: ReactNode }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: w,
      height: h,
      transform: `scale(${scale})`,
      transformOrigin: "0 0",
    }}
  >
    {children}
  </div>
);

function Play({ size, opacity }: { size: number; opacity: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        background: "rgb(0 0 0 / 0.5)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        opacity,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.42} height={size * 0.42} aria-hidden>
        <path d="M7 4.5v15l12.5-7.5z" fill="#fff" />
      </svg>
    </div>
  );
}

/** The player's bar along the bottom of the full frame, played to the end; `s` scales it. */
function PlayerBar({ s, opacity }: { s: number; opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200 * s, opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent, rgb(0 0 0 / 0.75))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 104 * s,
          height: 8 * s,
          borderRadius: 4 * s,
          background: "#fff",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 60,
          bottom: 40 * s,
          display: "flex",
          gap: 28,
          alignItems: "center",
          font: `500 ${30 * s}px/1 ${SANS}`,
          color: INK,
        }}
      >
        <svg viewBox="0 0 24 24" width={34 * s} height={34 * s} aria-hidden>
          <path d="M7 4.5v15l12.5-7.5z" fill="#fff" />
        </svg>
        0:30 / 0:30
      </div>
    </div>
  );
}

export function VideoFile() {
  const f = useFrame();
  const { fps, width: W, height: H, format } = useVideoInfo();
  const narrow = format.aspect < 1;
  const shape = narrow ? "portrait" : "wide";
  const content = SHAPES[shape];
  const name = narrow ? "task-feature-portrait.mp4" : "task-feature.mp4";
  const start = T.file;
  // Player controls come up over the last frame, as at the end of a video.
  const chrome = interpolate(f, [start, start + 12], [0, 1], { easing: ease.out });
  // The frame shrinks into the file.
  const shrink = springTo(
    f,
    fps,
    [
      { at: -1, to: 0 },
      { at: start + 16, to: 1 },
    ],
    { duration: 44, bounce: 0 },
  );
  const tile = narrow ? { width: 600, y: 600 } : { width: 880, y: 460 };
  const w = shrink > 0.9995 ? tile.width : interpolate(shrink, [0, 1], [W, tile.width]);
  const h = (w * content.height) / content.width;
  const y = shrink > 0.9995 ? tile.y : interpolate(shrink, [0, 1], [H / 2, tile.y]);
  const radius = interpolate(shrink, [0, 0.3], [0, 18]);
  const label = interpolate(f, [start + 46, start + 62], [0, 1], { easing: ease.out });
  const fade = interpolate(f, [T.create[0] - 10, T.create[0]], [1, 0], { easing: ease.in });
  const labelTop = tile.y + (tile.width * content.height) / content.width / 2 + 36;
  return (
    <div data-launch-check="off" style={{ position: "absolute", inset: 0, background: "#000", opacity: fade }}>
      <div
        // A picture of the video, not UI to read.
        data-launch-check="decor"
        style={{
          position: "absolute",
          left: Math.round(W / 2 - w / 2),
          top: Math.round(y - h / 2),
          width: Math.round(w),
          height: Math.round(h),
          borderRadius: radius,
          overflow: "hidden",
          background: "#000",
          boxShadow: "inset 0 0 0 1.5px rgb(255 255 255 / 0.1)",
        }}
      >
        <Fit w={content.width} h={content.height} scale={w / content.width}>
          <TodoAny shape={shape} cues={VIDEO_CUES} />
          <PlayerBar s={narrow ? 1.3 : 1} opacity={chrome * (1 - shrink)} />
        </Fit>
        <Play size={narrow ? 96 : 112} opacity={interpolate(shrink, [0.6, 1], [0, 1])} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: labelTop,
          textAlign: "center",
          opacity: label,
          transform: `translateY(${Math.round((1 - label) * 10)}px)`,
        }}
      >
        <div style={{ font: `500 34px/1.2 ${SANS}`, color: INK, letterSpacing: "-0.01em" }}>{name}</div>
        <div style={{ font: `400 28px/1.5 ${SANS}`, color: MUTED }}>
          0:30 · {content.width}×{content.height}
        </div>
      </div>
    </div>
  );
}
