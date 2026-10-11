// Test: no false crop warnings on ordinary product UI (a photo, a list clipped by its box, a
// path, a browser window) under a camera push and motion blur.
// Run: pnpm launch check test-check-ui
// Expect: ok, no errors or warnings. The UI's text is product UI, so it is not checked.

import { defineVideo, ease, interpolate, useFrame } from "@intentface-launch/core";
import { BrowserWindow, Camera, MotionBlur } from "@intentface-launch/core/kit";

const photo =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="400" height="240"><defs><linearGradient id="g"><stop offset="0" stop-color="#ffb37a"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><rect width="400" height="240" fill="url(#g)"/></svg>`,
  );

function App() {
  const f = useFrame();
  const rows = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div
      style={{
        width: 1280,
        height: 800,
        background: "#f4f4f5",
        color: "#18181b",
        fontFamily: "sans-serif",
        display: "flex",
      }}
    >
      <aside style={{ width: 260, background: "#e4e4e7", padding: 20 }}>
        {rows.slice(0, 6).map((i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", height: 40 }}>
            <svg aria-hidden="true" width={20} height={20} viewBox="0 0 20 20">
              <rect width={20} height={20} rx={4} fill="#71717a" />
            </svg>
            <span style={{ fontSize: 16 }}>Section {i + 1}</span>
          </div>
        ))}
      </aside>
      <main
        style={{
          flex: 1,
          padding: 32,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignContent: "start",
        }}
      >
        <div
          style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgb(0 0 0 / .1)" }}
        >
          <img src={photo} alt="" style={{ display: "block", width: "100%", height: 240, objectFit: "cover" }} />
          <div style={{ padding: 16, fontSize: 20 }}>Harbour festival</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, height: 320 }}>
          {/* A list clipped by its box: designed, not a crop. */}
          <div style={{ height: 280, overflow: "hidden" }}>
            {rows.map((i) => (
              <div
                key={i}
                style={{
                  height: 44,
                  marginTop: i ? 6 : -interpolate(f, [0, 120], [0, 60]),
                  background: "#eef2ff",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                Message {i + 1}
              </div>
            ))}
          </div>
        </div>
        <svg aria-hidden="true" width={300} height={160} viewBox="0 0 300 160" style={{ gridColumn: "span 2" }}>
          <path d="M0 140 C 60 40, 120 120, 180 60 S 280 20, 300 30" stroke="#6366f1" strokeWidth={4} fill="none" />
        </svg>
      </main>
    </div>
  );
}

function Shot() {
  const f = useFrame();
  const x = interpolate(f, [0, 90], [0, 300], { easing: ease.inOut });
  return (
    <Camera
      contentWidth={1280}
      contentHeight={844}
      keys={[
        { at: 0, view: { x: 640, y: 422, zoom: 1.2 } },
        { at: 150, view: { x: 760, y: 360, zoom: 2.2 } },
      ]}
    >
      {/* Product UI: its text is not the video's to read, so only the crop check applies. */}
      <div data-launch-check="off">
        <BrowserWindow url="app.example" width={1280} height={800}>
          <MotionBlur when={[[0, 20]]}>
            <div style={{ transform: `translateX(${x * 0}px)` }}>
              <App />
            </div>
          </MotionBlur>
        </BrowserWindow>
      </div>
    </Camera>
  );
}

export default defineVideo({
  id: "test-check-ui",
  title: "UI false-positive test",
  shots: [{ id: "ui", title: "UI", duration: 180, component: Shot }],
});
