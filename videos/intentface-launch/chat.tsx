import { ease, interpolate, landed, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import type { CSSProperties, ReactNode } from "react";
import { ASK, CHAT, REPLY, TERM } from "./timing";

// The cold open: a team chat, silent. A teammate asks for a screenshot of the
// new feature for social media; the reply says there is something better.
// Each message arrives after a few frames of typing dots, lifting the one
// above it; the second is the person who then opens the terminal.

const SANS = '"Intent Sans", "Helvetica Neue", Arial, sans-serif';
const TYPE = 60;
const INK = "#f4f4f6";
const MUTED = "#8b8b97";

const PEOPLE = {
  sara: { name: "Sara", color: "#ff9f8a", initial: "S" },
  you: { name: "You", color: "#a9b4ff", initial: "Y" },
};

function Face({ who }: { who: keyof typeof PEOPLE }) {
  const p = PEOPLE[who];
  return (
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 42,
        background: p.color,
        color: "#16161b",
        display: "grid",
        placeItems: "center",
        font: `600 38px/1 ${SANS}`,
        flex: "none",
      }}
    >
      {p.initial}
    </div>
  );
}

/** Three dots that rise in turn, while the other person types. */
function Dots({ from, to }: { from: number; to: number }) {
  const f = useFrame();
  const on = interpolate(f, [from, from + 8, to - 4, to], [0, 1, 1, 0], { easing: ease.out });
  if (on <= 0) return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "34px 36px", opacity: on }}>
      {[0, 1, 2].map((i) => {
        const phase = ((f - from - i * 6) % 30) / 30;
        const lift = Math.max(0, Math.sin(phase * Math.PI * 2));
        return (
          <div
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: MUTED,
              opacity: 0.5 + 0.5 * lift,
              transform: `translateY(${-8 * lift}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** A message: its bubble pops up out of the dots and settles. */
function Message({
  who,
  at,
  dots,
  children,
  mine,
}: {
  who: keyof typeof PEOPLE;
  at: number;
  dots: number;
  children: ReactNode;
  mine?: boolean;
}) {
  const f = useFrame();
  const { fps } = useVideoInfo();
  const pop = springTo(
    f,
    fps,
    [
      { at: -1, to: 0 },
      { at, to: 1 },
    ],
    { duration: 22, bounce: 0.12 },
  );
  const shown = f >= at;
  const bubble: CSSProperties = {
    maxWidth: useVideoInfo().format.aspect < 1 ? 760 : 1040,
    borderRadius: 40,
    background: mine ? "#6d7cff" : "#232329",
    color: INK,
    transformOrigin: mine ? "100% 100%" : "0 100%",
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 24,
        opacity: f >= dots ? 1 : 0,
      }}
    >
      <Face who={who} />
      <div style={{ display: "grid", gap: 12, justifyItems: mine ? "end" : "start" }}>
        <div style={{ font: `500 30px/1 ${SANS}`, color: MUTED, padding: "0 12px" }}>{PEOPLE[who].name}</div>
        {shown ? (
          <div
            style={{
              ...bubble,
              padding: "30px 40px",
              font: `400 ${TYPE}px/1.25 ${SANS}`,
              letterSpacing: "-0.01em",
              // Once it has landed, no transform at all: a scale creeping towards 1 re-rasterises the text a sub-pixel at a time.
              transform:
                Math.abs(1 - pop) < 0.004 ? undefined : `scale(${0.92 + 0.08 * pop}) translateY(${(1 - pop) * 16}px)`,
              opacity: Math.min(1, pop * 2),
            }}
          >
            {children}
          </div>
        ) : (
          <div style={bubble}>
            <Dots from={dots} to={at} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Sara answering again, as the scene cuts away: "Sara is typing…" under the reply. */
function Typing({ from }: { from: number }) {
  const f = useFrame();
  const on = interpolate(f, [from, from + 10], [0, 1], { easing: ease.out });
  if (on <= 0) return null;
  return (
    <div
      data-launch-check="off"
      style={{ display: "flex", alignItems: "center", gap: 14, opacity: on, marginTop: -24, paddingLeft: 108 }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => {
          const lift = Math.max(0, Math.sin((((f - from - i * 6) % 30) / 30) * Math.PI * 2));
          return (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: MUTED,
                transform: `translateY(${-5 * lift}px)`,
              }}
            />
          );
        })}
      </div>
      <span style={{ font: `400 30px/1 ${SANS}`, color: MUTED }}>Sara is typing…</span>
    </div>
  );
}

export function Chat() {
  const f = useFrame();
  const { fps, format } = useVideoInfo();
  // 4:5: a narrower column, set lower in the taller frame.
  const tall = format.aspect < 1;
  // The conversation sits centred; the reply's arrival lifts the question.
  const lift = springTo(
    f,
    fps,
    [
      { at: -1, to: 110 },
      { at: CHAT.dots[1], to: 0 },
    ],
    { duration: 30 },
  );
  const fadeIn = interpolate(f, [0, 18], [0, 1], { easing: ease.out });
  const out = interpolate(f, [TERM - 10, TERM], [1, 0], { easing: ease.in });
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0d0d10", fontFamily: SANS, opacity: fadeIn * out }}>
      <div
        style={{
          position: "absolute",
          left: tall ? 80 : 300,
          right: tall ? 80 : 300,
          top: tall ? 400 : 340,
          display: "grid",
          gap: 56,
          transform: `translateY(${landed(lift, 0)}px)`,
        }}
      >
        <Message who="sara" dots={CHAT.dots[0]} at={CHAT.ask}>
          {ASK}
        </Message>
        <Message who="you" dots={CHAT.dots[1]} at={CHAT.reply} mine>
          {REPLY}
        </Message>
        <Typing from={CHAT.again} />
      </div>
    </div>
  );
}
