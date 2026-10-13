// Example: AI products. Each shot is one pattern for showing an AI feature at work, a small
// component with props (its copy, its cue frames) on a made-up app labelled "Example app".
// Run: pnpm launch sheet example-ai --shot cut-in --every 3 (and --shot stream, select, agent-steps)
// Expect:
// - cut-in: the prompt types in a wide view framed on the content group (1.42×, the group at the
//   optical centre, no empty half); on one frame the view is 2× closer with the caret on
//   the same point of the screen, the keystrokes never pause, and the view follows the caret on a
//   spring; a cut back out wide, the cursor arrives and clicks send, the arrow swaps to a spinner.
// - stream: close on the send button as it is pressed; on the click frame a hard cut to the answer,
//   which condenses in a word at a time with a band of about six accent words behind the newest one,
//   cooling to ink; the camera pulls back on a gentle in-out and lands on the whole exchange;
//   Copy and Retry rise in under the answer once its last word has landed.
// - select: a caret lands before "invite", the band grows word by word to "project" (its right edge
//   on each word's measured end, never between words), the chip slides in beside it, Rewrite is clicked.
// - agent-steps: log lines arriving one after another at uneven intervals, each spinner swapping to
//   a check that draws in as its line dims; the column is centred, the exchange stays centred in the
//   frame while short and then scrolls to keep the newest line in sight, carrying its speed from
//   step to step, older lines fading out at the top.
// pnpm launch check example-ai: no errors, no warnings.

import {
  defineVideo,
  ease,
  interpolate,
  mixColor,
  progress,
  random,
  springTo,
  tempo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import {
  Camera,
  type CameraKey,
  Cursor,
  type CursorKey,
  cursorAt,
  edges,
  frameRect,
  measureTextNow,
  type Rect,
  Swap,
  Typewriter,
  typingCadence,
  useFontsReady,
  type View,
} from "@intentface-launch/core/kit";
import type { ReactNode } from "react";
import { LIGHT, look } from "../example-look";

const t = tempo(120, 60);

/** The app window, in content pixels: the same in every shot, so the shots cut together. */
const WINDOW: Rect = { x: 200, y: 150, width: 1520, height: 780 };
const WIDE: View = { x: 960, y: 540, zoom: 1 };
const NEVER = 1e9;

// ── Shared UI ────────────────────────────────────────────────────────────────────────────────

/**
 * The made-up app's window: a white surface with a title bar. Children are laid out in the
 * frame's own content pixels (so rects, marks and camera views share one space) and clipped to
 * the window.
 */
function AppWindow({ children }: { children?: ReactNode }) {
  const w = WINDOW;
  return (
    <div
      style={{
        position: "absolute",
        left: w.x,
        top: w.y,
        width: w.width,
        height: w.height,
        background: look.surface,
        borderRadius: look.radius,
        border: `1px solid ${look.line}`,
        boxShadow: look.shadow,
        overflow: "hidden",
        fontFamily: look.font,
        color: look.ink,
      }}
    >
      {/* Chrome, not copy: never meant to be read. */}
      <div
        data-launch-check="off"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 64,
          padding: "0 24px",
          borderBottom: `1px solid ${look.line}`,
          font: `500 24px/1 ${look.font}`,
          color: look.muted,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: look.line }} />
        ))}
        <span style={{ marginLeft: 14 }}>Example app</span>
      </div>
      <div style={{ position: "absolute", left: -w.x - 1, top: -w.y - 1, width: 1920, height: 1080 }}>{children}</div>
    </div>
  );
}

/** A message the person sent, right-aligned at `right`, as chat apps set it. */
function UserMessage({
  text,
  right,
  top,
  check = true,
}: {
  text: string;
  right: number;
  top: number;
  check?: boolean;
}) {
  return (
    <div
      data-launch-check={check ? undefined : "off"}
      style={{
        position: "absolute",
        right: 1920 - right,
        top,
        padding: "18px 26px",
        borderRadius: look.radius,
        background: look.ground,
        font: `400 32px/1.3 ${look.font}`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

const ICON = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Rotates once a second on a linear clock: a constant process reads as ongoing only at constant speed. */
function Spinner({ size, color, from = 0 }: { size: number; color: string; from?: number }) {
  const turn = ((useFrame() - from) / 60) * 360;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${turn}deg)` }}>
      <circle cx={12} cy={12} r={9} stroke={color} strokeOpacity={0.25} strokeWidth={2.5} {...ICON} />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth={2.5} {...ICON} />
    </svg>
  );
}

/** A check that draws from `at` over 18 frames on ease.out (`pathLength` 1: no path measuring). */
function DrawnCheck({ at, size, color }: { at: number; size: number; color: string }) {
  const draw = progress(useFrame(), at, 18, ease.out);
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M6 12.5l4 4L18 8"
        stroke={color}
        strokeWidth={2.6}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        {...ICON}
      />
    </svg>
  );
}

/** Advance width of every prefix of `text` (index n: the first n characters), measured in the loaded font. */
function usePrefixWidths(text: string, font: string) {
  useFontsReady(font, text);
  const chars = Array.from(text);
  return chars
    .map((_, n) => measureTextNow(chars.slice(0, n).join(""), font).width)
    .concat(measureTextNow(text, font).width);
}

/** Each word's box in a line of text, from the line's left edge; trailing punctuation is left out. */
function useWordBoxes(line: string, font: string) {
  useFontsReady(font, line);
  return Array.from(line.matchAll(/\S+/g), (m) => {
    const word = m[0].replace(/[.,;:!?]+$/, "");
    const x = measureTextNow(line.slice(0, m.index), font).width;
    return { text: word, x, width: measureTextNow(line.slice(0, m.index + word.length), font).width - x };
  });
}

// ── The prompt box (cut-in, and the opening of stream) ───────────────────────────────────────

const PROMPT = "Summarise this week's feedback in a reply";
const PROMPT_SIZE = 40;
const PROMPT_FONT = `400 ${PROMPT_SIZE}px "Studio Sans"`;
const FIELD: Rect = { x: 340, y: 540, width: 1240, height: 112 };
const SUGGESTIONS = ["Plan a launch", "Summarise a document", "Draft a reply"];
const TEXT_X = FIELD.x + 40;
const CARET_Y = FIELD.y + FIELD.height / 2;
/** The prompt screen's wide view: the content group (heading 300 to suggestions 742) at the optical centre. */
const PROMPT_WIDE: View = { x: 960, y: 533, zoom: 1.42 };
const SEND: Rect = { x: FIELD.x + FIELD.width - 88, y: FIELD.y + 24, width: 64, height: 64 };

/**
 * The send button: presses in over the 6 frames before the click and springs back over 12;
 * the arrow swaps to a spinner as an icon swap (out in 9, in over 15 from 3 frames later, from
 * half size), so the button answers on the click frame.
 */
function SendButton({ click = NEVER, enabledAt = -NEVER }: { click?: number; enabledAt?: number }) {
  const f = useFrame();
  const press = interpolate(f, [click - 6, click, click + 12], [0, 1, 0], { easing: ease.out });
  const enabled = progress(f, enabledAt, 9, ease.soft);
  return (
    <div
      style={{
        position: "absolute",
        left: SEND.x,
        top: SEND.y,
        width: SEND.width,
        height: SEND.height,
        borderRadius: look.control,
        background: look.accent,
        opacity: 0.35 + 0.65 * enabled,
        display: "grid",
        transform: `scale(${1 - 0.08 * press})`,
      }}
    >
      <Swap
        items={[
          {
            at: 0,
            content: (
              <svg aria-hidden width={34} height={34} viewBox="0 0 24 24">
                <path d="M12 19V5M6 11l6-6 6 6" stroke="#fff" strokeWidth={2.4} {...ICON} />
              </svg>
            ),
          },
          { at: click, content: <Spinner size={32} color="#fff" from={click} /> },
        ]}
        exit={9}
        enter={15}
        delay={3}
        blur={2}
        scale={0.5}
        easing={ease.swap}
      />
    </div>
  );
}

/** The prompt screen: a heading, the field typing `text` from `typeAt` on `keys`, and send. */
function PromptScreen({ text, typeAt, keys, click }: { text: string; typeAt: number; keys: number[]; click?: number }) {
  const f = useFrame();
  const typing = f >= typeAt + keys[0];
  return (
    <AppWindow>
      <div
        style={{
          position: "absolute",
          left: FIELD.x,
          top: 300,
          font: `600 56px/1 ${look.font}`,
          letterSpacing: "-0.02em",
        }}
        data-launch-check="off"
      >
        {/* The app's own heading, not the video's copy. */}
        What should we work on?
      </div>
      <div
        style={{
          position: "absolute",
          left: FIELD.x,
          top: FIELD.y,
          width: FIELD.width,
          height: FIELD.height,
          boxSizing: "border-box",
          borderRadius: look.radius,
          border: `1px solid ${look.line}`,
          boxShadow: look.shadow,
          background: look.surface,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: TEXT_X,
          top: CARET_Y - PROMPT_SIZE * 0.65,
          font: PROMPT_FONT.replace('"Studio Sans"', look.font),
          lineHeight: 1.3,
          whiteSpace: "pre",
          color: typing ? look.ink : look.muted,
        }}
      >
        {/* Read as it is typed (at reading pace), and cropped on purpose in a close view: the
            reading-time and safe-margin checks do not apply to it. */}
        <span data-launch-check="off">
          {typing ? (
            <Typewriter at={typeAt} times={keys}>
              {text}
            </Typewriter>
          ) : (
            "Ask anything"
          )}
        </span>
      </div>
      <SendButton click={click} enabledAt={typeAt + keys[0]} />
      {/* Suggestions under the field: they keep the screen from looking empty; not copy to read. */}
      <div
        data-launch-check="off"
        style={{ position: "absolute", left: FIELD.x, top: FIELD.y + FIELD.height + 36, display: "flex", gap: 14 }}
      >
        {SUGGESTIONS.map((s) => (
          <div
            key={s}
            style={{
              padding: "14px 22px",
              borderRadius: look.control,
              border: `1px solid ${look.line}`,
              font: `400 26px/1 ${look.font}`,
              color: look.muted,
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </AppWindow>
  );
}

// ── 1. Cut in on the caret ────────────────────────────────────────────────────────────────────

/**
 * Cut in on the caret: a prompt types in a wide shot, and partway through the frame cuts, in a
 * single frame, to `zoom`× with the caret on the same point of the screen. The typing carries
 * straight on, so the cut reads as leaning in, not as a new scene. Then a cut back out wide shows
 * the send button as the cursor arrives and clicks.
 *
 * Use it when the words being typed are the point (a prompt, a query) and they are too small to
 * read wide. A push would spend a second getting there and blur the keystrokes; a cut costs nothing.
 *
 * Numbers:
 * - The wide view (`PROMPT_WIDE`) frames the content group (heading, field, suggestions) at 1.42×,
 *   not the whole window: the group sits a touch above the middle with even space around it, the
 *   window's edges just outside the frame (no sliver of background), and the 40 px prompt reads at
 *   57 px. A window shown whole would leave a dead half and small text.
 * - `zoom` 2: the cut is 2× the wide view (2.84× in all), so the prompt reads at 114 px and about
 *   16 characters stay in frame. Under 2× the cut looks like a mistake; over 3× it is a new shot.
 * - The cut keeps the caret's screen point (view = caret − (caret's screen offset) / zoom): the eye is on
 *   the caret, so nothing has to be found again. The cut lands on the keystroke nearest `cutIn`
 *   (a beat) that falls inside a word: a letter appears on the cut frame and the next a few frames
 *   later, which is what carries the action across. At a space the typist pauses, and the cut
 *   reads as a stop.
 * - Close, the view follows the caret on a spring (`{ duration: 40 }`, no bounce), one target per
 *   keystroke, so it glides at the typing's average speed instead of stepping per letter; the
 *   caret runs a little ahead while typing and the view catches up when it stops.
 * - Keys from `typingCadence` at 13 characters a second: uneven like a person, the same each
 *   render, and at reading pace, so the prompt is read as it is typed.
 * - The cursor is hidden while typing and fades in on the cut out; it rests 14 frames on send
 *   before the click lands on the beat.
 */
function CutIn({
  text = PROMPT,
  typeAt = t.beats(1),
  cutIn = t.beats(3),
  cutOut = t.beats(8),
  click = t.beats(10),
  zoom = 2,
}: {
  text?: string;
  typeAt?: number;
  cutIn?: number;
  cutOut?: number;
  click?: number;
  zoom?: number;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const keys = typingCadence(text, fps, { cps: 13, seed: "cut-in" });
  const advance = usePrefixWidths(text, PROMPT_FONT);
  // Typewriter's caret sits 0.04 em after the text and is 0.06 em wide: its centre.
  const caretX = (n: number) => TEXT_X + advance[n] + PROMPT_SIZE * 0.07;
  const typedBy = (f: number) => keys.filter((k) => f - typeAt >= k).length;

  const wide = PROMPT_WIDE;
  let view = wide;
  // Cut on the keystroke nearest `cutIn` that lands inside a word, so keys fall on both sides of the cut.
  const chars = Array.from(text);
  const inWord = keys.filter((_, i) => /\S/.test(chars[i]) && /\S/.test(chars[i + 1] ?? " ") && i > 0);
  const cut = typeAt + inWord.reduce((a, b) => (Math.abs(typeAt + b - cutIn) < Math.abs(typeAt + a - cutIn) ? b : a));
  if (frame >= cut && frame < cutOut) {
    const anchor = caretX(typedBy(cut));
    const follow = springTo(
      frame,
      fps,
      [
        { at: cut, to: anchor },
        ...keys.flatMap((k, i) => (typeAt + k > cut ? [{ at: typeAt + k, to: caretX(i + 1) }] : [])),
      ],
      { duration: 40 },
    );
    // The caret's offset from the frame's centre in the wide view, kept in the close one.
    const close = wide.zoom * zoom;
    view = {
      x: follow - ((anchor - wide.x) * wide.zoom) / close,
      y: CARET_Y - ((CARET_Y - wide.y) * wide.zoom) / close,
      zoom: close,
    };
  }

  const cursor: CursorKey[] = [
    { at: cutOut, to: { x: 1560, y: 860 } },
    { at: click, hover: 14, to: SEND, click: true },
    { at: click + 60, to: { x: 1600, y: 800 } },
  ];
  return (
    <Camera keys={[{ at: 0, view }]}>
      <PromptScreen text={text} typeAt={typeAt} keys={keys} click={click} />
      <Cursor keys={cursor} appear={cutOut} />
    </Camera>
  );
}

// ── 2. Streaming answer ───────────────────────────────────────────────────────────────────────

const ANSWER = [
  "Here is the week in brief.",
  "Setup feels faster than expected.",
  "Two teams want a shared calendar.",
  "Large exports still time out.",
];
/** The conversation column: centred in the window, as chat apps set it. */
const CHAT = { left: 460, right: 1460 };
const QUESTION_TOP = 280;
const ANSWER_TOP = 530;
const ANSWER_LINE = 60;
const ANSWER_FONT = `400 34px/1 ${LIGHT.font}`;
/** The answer's actions under it, once it is complete. */
const ACTIONS_H = 56;
/** The whole exchange, the question and the full answer: the framing the pull-back lands on. */
const EXCHANGE: Rect = {
  x: CHAT.left - 20,
  y: QUESTION_TOP - 10,
  width: CHAT.right - CHAT.left + 40,
  height: ANSWER_TOP + ANSWER.length * ANSWER_LINE + ACTIONS_H - QUESTION_TOP + 20,
};

/** When each word of `lines` starts: 3 to 6 frames apart (seeded), plus 6 at a new line, as a model's tokens come in chunks. */
function streamTimes(lines: string[], at: number, seed: string) {
  const rnd = random(seed);
  let f = at;
  return lines.map((line, l) =>
    line.split(" ").map((_, w) => {
      if (w > 0 || l > 0) f += 3 + Math.floor(rnd() * 4) + (w === 0 ? 6 : 0);
      return f;
    }),
  );
}

/** Where the stream's head is, in words (fractional between arrivals); past the end it runs on at `every`, so the last words cool too. */
function streamHead(starts: number[], frame: number, every: number) {
  let i = -1;
  while (i + 1 < starts.length && starts[i + 1] <= frame) i++;
  if (i < 0) return -1;
  const next = starts[i + 1] ?? starts[i] + every;
  return i + (frame - starts[i]) / (next - starts[i]);
}

/**
 * Streaming answer: open close on the send button as it is pressed, cut hard to the answer on
 * the click, and let the answer build a word at a time while the camera pulls back to keep the
 * whole block framed.
 *
 * Use it for any generated text: an answer, a summary, a draft. It reads as text condensing into
 * place, where a typewriter reads as someone typing.
 *
 * Numbers:
 * - Words 3 to 6 frames apart (seeded), 6 more at a new line: uneven like real tokens, about 4.5
 *   frames a word on average (about 13 words a second: fast, yet each word is seen arriving). Each fades in over 21 frames on ease.out from a 1 px blur.
 * - Warmth: each word lands in the accent, stays there while the next `hold` (4) words arrive, then
 *   cools to ink over the following `cool` (4), on ease.soft (colour; it never overshoots), mixed
 *   in OKLCH. The clock is the stream's own (words arrived, not frames), so five or six words are
 *   warm behind the head whether the stream runs fast or slow; after the last word it runs on at
 *   the average pace, so the tail cools too.
 * - The camera opens at 2.2× on the answer (the question just out of frame above), and pulls back
 *   from half a beat after the cut (30 frames: the first words land on a still frame) to the last
 *   word, on ease.swap (symmetric: it leaves gently enough not to compete with the first words,
 *   and arrives just after the last ones have landed, 36 frames after the last word starts) on the
 *   whole exchange. The question comes into frame on the way: the answer first, then what it
 *   answers. Not ease.inOut, and no pass and return: over a move this long, their flat ends carry
 *   the text under a pixel a frame for half a second, and it steps (check's creep).
 * - When the last word has landed (21 frames after it starts), the answer's actions (Copy, Retry)
 *   rise 8 px and fade in over 15 frames on ease.out, 4 frames apart: the signal that it is
 *   finished, and something happening while the last line is read.
 * - The cut is on the click frame: the press runs the 6 frames before it, so the click is seen
 *   and the answer is its consequence.
 */
function Stream({
  question = PROMPT,
  lines = ANSWER,
  click = t.beats(2),
  hold = 4,
  cool = 4,
}: {
  question?: string;
  lines?: string[];
  click?: number;
  /** Words that arrive after a word before it starts to cool, and the words it takes to cool. */
  hold?: number;
  cool?: number;
}) {
  const frame = useFrame();
  const { fps, width, height } = useVideoInfo();
  const keys = typingCadence(question, fps, { cps: 13 });

  if (frame < click) {
    const close: View = { x: SEND.x - 170, y: CARET_Y, zoom: 2.6 };
    const cursor: CursorKey[] = [
      { at: 0, to: { x: SEND.x + 260, y: SEND.y + 190 } },
      { at: click, hover: 12, to: SEND, click: true },
    ];
    return (
      <Camera
        keys={[
          { at: 0, view: { ...close, zoom: 2.3 } },
          { at: click, view: close, easing: ease.out },
        ]}
      >
        <PromptScreen text={question} typeAt={-NEVER} keys={keys} click={click} />
        <Cursor keys={cursor} />
      </Camera>
    );
  }

  const times = streamTimes(lines, click + 8, "stream");
  const starts = times.flat();
  const head = streamHead(starts, frame, 4.5);
  const last = starts[starts.length - 1];
  // The stream is done once its last word has landed: the answer's actions arrive then.
  const done = last + 21;
  const mark = frameRect(EXCHANGE, width, height, 0.06);
  const camera: CameraKey[] = [
    { at: click, view: { x: CHAT.left + 345, y: ANSWER_TOP + 100, zoom: 2.2 } },
    { at: last + 36, view: mark, travel: last + 36 - (click + 30), easing: ease.swap },
  ];
  let index = 0;
  return (
    <Camera keys={camera}>
      <AppWindow>
        {/* Already read in the shot before; here it enters from the frame's edge as context. */}
        <UserMessage text={question} right={CHAT.right} top={QUESTION_TOP} check={false} />
        <div
          data-launch-check="off"
          style={{
            position: "absolute",
            left: CHAT.left,
            top: ANSWER_TOP - 72,
            display: "flex",
            alignItems: "center",
            gap: 12,
            font: `500 28px/1 ${look.font}`,
            color: look.muted,
          }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 11, background: look.accent }} />
          Assistant
        </div>
        {lines.map((line, l) => (
          <div
            key={line}
            style={{
              position: "absolute",
              left: CHAT.left + (l > 0 ? 36 : 0),
              top: ANSWER_TOP + l * ANSWER_LINE,
              font: ANSWER_FONT,
              whiteSpace: "pre",
            }}
          >
            {l > 0 && (
              <span
                style={{
                  position: "absolute",
                  left: -28,
                  top: 13,
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  background: look.muted,
                  opacity: progress(frame, times[l][0], 21, ease.soft),
                }}
              />
            )}
            {line.split(" ").map((word, w) => {
              const i = index++;
              const p = progress(frame, times[l][w], 21, ease.out);
              const cooled = ease.soft(Math.min(1, Math.max(0, (head - i - hold) / cool)));
              return (
                <span
                  key={`${word}-${w}`}
                  style={{
                    opacity: p,
                    filter: p < 1 ? `blur(${1 - p}px)` : undefined,
                    color: mixColor(look.accent, look.ink, cooled),
                  }}
                >
                  {w > 0 ? " " : ""}
                  {word}
                </span>
              );
            })}
          </div>
        ))}
        {/* The answer's actions: chrome, not copy. */}
        <div
          data-launch-check="off"
          style={{
            position: "absolute",
            left: CHAT.left - 12,
            top: ANSWER_TOP + lines.length * ANSWER_LINE + 8,
            display: "flex",
            gap: 8,
            font: `500 26px/1 ${look.font}`,
            color: look.muted,
          }}
        >
          {["Copy", "Retry"].map((action, i) => {
            const p = progress(frame, done + i * 4, 15, ease.out);
            return (
              <div
                key={action}
                style={{
                  padding: "12px 14px",
                  borderRadius: look.control,
                  border: `1px solid ${look.line}`,
                  opacity: progress(frame, done + i * 4, 15, ease.soft),
                  transform: `translateY(${Math.round((1 - p) * 8)}px)`,
                }}
              >
                {action}
              </div>
            );
          })}
        </div>
      </AppWindow>
    </Camera>
  );
}

// ── 3. Select a passage ───────────────────────────────────────────────────────────────────────

const PARAGRAPH = [
  "This release makes sharing simpler.",
  "Now you can invite guests to a project,",
  "and they only see the pages you choose.",
  "Links you share expire after a week.",
];
const DOC_X = 340;
const DOC_TOP = 460;
const DOC_LINE = 66;
const DOC_SIZE = 38;
const DOC_FONT = `400 ${DOC_SIZE}px "Studio Sans"`;
const CHIP_H = 64;

/** The action chip: two actions in a small floating bar. `press` fills the first (on the click frame). */
function ActionChip({ actions, press }: { actions: string[]; press: number }) {
  const f = useFrame();
  const down = interpolate(f, [press - 6, press, press + 12], [0, 1, 0], { easing: ease.out });
  const fill = progress(f, press, 9, ease.soft);
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        height: CHIP_H,
        padding: 6,
        boxSizing: "border-box",
        borderRadius: look.radius,
        background: look.surface,
        border: `1px solid ${look.line}`,
        boxShadow: look.raised,
        font: `500 28px/1 ${look.font}`,
        whiteSpace: "nowrap",
      }}
    >
      {actions.map((action, i) => (
        <div
          key={action}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 18px",
            borderRadius: look.control,
            background: i === 0 ? mixColor(look.chip, look.accent, fill) : "transparent",
            color: i === 0 ? mixColor(look.accent, "#ffffff", fill) : look.ink,
            transform: i === 0 ? `scale(${1 - 0.05 * down})` : undefined,
          }}
        >
          {i === 0 && (
            <svg aria-hidden width={24} height={24} viewBox="0 0 24 24">
              <path
                d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"
                fill="currentColor"
              />
            </svg>
          )}
          {action}
        </div>
      ))}
    </div>
  );
}

/**
 * Select a passage: a caret lands mid-sentence, a selection drags across a span word by word,
 * and an action chip pops in beside it for the cursor to click: "do something with this part".
 *
 * Use it for any AI action on a selection (rewrite, explain, translate, summarise): the
 * selection is what the action is about, so it is shown being made.
 *
 * Numbers:
 * - Word boxes are measured from the line in its loaded font (`useWordBoxes`), never guessed:
 *   the band's right edge stops only on a word's end, as an editor selecting by word does. It
 *   snaps to the next word once the pointer passes that word's middle.
 * - The band is `edges()`: the right edge, leading, rides the stiff spring, so each word step is
 *   quick (about 10 frames) and successive steps overlap without stopping; the left edge never moves.
 * - The drag takes 2 beats on ease.inOut: slow enough that each word is seen joining.
 * - The chip appears 5 frames after the release (an intent delay), from 0.97 over 15 frames on
 *   ease.out, its fade on ease.soft, travelling 6 px out of the selection and grown from its side
 *   nearest it: beside the selection when that ends its line (nothing under it to hide), else
 *   above. It is a surface: no overshoot.
 * - The cursor rests 14 frames on Rewrite; the click fills it on ease.soft in 9 frames.
 * - The camera pushes in once, to 1.52× (the 38 px text reads at 58 px), while the cursor travels
 *   to the text (ease.inOut, 54 frames), then holds while the selection and the chip happen: one
 *   change in frame at a time. The close view keeps its top edge inside the window, under the
 *   title bar, so no strip of background shows above the app.
 */
function Select({
  title = "Release notes",
  lines = PARAGRAPH,
  line = 1,
  from = "invite",
  to = "project",
  actions = ["Rewrite", "Explain"],
  click = t.beats(2),
  release = t.beats(4),
  press = t.beats(6),
}: {
  title?: string;
  lines?: string[];
  /** Which line holds the selection, and its first and last word. */
  line?: number;
  from?: string;
  to?: string;
  actions?: string[];
  click?: number;
  release?: number;
  press?: number;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const boxes = useWordBoxes(lines[line], DOC_FONT);
  const first = boxes.findIndex((b) => b.text === from);
  const lastWord = boxes.findIndex((b, i) => i >= first && b.text === to);
  const top = DOC_TOP + line * DOC_LINE;
  const midY = top + DOC_LINE / 2;
  const start = DOC_X + boxes[first].x - 3;
  const endOf = (i: number) => DOC_X + boxes[i].x + boxes[i].width + 3;
  // Beside the selection when it ends its line (after any punctuation), else above its start.
  const beside = lastWord === boxes.length - 1;
  const chipX = beside ? DOC_X + measureTextNow(lines[line], DOC_FONT).width + 24 : start - 6;
  const chipY = beside ? midY - CHIP_H / 2 : top - 12 - CHIP_H;

  const cursor: CursorKey[] = [
    { at: 0, to: { x: 1420, y: 860 } },
    { at: click, hover: 14, to: { x: start + 2, y: midY } },
    { at: release, to: { x: endOf(lastWord) + 4, y: midY + 4 }, drag: true },
    { at: press, hover: 14, to: { x: chipX + 90, y: chipY + CHIP_H / 2 }, click: true },
    { at: press + 60, to: { x: chipX + 220, y: chipY + 190 } },
  ];

  // The word the band reaches on each frame of the drag: the last one whose middle the pointer has passed.
  const stops = [{ at: click, start, end: start }];
  for (let f = click; f <= release; f++) {
    const x = cursorAt(cursor, f).x;
    let reached = first - 1;
    for (let i = first; i <= lastWord; i++) if (x >= DOC_X + boxes[i].x + boxes[i].width / 2) reached = i;
    const end = reached < first ? start : endOf(reached);
    if (end !== stops[stops.length - 1].end) stops.push({ at: f, start, end });
  }
  const band = edges(frame, fps, stops);
  const selecting = frame >= click && frame < release;
  const caretOn = selecting || (frame >= release && band.size < 1);

  const chipAt = release + 5;
  const chip = progress(frame, chipAt, 15, ease.out);
  const chipFade = progress(frame, chipAt, 15, ease.soft);

  const close: View = { x: 908, y: 572, zoom: 1.52 };
  return (
    <Camera
      keys={[
        { at: 0, view: WIDE },
        { at: click - 6, view: close, travel: click - 6 },
      ]}
    >
      <AppWindow>
        <div
          style={{
            position: "absolute",
            left: DOC_X,
            top: DOC_TOP - 120,
            font: `600 52px/1 ${look.font}`,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        {frame >= click && (
          <div
            style={{
              position: "absolute",
              left: band.start,
              top: midY - DOC_SIZE * 0.68,
              width: Math.max(0, band.size),
              height: DOC_SIZE * 1.36,
              borderRadius: 6,
              background: look.selection,
            }}
          />
        )}
        {lines.map((text, i) => (
          <div
            key={text}
            style={{
              position: "absolute",
              left: DOC_X,
              top: DOC_TOP + i * DOC_LINE,
              height: DOC_LINE,
              display: "flex",
              alignItems: "center",
              font: DOC_FONT.replace('"Studio Sans"', look.font),
              whiteSpace: "pre",
            }}
          >
            {text}
          </div>
        ))}
        {caretOn && (
          <div
            style={{
              position: "absolute",
              left: band.end - 1.5,
              top: midY - DOC_SIZE * 0.6,
              width: 3,
              height: DOC_SIZE * 1.2,
              borderRadius: 2,
              background: look.accent,
            }}
          />
        )}
        {frame >= chipAt && (
          <div
            style={{
              position: "absolute",
              left: chipX,
              top: chipY,
              opacity: chipFade,
              transform: beside
                ? `translateX(${(chip - 1) * 6}px) scale(${0.97 + 0.03 * chip})`
                : `translateY(${(1 - chip) * 6}px) scale(${0.97 + 0.03 * chip})`,
              transformOrigin: beside ? "0 50%" : "0 100%",
            }}
          >
            <ActionChip actions={actions} press={press} />
          </div>
        )}
      </AppWindow>
      <Cursor keys={cursor} />
    </Camera>
  );
}

// ── 4. An agent narrating its work ────────────────────────────────────────────────────────────

type Step = { text: string; frames: number };

const STEPS: Step[] = [
  { text: "Reading the project files", frames: 22 },
  { text: "Timing every page as it loads", frames: 48 },
  { text: "Slowest is Reports, at 4.1 s", frames: 16 },
  { text: "Finding what Reports loads", frames: 32 },
  { text: "Resizing 38 oversized images", frames: 58 },
  { text: "Loading the gallery on scroll", frames: 26 },
  { text: "Removing two unused scripts", frames: 18 },
  { text: "Timing Reports again", frames: 38 },
  { text: "Reports now loads in 1.3 s", frames: 22 },
];
/** The agent's column, centred in the frame. */
const AGENT = { left: 680, right: 1240 };
const LOG_TOP = 400;
const LOG_ROW = 80;
/** The window's body, under its title bar: what scrolls. */
const BODY: Rect = { x: WINDOW.x, y: WINDOW.y + 64, width: WINDOW.width, height: WINDOW.height - 64 };

/**
 * The window's body as a scroll view: children in content pixels, moved up by `offset`, fading
 * out over 56 px as they pass under the title bar (a fade, not a hard clip, so nothing is sliced).
 */
function ScrollBody({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: BODY.x,
        top: BODY.y,
        width: BODY.width,
        height: BODY.height,
        overflow: "hidden",
        maskImage: "linear-gradient(to bottom, transparent, black 56px)",
      }}
    >
      <div style={{ position: "absolute", left: -BODY.x, top: -BODY.y - offset, width: 1920, height: 1080 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * One log line: enters as it starts (rises 8 px, fades, unblurs from 2 px over 15 frames on
 * ease.out), shows a spinner while it runs, and when it finishes the spinner swaps to a check
 * that draws in while the text dims to muted. The last line is the result and stays ink.
 */
function LogLine({
  step,
  start,
  end,
  top,
  result,
  shown = 1,
}: {
  step: Step;
  start: number;
  end: number;
  top: number;
  result?: boolean;
  /** Opacity from where it is on screen: it fades as it scrolls out of the top. */
  shown?: number;
}) {
  const f = useFrame();
  const enter = progress(f, start, 15, ease.out);
  const dim = result ? 0 : progress(f, end + 4, 12, ease.soft);
  return (
    <div
      style={{
        position: "absolute",
        left: AGENT.left,
        top,
        height: LOG_ROW,
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity: progress(f, start, 15, ease.soft) * shown,
        transform: `translateY(${Math.round((1 - enter) * 8)}px)`,
        filter: enter < 1 ? `blur(${(1 - enter) * 2}px)` : undefined,
        font: `${result ? 600 : 400} 34px/1 ${look.font}`,
        color: mixColor(look.ink, look.muted, dim),
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 40, height: 40, display: "grid" }}>
        <Swap
          items={[
            { at: start, content: <Spinner size={36} color={look.accent} from={start} /> },
            {
              at: end,
              content: (
                <div style={{ width: 36, height: 36, borderRadius: 18, background: look.done, display: "grid" }}>
                  <div style={{ placeSelf: "center", display: "grid" }}>
                    <DrawnCheck at={end + 3} size={28} color="#ffffff" />
                  </div>
                </div>
              ),
            },
          ]}
          exit={9}
          enter={15}
          delay={3}
          blur={2}
          scale={0.5}
          easing={ease.swap}
        />
      </div>
      {step.text}
    </div>
  );
}

/**
 * An agent narrating its work: under the prompt, a log writes itself a line at a time; each step
 * shows a spinner while it runs, then a check draws in and the line dims. The next step starts as
 * the last one finishes, with uneven durations, so it reads as real work rather than a list.
 *
 * Use it for agents, background jobs, any multi-step process the product runs for the person.
 *
 * Numbers:
 * - Step durations 16 to 58 frames, never two alike in a row: an even rhythm reads as a canned
 *   animation. Keep the whole run under about 5 s; a real agent's minutes are compressed, not shown.
 *   The last line is the result: it stays ink, in a heavier weight, and is held for its reading
 *   time (about 2.3 s) before the shot ends.
 * - Spinner to check is an icon swap (out in 9, in over 15 from 3 frames later, from half size, 2 px
 *   blur, ease.swap); the check draws over 18 frames from 3 frames after the finish; the text dims
 *   on ease.soft over 12 frames from 4 after it, trailing the icon so the eye goes icon, then text.
 * - The log is a scroll view that keeps the exchange balanced and the newest line in sight: while
 *   it is short, the prompt and log stay centred in the frame (each new line pushes them up half a
 *   row); once a new line's bottom would pass `followLine`, each line pushes a full row. It moves
 *   by a spring (`{ duration: 45 }`, no bounce) with one target per step, so a step that starts while the list is still moving carries its speed on
 *   instead of stopping and setting off again (steps 18 to 38 frames apart against a 45-frame
 *   spring: they overlap). The offset is rounded to whole screen pixels, so lines at rest never
 *   shimmer between pixels. Lines leave under the title bar through a 56 px fade.
 * - The column (prompt and log) is centred in the frame, 680 to 1240, and the camera holds the
 *   window's body at `zoom` 1.5, edge to edge (the 34 px log reads at 51 px): no dead half, and
 *   each line fades out over 56 px as it scrolls up, gone when it reaches the frame's top safe
 *   margin. The list is the motion.
 */
function AgentSteps({
  prompt = "Find the slowest page and fix it",
  steps = STEPS,
  at = 20,
  zoom = 1.5,
  followLine = 880,
}: {
  prompt?: string;
  steps?: Step[];
  /** Frame the first step starts. */
  at?: number;
  zoom?: number;
  /** Content y the newest line's bottom is kept above. */
  followLine?: number;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const starts = steps.map((_, i) => at + steps.slice(0, i).reduce((sum, s) => sum + s.frames, 0));
  // Where the body scrolls to when the content ends at `bottom`: centred in the body while it is
  // short, then with its newest line held above `followLine`, whichever is further.
  const middle = BODY.y + BODY.height / 2;
  const settle = (bottom: number) => Math.max((QUESTION_TOP + bottom) / 2 - middle, bottom - followLine);
  const scroll = springTo(
    frame,
    fps,
    [
      { at: 0, to: settle(QUESTION_TOP + 80) },
      ...starts.map((s, i) => ({ at: s, to: settle(LOG_TOP + (i + 1) * LOG_ROW) })),
    ],
    { duration: 45 },
  );
  const offset = Math.round(scroll * zoom) / zoom;
  // A line scrolling out fades over 56 px and is gone when its top reaches the frame's 96 px safe
  // margin, so no text is ever half-visible inside it.
  const safeTop = middle - (540 - 96) / zoom;
  const shown = (top: number) => Math.min(1, Math.max(0, (top - offset - safeTop) / 56));
  return (
    <Camera keys={[{ at: 0, view: { x: 960, y: BODY.y + BODY.height / 2, zoom } }]}>
      <AppWindow>
        <ScrollBody offset={offset}>
          <div style={{ opacity: shown(QUESTION_TOP) }}>
            <UserMessage text={prompt} right={AGENT.right} top={QUESTION_TOP} />
          </div>
          {steps.map((step, i) =>
            frame >= starts[i] ? (
              <LogLine
                key={step.text}
                step={step}
                start={starts[i]}
                end={starts[i] + step.frames}
                top={LOG_TOP + i * LOG_ROW}
                result={i === steps.length - 1}
                shown={shown(LOG_TOP + i * LOG_ROW)}
              />
            ) : null,
          )}
        </ScrollBody>
      </AppWindow>
    </Camera>
  );
}

export default defineVideo({
  id: "example-ai",
  title: "Example: AI products",
  logline:
    "Reusable patterns for showing AI features at work: cut in on the caret, a streaming answer, a selection with an action, an agent's log.",
  bpm: t.bpm,
  background: LIGHT.ground,
  shots: [
    {
      id: "cut-in",
      title: "Cut in on the caret",
      duration: t.beats(11),
      component: () => <CutIn />,
      says: "The prompt is being typed, and we lean in to read it.",
      camera: "Wide on the prompt; a one-frame cut to 2× on the caret, following it; a cut back out wide for send.",
      moments: { type: t.beats(1), cut: t.beats(3), out: t.beats(8), click: t.beats(10) },
    },
    {
      id: "stream",
      title: "Streaming answer",
      duration: t.beats(11),
      component: () => <Stream />,
      says: "Send is pressed and the answer writes itself.",
      camera: "Close on send; hard cut on the click; pull back on ease-in-out as the answer grows, a settle.",
      moments: { click: t.beats(2) },
    },
    {
      id: "select",
      title: "Select a passage",
      duration: t.beats(8),
      component: () => <Select />,
      says: "Part of the text is chosen, and an action is taken on just that part.",
      camera: "Push in to the paragraph as the cursor arrives, then hold.",
      moments: { click: t.beats(2), release: t.beats(4), chip: t.beats(4) + 5, press: t.beats(6) },
    },
    {
      id: "agent-steps",
      title: "Agent steps",
      duration: t.beats(14),
      component: () => <AgentSteps />,
      says: "The agent works through a task step by step and finishes it.",
      camera: "Holds the window's body, the column centred; the log scrolls to keep its newest line in sight.",
      moments: { first: 20, last: 20 + STEPS.slice(0, -1).reduce((sum, s) => sum + s.frames, 0) },
    },
  ],
});
