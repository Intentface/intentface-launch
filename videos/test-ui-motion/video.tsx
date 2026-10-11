// Test: UI motion. One shape through three states (springTo and Swap), a tab indicator that
// stretches toward where it goes (edges), a slider dragged with dragValue and rubberband.
// Run: pnpm launch sheet test-ui-motion --shot morph --every 4 (and --shot tabs, --shot slider)
// Expect: even steps between tiles, no stop at a waypoint, content trailing its container.

import { defineVideo, springs, springTo, tempo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Camera, Cursor, type CursorKey, dragValue, edges, rubberband, Swap } from "@intentface-launch/core/kit";

const t = tempo(120, 60);
const ink = "#141414";
const canvas = "#e9e6e1";
const font = "Geist, Inter, system-ui, sans-serif";

/** Button → loader → check: one shape, its size and radius on springs, content swapped inside. */
function Morph() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const click = t.beats(1);
  const done = t.beats(3);
  const at = (to: number[]) => to.map((v, i) => ({ at: [0, click, done][i], to: v }));
  const width = springTo(frame, fps, at([360, 120, 120]), springs.snappy);
  const radius = springTo(frame, fps, at([24, 60, 60]), springs.snappy);
  const spin = ((frame - click) / fps) * 360;
  const cursor: CursorKey[] = [
    { at: 0, to: { x: 1300, y: 800 } },
    { at: click, to: { x: 960, y: 540 }, click: true },
    { at: t.beats(4), to: { x: 1250, y: 760 } },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: canvas, fontFamily: font }}>
      <Camera
        keys={[
          { at: 0, view: { x: 960, y: 540, zoom: 1 } },
          { at: t.beats(2), view: { x: 960, y: 540, zoom: 1.6 }, travel: t.beats(2) },
          { at: t.beats(4), view: { x: 960, y: 540, zoom: 1.3 }, travel: t.beats(2.5) },
        ]}
      >
        <div
          style={{
            position: "absolute",
            left: 960 - width / 2,
            top: 480,
            width,
            height: 120,
            borderRadius: radius,
            background: ink,
            color: "white",
            display: "grid",
            fontSize: 40,
            fontWeight: 500,
          }}
        >
          <Swap
            items={[
              { at: 0, content: "Get started" },
              {
                at: click,
                content: (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      border: "5px solid rgb(255 255 255 / 0.25)",
                      borderTopColor: "white",
                      transform: `rotate(${spin}deg)`,
                    }}
                  />
                ),
              },
              {
                at: done,
                content: (
                  <svg
                    aria-hidden="true"
                    width="56"
                    height="56"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
        <Cursor keys={cursor} />
      </Camera>
    </div>
  );
}

const TABS = ["Overview", "Activity", "Settings", "Billing"];
const TAB_X = [560, 780, 1000, 1220];
const TAB_W = [200, 190, 190, 150];

/** Tabs: the indicator's edges ride different springs, so it stretches toward the next tab. */
function Tabs() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const order = [0, 2, 3, 1];
  const stops = order.map((tab, i) => ({
    at: t.beats(i + 1) - (i === 0 ? t.beats(1) : 0),
    start: TAB_X[tab],
    end: TAB_X[tab] + TAB_W[tab],
  }));
  const bar = edges(frame, fps, stops);
  const cursor: CursorKey[] = [
    { at: 0, to: { x: 700, y: 700 } },
    ...order.slice(1).map((tab, i) => ({
      at: t.beats(i + 2),
      travel: 22,
      to: { x: TAB_X[tab] + TAB_W[tab] / 2, y: 540 },
      click: true,
    })),
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: canvas, fontFamily: font }}>
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 480,
          width: 860,
          height: 120,
          borderRadius: 60,
          background: "white",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bar.start,
          top: 492,
          width: bar.size,
          height: 96,
          borderRadius: 48,
          background: ink,
        }}
      />
      {TABS.map((label, i) => {
        const on = Math.max(0, 1 - Math.abs(bar.center - (TAB_X[i] + TAB_W[i] / 2)) / 120);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: TAB_X[i],
              top: 492,
              width: TAB_W[i],
              height: 96,
              display: "grid",
              placeItems: "center",
              fontSize: 32,
              fontWeight: 500,
              color: `color-mix(in srgb, white ${on * 100}%, ${ink})`,
            }}
          >
            {label}
          </div>
        );
      })}
      <Cursor keys={cursor} />
    </div>
  );
}

/** A slider dragged past its end: it gives, then springs back when let go. */
function Slider() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const left = 560;
  const length = 800;
  const keys: CursorKey[] = [
    { at: 0, to: { x: 900, y: 760 } },
    { at: t.beats(1), to: { x: left + length * 0.3, y: 540 } },
    { at: t.beats(2.5), to: { x: left + length * 1.4, y: 548 }, drag: true },
    { at: t.beats(4), to: { x: 1500, y: 720 } },
  ];
  const value = dragValue(frame, fps, {
    keys,
    initial: 0.3,
    value: (p) => rubberband((p.x - left) / length, 0, 1),
    rest: (v) => Math.min(1, Math.max(0, v)),
  });
  const over = Math.max(0, value - 1);
  return (
    <div style={{ position: "absolute", inset: 0, background: canvas }}>
      <div
        style={{
          position: "absolute",
          left,
          top: 540 - 20 * (1 - over * 2),
          width: length * (1 + over),
          height: 40 * (1 - over * 2),
          borderRadius: 20,
          background: "rgb(20 20 20 / 0.12)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${(Math.min(value, 1 + over) / (1 + over)) * 100}%`, height: "100%", background: ink }} />
      </div>
      <Cursor keys={keys} />
    </div>
  );
}

export default defineVideo({
  id: "test-ui-motion",
  title: "Fluid motion primitives",
  logline: "Scratch test for springTo, edges, Swap and drags.",
  bpm: t.bpm,
  background: canvas,
  shots: [
    { id: "morph", title: "Morph", duration: t.beats(5), component: Morph },
    { id: "tabs", title: "Tabs", duration: t.beats(5), component: Tabs },
    { id: "slider", title: "Slider", duration: t.beats(5), component: Slider },
  ],
});
