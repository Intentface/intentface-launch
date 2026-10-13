// Example: states. Each shot is one pattern for UI changing state, built from the kit's primitives
// as a small component whose copy and cue frames are props, ready to copy into a product video.
// The UI is a made-up "Example app" drawn as plain DOM; nothing in it comes from a real product.
// Run: pnpm launch sheet example-states --shot status --every 3 (and --shot spread, progress-toast, thread)
// Expect:
// - status: the line rises in, then twice its pill changes state. The old label rolls up out of the
//   pill as the new one rolls up in a few frames behind the width; the pill overshoots its new width
//   by a few pixels and settles; its colour shifts; "Your build is" glides to keep the line centred,
//   never jumping.
// - spread: the cursor walks to "Grant access" and clicks on the beat; the button dips and becomes a
//   green "Access granted"; then a wave runs down the list: each avatar fills with the accent, a
//   check badge pops on it and the row swells a touch, 7 frames after the row above, with a soft
//   band of light travelling with the front.
// - progress-toast: a dark toast rises over the window and counts to 100% unevenly, its bar
//   following; it shrinks and turns green into "Exported" as a check draws; then the window drops
//   and recedes while "Share anywhere." rises from behind its top edge.
// - thread: messages arrive in a channel at uneven intervals. Each sender first shows three dots
//   pulsing in a wave for about a beat, then the dots give way to the message, which rises 8 px out
//   of a 1 px blur; the list glides up by each new height and never jumps.

import {
  defineVideo,
  ease,
  interpolate,
  mixColor,
  overshootEase,
  progress,
  readingTime,
  springColor,
  springTo,
  tempo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import {
  Cursor,
  type CursorKey,
  measureTextNow,
  Reveal,
  Swap,
  useBaseline,
  useFontsReady,
} from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";
import { LIGHT, look } from "../example-look";

const t = tempo(120, 60);

/** Long before any shot starts: the value a spring rests at before its first change. */
const BEFORE = -1e4;

function Ground({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: look.ground, color: look.ink, fontFamily: look.font }}>
      {children}
    </div>
  );
}

/** A plain app window: hairline border, soft shadow, a title bar that says what it is. */
function AppWindow({
  style,
  title = "Example app",
  children,
}: {
  style: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        background: look.surface,
        borderRadius: look.radius,
        border: `1px solid ${look.line}`,
        boxShadow: look.shadow,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 22px",
          borderBottom: `1px solid ${look.line}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: look.dots }} />
        ))}
        {/* Window chrome, not copy: off the reading checks (a receding window shrinks it under 28 px). */}
        <div data-launch-check="off" style={{ marginLeft: 14, font: `500 28px/1 ${look.font}`, color: look.muted }}>
          {title}
        </div>
      </div>
      <div style={{ position: "relative", height: "calc(100% - 57px)" }}>{children}</div>
    </div>
  );
}

/** Widths of several strings in one font, measured once the font has loaded (the frame waits for it). */
function useTextWidths(texts: string[], font: string, letterSpacing: string | number = 0) {
  useFontsReady(font, texts.join(""));
  return texts.map((text) => measureTextNow(text, font, { letterSpacing }).width);
}

/** A check mark drawn on: `draw` 0 → 1. `pathLength` 1, so no path measuring. */
function CheckMark({
  draw,
  size,
  color = "#fff",
  weight = 3,
}: {
  draw: number;
  size: number;
  color?: string;
  weight?: number;
}) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
}

// ─── status ──────────────────────────────────────────────────────────────────────────────────────

type PillState = {
  /** Frame this state takes over (the first one is there from the start). */
  at: number;
  label: string;
  /** The pill's fill in this state, and its label's colour on that fill. */
  fill: string;
  text: string;
};

/**
 * Labels rolling through a clip like a drum: on each change the old label and the new one move up
 * together on one clock, `distance` apart (the clip's height), so they never overlap; the old one
 * leaves through the top edge as the new one rises through the bottom. 18 frames on `ease.out`
 * (it answers at once and settles), with 2 px of blur on the way that settles to 0.
 */
function Roll({
  items,
  distance,
  frames = 18,
}: {
  items: { at: number; content: ReactNode }[];
  distance: number;
  frames?: number;
}) {
  const frame = useFrame();
  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      {items.map((item, i) => {
        const next = items[i + 1];
        const into = i === 0 ? 1 : progress(frame, item.at, frames, ease.out);
        const away = next ? progress(frame, next.at, frames, ease.out) : 0;
        if (into <= 0 || away >= 1) return null;
        const moving = Math.max(1 - into, away);
        return (
          <div
            key={i}
            style={{
              gridArea: "1 / 1",
              transform: moving > 0 ? `translateY(${Math.round(distance * (1 - into - away))}px)` : undefined,
              filter: moving > 0.001 ? `blur(${2 * moving}px)` : undefined,
            }}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A status pill that cycles, at the end of a centred sentence: "Your build is [queued]".
 *
 * Use it when one word of state is the news (a build going live, a payment clearing, a sync
 * finishing) and the sentence around it gives the context. It reads as one line whose last word
 * is alive, so it works as a headline and as a label beside UI.
 *
 * - The pill's width rides one `springTo` per change, `{ duration: 27, bounce: 0.3 }`: about a
 *   4% overshoot (a few pixels on a 150 px change) that settles within half a second. One spring
 *   per change, summed, so a change that arrives mid-flight keeps the speed it had.
 * - The whole line re-centres on that same width: the prefix's x is `(width - line) / 2`, rounded
 *   to whole pixels, so it glides with the pill and never jumps or creeps a subpixel at a time.
 * - Content trails its container: a longer label rolls in 4 frames after the pill starts to grow.
 *   A shorter one rolls first and the pill shrinks 8 frames later, once the old label is mostly
 *   out, so the pill never clips a label's sides.
 * - The label rolls (`Roll`) through the pill's clip, old and new on one clock a pill's height
 *   apart: a conveyor, never two labels on top of each other.
 * - The colour is its own clock: `springColor` over 18 frames, no bounce (overshoot on a colour
 *   flashes). It moves in OKLCH, the hue the short way round: give a neutral state a grey tinted
 *   toward the next state's hue (a cool grey before blue), or the hue sweeps through orange and
 *   pink on the way (only a chroma under 0.0005 counts as hueless).
 * - The line enters as a headline reveal: 12 px rise, 3 px blur, 30 frames `ease.out`.
 *
 * Hold each state at least its reading time (a word: one second) before the next change.
 */
function StatusLine({ prefix, states, size = 120 }: { prefix: string; states: PillState[]; size?: number }) {
  const frame = useFrame();
  const { fps, width: frameWidth, height: frameHeight } = useVideoInfo();
  const spacing = "-0.02em";
  const font = `600 ${size}px ${look.font}`;
  const [prefixWidth, ...labelWidths] = useTextWidths([prefix, ...states.map((s) => s.label)], font, spacing);
  const height = Math.round(size * 1.32);
  const padding = Math.round(size * 0.42);
  const gap = Math.round(size * 0.26);

  // Growing: the pill moves first and the label follows. Shrinking: the label leaves first.
  const grows = (i: number) => i > 0 && labelWidths[i] >= labelWidths[i - 1];
  const widthAt = (s: PillState, i: number) => (i === 0 ? BEFORE : grows(i) ? s.at : s.at + 8);
  const labelAt = (s: PillState, i: number) => (i === 0 ? 0 : grows(i) ? s.at + 4 : s.at);

  const width = springTo(
    frame,
    fps,
    states.map((s, i) => ({ at: widthAt(s, i), to: labelWidths[i] + padding * 2 })),
    { duration: 27, bounce: 0.3 },
  );
  // An even whole width keeps the label's centre on a whole pixel.
  const pill = Math.round(width / 2) * 2;
  const fill = springColor(
    frame,
    fps,
    states.map((s, i) => ({ at: i === 0 ? BEFORE : s.at, to: s.fill })),
    { duration: 18 },
  );
  const left = Math.round((frameWidth - (prefixWidth + gap + pill)) / 2);
  const enter = progress(frame, 0, 30, ease.out);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: Math.round(frameHeight / 2 - height / 2 + 12 * (1 - enter)),
        height,
        width: frameWidth,
        font,
        letterSpacing: spacing,
        lineHeight: 1,
        opacity: progress(frame, 0, 24, ease.soft),
        filter: enter < 1 ? `blur(${3 * (1 - enter)}px)` : undefined,
      }}
    >
      <div
        style={{ position: "absolute", left, top: 0, height, display: "flex", alignItems: "center", whiteSpace: "pre" }}
      >
        {prefix}
      </div>
      <div
        style={{
          position: "absolute",
          left: left + Math.round(prefixWidth + gap),
          top: 0,
          width: pill,
          height,
          borderRadius: height / 2,
          background: fill,
          overflow: "hidden",
          display: "grid",
        }}
      >
        <Roll
          distance={height}
          items={states.map((s, i) => ({
            at: labelAt(s, i),
            content: <span style={{ color: s.text, whiteSpace: "pre" }}>{s.label}</span>,
          }))}
        />
      </div>
    </div>
  );
}

const BUILD: PillState[] = [
  {
    at: 0,
    label: "queued",
    get fill() {
      return look.pill;
    },
    get text() {
      return look.ink;
    },
  },
  {
    at: t.beats(3),
    label: "running",
    get fill() {
      return look.accent;
    },
    text: "#fff",
  },
  {
    at: t.beats(6),
    label: "live",
    get fill() {
      return look.done;
    },
    text: "#fff",
  },
];

function Status() {
  return (
    <Ground>
      <StatusLine prefix="Your build is" states={BUILD} />
    </Ground>
  );
}

// ─── spread ──────────────────────────────────────────────────────────────────────────────────────

type Member = { name: string; role: string };

const TEAM: Member[] = [
  { name: "Ada Brennan", role: "Design" },
  { name: "Kofi Mensah", role: "Engineering" },
  { name: "Lena Varga", role: "Product" },
  { name: "Ravi Sethi", role: "Engineering" },
  { name: "Noor Haddad", role: "Support" },
  { name: "Elin Strand", role: "Marketing" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");

/**
 * One row of the list switching on at frame `on`: the avatar fills with the accent from its
 * centre (12 frames `ease.out`, the monogram turning white on `ease.soft`), a check badge pops on
 * its corner 4 frames later (`overshootEase(0.25)` over 21 frames: a small icon may pop hard, then
 * its mark draws in 15), and the row swells 2% and back over 26 frames, scaled about the name's
 * baseline so the text does not judder. A soft accent band rises and fades around `on`: with the
 * rows 7 frames apart the bands overlap, and the eye reads one front travelling down the list.
 */
function MemberRow({ member, on }: { member: Member; on: number }) {
  const frame = useFrame();
  const baseline = useBaseline();
  const fill = progress(frame, on, 12, ease.out);
  const white = progress(frame, on, 12, ease.soft);
  const badge = progress(frame, on + 4, 21, overshootEase(0.25));
  const badgeFade = progress(frame, on + 4, 9, ease.soft);
  const draw = progress(frame, on + 9, 15, ease.out);
  const swell = interpolate(frame, [on, on + 8, on + 26], [1, 1.02, 1], { easing: ease.out });
  const band = interpolate(frame, [on - 6, on + 3, on + 36], [0, 1, 0], { easing: ease.soft });
  return (
    <div style={{ position: "relative", height: 100 }}>
      <div
        style={{
          position: "absolute",
          inset: "4px 24px",
          borderRadius: look.control,
          background: look.accentSoft,
          opacity: 0.8 * band,
        }}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "0 48px",
          transform: swell === 1 ? undefined : `scale(${swell})`,
          transformOrigin: baseline.origin("80px"),
        }}
      >
        <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 32, background: look.quiet }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 32,
              background: look.accent,
              opacity: Math.min(1, fill * 1.4),
              transform: `scale(${0.4 + 0.6 * fill})`,
            }}
          />
          <div
            data-launch-check="off"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              font: `600 24px/1 ${look.font}`,
              color: mixColor(look.ink, "#ffffff", white),
            }}
          >
            {initials(member.name)}
          </div>
          <div
            style={{
              position: "absolute",
              right: -6,
              bottom: -6,
              width: 30,
              height: 30,
              borderRadius: 15,
              background: look.done,
              border: `3px solid ${look.surface}`,
              display: "grid",
              placeItems: "center",
              opacity: badgeFade,
              transform: `scale(${badge})`,
            }}
          >
            <CheckMark draw={draw} size={18} weight={3.4} />
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ font: `600 32px/1.15 ${look.font}` }}>
            {member.name}
            {baseline.probe}
          </div>
          <div style={{ font: `400 28px/1.2 ${look.font}`, color: look.muted, marginTop: 4 }}>{member.role}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * A button that becomes its result: "Grant access" pressed into "Access granted".
 *
 * The press dips the button to 0.97 over the 6 frames before the click (the hand pushing in) and
 * springs it back over 14 on `ease.out`. On the click its width (right edge fixed, so it grows
 * toward the content) and colour ride springs, and the label swaps 3 frames behind them: the old
 * label leaves in 6 frames on `ease.out` (the viewer just caused it: it answers at once), the new
 * one arrives 4 frames later over 14, so the two never read on top of each other. One shape
 * changing state, never two buttons cross-fading.
 */
function GrantButton({ click, idle, done }: { click: number; idle: string; done: string }) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const font = `600 34px ${look.font}`;
  const [idleWidth, doneWidth] = useTextWidths([idle, done], font);
  const padding = 30;
  const icon = 30;
  const width = springTo(
    frame,
    fps,
    [
      { at: BEFORE, to: idleWidth + padding * 2 },
      { at: click, to: doneWidth + icon + 12 + padding * 2 },
    ],
    { duration: 24, bounce: 0.15 },
  );
  const color = springColor(
    frame,
    fps,
    [
      { at: BEFORE, to: look.accent },
      { at: click, to: look.done },
    ],
    { duration: 18 },
  );
  const press = interpolate(frame, [click - 6, click, click + 14], [1, 0.97, 1], { easing: ease.out });
  const draw = progress(frame, click + 10, 21, ease.out);
  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        top: 44,
        width: Math.round(width),
        height: 68,
        borderRadius: look.control,
        background: color,
        color: "#fff",
        font,
        lineHeight: 1,
        display: "grid",
        overflow: "hidden",
        transform: press === 1 ? undefined : `scale(${press})`,
      }}
    >
      <Swap
        items={[
          { at: 0, content: <span style={{ whiteSpace: "pre" }}>{idle}</span> },
          {
            at: click + 3,
            content: (
              <span style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "pre" }}>
                <CheckMark draw={draw} size={icon} weight={2.8} />
                {done}
              </span>
            ),
          },
        ]}
        exit={6}
        enter={14}
        delay={4}
        blur={2}
        rise={4}
        scale={0}
        easing={ease.out}
      />
    </div>
  );
}

/**
 * State spreading through a list: one action switches every row on, as a single ripple.
 *
 * Use it when one click changes many things (access for a team, a setting applied to every
 * project, a sync reaching each device): the wave shows the reach of the action.
 *
 * - The cursor arrives 14 frames before the click and rests (a hand reads its target), and clicks
 *   on the beat; the button answers on that frame (`GrantButton`).
 * - The wave starts 12 frames after the click, once the button has visibly turned, and runs top
 *   to bottom 7 frames a row (6 to 8 reads as one motion; 3 reads as a block, 12 as a list of
 *   separate events). Each row's motions overlap the next row's by most of their length.
 * - Six rows take 35 frames to start and about 70 to settle: under a bar at 120 BPM.
 */
function SpreadList({
  members,
  click,
  wave,
  every = 7,
}: {
  members: Member[];
  click: number;
  wave: number;
  every?: number;
}) {
  const win = { x: 360, y: 114, width: 1200, height: 852 };
  const button = { x: win.x + win.width - 48 - 125, y: win.y + 57 + 44 + 34 };
  const cursor: CursorKey[] = [
    { at: 0, to: { x: 1500, y: 1010 } },
    { at: click, hover: 14, to: button, arc: -0.15 },
    { at: click + 40, travel: 30, to: { x: 1690, y: 720 } },
  ];
  return (
    <Ground>
      <AppWindow style={{ left: win.x, top: win.y, width: win.width, height: win.height }}>
        <div style={{ padding: "40px 48px 28px" }}>
          <div style={{ font: `650 44px/1.1 ${look.font}`, letterSpacing: "-0.02em" }}>Workspace access</div>
          <div style={{ font: `400 28px/1.2 ${look.font}`, color: look.muted, marginTop: 8 }}>
            {members.length} people on the design team
          </div>
        </div>
        <GrantButton click={click} idle="Grant access" done="Access granted" />
        <div style={{ borderTop: `1px solid ${look.line}`, paddingTop: 12 }}>
          {members.map((m, i) => (
            <MemberRow key={m.name} member={m} on={wave + i * every} />
          ))}
        </div>
      </AppWindow>
      <Cursor keys={cursor} />
    </Ground>
  );
}

const SPREAD = { click: t.beats(2), wave: t.beats(2) + 12 };

function Spread() {
  return <SpreadList members={TEAM} click={SPREAD.click} wave={SPREAD.wave} />;
}

// ─── progress-toast ──────────────────────────────────────────────────────────────────────────────

/**
 * Progress of a task that does not run evenly: quick at first, a stall, a long steady run, a slow
 * finish. Linear between the points, as a real progress value is; the stall is what makes it read
 * as work rather than an animation.
 */
const exportProgress = (frame: number, start: number, end: number) =>
  interpolate(
    frame,
    [start, start + (end - start) * 0.22, start + (end - start) * 0.42, start + (end - start) * 0.86, end],
    [0, 34, 41, 92, 100],
  );

/**
 * A toast that reports a task and then becomes its result.
 *
 * - It arrives as a toast does: rises 16 px with a fade, 0.97 → 1 and 2 px of blur, over 21
 *   frames `ease.out`.
 * - "Exporting… N%" counts in tabular figures so the digits do not shuffle the line, with a bar
 *   under it on the same value.
 * - The count reaches 100% 8 frames before `done` and holds there, so the finish reads.
 * - At `done` it is one shape changing state, and because it shrinks, the content goes first:
 *   the old content leaves in 6 frames on `ease.out`; 4 frames in, the width (560 → 330) and
 *   height (112 → 88) set off on `{ duration: 24, bounce: 0.15 }` and the colour turns ink →
 *   green on `springColor` over 18; the result arrives 8 frames after the change, over 14, once
 *   the shape has room for it. Growing, it would be the other way round: shape first.
 * - The check draws over 24 frames from 13 frames after the change, once its circle has arrived.
 */
function ExportToast({ start, done, label, result }: { start: number; done: number; label: string; result: string }) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const arrive = progress(frame, start, 21, ease.out);
  const fade = progress(frame, start, 21, ease.soft);
  const shape = { duration: 24, bounce: 0.15 };
  const [width, height] = springTo(
    frame,
    fps,
    [
      { at: BEFORE, to: [560, 112] },
      { at: done + 4, to: [330, 88] },
    ],
    shape,
  );
  const color = springColor(
    frame,
    fps,
    [
      { at: BEFORE, to: look.toast },
      { at: done + 4, to: look.done },
    ],
    { duration: 18 },
  );
  const value = Math.min(100, exportProgress(frame, start + 12, done - 8));
  const draw = progress(frame, done + 13, 24, ease.out);
  if (frame < start) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 40,
        width: Math.round(width),
        height: Math.round(height),
        marginLeft: -Math.round(width / 2),
        borderRadius: look.radius,
        background: color,
        color: "#fff",
        overflow: "hidden",
        display: "grid",
        boxShadow: look.raised,
        opacity: fade,
        transform: arrive < 1 ? `translateY(${16 * (1 - arrive)}px) scale(${0.97 + 0.03 * arrive})` : undefined,
        filter: arrive < 1 ? `blur(${2 * (1 - arrive)}px)` : undefined,
      }}
    >
      <Swap
        items={[
          {
            at: 0,
            content: (
              <div style={{ width: 560 - 64 }}>
                <div style={{ display: "flex", justifyContent: "space-between", font: `700 40px/1 ${look.font}` }}>
                  <span>{label}</span>
                  <span data-launch-check="off" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {Math.floor(value)}%
                  </span>
                </div>
                <div style={{ marginTop: 18, height: 6, borderRadius: 3, background: "rgb(255 255 255 / 0.16)" }}>
                  <div style={{ width: `${value}%`, height: 6, borderRadius: 3, background: "#fff" }} />
                </div>
              </div>
            ),
          },
          {
            at: done,
            content: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  font: `700 40px/1 ${look.font}`,
                  whiteSpace: "pre",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: "rgb(255 255 255 / 0.2)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <CheckMark draw={draw} size={26} weight={3.2} />
                </div>
                {result}
              </div>
            ),
          },
        ]}
        exit={6}
        enter={14}
        delay={8}
        blur={2}
        rise={4}
        scale={0}
        easing={ease.out}
      />
    </div>
  );
}

/** What is being exported: a catalogue of six pages, as tiles. Decoration, not read. */
function Catalogue() {
  return (
    <div style={{ padding: "36px 44px" }}>
      <div style={{ font: `650 40px/1.1 ${look.font}`, letterSpacing: "-0.02em" }}>Spring catalogue</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginTop: 28 }}>
        {look.swatches.map((c) => (
          <div key={c} style={{ height: 200, borderRadius: look.control, background: c }} />
        ))}
      </div>
    </div>
  );
}

/**
 * A task finishing, then the headline it earns.
 *
 * Use it for the end of a flow (an export, a deploy, a report), when the result deserves a line
 * of its own: the UI proves it happened, the headline says what it means.
 *
 * - The end frame is laid out first, as one group: the headline's line, a gap of about its own
 *   height (96 px against 75 px caps), and the window at 0.7, the whole stack centred on the
 *   frame's optical centre (y 520, a little above the middle). The window's move is whatever gets
 *   it there from its full size: it recedes to 0.7 about its centre and drops to its place, over
 *   40 frames `ease.out` (a move with an end, so nothing creeps a subpixel at a time afterwards).
 *   0.7 sets the toast's 40 px bold label at 28 px: still bold large text, as white on green needs.
 * - The headline sits behind the window in the stacking order and rises one em by word (4 frames
 *   apart) out of a slight blur over 40 frames, starting 6 frames into the recession: it starts
 *   hidden behind the window and emerges from behind its top edge as that edge moves down out of
 *   its way, coming to rest centred in the space the window left.
 * - Give "result" and the headline different words: the same copy twice reads as a mistake.
 */
function TaskFinish({
  toastAt,
  done,
  recede,
  headline,
}: {
  toastAt: number;
  done: number;
  recede: number;
  headline: string;
}) {
  const frame = useFrame();
  const back = progress(frame, recede, 40, ease.out);
  const win = { x: 290, y: 160, width: 1340, height: 760 };
  // The end frame as one group: headline line, gap, receded window, centred on the optical centre.
  const size = 104;
  const line = Math.round(size * 1.1);
  const gap = 96;
  const rest = 0.7;
  const top = Math.round(520 - (line + gap + win.height * rest) / 2);
  const drop = top + line + gap + (win.height * rest) / 2 - (win.y + win.height / 2);
  return (
    <Ground>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top,
          textAlign: "center",
          font: `650 ${size}px/${line}px ${look.font}`,
          letterSpacing: "-0.03em",
        }}
      >
        <Reveal at={recede + 6} by="word" every={4} frames={40} rise={1} blur={0.06}>
          {headline}
        </Reveal>
      </div>
      <div
        style={{
          position: "absolute",
          left: win.x,
          top: win.y,
          width: win.width,
          height: win.height,
          transform: back > 0 ? `translateY(${drop * back}px) scale(${1 - (1 - rest) * back})` : undefined,
        }}
      >
        <AppWindow style={{ inset: 0 }}>
          <div data-launch-check="off">
            <Catalogue />
          </div>
          <ExportToast start={toastAt} done={done} label="Exporting…" result="Exported" />
        </AppWindow>
      </div>
    </Ground>
  );
}

const FINISH = { toast: 12, done: t.beats(4), recede: t.beats(6), headline: "Share anywhere." };

function ProgressToast() {
  return <TaskFinish toastAt={FINISH.toast} done={FINISH.done} recede={FINISH.recede} headline={FINISH.headline} />;
}

// ─── thread ──────────────────────────────────────────────────────────────────────────────────────

type Message = {
  from: string;
  time: string;
  /** The message, one string per line (lines are set, not wrapped, so every height is known). */
  lines: string[];
  /** Frame the sender starts typing; omit for a message already in the channel. */
  typing?: number;
  /** Frame the message lands. */
  lands?: number;
};

const avatarTints = (): Record<string, [string, string]> => ({
  "Mira Okafor": [look.accentSoft, look.accent],
  "Theo Lind": [look.doneSoft, look.done],
  "Sana Iqbal": look.warm,
  "Jonas Berg": [look.quiet, look.ink],
});

const LINE = 44;
const HEADER = 40;
const PAD = 18;
/** A slot's height: a header, its lines (or the typing dots' one line), padding above and below. */
const slotHeight = (lines: number) => PAD * 2 + HEADER + 6 + lines * LINE;

/**
 * Three dots pulsing in a wave, in a small bubble: one 36-frame cycle, each dot a sixth of a cycle behind the last.
 * Each rises 6 px and brightens over the first 40% of its phase on `ease.swap` and rests for the
 * rest, so the wave reads as travelling left to right. The phase comes from the frame alone.
 */
function TypingDots({ from }: { from: number }) {
  const frame = useFrame();
  const cycle = 36;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        height: 40,
        marginTop: 2,
        padding: "0 16px",
        alignItems: "center",
        borderRadius: 20,
        background: look.quiet,
      }}
    >
      {[0, 1, 2].map((i) => {
        const phase = ((((frame - from) / cycle - i / 6) % 1) + 1) % 1;
        const lift = interpolate(phase, [0, 0.2, 0.4, 1], [0, 1, 0, 0], { easing: ease.swap });
        return (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: look.muted,
              opacity: 0.35 + 0.65 * lift,
              transform: `translateY(${-6 * lift}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * One message slot. From `typing` it shows the sender's name with the dots under it (rising 8 px
 * and fading in over 15 frames `ease.out`); at `lands` the dots leave in 9 frames and the message
 * rises 8 px into their place out of a 1 px blur over 18 frames, 2 frames behind.
 */
function MessageSlot({ message, top }: { message: Message; top: number }) {
  const frame = useFrame();
  const appear = message.typing === undefined ? 1 : progress(frame, message.typing, 15, ease.out);
  const [tint, letter] = avatarTints()[message.from] ?? [look.quiet, look.ink];
  const text = (
    <div style={{ font: `400 32px/${LINE}px ${look.font}` }}>
      {message.lines.map((l) => (
        <div key={l} style={{ whiteSpace: "pre" }}>
          {l}
        </div>
      ))}
    </div>
  );
  return (
    <div
      // History already in the channel is context that scrolls away, not copy to read.
      data-launch-check={message.typing === undefined ? "off" : undefined}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        padding: `${PAD}px 44px`,
        display: "flex",
        gap: 22,
        opacity: progress(frame, message.typing ?? BEFORE, 12, ease.soft),
        transform: appear < 1 ? `translateY(${Math.round(8 * (1 - appear))}px)` : undefined,
      }}
    >
      <div
        data-launch-check="off"
        style={{
          width: 56,
          height: 56,
          flex: "none",
          borderRadius: 28,
          background: tint,
          color: letter,
          display: "grid",
          placeItems: "center",
          font: `600 22px/1 ${look.font}`,
        }}
      >
        {initials(message.from)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: HEADER, display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
          <span style={{ font: `600 30px/1 ${look.font}` }}>{message.from}</span>
          <span style={{ font: `400 28px/1 ${look.font}`, color: look.muted }}>{message.time}</span>
        </div>
        {message.typing === undefined || message.lands === undefined ? (
          text
        ) : (
          <Swap
            items={[
              { at: 0, content: <TypingDots from={message.typing} /> },
              { at: message.lands, content: text },
            ]}
            exit={9}
            enter={18}
            delay={2}
            blur={1}
            rise={8}
            scale={0}
            easing={ease.out}
            style={{ placeItems: "start" }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * A conversation filling in: messages arrive one at a time, each announced by its sender typing.
 *
 * Use it for anything social or collaborative (a team agreeing, a review, support replying), and
 * for showing a product answering inside a conversation.
 *
 * - Every height is known from the data (lines are set, not wrapped), so the list's height at any
 *   frame is a `springTo` with one change when a sender starts typing (the slot opens with one
 *   line of dots) and one when the message lands (it grows by its extra lines). On
 *   `{ duration: 24 }` with no bounce, rounded to whole pixels; a second push that arrives before
 *   the first has settled adds to it at the speed it had, so the list never stops between them.
 * - The list is anchored to the composer: it rises, the oldest messages leave under a feathered mask
 *   at the top of the pane (clear for 12 px, then a 44 px feather), sized so that at rest no
 *   partial line sits under the header. Start with a few messages already there so the pane is not empty;
 *   they scroll away before anyone could read them, so they are off the reading checks.
 * - Gaps are uneven on purpose: a quick reply 30 frames after a message, a pause of a second
 *   before the next. Typing lasts about a beat (22 to 44 frames), longer for longer messages.
 */
function Thread({ channel, messages }: { channel: string; messages: Message[] }) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const win = { x: 400, y: 96, width: 1120, height: 888 };
  // The pane's height is set so that at rest the last four messages fill it, with only the top
  // slot's bottom padding (and a descender) left above them, inside the mask's clear band.
  const pane = { top: 120, height: 888 - 57 - 120 - 128 };

  const tops: number[] = [];
  let total = 0;
  const changes: { at: number; to: number }[] = [];
  for (const m of messages) {
    tops.push(total);
    if (m.typing === undefined) total += slotHeight(m.lines.length);
    else {
      changes.push({ at: m.typing, to: total + slotHeight(1) });
      total += slotHeight(m.lines.length);
      changes.push({ at: m.lands ?? m.typing, to: total });
    }
  }
  const resting = messages.filter((m) => m.typing === undefined).reduce((h, m) => h + slotHeight(m.lines.length), 0);
  const height = Math.round(springTo(frame, fps, [{ at: BEFORE, to: resting }, ...changes], { duration: 24 }));

  return (
    <Ground>
      <AppWindow style={{ left: win.x, top: win.y, width: win.width, height: win.height }}>
        <div
          style={{
            height: pane.top,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 44px",
            borderBottom: `1px solid ${look.line}`,
          }}
        >
          <span style={{ font: `650 36px/1 ${look.font}`, letterSpacing: "-0.01em" }}># {channel}</span>
          <span style={{ font: `400 28px/1 ${look.font}`, color: look.muted }}>4 members</span>
        </div>
        <div
          style={{
            position: "relative",
            height: pane.height,
            overflow: "hidden",
            // A feathered top edge: a line leaving the list fades out over 44 px, then is gone.
            maskImage: "linear-gradient(to bottom, transparent 0, transparent 12px, #000 56px)",
          }}
        >
          <div style={{ position: "absolute", left: 0, right: 0, top: pane.height - height - 8 }}>
            {messages.map((m, i) =>
              m.typing !== undefined && frame < m.typing ? null : (
                <MessageSlot key={m.from + m.time} message={m} top={tops[i]} />
              ),
            )}
          </div>
        </div>
        <div style={{ position: "absolute", left: 44, right: 44, bottom: 32 }}>
          <div
            style={{
              height: 72,
              borderRadius: look.control,
              border: `1px solid ${look.lineStrong}`,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              font: `400 28px/1 ${look.font}`,
              color: look.muted,
            }}
          >
            Message #{channel}
          </div>
        </div>
      </AppWindow>
    </Ground>
  );
}

const CHAT: Message[] = [
  { from: "Jonas Berg", time: "9:38", lines: ["Draft is in the shared folder."] },
  { from: "Sana Iqbal", time: "9:40", lines: ["On it."] },
  { from: "Mira Okafor", time: "9:41", lines: ["Release notes are ready."] },
  { from: "Theo Lind", time: "9:42", lines: ["Reading now."] },
  { from: "Sana Iqbal", time: "9:44", lines: ["Looks great.", "Fixed one typo."], typing: 16, lands: 58 },
  { from: "Theo Lind", time: "9:44", lines: ["Approved."], typing: 84, lands: 106 },
  { from: "Mira Okafor", time: "9:45", lines: ["Shipping at noon."], typing: 150, lands: 184 },
  { from: "Jonas Berg", time: "9:45", lines: ["Nice work."], typing: 204, lands: 232 },
];

function ThreadShot() {
  return <Thread channel="launch-day" messages={CHAT} />;
}

// ─── the video ───────────────────────────────────────────────────────────────────────────────────

/**
 * A shot's length: from the frame the last text has landed, its reading time, then on to the next
 * beat so the cut lands on the music.
 */
const holdAfter = (landed: number, text: string) =>
  t.beats(Math.ceil((landed + readingTime(text, t.fps).frames) / t.framesPerBeat));

export default defineVideo({
  id: "example-states",
  title: "Example: UI changing state",
  logline:
    "Reusable patterns for UI that changes state: a status pill, a ripple through a list, a finishing task, a chat filling in.",
  bpm: t.bpm,
  background: LIGHT.ground,
  shots: [
    {
      id: "status",
      title: "Status pill",
      duration: holdAfter(BUILD[2].at + 24, "live"),
      component: Status,
      says: "A status changes, and the sentence around it makes room.",
      copy: ["Your build is", "queued", "running", "live"],
      moments: { running: BUILD[1].at, live: BUILD[2].at },
    },
    {
      id: "spread",
      title: "State spreading",
      // The last text to land is the button's label (click + 21): its reading time ends near the
      // wave's settle (wave + 65), and a little over half a second of rest follows.
      duration: t.beats(6),
      component: Spread,
      says: "One click switches the whole team on, as one ripple.",
      copy: ["Grant access", "Access granted"],
      moments: { click: SPREAD.click, wave: SPREAD.wave },
    },
    {
      id: "progress-toast",
      title: "Task finishing",
      // The last word starts at recede + 10 and is within a pixel of rest 26 frames into its 40.
      duration: holdAfter(FINISH.recede + 10 + 26, FINISH.headline),
      component: ProgressToast,
      says: "The export finishes, and the result earns its headline.",
      copy: ["Exporting…", "Exported", FINISH.headline],
      moments: { done: FINISH.done, recede: FINISH.recede },
    },
    {
      id: "thread",
      title: "Chat filling in",
      duration: holdAfter((CHAT[CHAT.length - 1].lands ?? 0) + 20, CHAT[CHAT.length - 1].lines.join(" ")),
      component: ThreadShot,
      says: "A team agrees, one message at a time.",
      copy: CHAT.filter((m) => m.typing !== undefined).flatMap((m) => m.lines),
      moments: Object.fromEntries(CHAT.flatMap((m, i) => (m.lands === undefined ? [] : [[`m${i}`, m.lands]]))),
    },
  ],
});
