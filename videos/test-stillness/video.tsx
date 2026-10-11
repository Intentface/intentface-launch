// Test: calibrates check's stillness. A gradient drifting behind a frozen layout still counts as
// still; a 3% drift of the layout does not. Run: pnpm launch check test-stillness
// Expect: one "still" warning, on "frozen" (about 3 s), none on "drift"; one "creep" warning, on
// "drift" (its line moves well under a pixel a frame, so it steps); no errors.
// Audio is synthetic (audio/make.sh).

import { defineVideo, ease, interpolate, useFrame } from "@intentface-launch/core";
import { MeshGradient } from "@intentface-launch/core/kit";

function Card({ drift }: { drift: boolean }) {
  const frame = useFrame();
  const zoom = drift ? interpolate(frame, [0, 240], [1, 1.03], { easing: ease.soft }) : 1;
  return (
    <>
      <MeshGradient colors={["#0b0b14", "#1d1840", "#2e2470", "#0f2a33"]} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        <div style={{ position: "absolute", left: 160, top: 420, fontSize: 110, fontWeight: 500, color: "#fafafa" }}>
          Only the light moves.
        </div>
      </div>
    </>
  );
}

export default defineVideo({
  id: "test-stillness",
  title: "Stillness calibration",
  audio: { src: "/videos/test-stillness/audio/test.wav" },
  shots: [
    { id: "frozen", title: "Frozen", duration: 180, component: () => <Card drift={false} /> },
    { id: "drift", title: "Drift", duration: 240, component: () => <Card drift /> },
  ],
});
