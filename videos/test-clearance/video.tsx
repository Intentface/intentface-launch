// Test: the clearance check finds overlay type crowding a panel, and nothing else.
// Run: pnpm launch board test-clearance --no-animatic (or pnpm launch check test-clearance)
// Expect: one clearance error, in shot "touching" ("touches or overlaps a box"). The other shots
// pass: a line with room under a panel, a label sitting on its own card, terminal text on a panel
// that covers another panel, a small UI label close to a panel, and a line marked to touch.

import { defineVideo } from "@intentface-launch/core";
import { Camera } from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";

const ground: CSSProperties = { position: "absolute", inset: 0, background: "#0b0c0d", fontFamily: "sans-serif" };
const panel = (x: number, y: number, width: number, height: number, extra?: CSSProperties): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  width,
  height,
  background: "#1a1d1f",
  borderRadius: 18,
  outline: "1px solid rgb(255 255 255 / 0.1)",
  ...extra,
});
const line = (top: number, size = 64): CSSProperties => ({
  position: "absolute",
  left: 0,
  right: 0,
  top,
  textAlign: "center",
  font: `600 ${size}px/1.1 sans-serif`,
  color: "#f5f5f5",
});

/** The bug this check exists for: a panel inside a camera moved down onto a line set in frame pixels. */
function Touching() {
  return (
    <div style={ground}>
      <Camera keys={[{ at: 0, view: { x: 960, y: 500, zoom: 1 } }]} contentWidth={1920} contentHeight={1080}>
        <div style={panel(250, 96, 1420, 760)} />
      </Camera>
      <div style={line(892)}>That's the whole backend.</div>
    </div>
  );
}

function Room() {
  return (
    <div style={ground}>
      <div style={panel(250, 92, 1420, 712)} />
      <div style={line(856)}>That's the whole backend.</div>
    </div>
  );
}

function OnItsCard() {
  return (
    <div style={ground}>
      <div style={{ ...panel(460, 290, 1000, 500), padding: 48 }}>
        <div style={{ font: "600 72px/1.1 sans-serif", color: "#f5f5f5" }}>A label on its card.</div>
      </div>
    </div>
  );
}

function Stacked({ children }: { children?: ReactNode }) {
  return (
    <div style={ground}>
      <div style={panel(90, 100, 1740, 700)} />
      <div style={{ ...panel(360, 600, 1200, 380), padding: 40, background: "#202426" }}>
        <div style={{ font: "400 44px/1.4 monospace", color: "#f5f5f5" }}>&gt; Text on the panel on top.</div>
        {children}
      </div>
    </div>
  );
}

function SmallLabel() {
  return (
    <div style={ground}>
      <div style={{ position: "absolute", left: 460, top: 452, font: "500 30px/1 sans-serif", color: "#aaa" }}>
        Sara
      </div>
      <div style={panel(460, 492, 1040, 210)} />
    </div>
  );
}

function MarkedOk() {
  return (
    <div style={ground}>
      <div style={panel(250, 96, 1420, 800)} />
      <div data-launch-clearance="ok" style={line(880)}>
        Meant to overlap the panel.
      </div>
    </div>
  );
}

export default defineVideo({
  id: "test-clearance",
  title: "Test: clearance",
  fps: 60,
  background: "#0b0c0d",
  shots: [
    { id: "touching", title: "Touching", duration: 180, component: Touching },
    { id: "room", title: "Room", duration: 180, component: Room },
    { id: "on-its-card", title: "On its card", duration: 180, component: OnItsCard },
    { id: "stacked", title: "Stacked", duration: 180, component: () => <Stacked /> },
    { id: "small-label", title: "Small label", duration: 180, component: SmallLabel },
    { id: "marked-ok", title: "Marked ok", duration: 180, component: MarkedOk },
  ],
});
