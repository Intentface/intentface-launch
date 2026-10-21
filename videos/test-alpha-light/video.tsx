// Test: render --alpha on light on black (alpha: "black"), keyed by brightness. A white core in a
// coloured glow that fades to black. Run: pnpm launch render test-alpha-light --alpha, and
// pnpm launch still test-alpha-light --at 10 --grid --alpha to see it on a checkerboard.
// Expect: out/test-alpha-light-alpha.mov is ProRes 4444. Its alpha is 255 in the core, falls
// smoothly through the glow and is 0 in the black around it; the glow keeps its hue as it fades
// (it does not grey out). The mp4 matches a render without --alpha to within a level or two.

import { defineVideo } from "@intentface-launch/core";

function Glow() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 50%, #ffffff 0, #ffffff 60px, #74e6ff 160px, #fe9eff 300px, rgba(255, 220, 116, 0.4) 420px, #000000 520px)",
      }}
    />
  );
}

export default defineVideo({
  id: "test-alpha-light",
  title: "Alpha light test",
  background: "#000000",
  alpha: "black",
  shots: [{ id: "one", title: "One", duration: 20, component: Glow }],
});
