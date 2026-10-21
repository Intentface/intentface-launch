// Test: render --alpha keyed by the page (the default). A card at 20% white with an opaque line on
// it, and a disc that crosses under motion blur. Run: pnpm launch render test-alpha --alpha, and
// pnpm launch still test-alpha --at 20 --grid --alpha to see it on a checkerboard.
// Expect: out/test-alpha-alpha.mov is ProRes 4444 (ffprobe: yuva444p12le). At frame 20 its alpha
// (ffmpeg -i out/test-alpha-alpha.mov -vf "select=eq(n\,20),alphaextract" -frames:v 1 a.png) is
// 0 outside the card, about 51 on it, 255 on the text and the disc's middle, and ramps along the
// disc's streak; the mp4 is the same frames on the background (#18181c), with no fringe at edges.

import { defineVideo, interpolate, useFrame } from "@intentface-launch/core";
import { MotionBlur } from "@intentface-launch/core/kit";

function Scene() {
  const frame = useFrame();
  const x = interpolate(frame, [10, 30], [200, 1600]);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 460,
          top: 340,
          width: 1000,
          height: 400,
          borderRadius: 40,
          background: "rgba(255, 255, 255, 0.2)",
          display: "grid",
          placeItems: "center",
          fontFamily: "sans-serif",
          fontSize: 96,
          fontWeight: 600,
          color: "#ffffff",
        }}
      >
        Alpha
      </div>
      <MotionBlur when={[[10, 30]]}>
        <div
          style={{
            position: "absolute",
            left: x - 60,
            top: 800,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "#4f46e5",
          }}
        />
      </MotionBlur>
    </>
  );
}

export default defineVideo({
  id: "test-alpha",
  title: "Alpha test",
  shots: [{ id: "one", title: "One", duration: 40, component: Scene }],
});
