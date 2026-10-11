import { ease, interpolate, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import {
  Floor,
  fillDistance,
  Laptop,
  Phone,
  rig,
  Stage3D,
  samplesForBlur,
  sweep,
  Tablet,
  threePoint,
} from "@intentface-launch/three";
import type { ReactNode } from "react";
import { PhotoFeedScreen, ShortVideoScreen, VideoSiteScreen } from "./feed";
import { T } from "./timing";

// Every platform, as a family of devices on black, each on a different kind of platform: a video
// site on the laptop (16:9), a photo feed on the tablet (1:1), a short-video app on the phone (9:16),
// all playing one clip laid out for each. The laptop's lid opens on the first beat and the other
// screens wake; on the lift the button on all three becomes "Launched" on the same frame. Generic
// hardware and platform chrome, no real product's name or marks.

const FLOOR = -820;
const FOV = 26;
const LENGTH = T.breakdown - T.sizes[0];

/** A screen waking: from black to its picture over a few frames. */
function Wake({ at, children }: { at: number; children: ReactNode }) {
  const frame = useFrame();
  const on = interpolate(frame, [at, at + 14], [0, 1], { easing: ease.out });
  return (
    <div style={{ position: "relative", background: "#000" }}>
      <div style={{ opacity: on }}>{children}</div>
    </div>
  );
}

const keyLight = sweep({ from: [-3000, 1400, 1600], to: [2200, 1400, 1600], at: 0, duration: LENGTH, width: 500 });

export function SizesFamily() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  // The lid opens on a spring, from nearly closed, as the line lands.
  const lid = springTo(
    frame,
    fps,
    [
      { at: -1, to: 0.12 },
      { at: 30, to: 1 },
    ],
    { duration: 70, bounce: 0.05 },
  );
  // The camera starts looking high, so the family rises into frame from below, then settles and
  // pushes in slowly for the rest of the shot.
  const PAN = 54;
  const lens = rig([
    {
      at: 0,
      target: [40, FLOOR + 1650, -720],
      distance: fillDistance(2150, FOV),
      elevation: 74,
      azimuth: 186,
      fov: FOV,
      blur: { px: 4, depth: 600 },
    },
    {
      at: PAN,
      target: [30, FLOOR + 560, -720],
      distance: fillDistance(2120, FOV),
      elevation: 78,
      azimuth: 183,
      fov: FOV,
      blur: { px: 4, depth: 600 },
      easing: ease.out,
    },
    {
      at: LENGTH,
      target: [10, FLOOR + 570, -720],
      distance: fillDistance(2020, FOV),
      elevation: 80,
      azimuth: 179,
      fov: FOV,
      blur: { px: 4, depth: 600 },
      easing: ease.linear,
    },
  ]);
  return (
    <Stage3D
      lens={lens}
      background="#000"
      environment={{ preset: "softbox", intensity: 0.7 }}
      lights={(f) => [
        ...threePoint([0, FLOOR + 500, 0], { distance: 3200, key: 1.4, fill: 0.35, rim: 3 }),
        keyLight(f),
      ]}
      samples={samplesForBlur(4, { min: 32 })}
      style={{ opacity: interpolate(frame, [LENGTH - 16, LENGTH - 2], [1, 0], { easing: ease.in }) }}
    >
      <Floor y={FLOOR} reflect={0.12} roughness={0.03} shadow={0.4} fade={[300, 1300]} />
      <Laptop open={() => lid} reflection={0.1} pose={() => ({ position: [0, FLOOR, -120] })}>
        <Wake at={36}>
          <VideoSiteScreen />
        </Wake>
      </Laptop>
      <Tablet pose={() => ({ position: [-1120, FLOOR + 616 * 0.82 - 30, -640], rotation: [0, 14, 0], scale: 0.82 })}>
        <Wake at={44}>
          <PhotoFeedScreen />
        </Wake>
      </Tablet>
      <Phone pose={() => ({ position: [1030, FLOOR + 435 * 0.86 - 30, -540], rotation: [0, -16, 0], scale: 0.86 })}>
        <Wake at={52}>
          <ShortVideoScreen />
        </Wake>
      </Phone>
    </Stage3D>
  );
}
