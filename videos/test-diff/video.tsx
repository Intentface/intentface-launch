// Test: diff finds a handoff that is off by 2 px.
// Run: pnpm launch diff test-diff --frame land:end --against pick
// Expect: about 0.09% of pixels over 16 levels, in a box around the mark (860,440 202×200).

import { defineVideo, ease, interpolate, useFrame } from "@intentface-launch/core";

// A mark that lands, then a second shot that should pick it up exactly (it is 2 px off on purpose).
function Mark({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={240}
      height={240}
      viewBox="0 0 240 240"
      style={{ position: "absolute", left: x - 120, top: y - 120, transform: `scale(${scale})` }}
    >
      <circle cx={120} cy={120} r={100} fill="#74e6ff" />
      <rect x={70} y={70} width={100} height={100} rx={18} fill="#18181c" />
    </svg>
  );
}

function Land() {
  const f = useFrame();
  const x = interpolate(f, [0, 60], [600, 960], { easing: ease.out });
  return <Mark x={x} y={540} />;
}

function Pick({ off = 2 }: { off?: number }) {
  const f = useFrame();
  return (
    <>
      <Mark x={960 + off} y={540} />
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 720,
          fontSize: 64,
          color: "#fafafa",
          opacity: Math.min(1, f / 20),
        }}
      >
        Lands here
      </div>
    </>
  );
}

export default defineVideo({
  id: "test-diff",
  title: "Diff test",
  shots: [
    { id: "land", title: "Land", duration: 90, component: Land },
    { id: "pick", title: "Pick up", duration: 90, component: () => <Pick /> },
  ],
});
