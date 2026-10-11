import { ease, interpolate, useFrame } from "@intentface-launch/core";
import type { CSSProperties } from "react";
import { LaunchButton, ORBIT } from "./sample-app";
import { T } from "./timing";

const SANS = '"Intent Sans", "Helvetica Neue", Arial, sans-serif';
const fill: CSSProperties = { position: "absolute", inset: 0 };

// 9. sizes: one launch clip posted three times: a feed post (16:9), a phone reel (9:16) and a square
// post (1:1), each its own layout of the clip, not a crop. Generic feed chrome, no platform's marks.
// On the lift the button in all three becomes "Launched" on the same frame (one video, three shapes),
// then the likes come in.
export const LIFT = T.sizes[1] - T.sizes[0];
export const FEED = {
  card: "#0f0f12",
  edge: "rgb(255 255 255 / 0.1)",
  ink: "#f4f4f6",
  muted: "rgb(255 255 255 / 0.5)",
  like: "#ff3b5c",
};
export const ICONS = {
  heart: "M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z",
  comment: "M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z",
  repost: "M17 4l3 3-3 3M4 11V9a2 2 0 0 1 2-2h14M7 20l-3-3 3-3M20 13v2a2 2 0 0 1-2 2H4",
  send: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  share: "M14 5l7 7-7 7M21 12H10a7 7 0 0 0-7 7",
  bookmark: "M6 3.5h12v17l-6-4.2-6 4.2z",
};

export function Icon({
  d,
  size = 24,
  fill = "none",
  color = FEED.ink,
  scale = 1,
}: {
  d: string;
  size?: number;
  fill?: string;
  color?: string;
  scale?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ transform: `scale(${scale})`, flex: "none" }}
      aria-hidden
    >
      <path d={d} fill={fill} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A heart that fills and pops at `at`, and a count that climbs from `from` to `to` after it. */
export function Like({
  at,
  from,
  to,
  size,
  format = (n: number) => n.toLocaleString("en-US"),
  column,
  ink = FEED.ink,
}: {
  at: number;
  from: number;
  to: number;
  size: number;
  format?: (n: number) => string;
  column?: boolean;
  ink?: string;
}) {
  const frame = useFrame();
  const on = frame >= at;
  const pop = interpolate(frame, [at, at + 7, at + 20], [0, 1, 0], { easing: ease.out });
  const n = Math.round(interpolate(frame, [at, at + 150], [from, to], { easing: ease.out }));
  return (
    <div
      style={{ display: "flex", flexDirection: column ? "column" : "row", alignItems: "center", gap: column ? 4 : 8 }}
    >
      <Icon
        d={ICONS.heart}
        size={size}
        fill={on ? FEED.like : "none"}
        color={on ? FEED.like : ink}
        scale={1 + 0.3 * pop}
      />
      <span
        style={{ font: `600 ${Math.round(size * 0.62)}px/1 ${SANS}`, fontVariantNumeric: "tabular-nums", color: ink }}
      >
        {format(n)}
      </span>
    </div>
  );
}

/** The clip's own ground, so the video reads as a picture inside the post. */
export const CLIP = "#2a2a2e";

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

/** The clip: Orbit's summer launch, "Launch" becoming "Launched ✓" at `click`, laid out for its shape. */
export function Clip({
  width,
  height,
  layout,
  s,
  type,
  bar = "#fff",
}: {
  width: number;
  height: number;
  layout: "row" | "stack";
  s: number;
  type: number;
  /** The player's progress colour: each platform has its own. */
  bar?: string;
}) {
  const frame = useFrame();
  const progress = interpolate(frame, [0, LIFT + 260], [0.08, 0.96]);
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background: CLIP,
        color: ORBIT.ink,
        fontFamily: ORBIT.font,
      }}
    >
      <div
        style={{
          ...fill,
          display: "flex",
          flexDirection: layout === "row" ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: layout === "row" ? type * 1.1 : type * 0.7,
          textAlign: layout === "row" ? "left" : "center",
        }}
      >
        <div style={{ font: `600 ${type}px/1.02 ${ORBIT.font}`, letterSpacing: "-0.03em" }}>
          Summer
          <br />
          launch
        </div>
        <div style={{ position: "relative", width: 300 * s, height: 76 * s }}>
          <div style={{ position: "absolute", right: 0, top: 0, transform: `scale(${s})`, transformOrigin: "100% 0" }}>
            <LaunchButton click={LIFT} idle={ORBIT.done} />
          </div>
        </div>
      </div>
      <div
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgb(255 255 255 / 0.18)" }}
      >
        <div style={{ width: `${progress * 100}%`, height: "100%", background: bar }} />
      </div>
    </div>
  );
}

/** The 16:9 feed post. */
export function FeedPost({ width }: { width: number }) {
  const h = (width * 9) / 16;
  return (
    <div
      style={{
        width,
        background: FEED.card,
        border: `1.5px solid ${FEED.edge}`,
        borderRadius: 22,
        overflow: "hidden",
        color: FEED.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px 12px" }}>
        <Avatar size={46} />
        <div>
          <div style={{ font: `600 20px/1.2 ${SANS}` }}>Example app</div>
          <div style={{ font: `400 16px/1.3 ${SANS}`, color: FEED.muted }}>now</div>
        </div>
      </div>
      <div style={{ font: `400 18px/1.35 ${SANS}`, padding: "0 20px 14px" }}>Summer launch is live.</div>
      <Clip width={width} height={h} layout="row" s={0.7} type={50} />
      <div style={{ display: "flex", alignItems: "center", gap: 34, padding: "16px 22px 18px" }}>
        <Like at={LIFT + 26} from={248} to={1940} size={26} />
        <Icon d={ICONS.comment} size={26} />
        <Icon d={ICONS.repost} size={26} />
        <Icon d={ICONS.send} size={26} />
      </div>
    </div>
  );
}

/** The 9:16 reel on a phone. */
export function PhoneReel({ width, height }: { width: number; height: number }) {
  const bezel = 9;
  const sw = width - bezel * 2;
  const sh = height - bezel * 2;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: 54,
        background: "#060607",
        border: "2px solid rgb(255 255 255 / 0.16)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: bezel - 2,
          top: bezel - 2,
          width: sw,
          height: sh,
          borderRadius: 45,
          overflow: "hidden",
        }}
      >
        <ReelScreen width={sw} height={sh} />
      </div>
    </div>
  );
}

/** A 9:16 reel filling a phone's screen: the clip, the camera cut-out, the actions and the caption. */
export function ReelScreen({ width, height, island = true }: { width: number; height: number; island?: boolean }) {
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>
      <Clip width={width} height={height} layout="stack" s={0.66} type={50} />
      {island && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 12,
            width: 96,
            height: 28,
            marginLeft: -48,
            borderRadius: 14,
            background: "#000",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          right: 14,
          bottom: 96,
          display: "grid",
          gap: 20,
          justifyItems: "center",
          color: FEED.ink,
        }}
      >
        <Like at={LIFT + 34} from={1200} to={18400} size={30} format={compact} column />
        <Icon d={ICONS.comment} size={30} />
        <Icon d={ICONS.share} size={30} />
      </div>
      <div style={{ position: "absolute", left: 16, bottom: 30, color: FEED.ink }}>
        <div style={{ font: `600 17px/1.3 ${SANS}` }}>@exampleapp</div>
        <div style={{ font: `400 15px/1.3 ${SANS}`, color: "rgb(255 255 255 / 0.75)" }}>Summer launch is live.</div>
      </div>
    </div>
  );
}

/** The 1:1 square post. */
export function SquarePost({ width }: { width: number }) {
  return (
    <div
      style={{
        width,
        background: FEED.card,
        border: `1.5px solid ${FEED.edge}`,
        borderRadius: 22,
        overflow: "hidden",
        color: FEED.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <Avatar size={36} />
        <div style={{ font: `600 18px/1 ${SANS}`, flex: 1 }}>exampleapp</div>
        <div style={{ font: `600 22px/1 ${SANS}`, color: FEED.muted, letterSpacing: "0.05em" }}>···</div>
      </div>
      <Clip width={width} height={width} layout="stack" s={0.74} type={56} />
      <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 18px 18px" }}>
        <Like at={LIFT + 42} from={312} to={2406} size={28} />
        <Icon d={ICONS.comment} size={28} />
        <Icon d={ICONS.send} size={28} />
        <div style={{ flex: 1 }} />
        <Icon d={ICONS.bookmark} size={28} />
      </div>
    </div>
  );
}

export function Avatar({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#1c1c24",
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <div
        style={{
          width: size * 0.44,
          height: size * 0.44,
          boxSizing: "border-box",
          borderRadius: "50%",
          border: `${size * 0.1}px solid ${ORBIT.accent}`,
        }}
      />
    </div>
  );
}

// Platforms: the same clip on three kinds of platform, each told apart by its layout and theme alone
// (no platform's name, logo or marks): a video site, a photo feed, a short-video app.

const bar = (width: number, color: string, height = 14) => (
  <div style={{ width, height, borderRadius: height / 2, background: color, flex: "none" }} />
);
const UP_NEXT = ["#2c2c30", "#323236", "#2a2a2e", "#303034", "#2e2e32"];

/** A video site on a laptop: the 16:9 player, its title and channel, and what plays next. */
export function VideoSiteScreen({ width = 1440, height = 900 }: { width?: number; height?: number }) {
  const player = { width: 1000, height: 562 };
  return (
    <div
      data-launch-check="off"
      style={{ position: "relative", width, height, background: "#0f0f0f", color: "#f1f1f1", fontFamily: SANS }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, height: 64, padding: "0 28px" }}>
        <div style={{ width: 36, height: 26, borderRadius: 7, background: "#e8e8e8" }} />
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div
            style={{ width: 560, height: 40, borderRadius: 20, border: "1px solid #303030", background: "#121212" }}
          />
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: "#3a3a3a" }} />
      </div>
      <div style={{ position: "absolute", left: 28, top: 80, borderRadius: 14, overflow: "hidden" }}>
        <Clip {...player} layout="row" s={0.86} type={58} bar="#f1f1f1" />
      </div>
      <div style={{ position: "absolute", left: 28, top: 80 + player.height + 18, width: player.width }}>
        <div style={{ font: `600 26px/1.2 ${SANS}` }}>Summer launch is live</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
          <Avatar size={44} />
          <div>
            <div style={{ font: `600 18px/1.2 ${SANS}` }}>Example app</div>
            <div style={{ font: `400 15px/1.3 ${SANS}`, color: "#aaa" }}>12.8K subscribers</div>
          </div>
          <div
            style={{
              marginLeft: 12,
              padding: "10px 18px",
              borderRadius: 20,
              background: "#f1f1f1",
              color: "#0f0f0f",
              font: `600 16px/1 ${SANS}`,
            }}
          >
            Subscribe
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: "8px 16px", borderRadius: 20, background: "#272727" }}>
            <Like at={LIFT + 26} from={248} to={1940} size={22} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 28 + player.width + 24, right: 28, top: 80, display: "grid", gap: 14 }}>
        {UP_NEXT.map((c) => (
          <div key={c} style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 168, height: 94, borderRadius: 10, background: c, flex: "none" }} />
            <div style={{ display: "grid", gap: 8, alignContent: "start", paddingTop: 4 }}>
              {bar(150, "#3a3a3a")}
              {bar(100, "#2a2a2a", 12)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STORIES = ["#d9d9dc", "#cfcfd3", "#e1e1e4", "#d4d4d8", "#dcdcdf", "#cbcbcf"];

/** A photo feed on a tablet, in light mode: a row of stories, then the clip as a square post. */
export function PhotoFeedScreen({ width = 820, height = 1180 }: { width?: number; height?: number }) {
  const ink = "#111";
  return (
    <div
      data-launch-check="off"
      style={{
        position: "relative",
        width,
        height,
        background: "#fff",
        color: ink,
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: 64, padding: "0 24px", gap: 18 }}>
        {bar(120, "#e6e6e6", 22)}
        <div style={{ flex: 1 }} />
        <Icon d={ICONS.heart} size={28} color={ink} />
        <Icon d={ICONS.send} size={28} color={ink} />
      </div>
      <div style={{ display: "flex", gap: 22, padding: "8px 24px 18px", borderBottom: "1px solid #eee" }}>
        {STORIES.map((c, i) => (
          <div key={c} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                border: `3px solid ${i === 0 ? "#3ecf8e" : "#b8b8bd"}`,
                padding: 4,
                boxSizing: "border-box",
              }}
            >
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: c }} />
            </div>
            {bar(56, "#e3e3e3", 10)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
        <Avatar size={38} />
        <div style={{ font: `600 18px/1 ${SANS}`, flex: 1 }}>exampleapp</div>
        <div style={{ font: `600 22px/1 ${SANS}`, color: "#888", letterSpacing: "0.05em" }}>···</div>
      </div>
      <Clip width={width} height={width} layout="stack" s={1} type={76} />
      <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 20px" }}>
        <Like at={LIFT + 42} from={312} to={2406} size={30} ink={ink} />
        <Icon d={ICONS.comment} size={30} color={ink} />
        <Icon d={ICONS.send} size={30} color={ink} />
        <div style={{ flex: 1 }} />
        <Icon d={ICONS.bookmark} size={30} color={ink} />
      </div>
    </div>
  );
}

/** A short-video app on a phone: the clip full-bleed, tabs above, the actions down the right. */
export function ShortVideoScreen({ width = 390, height = 844 }: { width?: number; height?: number }) {
  return (
    <div
      data-launch-check="off"
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background: "#000",
        color: "#fff",
        fontFamily: SANS,
      }}
    >
      <Clip width={width} height={height} layout="stack" s={0.72} type={52} bar="rgb(255 255 255 / 0.9)" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 58,
          display: "flex",
          justifyContent: "center",
          gap: 22,
          font: `600 17px/1 ${SANS}`,
        }}
      >
        <span style={{ color: "rgb(255 255 255 / 0.6)" }}>Following</span>
        <span style={{ borderBottom: "2px solid #fff", paddingBottom: 6 }}>For you</span>
      </div>
      <div style={{ position: "absolute", right: 10, bottom: 120, display: "grid", gap: 22, justifyItems: "center" }}>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <Avatar size={46} />
          <div
            style={{
              position: "absolute",
              left: 15,
              bottom: -8,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: "#f1f1f1",
              color: "#111",
              font: `700 13px/16px ${SANS}`,
              textAlign: "center",
            }}
          >
            +
          </div>
        </div>
        <Like at={LIFT + 34} from={1200} to={18400} size={32} format={compact} column />
        <Icon d={ICONS.comment} size={32} />
        <Icon d={ICONS.bookmark} size={32} />
        <Icon d={ICONS.share} size={32} />
      </div>
      <div style={{ position: "absolute", left: 14, right: 80, bottom: 26 }}>
        <div style={{ font: `700 17px/1.3 ${SANS}` }}>@exampleapp</div>
        <div style={{ font: `400 15px/1.35 ${SANS}`, color: "rgb(255 255 255 / 0.9)" }}>Summer launch is live.</div>
        <div style={{ font: `400 13px/1.6 ${SANS}`, color: "rgb(255 255 255 / 0.75)" }}>
          ♪ original sound · exampleapp
        </div>
      </div>
    </div>
  );
}
