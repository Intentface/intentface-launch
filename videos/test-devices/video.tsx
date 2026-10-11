// Test: the 3D devices (Phone, Laptop and its hinge, Tablet) and a Panel, with live DOM screens.
// Run: pnpm launch still test-devices --at phone:+120,laptop:+120,hinge:+100,tablet:+60 --grid --samples 8
// Expect: each device lit over a reflective floor, the laptop's screen showing the dashboard.

import { defineVideo, ease, interpolate } from "@intentface-launch/core";
import { Floor, fillDistance, Laptop, Panel, Phone, rig, Stage3D, Tablet, threePoint } from "@intentface-launch/three";

const font = "Inter, system-ui, sans-serif";
const SAMPLES = 96;

function PhoneScreen() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: "linear-gradient(180deg, #f6f5f2, #ecebe7)",
        fontFamily: font,
        color: "#18181b",
        padding: "64px 22px 0",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 15, color: "#71717a", fontWeight: 500 }}>Tuesday</div>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8, marginTop: 4 }}>Today</div>
      {["Design review", "Ship the launch video", "Lunch with Ana", "Read the brief"].map((t, i) => (
        <div
          key={t}
          style={{
            marginTop: i === 0 ? 24 : 12,
            padding: "18px 18px",
            borderRadius: 18,
            background: i === 1 ? "#18181b" : "white",
            color: i === 1 ? "white" : "#18181b",
            boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {t}
          <div style={{ fontSize: 14, fontWeight: 400, opacity: 0.6, marginTop: 4 }}>{`${9 + i * 2}:00`}</div>
        </div>
      ))}
    </div>
  );
}

function LaptopScreen() {
  const bars = [42, 58, 51, 74, 66, 88, 79, 95, 84, 102, 97, 118];
  return (
    <div
      style={{
        width: 1440,
        height: 900,
        display: "flex",
        background: "#101114",
        fontFamily: font,
        color: "#ececf1",
      }}
    >
      <div style={{ width: 240, background: "#16171b", padding: 28, boxSizing: "border-box" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Northwind</div>
        {["Overview", "Customers", "Revenue", "Settings"].map((t, i) => (
          <div
            key={t}
            style={{
              marginTop: i === 0 ? 36 : 8,
              padding: "10px 14px",
              borderRadius: 10,
              background: i === 0 ? "#26282f" : "transparent",
              fontSize: 17,
              color: i === 0 ? "white" : "#9a9cab",
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 48 }}>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Revenue</div>
        <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
          {[
            ["$48.2k", "This month"],
            ["+18%", "Growth"],
            ["1,204", "Customers"],
          ].map(([v, l]) => (
            <div key={l} style={{ flex: 1, background: "#1b1c21", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 16, color: "#9a9cab", marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 28,
            height: 420,
            background: "#1b1c21",
            borderRadius: 16,
            padding: 32,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "flex-end",
            gap: 18,
          }}
        >
          {bars.map((b, i) => (
            <div
              key={`${i}-${b}`}
              style={{
                flex: 1,
                height: b * 2.8,
                borderRadius: 8,
                background: i === bars.length - 1 ? "#7c8cff" : "#3a3d4a",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const env = { preset: "softbox" as const, intensity: 1 };

function PhoneShot() {
  return (
    <Stage3D
      lens={rig([{ at: 0, target: [0, 0, 0], distance: fillDistance(1250, 30), elevation: 82, azimuth: 180 }])}
      lights={() => threePoint([0, 0, 0])}
      environment={env}
      background="#0d0e11"
      samples={SAMPLES}
    >
      <Floor y={-470} reflect={0.25} roughness={0.3} shadow={0.35} fade={[600, 1600]} />
      <Phone pose={(f) => ({ rotation: [0, interpolate(f, [0, 240], [-30, 330], { easing: ease.inOut }), 0] })}>
        <PhoneScreen />
      </Phone>
    </Stage3D>
  );
}

function LaptopShot() {
  return (
    <Stage3D
      lens={rig([
        { at: 0, target: [0, -60, 0], distance: fillDistance(1500, 30), elevation: 70, azimuth: 200 },
        { at: 240, target: [0, 0, 0], distance: fillDistance(1350, 30), elevation: 78, azimuth: 188 },
      ])}
      lights={() => threePoint([0, 0, 0], { distance: 2400 })}
      environment={env}
      background="#0d0e11"
      samples={SAMPLES}
    >
      <Floor y={-400} reflect={0.25} roughness={0.3} shadow={0.4} fade={[900, 2400]} />
      <Laptop
        open={(f) => interpolate(f, [20, 200], [0, 1], { easing: ease.inOut })}
        pose={() => ({ position: [0, -400, 0] })}
      >
        <LaptopScreen />
      </Laptop>
    </Stage3D>
  );
}

function HingeShot() {
  return (
    <Stage3D
      lens={rig([{ at: 0, target: [740, -340, -470], distance: fillDistance(420, 30), elevation: 8, azimuth: 102 }])}
      lights={() => threePoint([0, 0, 0], { distance: 2400 })}
      environment={env}
      background="#0d0e11"
      samples={SAMPLES}
    >
      <Floor y={-400} reflect={0.25} roughness={0.3} shadow={0.4} fade={[900, 2400]} />
      <Laptop open={(f) => interpolate(f, [0, 120], [0, 1])} pose={() => ({ position: [0, -400, 0] })}>
        <LaptopScreen />
      </Laptop>
    </Stage3D>
  );
}

function TabletShot() {
  return (
    <Stage3D
      lens={rig([{ at: 0, target: [0, 0, 0], distance: fillDistance(1500, 30), elevation: 80, azimuth: 190 }])}
      lights={() => threePoint([0, 0, 0])}
      environment={env}
      background="#0d0e11"
      samples={SAMPLES}
    >
      <Tablet pose={(f) => ({ rotation: [0, interpolate(f, [0, 120], [-25, 205]), 0] })}>
        <div
          style={{
            width: 820,
            height: 1180,
            background: "#e9edf5",
            fontFamily: font,
            padding: 48,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700 }}>Library</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 28 }}>
            {["#7c8cff", "#ff9f7c", "#7cd8b0", "#f2c94c", "#c08cff", "#4cc3f2"].map((c) => (
              <div key={c} style={{ height: 240, borderRadius: 20, background: c }} />
            ))}
          </div>
        </div>
      </Tablet>
    </Stage3D>
  );
}

function PanelShot() {
  return (
    <Stage3D
      lens={rig([{ at: 0, target: [0, 0, 0], distance: fillDistance(1100, 30), elevation: 75, azimuth: 200 }])}
      lights={() => threePoint([0, 0, 0])}
      environment={env}
      background="#0d0e11"
      samples={SAMPLES}
    >
      <Panel size={[390, 844]} radius={40} depth={10} pose={() => ({ rotation: [0, 20, 0] })}>
        <PhoneScreen />
      </Panel>
    </Stage3D>
  );
}

export default defineVideo({
  id: "test-devices",
  title: "Devices",
  logline: "Scratch test for the generic Phone and Laptop.",
  background: "#0d0e11",
  shots: [
    { id: "phone", title: "Phone", duration: 240, component: PhoneShot },
    { id: "laptop", title: "Laptop", duration: 240, component: LaptopShot },
    { id: "hinge", title: "Hinge", duration: 130, component: HingeShot },
    { id: "tablet", title: "Tablet", duration: 120, component: TabletShot },
    { id: "panel", title: "Panel", duration: 30, component: PanelShot },
  ],
});
