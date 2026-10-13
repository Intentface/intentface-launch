import {
  ease,
  interpolate,
  overshootEase,
  safeZone,
  springColor,
  springTo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import { Swap } from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";

// The productivity app the film's video is about: a made-up to-do app (nothing
// in it is a real product), dark, in its own window. It animates itself from
// cues (frames in the shot's clock) with the ui-motion recipes: a checkbox
// fills, then draws its mark, then the task strikes through; the others tick in
// turn, the count climbs, the chart draws, the team pops in.

/** What the app is called on screen: plainly an example. */
export const APP_NAME = "Example app";

export const APP = {
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

/** Frames (in the shot's clock) when each part moves. Before a cue it is at rest; long after, done. */
export type Cues = {
  check?: number; // the first task checked
  ticks?: number; // the other tasks checked, one every 6 frames
  count?: number; // the completed count climbs
  chart?: number; // the chart draws
  team?: number; // the team pops in
};
const NEVER = 1e9;
const LONG_AGO = -1e4;
/** Every cue long past: the app finished. */
export const DONE: Cues = { check: LONG_AGO, ticks: LONG_AGO, count: LONG_AGO, chart: LONG_AGO, team: LONG_AGO };

export const TASKS = [
  { title: "Ship the task feature", due: "Today", who: 0 },
  { title: "Write release notes", due: "Today", who: 1 },
  { title: "Record the demo", due: "Tue", who: 2 },
  { title: "Plan next sprint", due: "Wed", who: 3 },
  { title: "Reply to feedback", due: "Fri", who: 1 },
];
const TEAM = [
  { color: "#ff9f8a", initial: "A" },
  { color: "#8fe0b8", initial: "S" },
  { color: "#a9b4ff", initial: "M" },
  { color: "#ffd479", initial: "J" },
];
const POINTS = [0.06, 0.1, 0.09, 0.17, 0.24, 0.31, 0.3, 0.42, 0.52, 0.6, 0.73, 0.88];
const COMPLETED = 128;

/** The app's other layouts, in their own content pixels. */
export type Shape = "tall" | "square" | "portrait";
export const SHAPES: Record<Shape | "wide", { width: number; height: number }> = {
  wide: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  tall: { width: 1080, height: 1920 },
};

/** The frame task `i` is checked under `cues`. */
const checkedAt = (cues: Cues, i: number) => (i === 0 ? (cues.check ?? NEVER) : (cues.ticks ?? NEVER) + (i - 1) * 6);

// The wide layout, in content pixels on a 1920×1080 canvas: the window inset 24 px.
const W = { x: 24, y: 24, width: 1872, height: 1032 };
const ROW = 104;
const ROWS_TOP = 216; // inside the task card
export const AREAS = {
  app: { x: 0, y: 0, width: 1920, height: 1080 },
  window: W,
  card: { x: 352, y: 176, width: 940, height: 840 },
  /** The first task's row, and its checkbox: the closeup. */
  hero: { x: 352, y: 176 + ROWS_TOP, width: 940, height: ROW },
  checkbox: { x: 404, y: 176 + ROWS_TOP + (ROW - 46) / 2, width: 46, height: 46 },
  completed: { x: 1324, y: 176, width: 512, height: 420 },
  team: { x: 1324, y: 628, width: 512, height: 388 },
};

/** The 4:5 layout's window and first checkbox (window inset 24, padding 24, header 124). */
export const PORTRAIT_AREAS = {
  window: { x: 24, y: 24, width: 1032, height: 1302 },
  checkbox: { x: 48 + 52, y: 172 + ROWS_TOP + (ROW - 46) / 2, width: 46, height: 46 },
};

const panel: CSSProperties = {
  background: APP.surface,
  borderRadius: 28,
  border: `1.5px solid ${APP.line}`,
  overflow: "hidden",
  position: "relative",
  boxSizing: "border-box",
};

/** A checkbox: the fill grows in 9 frames, then the mark draws in 21. */
export function Check({ at, size = 46 }: { at: number; size?: number }) {
  const f = useFrame();
  const fill = interpolate(f, [at, at + 9], [0, 1], { easing: ease.out });
  const draw = interpolate(f, [at + 5, at + 26], [0, 1], { easing: ease.out });
  const press = interpolate(f, [at - 8, at - 2, at + 10], [0, 1, 0], { easing: ease.out });
  const r = size * 0.28;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: r,
        boxSizing: "border-box",
        border: `${size * 0.055}px solid rgb(255 255 255 / 0.22)`,
        flex: "none",
        transform: `scale(${1 - 0.08 * press})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -size * 0.055,
          borderRadius: r,
          background: APP.done,
          transform: `scale(${0.6 + 0.4 * fill})`,
          opacity: fill,
        }}
      />
      <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: size * 0.11 }} aria-hidden>
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

function Avatar({ who, size = 44 }: { who: number; size?: number }) {
  const t = TEAM[who];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: t.color,
        color: "#16161b",
        display: "grid",
        placeItems: "center",
        font: `600 ${Math.round(size * 0.45)}px/1 ${APP.font}`,
        flex: "none",
      }}
    >
      {t.initial}
    </div>
  );
}

/** One task: the checkbox, the title striking through once checked, its due day and who has it. */
export function TaskRow({
  task,
  at,
  height = ROW,
  type = 36,
  pad = 52,
  border = true,
}: {
  task: (typeof TASKS)[number];
  at: number;
  height?: number;
  type?: number;
  pad?: number;
  border?: boolean;
}) {
  const f = useFrame();
  const strike = interpolate(f, [at + 8, at + 22], [0, 1], { easing: ease.inOut });
  const tone = springColor(
    f,
    60,
    [
      { at: LONG_AGO, to: APP.ink },
      { at: at + 8, to: APP.muted },
    ],
    { duration: 16 },
  );
  const s = type / 36;
  return (
    <div
      style={{
        height,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 28 * s,
        padding: `0 ${pad}px`,
        borderTop: border ? `1.5px solid ${APP.line}` : undefined,
      }}
    >
      <Check at={at} size={46 * s} />
      <div style={{ position: "relative", font: `500 ${type}px/1 ${APP.font}`, color: tone, whiteSpace: "nowrap" }}>
        {task.title}
        <div
          style={{
            position: "absolute",
            left: -4 * s,
            right: -4 * s,
            top: "54%",
            height: Math.max(2, 3 * s),
            borderRadius: 2,
            background: APP.muted,
            transform: `scaleX(${strike})`,
            transformOrigin: "0 50%",
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          font: `500 ${26 * s}px/1 ${APP.font}`,
          color: APP.muted,
          padding: `${10 * s}px ${16 * s}px`,
          borderRadius: 20 * s,
          background: "rgb(255 255 255 / 0.05)",
        }}
      >
        {task.due}
      </div>
      <Avatar who={task.who} size={44 * s} />
    </div>
  );
}

const swap = { exit: 9, enter: 9, delay: 0, blur: 2, rise: 4, scale: 0, easing: ease.swap };

export function TaskCard({ cues = {}, width = 940, height = 840 }: { cues?: Cues; width?: number; height?: number }) {
  const f = useFrame();
  const { fps } = useVideoInfo();
  const times = TASKS.map((_, i) => checkedAt(cues, i));
  const bar = springTo(
    f,
    fps,
    [{ at: LONG_AGO, to: 0 }, ...times.map((t, i) => ({ at: t, to: (i + 1) / TASKS.length }))].sort(
      (a, b) => a.at - b.at,
    ),
    { duration: 20 },
  );
  const all = Math.max(...times);
  return (
    <div style={{ ...panel, width, height }}>
      <div style={{ padding: "48px 52px 0", height: 128, boxSizing: "border-box", display: "flex", gap: 24 }}>
        <div style={{ font: `600 64px/1.1 ${APP.font}`, letterSpacing: "-0.03em", color: APP.ink }}>This week</div>
        <div
          style={{
            alignSelf: "center",
            display: "grid",
            font: `600 26px/1 ${APP.font}`,
            padding: "10px 18px",
            borderRadius: 20,
            background: f >= all ? APP.doneSoft : APP.accentSoft,
            color: f >= all ? APP.done : APP.accent,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Swap
            items={[
              { at: LONG_AGO, content: `${TASKS.length} to do` },
              ...times
                .map((t, i) => ({
                  at: t + 6,
                  content: i === TASKS.length - 1 ? "All done" : `${TASKS.length - i - 1} to do`,
                }))
                .filter((x) => x.at < NEVER / 2)
                .sort((a, b) => a.at - b.at),
            ]}
            {...swap}
          />
        </div>
      </div>
      <div style={{ margin: "36px 52px 0", height: 12, borderRadius: 6, background: "rgb(255 255 255 / 0.08)" }}>
        <div style={{ height: 12, borderRadius: 6, width: `${bar * 100}%`, background: APP.done }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: ROWS_TOP }}>
        {TASKS.map((task, i) => (
          <TaskRow key={task.title} task={task} at={times[i]} />
        ))}
      </div>
    </div>
  );
}

export function CompletedCard({
  cues = {},
  width = 512,
  height = 420,
}: {
  cues?: Cues;
  width?: number;
  height?: number;
}) {
  const f = useFrame();
  const c = cues.count ?? NEVER;
  const d = cues.chart ?? NEVER;
  const count = interpolate(f, [c, c + 54], [COMPLETED - 24, COMPLETED], { easing: ease.out });
  const draw = interpolate(f, [d, d + 48], [0, 1], { easing: ease.inOut });
  const pulse = interpolate(f, [d + 46, d + 72], [0, 1], { easing: ease.out });
  const cw = width - 72;
  const ch = height * 0.42;
  const path = POINTS.map((p, i) => `${i ? "L" : "M"}${(i / (POINTS.length - 1)) * cw},${ch - p * ch}`).join(" ");
  const end = [cw, ch - POINTS[POINTS.length - 1] * ch];
  return (
    <div style={{ ...panel, width, height }}>
      <div style={{ padding: "40px 36px 0", font: `500 30px/1 ${APP.font}`, color: APP.muted }}>Done this month</div>
      <div
        style={{
          padding: "16px 36px 0",
          font: `600 76px/1 ${APP.font}`,
          letterSpacing: "-0.03em",
          color: APP.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(count)}
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
          stroke={APP.done}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
        {draw >= 1 && (
          <>
            <circle cx={end[0]} cy={end[1]} r={9} fill={APP.done} />
            <circle
              cx={end[0]}
              cy={end[1]}
              r={9 + 22 * pulse}
              fill="none"
              stroke={APP.done}
              opacity={1 - pulse}
              strokeWidth={3}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export function TeamCard({ cues = {}, width = 512, height = 388 }: { cues?: Cues; width?: number; height?: number }) {
  const f = useFrame();
  const t = cues.team ?? NEVER;
  return (
    <div style={{ ...panel, width, height, padding: 36 }}>
      <div style={{ font: `500 30px/1 ${APP.font}`, color: APP.muted }}>On it this week</div>
      <div style={{ display: "flex", gap: 14, marginTop: 32 }}>
        {TEAM.map((m, i) => {
          const p = interpolate(f, [t + i * 4, t + i * 4 + 18], [0, 1], { easing: overshootEase(0.05) });
          return (
            <div
              key={m.color}
              style={{ transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5), borderRadius: 46 }}
            >
              <div style={{ border: `4px solid ${APP.surface}`, borderRadius: 46 }}>
                <Avatar who={i} size={84} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppMark({ size = 30 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: APP.accent,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
      </svg>
    </div>
  );
}

function Sidebar() {
  return (
    <div style={{ width: 300, height: "100%", background: APP.sidebar, borderRight: `1.5px solid ${APP.line}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "50px 28px",
          font: `600 32px/1 ${APP.font}`,
          color: APP.ink,
          whiteSpace: "nowrap",
        }}
      >
        <AppMark />
        {APP_NAME}
      </div>
      {["Inbox", "Today", "Upcoming", "Projects"].map((n) => (
        <div
          key={n}
          style={{
            margin: "4px 18px",
            padding: "18px 20px",
            borderRadius: 14,
            font: `500 30px/1 ${APP.font}`,
            background: n === "Today" ? APP.accentSoft : "transparent",
            color: n === "Today" ? APP.ink : APP.muted,
          }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

export function NewTask() {
  return (
    <div
      style={{
        height: 76,
        padding: "0 34px",
        borderRadius: 38,
        background: APP.accent,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 12,
        font: `600 30px/1 ${APP.font}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 40, fontWeight: 400, marginTop: -4 }}>+</span> New task
    </div>
  );
}

const windowStyle: CSSProperties = {
  position: "absolute",
  background: APP.window,
  borderRadius: 36,
  border: "1.5px solid rgb(255 255 255 / 0.09)",
  overflow: "hidden",
  color: APP.ink,
  fontFamily: APP.font,
};

const place = (r: { x: number; y: number }, children: ReactNode) => (
  <div style={{ position: "absolute", left: r.x - W.x, top: r.y - W.y }}>{children}</div>
);

/** The app at 1920×1080 (content pixels), in its window. */
export function TodoApp({ cues = {} }: { cues?: Cues }) {
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
            font: `600 56px/1 ${APP.font}`,
            letterSpacing: "-0.02em",
          }}
        >
          Today
        </div>
        <div style={{ position: "absolute", right: 84 - W.x, top: 66 - W.y }}>
          <NewTask />
        </div>
        {place(AREAS.card, <TaskCard cues={cues} />)}
        {place(AREAS.completed, <CompletedCard cues={cues} />)}
        {place(AREAS.team, <TeamCard cues={cues} />)}
      </div>
    </div>
  );
}

/**
 * The app laid out again for a tall (9:16) or square (1:1) frame, in its own content pixels. The
 * vertical cut keeps everything inside the organic safe zone (`safeZone`: x 90 to 880, y 270 to
 * 1470), clear of the apps' top bar, caption and buttons; the app's ground still fills the frame.
 */
export function TodoReflow({ shape, cues = DONE }: { shape: Shape; cues?: Cues }) {
  if (shape === "tall") {
    const box = safeZone({ width: 1080, height: 1920 });
    return (
      <div
        data-launch-check="off"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1080,
          height: 1920,
          background: APP.window,
          color: APP.ink,
          fontFamily: APP.font,
        }}
      >
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 84,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, font: `600 44px/1 ${APP.font}` }}>
              <AppMark size={40} />
              Today
            </div>
            <NewTask />
          </div>
          <div style={{ display: "grid", gap: 24 }}>
            <TaskCard cues={cues} width={box.width} height={760} />
            <CompletedCard cues={cues} width={box.width} height={300} />
          </div>
        </div>
      </div>
    );
  }
  const size = SHAPES[shape];
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
          <div style={{ display: "flex", alignItems: "center", gap: 16, font: `600 44px/1 ${APP.font}` }}>
            <AppMark size={40} />
            Today
          </div>
          <NewTask />
        </div>
        {shape === "portrait" ? (
          <div style={{ display: "grid", gap: 24 }}>
            <TaskCard cues={cues} width={inner} height={760} />
            <CompletedCard cues={cues} width={inner} height={size.height - 172 - 760 - 24 - 48} />
          </div>
        ) : (
          <TaskCard cues={cues} width={inner} height={size.height - 216} />
        )}
      </div>
    </div>
  );
}

/** The app in any shape: the wide layout, or a reflow. */
export function TodoAny({ shape, cues }: { shape: Shape | "wide"; cues?: Cues }) {
  return shape === "wide" ? <TodoApp cues={cues} /> : <TodoReflow shape={shape} cues={cues} />;
}
