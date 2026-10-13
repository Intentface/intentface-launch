// Test: text under a scale. A line scaling about its centre climbs the pixel grid a whole pixel at a
// time (its baseline lands between pixels, and glyphs are not placed at fractions of a pixel
// vertically), so it judders; about its baseline it does not. Hinting re-snaps the stems as the
// size changes; geometricPrecision draws the outlines as they are.
// Run: pnpm launch measure test-text-scale --shot centre (and baseline, precise, slam, reveal, push)
// Expect: centre about 0.26 px of vertical judder with dozens of turns, and a "shakes" line;
// baseline, precise, slam and reveal under 0.01 px and no turns. On macOS precise matches baseline
// (no hinting there; it may differ on Linux). push and push-precise: a block of UI text under a
// camera push, for comparison: about 0.14 px at nearly 3 px a frame, which reads as smooth.

import { defineVideo, ease, interpolate, useFrame } from "@intentface-launch/core";
import { Reveal, Slam, useBaseline } from "@intentface-launch/core/kit";

const sans = '"Studio Sans", system-ui, sans-serif';
const ground = "#f6f5f2";
const ink = "#141414";

/** Scale 1.35 → 1 at an even rate over 40 frames, so any change of direction is the raster's. */
const scaleAt = (frame: number) => interpolate(frame, [4, 44], [1.35, 1]);

function Line({ origin, precise }: { origin: "centre" | "baseline"; precise?: boolean }) {
  const frame = useFrame();
  const baseline = useBaseline();
  const transformOrigin = origin === "baseline" ? baseline.origin() : "50% 50%";
  return (
    <div style={{ position: "absolute", inset: 0, background: ground, color: ink, fontFamily: sans }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", fontSize: 120 }}>
        <span
          style={{
            display: "inline-block",
            position: "relative",
            fontWeight: 600,
            transform: `scale(${scaleAt(frame)})`,
            transformOrigin,
            textRendering: precise ? "geometricPrecision" : undefined,
          }}
        >
          Scale the type.
          {baseline.probe}
        </span>
      </div>
    </div>
  );
}

/** The kit's own: Slam and Reveal on the same even scale, so their numbers match `baseline`. */
function Kit({ reveal }: { reveal?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: ground, color: ink, fontFamily: sans }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 440,
          textAlign: "center",
          fontSize: 120,
          fontWeight: 600,
        }}
      >
        {reveal ? (
          <Reveal at={4} by="line" frames={40} scale={1.35} rise={0} blur={0} easing={ease.linear}>
            Scale the type.
          </Reveal>
        ) : (
          <Slam at={4} duration={40} from={1.35} blur={0} easing={ease.linear}>
            Scale the type.
          </Slam>
        )}
      </div>
    </div>
  );
}

const ROWS = ["Launch checklist", "Website ready", "Video rendered", "Email drafted", "Press kit sent"];

/** A block of UI text under a camera push, origin top left as Camera does it. */
function Push({ precise }: { precise?: boolean }) {
  const frame = useFrame();
  const zoom = interpolate(frame, [4, 94], [1, 1.5]);
  return (
    <div style={{ position: "absolute", inset: 0, background: ground, color: ink, fontFamily: sans }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: "0 0",
          transform: `translate(${-zoom * 300 + 300}px, ${-zoom * 200 + 200}px) scale(${zoom})`,
          textRendering: precise ? "geometricPrecision" : undefined,
        }}
      >
        <div style={{ position: "absolute", left: 640, top: 380, fontSize: 28, lineHeight: 1.6 }}>
          {ROWS.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default defineVideo({
  id: "test-text-scale",
  title: "Text under a scale",
  logline: "Measures judder and shape drift of scaling type.",
  background: ground,
  shots: [
    { id: "centre", title: "Centre", duration: 60, component: () => <Line origin="centre" /> },
    { id: "baseline", title: "Baseline", duration: 60, component: () => <Line origin="baseline" /> },
    { id: "precise", title: "Baseline, precise", duration: 60, component: () => <Line origin="baseline" precise /> },
    { id: "centre-precise", title: "Centre, precise", duration: 60, component: () => <Line origin="centre" precise /> },
    { id: "slam", title: "Slam", duration: 60, component: () => <Kit /> },
    { id: "reveal", title: "Reveal", duration: 60, component: () => <Kit reveal /> },
    { id: "push", title: "Push", duration: 100, component: () => <Push /> },
    { id: "push-precise", title: "Push, precise", duration: 100, component: () => <Push precise /> },
  ],
});
