// Example: kinetic type. Each shot is one pattern for type in a launch video, written as a small
// component that takes its copy and cue frames as props, to copy into a product's video.
// Run: pnpm launch sheet example-type --shot build-centred --every 3 (and slot, wordmark-cut,
// wordmark-close, punch); pnpm launch measure example-type --shot <id> for landings and judder.
// Expect:
// - build-centred: one word fades up out of a blur on each beat (the last two on half beats); the
//   words already placed glide left so the line stays centred, never stopping between words;
//   held, the line sits still on whole pixels.
// - slot: "Make a video for your" with the last word on a reel: launch (a bar), release (two
//   beats), changelog (one beat), then a fast spin with motion blur that brakes onto "team" on a
//   beat. The line re-centres on each word's width; nothing touches.
// - wordmark-cut: "northwind." flies in from the right far larger than the frame, pulls back to
//   full view in the accent and cools to ink as it settles; the full stop keeps the accent.
// - wordmark-close: a hard cut on the beat to the same layout 1.7× nearer, the full stop right of
//   centre, held still.
// - punch: three two-line cards, each line flicked in from the left with no bounce, the second
//   5 frames behind; hard cuts on beats, each card a different size, place and ground.

import {
  defineVideo,
  ease,
  landed,
  lerp,
  mixColor,
  progress,
  readingTime,
  readingTimeOnBeats,
  springTo,
  tempo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import {
  brake,
  Camera,
  MotionBlur,
  measureTextNow,
  Reveal,
  useBaseline,
  useFontsReady,
  useMeasureText,
} from "@intentface-launch/core/kit";
import type { CSSProperties } from "react";

const t = tempo(120, 60);

/** The look every example video shares. */
const look = {
  ground: "#f4f3f0",
  surface: "#ffffff",
  ink: "#16161a",
  muted: "#6b6b76",
  line: "rgb(22 22 26 / 0.08)",
  accent: "#4f5bff",
  accentSoft: "rgb(79 91 255 / 0.12)",
  darkGround: "#0f1013",
  darkInk: "#f3f2ef",
};
const sans = '"Studio Sans", system-ui, sans-serif';
const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: look.ground,
  color: look.ink,
  fontFamily: sans,
};

/** A CSS font shorthand in the shared face, for measuring. */
const face = (weight: number, size: number) => `${weight} ${size}px "Studio Sans"`;
/** The same face as style properties (not the `font` shorthand, which would reset `lineHeight`). */
const faceStyle = (weight: number, size: number): CSSProperties => ({ fontWeight: weight, fontSize: size });

// ─── 1. build-centred ──────────────────────────────────────────────────────────────────────────

const BUILD = {
  text: "Every word lands on time.",
  /** Beats each word lands on: one a beat, then two on half beats so the line gathers pace. */
  beats: [1, 2, 3, 3.5, 4],
};

/**
 * A line built word by word that stays centred as it grows.
 *
 * Use it for a claim that should be heard word by word on the music: each word lands on its own
 * beat, and the line never sits off-centre waiting for the rest of it.
 *
 * - Widths come from `useMeasureText` (the frame waits for the font), so the centre of the line
 *   after word `i` is known before it is drawn: `left = (width - end of word i) / 2`.
 * - `left` rides `springTo`, one target per word, `{ duration: 18, bounce: 0 }`: 18 frames settles
 *   inside a half beat (15 frames) to within a few pixels, and when the next word comes before
 *   that, the spring keeps the speed it had instead of stopping and setting off again. No bounce:
 *   the line is text being read.
 * - Each word starts `lead` (6) frames before its beat, so it is readable on the beat (a hit that
 *   lands exactly on the transient looks late), and fades up out of a blur over 24 frames
 *   (`Reveal` with a quarter-em rise and 0.08 em of blur: the kinetic-typography default).
 * - The words are laid out by the browser in one line (`Reveal`, words not yet in at opacity 0),
 *   so kerning and spaces are the font's own; only the line's left edge moves. Its targets are
 *   whole pixels and it snaps to them once within 0.2 px (`landed`), so the held line is still
 *   and on the pixel grid (0.035 px of judder on the last re-centre).
 */
function BuildCentred({
  text,
  times,
  size = 128,
  top = 470,
  lead = 6,
  enter = 24,
}: {
  text: string;
  /** Frame each word lands on (readable from then), one per word. */
  times: number[];
  size?: number;
  top?: number;
  /** Frames a word starts before its landing frame. */
  lead?: number;
  /** Frames a word takes to fade up. */
  enter?: number;
}) {
  const frame = useFrame();
  const { fps, width } = useVideoInfo();
  const font = face(600, size);
  const tracking = "-0.03em";
  const m = useMeasureText(text, font, { letterSpacing: tracking });
  const starts = times.map((f) => f - lead);
  const targets = m.words.map((w, i) => ({ at: starts[i], to: Math.round((width - (w.x + w.width)) / 2) }));
  const moving = springTo(frame, fps, targets, { duration: 18, bounce: 0 });
  const target = targets.filter((k) => frame >= k.at).at(-1)?.to ?? targets[0].to;
  const left = landed(moving, target);
  return (
    <div style={fill}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          ...faceStyle(600, size),
          letterSpacing: tracking,
          whiteSpace: "nowrap",
        }}
      >
        <Reveal times={starts} frames={enter} rise={0.25} blur={0.08}>
          {text}
        </Reveal>
      </div>
    </div>
  );
}

const buildTimes = BUILD.beats.map((b) => t.beats(b));
/** Held for its reading time after the last word lands, in whole beats, then a cut. */
const buildLength = buildTimes[buildTimes.length - 1] + readingTimeOnBeats(BUILD.text, t).frames;

// ─── 2. slot ───────────────────────────────────────────────────────────────────────────────────

const SLOT = {
  lead: "Make a video for your",
  options: ["launch", "release", "changelog", "team"],
  /** The reel steps on these beats: the first option holds a bar, the next two beats, then one. */
  steps: [5, 7],
  /** The last option spins in from beat 8 and stops on beat 10. */
  spin: { at: 8, land: 10, turns: 2 },
};

/**
 * A sentence that finishes itself several ways: a fixed lead-in and a last word on a reel.
 *
 * Use it to show range (what a product is for, who it is for) in one line the viewer reads once:
 * the lead-in is read on the first option, then only the last word changes.
 *
 * - The reel is a column of the options, repeated `turns` times so the last spin has rows to pass;
 *   its position is in rows. Steps ride `springTo` (`{ duration: 20, bounce: 0 }`, about 16 px a
 *   frame at its fastest for a 135 px row: quick enough to read as a reel, slow enough to stay
 *   sharp without blur), on beats, the first option holding a bar, then two beats, then one, so
 *   the changes gather pace into the spin.
 * - The spin: 12 frames of even acceleration, then `brake` (speed falling as (1 − t/frames)²) onto
 *   the last option exactly on its beat. The top speed is solved from the distance, so the two
 *   join with no change of speed: v = rows / (ramp / 2 + brake / 3). With 9 rows over 60 frames it
 *   peaks near 55 px a frame, where a reel strobes without blur, so `MotionBlur` covers exactly
 *   the frames over 4 px a frame and the stop is sharp. 32 samples, not 16: at that speed 16
 *   samples show as separate copies.
 * - The slot is a window with feathered top and bottom edges (a reel's), sized so the rows next
 *   to the held word are fully outside it: rows are 1.3 em apart, the window reaches 0.2 em past
 *   its row and is opaque only over the glyphs.
 * - The slot's width follows each word on a quick spring (`{ duration: 12, bounce: 0 }`), and the
 *   whole line is centred on lead-in + slot, so it stays balanced: the lead-in glides half the
 *   change in width. Positions land on whole pixels with `landed`.
 * - Only the lead-in and the last option are checked for reading time; the options in passing
 *   are the reel, not copy.
 */
function Slot({
  lead,
  options,
  steps,
  spin,
  size = 104,
  enterAt = 4,
}: {
  lead: string;
  options: string[];
  /** Frames the reel steps on to the next option (one fewer than the options before the spin). */
  steps: number[];
  /** The last option: the spin starts at `at`, passes `turns` whole cycles and stops at `land`. */
  spin: { at: number; land: number; turns: number };
  size?: number;
  /** Frame the lead-in starts to fade up. */
  enterAt?: number;
}) {
  const frame = useFrame();
  const { fps, width, height } = useVideoInfo();
  const font = face(600, size);
  const tracking = "-0.03em";
  useFontsReady(font, `${lead} ${options.join(" ")}`);
  const measure = (s: string) => measureTextNow(s, font, { letterSpacing: tracking });
  /** Where the slot starts: the lead-in, then a space. */
  const slotX = measure(`${lead} x`).words.at(-1)?.x ?? 0;
  const widths = options.map((o) => measure(o).width);
  const row = Math.round(size * 1.3);
  const pad = Math.round(size * 0.2);
  const top = Math.round(height / 2 - row / 2);

  // The reel, in rows. Row 0 is the first option; it rolls in from an empty row above.
  const n = options.length;
  const first = enterAt + 16;
  const stepped = springTo(
    frame,
    fps,
    [{ at: 0, to: -1 }, { at: first, to: 0 }, ...steps.map((at, i) => ({ at, to: i + 1 }))],
    { duration: 20, bounce: 0 },
  );
  const last = n - 1 + spin.turns * n;
  const rows = last - steps.length;
  const ramp = 12;
  const braking = spin.land - spin.at - ramp;
  const topSpeed = rows / (ramp / 2 + braking / 3);
  const stop = brake({ speed: topSpeed, frames: braking, to: rows });
  const since = frame - spin.at;
  const spun = since <= 0 ? 0 : since < ramp ? 0.5 * (topSpeed / ramp) * since ** 2 : stop.position(since - ramp);
  const pos = stepped + spun;
  // Blur only while the reel moves over 4 px a frame.
  const fast = 4 / row / topSpeed;
  const blurWhen: [number, number][] = [
    [Math.floor(spin.at + ramp * fast), Math.ceil(spin.at + ramp + braking * (1 - Math.sqrt(fast)))],
  ];

  // The slot's width: one quick spring per word ({ duration: 12 }: a long tail creeps under a
  // pixel a frame). The last sets off 12 frames before the stop, so the line is balanced on the
  // new word as the reel comes to rest.
  const slotTargets = [
    { at: 0, to: widths[0] },
    ...steps.map((at, i) => ({ at, to: widths[(i + 1) % n] })),
    { at: spin.land - 12, to: widths[n - 1] },
  ];
  const slot = springTo(frame, fps, slotTargets, { duration: 12, bounce: 0 });
  const slotTarget = slotTargets.filter((k) => frame >= k.at).at(-1)?.to ?? widths[0];
  const left = landed((width - slotX - slot) / 2, Math.round((width - slotX - slotTarget) / 2));
  // The reel's offset in pixels, landing on the whole row it is heading for.
  const offset = landed(pos * row, Math.round(pos) * row);
  const text: CSSProperties = {
    ...faceStyle(600, size),
    letterSpacing: tracking,
    lineHeight: `${row}px`,
    whiteSpace: "nowrap",
  };
  const visible = [Math.floor(pos) - 1, Math.floor(pos), Math.floor(pos) + 1, Math.floor(pos) + 2].filter(
    (k) => k >= 0 && k <= last,
  );
  const reel: CSSProperties = {
    position: "absolute",
    left: left + slotX,
    top: top - pad,
    width: size * 8,
    height: row + 2 * pad,
    // Opaque over the glyphs of the row in the window, feathered to nothing at its edges.
    maskImage: `linear-gradient(to bottom, transparent ${size * 0.2}px, #000 ${size * 0.47}px, #000 ${row + pad * 2 - size * 0.25}px, transparent ${row + pad * 2}px)`,
    maskRepeat: "repeat-x",
  };
  return (
    <div style={fill}>
      <div style={{ ...text, position: "absolute", left, top }}>
        <Reveal at={enterAt} every={3} frames={24} rise={0.25} blur={0.08}>
          {lead}
        </Reveal>
      </div>
      <MotionBlur when={blurWhen} samples={32}>
        <div style={reel}>
          {visible.map((k) => (
            <div
              key={k}
              data-launch-check={k === last && frame >= spin.land ? undefined : "off"}
              style={{ ...text, position: "absolute", left: 0, top: pad + k * row - offset }}
            >
              {options[k % n]}
            </div>
          ))}
        </div>
      </MotionBlur>
    </div>
  );
}

const slotSteps = SLOT.steps.map((b) => t.beats(b));
const slotSpin = { at: t.beats(SLOT.spin.at), land: t.beats(SLOT.spin.land), turns: SLOT.spin.turns };
/** The whole sentence is read again on the landing: its reading time, in whole beats. */
const slotLength =
  slotSpin.land + readingTimeOnBeats(`${SLOT.lead} ${SLOT.options[SLOT.options.length - 1]}`, t).frames;

// ─── 3. wordmark-cut ───────────────────────────────────────────────────────────────────────────

const MARK = { name: "northwind", stop: ".", size: 240, tracking: "-0.045em", top: 400 };
const markFont = face(700, MARK.size);

/**
 * The wordmark as laid out on the end card: centred, letters and full stop as separate runs so
 * each can take its own colour. Both end-card shots draw this same layout, so the cut between
 * them is a cut between two framings of one object. `transform` (about the baseline) moves it.
 */
function Wordmark({
  color = look.ink,
  stopColor = look.accent,
  transform,
  check,
}: {
  color?: string;
  stopColor?: string;
  transform?: (origin: (x?: string) => string) => CSSProperties;
  /** `false` while it is moving or cropped: not meant to be read then. */
  check?: boolean;
}) {
  const baseline = useBaseline();
  return (
    <div
      data-launch-check={check === false ? "off" : undefined}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: MARK.top,
        textAlign: "center",
        ...faceStyle(700, MARK.size),
        letterSpacing: MARK.tracking,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "inline-block", position: "relative", ...transform?.(baseline.origin) }}>
        <span style={{ color }}>{MARK.name}</span>
        <span style={{ color: stopColor }}>{MARK.stop}</span>
        {baseline.probe}
      </span>
    </div>
  );
}

/**
 * End card, first shot: a wordmark far wider than the frame flies in from the right, pulls back
 * to full view and cools from the accent to ink as it settles.
 *
 * Use it to land a name after a fast cut: the size and speed carry the film's energy into the
 * card, and the settle is the stillest moment, where the name is read.
 *
 * - One move, 72 frames on `ease.expo`: most of it in the first third, a long settle after, so it
 *   arrives fast and rests (a big travel wants the long end of 30 to 60+ frames).
 * - Scale from 3.2× to 1× in log space (each halving takes the same time, so the pull-back does
 *   not rush at the end), about the baseline (`useBaseline`): the baseline stays on its pixel row
 *   and the letters do not judder as they shrink. The slide (1500 px from the right) rides the
 *   same curve, so the two read as one move.
 * - `MotionBlur` over the first 30 frames, where it moves tens of pixels a frame; the settle is
 *   sharp.
 * - Colour on its own clock: from frame 12 over 48 frames on `ease.soft` in OKLCH, so it is still
 *   cooling as the move settles and is ink before it lands. The full stop keeps the accent.
 * - From the landing on it has no transform and the exact colours: the held frame is the mark.
 */
function WordmarkCut({ at = 0, frames = 72, from = 3.2, slide = 1500 }) {
  const frame = useFrame();
  const p = progress(frame, at, frames, ease.expo);
  const cool = progress(frame, at + 12, 48, ease.soft);
  const scale = Math.exp(lerp(Math.log(from), 0, p));
  const moving = p < 1;
  return (
    <div style={fill}>
      <MotionBlur when={[[at, at + 30]]}>
        <Wordmark
          check={!moving}
          color={cool < 1 ? mixColor(look.accent, look.ink, cool) : look.ink}
          transform={(origin) =>
            moving ? { transform: `translateX(${slide * (1 - p)}px) scale(${scale})`, transformOrigin: origin() } : {}
          }
        />
      </MotionBlur>
    </div>
  );
}

/**
 * End card, second shot: a hard cut to the same wordmark 1.7× nearer on its last letters and the
 * full stop, held as the film's last punctuation.
 *
 * Use it after a wordmark has been read: the cut on the beat is the full stop said out loud.
 *
 * - The same `Wordmark` under a still `Camera`: one key, so nothing moves and the text holds
 *   still. 1.7× is near enough to read as a new shot (a cut under about 1.4× looks like a jump)
 *   and keeps the end of the name legible as a word.
 * - Framed off-centre: the full stop sits at 62% across and on the lower third's line, from the
 *   measured width of the name, so a change of copy keeps the framing.
 * - Cropped by the frame on purpose, so it is left out of the reading and safe-area checks; the
 *   name was read in the shot before.
 */
function WordmarkClose({ zoom = 1.7, stopAt = [0.62, 0.6] }: { zoom?: number; stopAt?: [number, number] }) {
  const { width, height } = useVideoInfo();
  const m = useMeasureText(`${MARK.name}${MARK.stop}`, markFont, { letterSpacing: MARK.tracking });
  const name = measureTextNow(MARK.name, markFont, { letterSpacing: MARK.tracking }).width;
  // The full stop's centre in the layout: the line is centred, the dot sits on the baseline.
  const stop = { x: (width - m.width) / 2 + (name + m.width) / 2, y: MARK.top + m.ascent - MARK.size * 0.08 };
  const view = {
    x: stop.x - (stopAt[0] * width - width / 2) / zoom,
    y: stop.y - (stopAt[1] * height - height / 2) / zoom,
    zoom,
  };
  return (
    <div style={fill}>
      <Camera keys={[{ at: 0, view }]}>
        <Wordmark check={false} />
      </Camera>
    </div>
  );
}

// ─── 4. punch ──────────────────────────────────────────────────────────────────────────────────

type Card = {
  lines: [string, string];
  size: number;
  /** Where the block sits: its left edge (left), right edge (right) or centre (center). */
  align: "left" | "right" | "center";
  top: number;
  dark?: boolean;
  /** The line set in the accent: the stressed word, if any. */
  accent?: number;
};

const CARDS: Card[] = [
  { lines: ["Write it", "once."], size: 200, align: "left", top: 300 },
  { lines: ["Render it", "anywhere."], size: 136, align: "right", top: 560, dark: true },
  { lines: ["Ship it", "today."], size: 260, align: "center", top: 270, accent: 1 },
];

/**
 * A card lasts until its second line has landed (5 frames behind, readable about 12 frames in)
 * plus its reading time, rounded up to whole beats, so cuts land on beats and no card outstays its
 * words: 4 beats each here.
 */
const cardBeats = CARDS.map((c) =>
  Math.ceil((5 + 12 + readingTime(c.lines.join(" "), t.fps).frames) / t.framesPerBeat),
);
const cardAt = cardBeats.map((_, i) => t.beats(cardBeats.slice(0, i).reduce((a, b) => a + b, 0)));
const punchLength = t.beats(cardBeats.reduce((a, b) => a + b, 0));

/**
 * Statement cards that cut hard: two short lines per card, flicked in from the left, a hard cut
 * to the next card on the beat.
 *
 * Use it for a run of short claims between product shots, or a manifesto: the cuts are the
 * rhythm, so vary each card's size, place and ground or it reads as a slideshow.
 *
 * - Each line travels 1.2 em from the left in 18 frames on `ease.expo`: two thirds of the way in
 *   its first 3 frames (a flick), then a long settle with no overshoot. Statements are read, so no
 *   bounce. Under about 1 em the move is over before the eye sees a direction and reads as a pop. It fades in over its first 4 frames on `ease.soft`, so the first frame of the cut is
 *   not blank for long.
 * - The second line follows 5 frames behind the first: close enough to read as one statement,
 *   apart enough to see two hits.
 * - `MotionBlur` on each card's first 24 frames, where the lines move fast; held, they are sharp
 *   with no transform.
 * - Each card lasts until its second line is readable plus `readingTime` of its words, rounded up
 *   to whole beats, so every cut is on a beat and nothing leaves before it is read.
 */
function Punch({
  cards,
  at,
  travel = 1.2,
  flick = 18,
  follow = 5,
}: {
  cards: Card[];
  /** Frame each card cuts in. */
  at: number[];
  /** Em each line flicks in from. */
  travel?: number;
  /** Frames a line takes to land. */
  flick?: number;
  /** Frames the second line follows the first. */
  follow?: number;
}) {
  const frame = useFrame();
  const { width } = useVideoInfo();
  const i = Math.max(0, at.filter((f) => frame >= f).length - 1);
  const card = cards[i];
  const local = frame - at[i];
  const margin = 160;
  const place: CSSProperties =
    card.align === "left"
      ? { left: margin, textAlign: "left" }
      : card.align === "right"
        ? { right: margin, textAlign: "right" }
        : { left: 0, width, textAlign: "center" };
  return (
    <div style={{ ...fill, background: card.dark ? look.darkGround : look.ground }}>
      <MotionBlur when={[[at[i], at[i] + flick + follow + 1]]}>
        <div
          style={{
            position: "absolute",
            top: card.top,
            ...place,
            ...faceStyle(700, card.size),
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            whiteSpace: "nowrap",
          }}
        >
          {card.lines.map((line, j) => {
            const p = progress(local, j * follow, flick, ease.expo);
            const shown = progress(local, j * follow, 4, ease.soft);
            const color = card.accent === j ? look.accent : card.dark ? look.darkInk : look.ink;
            return (
              <div
                key={`${i}-${j}`}
                style={{
                  color,
                  opacity: shown,
                  transform: p < 1 ? `translateX(${-(1 - p) * travel}em)` : undefined,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </MotionBlur>
    </div>
  );
}

export default defineVideo({
  id: "example-type",
  title: "Kinetic type patterns",
  logline: "Reusable kinetic type moves for launch videos, one pattern per shot.",
  bpm: t.bpm,
  background: look.ground,
  shots: [
    {
      id: "build-centred",
      title: "Build, centred",
      duration: buildLength,
      component: () => <BuildCentred text={BUILD.text} times={buildTimes} />,
      moments: { last: buildTimes[buildTimes.length - 1] },
    },
    {
      id: "slot",
      title: "Slot",
      duration: slotLength,
      component: () => <Slot lead={SLOT.lead} options={SLOT.options} steps={slotSteps} spin={slotSpin} />,
      moments: { spin: slotSpin.at, land: slotSpin.land },
    },
    {
      id: "wordmark-cut",
      title: "Wordmark, settle",
      duration: t.beats(5),
      component: () => <WordmarkCut />,
      moments: { settled: 72 },
    },
    {
      id: "wordmark-close",
      title: "Wordmark, close",
      duration: t.beats(4),
      component: () => <WordmarkClose />,
    },
    {
      id: "punch",
      title: "Punch cards",
      duration: punchLength,
      component: () => <Punch cards={CARDS} at={cardAt} />,
      moments: Object.fromEntries(cardAt.map((f, i) => [`card${i + 1}`, f])),
    },
  ],
});
