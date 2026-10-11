import {
  ease,
  interpolate,
  overshootEase,
  springColor,
  springTo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import { Swap } from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";

// Orbit: a made-up product for this film (nothing in it is a real product).
// A small launch planner in dark mode, in its own window. It animates itself
// from cues (frames in the shot's clock), with the ui-motion recipes: the
// button becomes "Launched", the badge "Live", checkboxes fill then draw,
// sign-ups count up, the chart draws, the team pops in.

/** What the app is called on screen: plainly an example, so no one wonders what product this is. */
export const APP_NAME = "Example app";

export const ORBIT = {
  window: "#0d0d10",
  sidebar: "#111115",
  surface: "#16161b",
  line: "rgb(255 255 255 / 0.07)",
  ink: "#f4f4f6",
  muted: "#8b8b97",
  accent: "#6d7cff",
  accentSoft: "rgb(109 124 255 / 0.16)",
  done: "#3ecf8e",
  doneSoft: "rgb(62 207 142 / 0.16)",
  font: '"Intent Sans", "Helvetica Neue", Arial, sans-serif',
};

/** Frames (in the shot's clock) when each part of Orbit moves. Before a cue it is at rest; long after, done. */
export type Cues = {
  click?: number; // the Launch button pressed: it becomes "Launched", the badge "Live"
  ticks?: number; // the checklist ticks, a row every 5 frames
  count?: number; // sign-ups count up
  chart?: number; // the chart draws
  team?: number; // the team pops in
};
const NEVER = 1e9;
const LONG_AGO = -1e4;
/** Every cue long past: Orbit finished. */
export const DONE: Cues = { click: LONG_AGO, ticks: LONG_AGO, count: LONG_AGO, chart: LONG_AGO, team: LONG_AGO };
export type OrbitProps = { cues?: Cues; title?: string; titleAt?: number };

export const CHECKLIST = ["Website", "Launch video", "Email to users", "Press kit", "Go live"];
const POINTS = [0.06, 0.1, 0.09, 0.17, 0.24, 0.31, 0.3, 0.42, 0.52, 0.6, 0.73, 0.88];
const TEAM = ["#ff9f8a", "#8fe0b8", "#a9b4ff", "#ffd479"];
const SIGNUPS = 12840;

// The wide layout, in content pixels on a 1920×1080 canvas: the window inset 24 px.
const W = { x: 24, y: 24, width: 1872, height: 1032 };
export const AREAS = {
  app: { x: 0, y: 0, width: 1920, height: 1080 },
  window: W,
  button: { x: 1536, y: 66, width: 300, height: 76 },
  card: { x: 352, y: 176, width: 940, height: 840 },
  checklist: { x: 352, y: 430, width: 940, height: 560 },
  signups: { x: 1324, y: 176, width: 512, height: 420 },
  team: { x: 1324, y: 628, width: 512, height: 388 },
};

const panel: CSSProperties = {
  background: ORBIT.surface,
  borderRadius: 28,
  border: `1.5px solid ${ORBIT.line}`,
  overflow: "hidden",
  position: "relative",
};

/** Launch → Launched: the pill grows and turns green on springs, its label swaps 2 frames behind. */
export function LaunchButton({ click = NEVER, idle = ORBIT.accent }: { click?: number; idle?: string }) {
  const f = useFrame();
  const { fps } = useVideoInfo();
  const press = interpolate(f, [click - 10, click - 3, click + 12], [0, 1, 0], { easing: ease.out });
  const width = springTo(
    f,
    fps,
    [
      { at: LONG_AGO, to: 230 },
      { at: click, to: 300 },
    ],
    { duration: 22 },
  );
  const color = springColor(
    f,
    fps,
    [
      { at: LONG_AGO, to: idle },
      { at: click, to: ORBIT.done },
    ],
    { duration: 18 },
  );
  return (
    <div
      style={{
        width,
        height: 76,
        borderRadius: 38,
        background: color,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        font: `600 30px/1 ${ORBIT.font}`,
        transform: `scale(${1 - 0.05 * press})`,
      }}
    >
      <Swap
        items={[
          { at: LONG_AGO, content: "Launch" },
          { at: click + 2, content: "Launched ✓" },
        ]}
        exit={9}
        enter={9}
        delay={2}
        blur={2}
        rise={4}
        scale={0}
        easing={ease.swap}
      />
    </div>
  );
}

/** A checkbox: the fill grows in 9 frames, then the mark draws in 21. */
function Check({ at }: { at: number }) {
  const f = useFrame();
  const fill = interpolate(f, [at, at + 9], [0, 1], { easing: ease.out });
  const draw = interpolate(f, [at + 5, at + 26], [0, 1], { easing: ease.out });
  return (
    <div
      style={{
        position: "relative",
        width: 46,
        height: 46,
        borderRadius: 13,
        boxSizing: "border-box",
        border: "2.5px solid rgb(255 255 255 / 0.18)",
        flex: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -2.5,
          borderRadius: 13,
          background: ORBIT.done,
          transform: `scale(${0.6 + 0.4 * fill})`,
          opacity: fill,
        }}
      />
      <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: 5 }} aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="#0d0d10"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
    </div>
  );
}

const swap = { exit: 9, enter: 9, delay: 0, blur: 2, rise: 4, scale: 0, easing: ease.swap };

export function LaunchCard({
  cues = {},
  title = "Spring launch",
  titleAt,
  width = 940,
  height = 840,
}: OrbitProps & { width?: number; height?: number }) {
  const f = useFrame();
  const { fps } = useVideoInfo();
  const ticks = cues.ticks ?? NEVER;
  const done = CHECKLIST.filter((_, i) => f >= ticks + i * 5 + 5).length;
  const bar = springTo(
    f,
    fps,
    [{ at: LONG_AGO, to: 0 }, ...CHECKLIST.map((_, i) => ({ at: ticks + i * 5 + 5, to: (i + 1) / CHECKLIST.length }))],
    { duration: 20 },
  );
  const live = (cues.click ?? NEVER) + 8;
  return (
    <div style={{ ...panel, width, height }}>
      <div style={{ padding: "48px 52px 0", display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{ display: "grid", font: `600 72px/1.1 ${ORBIT.font}`, letterSpacing: "-0.03em", color: ORBIT.ink }}
        >
          <Swap
            items={[
              { at: LONG_AGO, content: titleAt === undefined ? title : "Spring launch" },
              ...(titleAt === undefined ? [] : [{ at: titleAt, content: title }]),
            ]}
            {...swap}
          />
        </div>
        <div
          style={{
            display: "grid",
            font: `600 26px/1 ${ORBIT.font}`,
            padding: "10px 18px",
            borderRadius: 20,
            background: f >= live ? ORBIT.doneSoft : ORBIT.accentSoft,
            color: f >= live ? ORBIT.done : ORBIT.accent,
          }}
        >
          <Swap
            items={[
              { at: LONG_AGO, content: "Ready" },
              { at: live, content: "Live" },
            ]}
            {...swap}
          />
        </div>
      </div>
      <div style={{ margin: "40px 52px 0", height: 12, borderRadius: 6, background: "rgb(255 255 255 / 0.08)" }}>
        <div style={{ height: 12, borderRadius: 6, width: `${bar * 100}%`, background: ORBIT.done }} />
      </div>
      <div style={{ marginTop: 40 }}>
        {CHECKLIST.map((item, i) => (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "28px 52px",
              borderTop: `1.5px solid ${ORBIT.line}`,
              font: `500 36px/1 ${ORBIT.font}`,
              color: i < done ? ORBIT.ink : ORBIT.muted,
            }}
          >
            <Check at={ticks + i * 5} />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignupsCard({
  cues = {},
  width = 512,
  height = 420,
}: OrbitProps & { width?: number; height?: number }) {
  const f = useFrame();
  const c = cues.count ?? NEVER;
  const d = cues.chart ?? NEVER;
  const count = interpolate(f, [c, c + 54], [0, SIGNUPS], { easing: ease.out });
  const draw = interpolate(f, [d, d + 48], [0, 1], { easing: ease.inOut });
  const pulse = interpolate(f, [d + 46, d + 72], [0, 1], { easing: ease.out });
  const cw = width - 72;
  const ch = height * 0.42;
  const path = POINTS.map((p, i) => `${i ? "L" : "M"}${(i / (POINTS.length - 1)) * cw},${ch - p * ch}`).join(" ");
  const end = [cw, ch - POINTS[POINTS.length - 1] * ch];
  return (
    <div style={{ ...panel, width, height }}>
      <div style={{ padding: "40px 36px 0", font: `500 30px/1 ${ORBIT.font}`, color: ORBIT.muted }}>Sign-ups</div>
      <div
        style={{
          padding: "16px 36px 0",
          font: `600 76px/1 ${ORBIT.font}`,
          letterSpacing: "-0.03em",
          color: ORBIT.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(count).toLocaleString("en-US")}
      </div>
      <svg
        aria-hidden
        width={cw}
        height={ch}
        style={{ position: "absolute", left: 36, bottom: 40, overflow: "visible" }}
      >
        <path
          d={path}
          fill="none"
          stroke={ORBIT.accent}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
        {draw >= 1 && (
          <>
            <circle cx={end[0]} cy={end[1]} r={9} fill={ORBIT.accent} />
            <circle
              cx={end[0]}
              cy={end[1]}
              r={9 + 22 * pulse}
              fill="none"
              stroke={ORBIT.accent}
              opacity={1 - pulse}
              strokeWidth={3}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export function TeamCard({ cues = {}, width = 512, height = 388 }: OrbitProps & { width?: number; height?: number }) {
  const f = useFrame();
  const t = cues.team ?? NEVER;
  return (
    <div style={{ ...panel, width, height, padding: 36, boxSizing: "border-box" }}>
      <div style={{ font: `500 30px/1 ${ORBIT.font}`, color: ORBIT.muted }}>Launching with</div>
      <div style={{ display: "flex", gap: 14, marginTop: 32 }}>
        {TEAM.map((c, i) => {
          const p = interpolate(f, [t + i * 4, t + i * 4 + 18], [0, 1], { easing: overshootEase(0.05) });
          return (
            <div
              key={c}
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                background: c,
                border: `4px solid ${ORBIT.surface}`,
                transform: `scale(${0.6 + 0.4 * p})`,
                opacity: Math.min(1, p * 1.5),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div style={{ width: 300, height: "100%", background: ORBIT.sidebar, borderRight: `1.5px solid ${ORBIT.line}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "50px 28px",
          font: `600 32px/1 ${ORBIT.font}`,
          color: ORBIT.ink,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            boxSizing: "border-box",
            borderRadius: 15,
            border: `7px solid ${ORBIT.accent}`,
            flex: "none",
          }}
        />
        {APP_NAME}
      </div>
      {["Home", "Launches", "Calendar", "Team"].map((n) => (
        <div
          key={n}
          style={{
            margin: "4px 18px",
            padding: "18px 20px",
            borderRadius: 14,
            font: `500 30px/1 ${ORBIT.font}`,
            background: n === "Launches" ? ORBIT.accentSoft : "transparent",
            color: n === "Launches" ? ORBIT.ink : ORBIT.muted,
          }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

const windowStyle: CSSProperties = {
  position: "absolute",
  background: ORBIT.window,
  borderRadius: 36,
  border: "1.5px solid rgb(255 255 255 / 0.09)",
  overflow: "hidden",
  color: ORBIT.ink,
  fontFamily: ORBIT.font,
};

const place = (r: { x: number; y: number }, children: ReactNode) => (
  <div style={{ position: "absolute", left: r.x - W.x, top: r.y - W.y }}>{children}</div>
);

/** Orbit at 1920×1080 (content pixels): the whole app in its window; `withoutCard` leaves the launch card out (it is carried elsewhere). */
export function Orbit({ cues = {}, title, titleAt, withoutCard }: OrbitProps & { withoutCard?: boolean }) {
  const b = AREAS.button;
  return (
    <div data-launch-check="off" style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ ...windowStyle, left: W.x, top: W.y, width: W.width, height: W.height }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0 }}>
          <Sidebar />
        </div>
        <div
          style={{
            position: "absolute",
            left: 352 - W.x,
            top: 82 - W.y,
            font: `600 56px/1 ${ORBIT.font}`,
            letterSpacing: "-0.02em",
          }}
        >
          Launches
        </div>
        {/* The button grows to the left as it becomes "Launched": anchored at its right edge. */}
        <div style={{ position: "absolute", right: W.x + W.width - (b.x + b.width), top: b.y - W.y }}>
          <LaunchButton click={cues.click} />
        </div>
        {!withoutCard && place(AREAS.card, <LaunchCard cues={cues} title={title} titleAt={titleAt} />)}
        {place(AREAS.signups, <SignupsCard cues={cues} />)}
        {place(AREAS.team, <TeamCard cues={cues} />)}
      </div>
    </div>
  );
}

/** Orbit laid out again for a tall (9:16) or square (1:1) frame, in its own content pixels. */
export function OrbitReflow({ shape, cues = DONE }: { shape: "tall" | "square"; cues?: Cues }) {
  const size = shape === "tall" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
  const inner = size.width - 96;
  return (
    <div data-launch-check="off" style={{ position: "absolute", left: 0, top: 0, ...size }}>
      <div
        style={{
          ...windowStyle,
          left: 24,
          top: 24,
          width: size.width - 48,
          height: size.height - 48,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 8px 32px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, font: `600 44px/1 ${ORBIT.font}` }}>
            <div
              style={{
                width: 36,
                height: 36,
                boxSizing: "border-box",
                borderRadius: 18,
                border: `8px solid ${ORBIT.accent}`,
              }}
            />
            {APP_NAME}
          </div>
          <LaunchButton click={cues.click} />
        </div>
        {shape === "tall" ? (
          <div style={{ display: "grid", gap: 24 }}>
            <LaunchCard cues={cues} width={inner} height={840} />
            <SignupsCard cues={cues} width={inner} height={460} />
            <TeamCard cues={cues} width={inner} height={300} />
          </div>
        ) : (
          <LaunchCard cues={cues} width={inner} height={size.height - 216} />
        )}
      </div>
    </div>
  );
}
