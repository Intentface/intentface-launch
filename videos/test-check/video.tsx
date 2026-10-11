// Test: check's picture checks. Run: pnpm launch check test-check
// Expect 1 error and 7 warnings:
// - match: "end-off" differs from its lockup (3 px off, about 0.23% of pixels); "end" matches.
// - crop: the globe cut by its canvas, and the circle clipped by its 200 px box. The card, the
//   photo canvas and the SVG of two rects are not flagged.
// - still: every shot holds over 2 s (4 warnings); cuts: no beat to check against.
// The canvas text "Five mistakes" is declared, so it is measured and its storyboard copy is found.

import { declareText, defineVideo, interpolate, isTextHidden, useFrame } from "@intentface-launch/core";
import { useLayoutEffect, useRef } from "react";

const globe = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#9ff0ff");
  g.addColorStop(1, "#2a6cff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
};

// A globe taller than its canvas: the bottom is sliced off by the canvas edge (the bug).
function CutGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = useFrame();
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 600, 400);
    globe(ctx, 300, 260 + Math.sin(f / 30) * 4, 240);
  });
  return (
    <>
      <canvas
        ref={ref}
        width={600}
        height={400}
        style={{ position: "absolute", left: 200, top: 300, width: 600, height: 400 }}
      />
      {/* No false positives: a card with a border, a full photo-like canvas, a tight logo SVG. */}
      <div
        style={{
          position: "absolute",
          left: 1000,
          top: 200,
          width: 600,
          height: 300,
          background: "#2b2b33",
          borderRadius: 24,
        }}
      />
      <Photo />
      <div style={{ position: "absolute", left: 1500, top: 120, width: 300, height: 200, overflow: "hidden" }}>
        <svg aria-hidden="true" width={300} height={300} viewBox="0 0 300 300">
          <circle cx={150} cy={150} r={140} fill="#ffdc74" />
        </svg>
      </div>
      <svg
        aria-hidden="true"
        width={300}
        height={100}
        viewBox="0 0 300 100"
        style={{ position: "absolute", left: 1300, top: 860 }}
      >
        <rect x={0} y={0} width={80} height={100} fill="#fafafa" />
        <rect x={110} y={40} width={190} height={60} fill="#fafafa" />
      </svg>
    </>
  );
}

function Photo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 400, 240);
    g.addColorStop(0, "#ff9e7a");
    g.addColorStop(1, "#7a3cff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 240);
  });
  return (
    <canvas
      ref={ref}
      width={400}
      height={240}
      style={{ position: "absolute", left: 1000, top: 560, width: 400, height: 240 }}
    />
  );
}

// Text drawn in a canvas, declared so check sees it; scaled by a CSS zoom to prove the mapping.
function CanvasText() {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = useFrame();
  const opacity = interpolate(f, [0, 12], [0, 1]);
  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, 800, 200);
    if (!isTextHidden()) {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "#fafafa";
      ctx.font = "500 64px sans-serif";
      ctx.fillText("Five mistakes", 40, 120);
      ctx.globalAlpha = 1;
    }
    declareText(el, [{ text: "Five mistakes", x: 40, y: 70, width: 400, height: 64, size: 64, opacity }]);
  });
  return (
    <div style={{ position: "absolute", left: 400, top: 400, transform: "scale(1.5)", transformOrigin: "0 0" }}>
      <canvas ref={ref} width={800} height={200} style={{ width: 800, height: 200 }} />
    </div>
  );
}

// The end card: the animated lockup lands where the static one sits, 3 px off in "end-off".
function Lockup({ x = 760 }: { x?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: 470, display: "flex", gap: 24, alignItems: "center" }}>
      <svg aria-hidden="true" width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={56} fill="#74e6ff" />
      </svg>
      <span style={{ fontSize: 96, fontWeight: 600, color: "#fafafa", fontFamily: "sans-serif" }}>Mark</span>
    </div>
  );
}
function LandingLockup({ off = 0 }: { off?: number }) {
  const f = useFrame();
  const x = interpolate(f, [0, 40], [500, 760 + off]);
  return <Lockup x={x} />;
}

export default defineVideo({
  id: "test-check",
  title: "Check test",
  shots: [
    { id: "globe", title: "Cut globe", duration: 120, component: CutGlobe },
    { id: "canvas-text", title: "Canvas text", duration: 240, component: CanvasText, copy: ["Five mistakes"] },
    {
      id: "end",
      title: "End",
      duration: 180,
      component: () => <LandingLockup />,
      matches: { reference: () => <Lockup />, label: "lockup" },
    },
    {
      id: "end-off",
      title: "End off",
      duration: 180,
      component: () => <LandingLockup off={3} />,
      matches: { reference: () => <Lockup />, label: "lockup" },
    },
  ],
});
