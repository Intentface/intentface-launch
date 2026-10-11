import { ease, interpolate, useFrame } from "@intentface-launch/core";
import { Cursor } from "@intentface-launch/core/kit";
import {
  fillDistance,
  framingAt,
  frame as lensFor,
  Panel,
  type RigKey,
  rig,
  Stage3D,
  samplesForBlur,
  sweep,
  threePoint,
} from "@intentface-launch/three";
import type { ReactNode } from "react";
import { AREAS, type Cues, ORBIT, Orbit } from "./sample-app";
import { T } from "./timing";

// The app in 3D: Orbit's window as a slab of dark glass with a lit edge, on black, through a real
// lens. The camera starts low across the window on the Launch button with the rest falling into
// bokeh, and ends straight on at one world unit per pixel, so the last frame is the flat window
// that the code shot starts from.

export const FOV = 30;
/** Straight on, one world unit per pixel at 1080p. */
export const FLAT = fillDistance(1080, FOV);
const W = AREAS.window;
/** The slab's thickness; its face sits at z 0, on the plane the flat handoff is measured in. */
const DEPTH = 30;

/** A content point (CSS pixels of the 1920×1080 app) in world units: origin at the centre, y up. */
export const world = (x: number, y: number, z = 0): [number, number, number] => [x - 960, 540 - y, z];

const BUTTON = world(AREAS.button.x + AREAS.button.width / 2, AREAS.button.y + AREAS.button.height / 2);

/** The window as a slab: the region is the window itself, so its corners are the slab's. */
export function OrbitSlab({ children, resolution = 2.5 }: { children: ReactNode; resolution?: number }) {
  return (
    <Panel
      region={W}
      radius={36}
      depth={DEPTH}
      bevel={4}
      resolution={resolution}
      lit={0}
      edge="#2a2a31"
      surface={ORBIT.window}
      pose={() => ({ position: world(W.x + W.width / 2, W.y + W.height / 2, -DEPTH / 2) })}
    >
      <div style={{ position: "relative", width: 1920, height: 1080, background: ORBIT.window }}>{children}</div>
    </Panel>
  );
}

// After the click the app answers: the checklist ticks, sign-ups count, the chart draws and the team
// arrives while the camera pulls back, so the reveal lands on a full app.
const CLICK_CUES: Cues = {
  click: T.click,
  ticks: T.click + 46,
  count: T.click + 64,
  chart: T.click + 92,
  team: T.click + 118,
};
const CENTRE = { x: AREAS.button.x + AREAS.button.width / 2, y: AREAS.button.y + AREAS.button.height / 2 };

const light = sweep({
  from: [-2600, 900, 700],
  to: [2600, 900, 700],
  at: 0,
  duration: T.code,
  width: 260,
  intensity: 5,
});

/** The camera lands straight on here; the flat window dissolves in over the slab before the cut. */
const LANDS = T.code - 16;

export function AppScene3D() {
  const frame = useFrame();
  const flat = interpolate(frame, [LANDS - 2, T.code - 3], [0, 1], { easing: ease.inOut });
  // The film opens on light arriving out of black.
  const dark = interpolate(frame, [0, 36], [1, 0], { easing: ease.out });
  const pull = T.click + 70;
  // The path: a slow dolly to the click, a drift while "Launched" lands, then one continuous pull
  // back to straight on. No key in the middle of the pull: a key there stops the camera.
  const keys: RigKey[] = [
    {
      at: 0,
      target: [BUTTON[0] - 60, BUTTON[1] - 10, 0],
      distance: fillDistance(600, FOV),
      elevation: 30,
      azimuth: 190,
      fov: FOV,
    },
    {
      at: T.click,
      target: [BUTTON[0] - 10, BUTTON[1] - 10, 0],
      distance: fillDistance(440, FOV),
      elevation: 40,
      azimuth: 186,
      fov: FOV,
      easing: ease.inOut,
    },
    {
      at: pull,
      target: [BUTTON[0] - 10, BUTTON[1] - 10, 0],
      distance: fillDistance(425, FOV),
      elevation: 42,
      azimuth: 185.5,
      fov: FOV,
      easing: ease.linear,
    },
    { at: LANDS, target: [0, 0, 0], distance: FLAT, elevation: 90, azimuth: 180, fov: FOV, easing: ease.inOut },
  ];
  // Focus on its own curve: shallow on the button, then the lens stops down in the first half of
  // the pull, so "Launched" stays sharp as it leaves and the whole app is sharp when it arrives.
  const blurAt = (f: number) => interpolate(f, [pull, pull + (LANDS - pull) * 0.5], [80, 0], { easing: ease.out });
  const lens = (f: number) => lensFor({ ...framingAt(keys, f), blur: { px: blurAt(f), depth: 260 } });
  return (
    <>
      <Stage3D
        lens={lens}
        background="#000"
        environment={{ preset: "dark", intensity: 0.6 }}
        lights={(f) => [...threePoint([0, 0, 0], { distance: 2600, key: 1.6, fill: 0.3, rim: 3 }), light(f)]}
        samples={(f) => samplesForBlur(blurAt(f))}
      >
        <OrbitSlab resolution={3}>
          <Orbit cues={CLICK_CUES} />
          <Cursor
            keys={[
              // In from the right edge along the button's row: on the focus plane, so it is sharp, not a disc.
              { at: 40, to: { x: 1960, y: 150 } },
              { at: T.click, to: CENTRE, click: true, hover: 16 },
            ]}
            hidden={[[T.click + 40, T.code + 1]]}
          />
        </OrbitSlab>
      </Stage3D>
      {dark > 0 && <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dark }} />}
      {flat > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: flat, background: "#000" }}>
          <Orbit cues={CLICK_CUES} />
        </div>
      )}
    </>
  );
}

// The reel: the launch video that the code makes, on the drop. The camera glides low across the
// slab and whips to the next part every two beats with the shutter open, each part moving as it
// arrives, then pulls back to the whole window, straight on.
type Stop = { at: number; centre: [number, number]; height: number; elevation: number; azimuth: number };

export function Reel3D() {
  const stops = T.reel.map((r) => r - T.drop);
  const cues: Cues = { click: -100, ticks: stops[1] + 6, count: stops[2] + 4, chart: stops[3] + 2, team: stops[4] + 4 };
  const whip = 14;
  const parts: Stop[] = [
    { at: 0, centre: [640, 250], height: 400, elevation: 40, azimuth: 189 },
    { at: stops[1], centre: [700, 700], height: 560, elevation: 50, azimuth: 172 },
    { at: stops[2], centre: [1510, 310], height: 300, elevation: 50, azimuth: 190 },
    { at: stops[3], centre: [1585, 400], height: 440, elevation: 52, azimuth: 173 },
    { at: stops[4], centre: [1560, 820], height: 400, elevation: 44, azimuth: 189 },
  ];
  const framing = (p: Stop, drift: number) => ({
    target: world(p.centre[0] + drift * 40, p.centre[1]),
    distance: fillDistance(p.height * (1 - drift * 0.08), FOV),
    elevation: p.elevation + drift * 4,
    azimuth: p.azimuth + drift * (p.azimuth > 180 ? -3 : 3),
    fov: FOV,
    blur: { px: 70, depth: 220 },
  });
  const keys: RigKey[] = [];
  parts.forEach((p, i) => {
    // A whip lands on each part; then the camera drifts on it until the next whip sets off.
    keys.push({ at: p.at, ...framing(p, 0), easing: i === 0 ? ease.linear : ease.inOut });
    const next = parts[i + 1]?.at ?? stops[5];
    keys.push({ at: next - (i + 1 < parts.length ? whip : 0), ...framing(p, 1), easing: ease.linear });
  });
  keys.push({
    at: stops[5] + 44,
    target: [0, 0, 0],
    distance: FLAT,
    elevation: 90,
    azimuth: 180,
    fov: FOV,
    blur: { px: 0, depth: 220 },
    easing: ease.inOut,
  });
  const when = stops.slice(1, 5).map((s): [number, number] => [s - whip - 1, s + 1]);
  when.push([stops[5] - 1, stops[5] + 30]);
  return (
    <Stage3D
      lens={rig(keys)}
      background="#000"
      environment={{ preset: "dark", intensity: 0.6 }}
      lights={(f) => [...threePoint([0, 0, 0], { distance: 2600, key: 1.6, fill: 0.3, rim: 3 }), reelLight(f)]}
      shutter={{ angle: 180, when }}
      samples={samplesForBlur(70)}
    >
      <OrbitSlab resolution={3}>
        <Orbit cues={cues} title="Summer launch" />
      </OrbitSlab>
    </Stage3D>
  );
}

const reelLight = sweep({
  from: [2600, 900, 700],
  to: [-2600, 900, 700],
  at: 0,
  duration: 380,
  width: 260,
  intensity: 5,
});
