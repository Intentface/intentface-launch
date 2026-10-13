// Test: check's `ui` warning, for the product's UI shown too far away to read. The same made-up app
// (14 px body text, marked data-launch-check="off" as product UI) framed whole on the frame, then
// pushed in on one panel, then a field of small tiles marked "decor" behind a headline, then the app
// as a Snapshot shows it (a same-origin page in an iframe), framed whole.
// Run: pnpm launch check test-check-ui-distance
// Expect: two `ui` warnings, on "far" and "frame" (3 s each, text 19 px at 1080p); none on "close"
// (the same text at 2.2×, about 31 px) or "decor"; no errors. The shots are still calibration frames, so
// `still` and `cuts` warnings are expected too.

import { defineVideo, waitFor } from "@intentface-launch/core";
import { Camera } from "@intentface-launch/core/kit";
import { useState } from "react";

const sans = '"Studio Sans", system-ui, sans-serif';
const ROWS = ["Website ready", "Launch video", "Email to users", "Press kit", "Go live", "Thank the team"];

/** A 1440 × 900 app with a sidebar and a list, its body text at 14 px, as most web apps set it. */
function App() {
  return (
    <div
      data-launch-check="off"
      style={{
        position: "absolute",
        left: 240,
        top: 90,
        width: 1440,
        height: 900,
        display: "flex",
        background: "#ffffff",
        color: "#16161a",
        fontFamily: sans,
        fontSize: 14,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <aside style={{ width: 240, padding: 20, background: "#f2f1ee" }}>
        {["Home", "Projects", "Launches", "Team", "Settings"].map((s) => (
          <div key={s} style={{ padding: "8px 0" }}>
            {s}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, padding: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Launch checklist</div>
        {ROWS.map((r) => (
          <div key={r} style={{ padding: "10px 0", borderBottom: "1px solid #ececec" }}>
            {r} · owner, due date and notes for this step
          </div>
        ))}
      </main>
    </div>
  );
}

const ground = { position: "absolute", inset: 0, background: "#e9e7e2" } as const;

/** The whole app on the frame: 14 px text lands at about 19 px. */
function Far() {
  return (
    <div style={ground}>
      <Camera keys={[{ at: 0, view: { x: 960, y: 540, zoom: 1.333 } }]}>
        <App />
      </Camera>
    </div>
  );
}

/** Pushed in on the list: the same text at about 31 px. */
function Close() {
  return (
    <div style={ground}>
      <Camera keys={[{ at: 0, view: { x: 760, y: 330, zoom: 2.2 } }]}>
        <App />
      </Camera>
    </div>
  );
}

const PAGE = `<!doctype html><body style="margin:0;font:14px system-ui;background:#fff;color:#16161a">
<div style="padding:32px"><div style="font-size:20px;font-weight:600">Launch checklist</div>
${ROWS.map((r) => `<div style="padding:10px 0;border-bottom:1px solid #ececec">${r} · owner, due date and notes</div>`).join("")}
</div></body>`;

/** The app as a Snapshot shows it: a same-origin page in an iframe, framed whole. */
function Frame() {
  const [loaded] = useState(() => {
    let done = () => {};
    waitFor(new Promise<void>((resolve) => (done = resolve)), "test page");
    return () => done();
  });
  return (
    <div style={ground}>
      <Camera keys={[{ at: 0, view: { x: 960, y: 540, zoom: 1.333 } }]}>
        <iframe
          title="Example app"
          srcDoc={PAGE}
          onLoad={loaded}
          style={{ position: "absolute", left: 240, top: 90, width: 1440, height: 900, border: 0, borderRadius: 14 }}
        />
      </Camera>
    </div>
  );
}

/** Small tiles that are decoration, not UI, around a headline that is read. */
function Decor() {
  return (
    <div style={{ ...ground, fontFamily: sans }}>
      <div data-launch-check="decor">
        {Array.from({ length: 60 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 120 + (i % 10) * 168,
              top: 80 + Math.floor(i / 10) * 160,
              fontSize: 13,
              color: "#6b6b76",
            }}
          >
            Integration {i + 1}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          textAlign: "center",
          fontSize: 96,
          fontWeight: 600,
          color: "#16161a",
        }}
      >
        <span style={{ background: "#e9e7e2", padding: "0 32px" }}>Works with yours</span>
      </div>
    </div>
  );
}

export default defineVideo({
  id: "test-check-ui-distance",
  title: "UI distance",
  logline: "Calibrates check's ui warning: a UI shown too far away to read.",
  background: "#e9e7e2",
  shots: [
    { id: "far", title: "Far", duration: 180, component: Far, offBeat: true },
    { id: "close", title: "Close", duration: 180, component: Close, offBeat: true },
    { id: "decor", title: "Decor", duration: 180, component: Decor, offBeat: true },
    { id: "frame", title: "Frame", duration: 180, component: Frame, offBeat: true },
  ],
});
