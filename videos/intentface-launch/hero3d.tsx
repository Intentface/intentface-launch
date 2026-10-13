import { ease, interpolate, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Cursor } from "@intentface-launch/core/kit";
import {
  fillDistance,
  framingAt,
  frame as lensFor,
  Panel,
  type RigKey,
  Stage3D,
  samplesForBlur,
  sweep,
  threePoint,
} from "@intentface-launch/three";
import type { ReactNode } from "react";
import { T } from "./timing";
import { APP, AREAS, type Cues, PORTRAIT_AREAS, SHAPES, TodoAny } from "./todo-app";

// The video Claude made, on the drop: the to-do app's window as a slab of dark
// glass with a lit edge, on black, through a real lens. It opens on the
// closeup the note asked for, low across the first task with its checkbox in
// focus and the rest in bokeh; the task is checked on the downbeat; then one
// continuous pull back, the week filling in, to straight on at one world unit
// per pixel, so the last frame is the flat app the next shot starts from.
// In the 4:5 cut the slab is the app's 4:5 layout. On the film's clock.

export const FOV = 30;
/** The slab's thickness; its face sits at z 0, on the plane the flat handoff is measured in. */
const DEPTH = 30;

/**
 * The scene for the frame's shape: in 16:9 the wide app, in 4:5 its 4:5 layout. Content is the
 * frame's size, so straight on at `flat` one world unit is one pixel and the flat app lands exactly.
 * In 4:5 the closeup aims nearer the checkbox and stands a little further back, for the narrower frame.
 */
function layout(narrow: boolean) {
  const content = SHAPES[narrow ? "portrait" : "wide"];
  const area = narrow ? PORTRAIT_AREAS : AREAS;
  /** A content point in world units: origin at the content's centre, y up. */
  const world = (x: number, y: number, z = 0): [number, number, number] => [
    x - content.width / 2,
    content.height / 2 - y,
    z,
  ];
  const cb = area.checkbox;
  const box = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
  return {
    narrow,
    content,
    window: area.window,
    world,
    box,
    aim: world(box.x + (narrow ? 185 : 170), box.y),
    near: narrow ? 1.7 : 1,
    flat: fillDistance(content.height, FOV),
    cursorFrom: { x: box.x + (narrow ? 380 : 560), y: box.y + 40 },
  };
}
type Layout = ReturnType<typeof layout>;

/** The window as a slab: the region is the window itself, so its corners are the slab's. */
export function AppSlab({ l, children, resolution = 3 }: { l: Layout; children: ReactNode; resolution?: number }) {
  const W = l.window;
  return (
    <Panel
      region={W}
      radius={36}
      depth={DEPTH}
      bevel={4}
      resolution={resolution}
      lit={0}
      edge="#2a2a31"
      surface={APP.window}
      pose={() => ({ position: l.world(W.x + W.width / 2, W.y + W.height / 2, -DEPTH / 2) })}
    >
      <div style={{ position: "relative", ...l.content, background: APP.window }}>{children}</div>
    </Panel>
  );
}

// After the click the app answers: the other tasks tick, the count climbs, the chart draws and the
// team arrives while the camera pulls back, so the reveal lands on a full week.
export const VIDEO_CUES: Cues = {
  check: T.check,
  ticks: T.check + 34,
  count: T.check + 44,
  chart: T.check + 64,
  team: T.check + 96,
};

const light = sweep({
  from: [-2600, 900, 700],
  to: [2600, 900, 700],
  at: T.drop,
  duration: T.file - T.drop,
  width: 260,
  intensity: 5,
});

/** The camera lands straight on here; the flat window dissolves in over the slab before the cut. */
const LANDS = T.file - 16;

export function VideoScene3D() {
  const frame = useFrame();
  const l = layout(useVideoInfo().format.aspect < 1);
  const AIM = l.aim;
  const BOX = l.box;
  const flat = interpolate(frame, [LANDS - 2, T.file - 3], [0, 1], { easing: ease.inOut });
  const pull = T.check + 30;
  // A slow dolly onto the checkbox to the click, a drift while it fills, then one continuous pull
  // back to straight on. No key in the middle of the pull: a key there stops the camera.
  const keys: RigKey[] = [
    {
      at: T.drop,
      target: [AIM[0] - 40, AIM[1] - 4, 0],
      distance: fillDistance(400 * l.near, FOV),
      elevation: 30,
      azimuth: 192,
      fov: FOV,
    },
    {
      at: T.check,
      target: [AIM[0], AIM[1], 0],
      distance: fillDistance(350 * l.near, FOV),
      elevation: 36,
      azimuth: 188,
      fov: FOV,
      easing: ease.inOut,
    },
    {
      at: pull,
      target: [AIM[0] + 6, AIM[1], 0],
      distance: fillDistance(340 * l.near, FOV),
      elevation: 37,
      azimuth: 187.5,
      fov: FOV,
      easing: ease.linear,
    },
    { at: LANDS, target: [0, 0, 0], distance: l.flat, elevation: 90, azimuth: 180, fov: FOV, easing: ease.inOut },
  ];
  // Focus on its own curve: shallow on the checkbox, then the lens stops down in the first half of
  // the pull, so the task stays sharp as it leaves and the whole app is sharp when it arrives.
  const blurAt = (f: number) => interpolate(f, [pull, pull + (LANDS - pull) * 0.5], [50, 0], { easing: ease.out });
  const lens = (f: number) => lensFor({ ...framingAt(keys, f), blur: { px: blurAt(f), depth: 240 } });
  return (
    <>
      <Stage3D
        lens={lens}
        background="#000"
        environment={{ preset: "dark", intensity: 0.6 }}
        lights={(f) => [...threePoint([0, 0, 0], { distance: 2600, key: 1.6, fill: 0.3, rim: 3 }), light(f)]}
        samples={(f) => samplesForBlur(blurAt(f))}
      >
        <AppSlab l={l}>
          <TodoAny shape={l.narrow ? "portrait" : "wide"} cues={VIDEO_CUES} />
          <Cursor
            size={22}
            keys={[
              // In along the task's own row, on the focus plane, so it is sharp, not a disc.
              { at: T.drop, to: l.cursorFrom },
              { at: T.check, to: BOX, click: true, hover: 12 },
            ]}
            hidden={[[T.check + 26, T.file + 1]]}
          />
        </AppSlab>
      </Stage3D>
      {flat > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: flat, background: "#000" }}>
          <TodoAny shape={l.narrow ? "portrait" : "wide"} cues={VIDEO_CUES} />
        </div>
      )}
    </>
  );
}
