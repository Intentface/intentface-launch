// Test: Stage3D's bokeh smoothing. A panel of white type on dark, seen low across it with 60 px of
// blur at 100 samples: `smooth` with the smoothing (the default), `raw` without (`smoothBokeh={false}`).
// Run: pnpm launch still test-bokeh --at smooth:+30,raw:+30 --grid
// Expect (magnify the lower rows: --crop 100,700,700,380): in `smooth`, the type away from the focus
// line blurs evenly, like a lens; in `raw`, the same rows break into striated, stepped copies of
// themselves. The focused line is equally sharp in both.
import { defineVideo } from "@intentface-launch/core";
import { fillDistance, frame, Panel, Stage3D, threePoint } from "@intentface-launch/three";

const LINES = [
  "Ship the task feature",
  "Write release notes",
  "Record the demo",
  "Plan next sprint",
  "Reply to feedback",
];

function Card() {
  return (
    <div
      style={{
        width: 1200,
        height: 900,
        background: "#16161b",
        color: "#f4f4f6",
        font: "600 64px/1 Inter, system-ui, sans-serif",
        padding: 80,
        boxSizing: "border-box",
        display: "grid",
        gap: 70,
      }}
    >
      <div style={{ fontSize: 110, letterSpacing: "-0.03em" }}>This week</div>
      {LINES.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

const scene = (smoothBokeh: boolean) =>
  function Bokeh() {
    const lens = frame({
      target: [-120, 70, 0],
      distance: fillDistance(520, 30),
      elevation: 30,
      azimuth: 192,
      fov: 30,
      blur: { px: 60, depth: 240 },
    });
    return (
      <Stage3D
        lens={() => lens}
        background="#000"
        environment={{ preset: "dark", intensity: 0.6 }}
        lights={() => threePoint([0, 0, 0], { distance: 2600, key: 1.6, fill: 0.3, rim: 3 })}
        samples={100}
        smoothBokeh={smoothBokeh}
      >
        <Panel
          region={{ x: 0, y: 0, width: 1200, height: 900 }}
          radius={32}
          depth={20}
          resolution={3}
          surface="#16161b"
        >
          <Card />
        </Panel>
      </Stage3D>
    );
  };

export default defineVideo({
  id: "test-bokeh",
  title: "Test: bokeh smoothing",
  shots: [
    { id: "smooth", title: "Smoothed", duration: 60, component: scene(true) },
    { id: "raw", title: "Raw samples", duration: 60, component: scene(false) },
  ],
});
