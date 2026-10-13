import type { CSSProperties, ReactNode } from "react";
import {
  type Easing,
  ease,
  lerp,
  progress,
  type ReadingOptions,
  random,
  readingTime,
  useFrame,
  useVideoInfo,
} from "../engine/index.js";
import { useBaseline } from "./baseline.js";

export type TextUnit = {
  text: string;
  /** Position in the stagger, or -1 for the whitespace between words (it never animates). */
  index: number;
  /** For `char`: which word the character belongs to (-1 for spaces), so a word never breaks across lines. */
  word: number;
};

/**
 * Split text the way `Reveal` does, for custom kinetic type: `line` on \n,
 * `word` on whitespace (kept as units with index -1, so the text reflows as
 * written), `char` into every character including spaces (each takes a slot
 * in the stagger, so a pause between words comes for free).
 */
export function splitText(text: string, by: "word" | "char" | "line" = "word"): TextUnit[] {
  if (by === "line") return text.split("\n").map((line, i) => ({ text: line, index: i, word: i }));
  if (by === "word") {
    let index = 0;
    return text
      .split(/(\s+)/)
      .filter((unit) => unit !== "")
      .map((unit) =>
        /^\s+$/.test(unit) ? { text: unit, index: -1, word: -1 } : { text: unit, index: index++, word: index - 1 },
      );
  }
  let word = 0;
  let inWord = false;
  return Array.from(text).map((ch, index) => {
    const space = /\s/.test(ch);
    if (!space && !inWord) inWord = true;
    if (space && inWord) {
      inWord = false;
      word++;
    }
    return { text: ch, index, word: space ? -1 : word };
  });
}

export type RevealTiming = {
  /** First frame of `at`, a stagger in seconds (`stagger`) or frames (`every`), or explicit `times`. */
  at?: number;
  by?: "word" | "char" | "line";
  stagger?: number;
  every?: number;
  times?: number[];
  duration?: number;
  frames?: number;
  /** The last unit is one the next cut interrupts: `landed` (and so `exit="read"`) ignores it. */
  cutOff?: boolean;
};

/**
 * When each unit of a `Reveal` starts and lands, and when the whole text has
 * landed: what sizes a shot around its text, or builds `sfx` on the same frames.
 */
export function revealTimes(text: string, fps: number, timing: RevealTiming = {}) {
  const { at = 0, by = "word", stagger = 0.05, every, times, duration = 0.8, frames, cutOff } = timing;
  const step = every ?? stagger * fps;
  const length = frames ?? duration * fps;
  const count = splitText(text, by).filter((u) => u.index >= 0).length;
  // Explicit times first; units past the end of `times` carry on at the stagger.
  const starts = Array.from({ length: count }, (_, i) =>
    times && i < times.length
      ? times[i]
      : times?.length
        ? times[times.length - 1] + (i - times.length + 1) * step
        : at + i * step,
  );
  const counted = cutOff && count > 1 ? starts.slice(0, -1) : starts;
  const landed = count === 0 ? at : Math.max(...counted) + length;
  return { starts, length, landed };
}

export type RevealProps = RevealTiming & {
  children: string;
  /** Rise distance, in em (or in % of the unit's height under a `mask`). */
  rise?: number;
  /** Start blur, in em. */
  blur?: number;
  /** Scale each unit settles from (0.9 grows into place, 1.2 settles down onto the page), about its baseline. */
  scale?: number;
  /**
   * Masked rise: each unit rises out of its own clip, padded `mask` em (0.15
   * when `true`) below for descenders and a little on the other sides, so the
   * clip cuts the motion and never the glyphs. No fade or blur by default.
   */
  mask?: boolean | number;
  /**
   * Variable-font axes from → to per unit, on the same curve: `{ wght: [300, 820] }`.
   * With `axesEvery`, letter by letter inside each word or line, that many
   * frames apart, while the unit itself still moves as one.
   */
  axes?: Record<string, [number, number]>;
  axesEvery?: number;
  easing?: Easing;
  /**
   * Frame to start fading out (quiet fade in place, never reverse the entrance),
   * or `"read"`: once the last unit has landed and the text has been held for its
   * reading time (`readingTime`, with `reading` options), so every text layer
   * gets its hold without counting frames.
   */
  exit?: number | "read";
  /** Seconds the exit fade takes. */
  exitDuration?: number;
  reading?: ReadingOptions;
  style?: CSSProperties;
  className?: string;
};

/**
 * Staggered text reveal: each unit rises, sharpens and fades in. Timings
 * follow the site's text reveal (0.6 s, 40 ms stagger) scaled for video.
 *
 * Presets, by the props they set:
 * - masked line rise: `by="line" mask`
 * - per-character stagger: `by="char" every={2}`
 * - word by word on the beat: `times={[t.beats(0), t.beats(1), …]}`
 * - blur-in: `blur={0.3} rise={0}`
 * - scale settle: `scale={0.85}` (or 1.15 from above)
 * - weight ripple: `by="char" axes={{ wght: [300, 820] }}`
 */
export function Reveal({
  children,
  at = 0,
  by = "word",
  stagger = 0.05,
  every,
  times,
  duration = 0.8,
  frames,
  rise,
  blur,
  scale,
  mask,
  axes,
  axesEvery,
  easing = ease.out,
  exit,
  exitDuration = 0.3,
  reading,
  cutOff,
  style,
  className,
}: RevealProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  // Units share one font, so one probe in the first gives every unit its baseline.
  const baseline = useBaseline();
  const scaled = scale !== undefined && scale !== 1;
  const units = splitText(children, by);
  const { starts, length, landed } = revealTimes(children, fps, {
    at,
    by,
    stagger,
    every,
    times,
    duration,
    frames,
    cutOff,
  });
  const last = cutOff ? starts.length - 1 : -1;
  // The interrupted unit is never meant to be read: hold for the rest of the text.
  const read = cutOff
    ? units
        .filter((u) => u.index !== last)
        .map((u) => u.text)
        .join("")
        .trim()
    : children;
  const exitAt = exit === "read" ? landed + readingTime(read, fps, reading).frames : exit;
  const out = exitAt === undefined ? 0 : progress(frame, exitAt, exitDuration * fps, ease.soft);
  const pad = mask === undefined || mask === false ? undefined : mask === true ? 0.15 : mask;
  const lift = rise ?? (pad === undefined ? 0.35 : 1.1);
  const soft = blur ?? (pad === undefined ? 0.12 : 0);

  const render = (unit: TextUnit) => {
    const p = progress(frame, starts[unit.index], length, easing);
    const variation = (t: number) =>
      axes
        ? Object.entries(axes)
            .map(([axis, [from, to]]) => `"${axis}" ${lerp(from, to, t).toFixed(1)}`)
            .join(", ")
        : undefined;
    const letters = axes !== undefined && axesEvery !== undefined && by !== "char";
    const settings = letters ? undefined : variation(p);
    const content = letters
      ? Array.from(unit.text).map((ch, i) => (
          <span
            key={i}
            style={{
              fontVariationSettings: variation(progress(frame, starts[unit.index] + i * axesEvery, length, easing)),
            }}
          >
            {ch}
          </span>
        ))
      : unit.text;
    const check = unit.index === last ? "off" : undefined;
    const transform = [
      lift ? (pad === undefined ? `translateY(${(1 - p) * lift}em)` : `translateY(${(1 - p) * lift * 100}%)`) : "",
      scaled ? `scale(${lerp(scale, 1, p)})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const inner: CSSProperties = {
      display: by === "line" ? "block" : "inline-block",
      whiteSpace: "pre",
      opacity: pad === undefined || soft > 0 ? p : 1,
      transform: transform || undefined,
      ...(scaled && { position: "relative", transformOrigin: baseline.origin() }),
      filter: p < 1 && soft > 0 ? `blur(${(1 - p) * soft}em)` : undefined,
      fontVariationSettings: settings,
    };
    const node = (
      <span key={unit.index} style={inner} data-launch-check={pad === undefined ? check : undefined}>
        {content}
        {scaled && unit.index === 0 && baseline.probe}
      </span>
    );
    if (pad === undefined) return node;
    // clip-path, not overflow: an inline-block with overflow hidden sits on its
    // bottom edge instead of the text baseline, which would lift every word.
    return (
      <span
        key={unit.index}
        style={{
          display: by === "line" ? "block" : "inline-block",
          clipPath: `inset(-0.1em -0.08em -${pad}em -0.08em)`,
        }}
        data-launch-check={check}
      >
        {node}
      </span>
    );
  };

  const words: ReactNode[] = [];
  if (by === "char") {
    // Characters of one word stay together, so the line wraps between words as text would.
    let group: TextUnit[] = [];
    const flush = () => {
      if (group.length === 0) return;
      words.push(
        <span key={`w${group[0].index}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {group.map(render)}
        </span>,
      );
      group = [];
    };
    for (const unit of units) {
      if (unit.word < 0) {
        flush();
        words.push(render(unit));
      } else group.push(unit);
    }
    flush();
  } else {
    for (const unit of units) words.push(unit.index < 0 ? unit.text : render(unit));
  }

  return (
    <span className={className} style={{ display: "inline", ...style, opacity: 1 - out }}>
      {words}
    </span>
  );
}

export type TypingOptions = {
  /** Average characters per second, kept over the whole text (default 18). */
  cps?: number;
  /** Seed for the variation, so the same text types the same way every render (default: the text). */
  seed?: number | string;
  /** How much each gap varies, ± as a fraction of the average (default 0.45). */
  variance?: number;
  /** Gap before the first letter after a space, × the average (default 1.8): a word is reached for. */
  space?: number;
  /** Gap after . , ; : ! ? (default 4): the typist reads what they wrote. */
  punctuation?: number;
  /** Speed of letters inside a word, × the average (default 0.75): fingers already know the word. */
  burst?: number;
};

/**
 * When each character of typed text appears, in frames after typing starts:
 * uneven like a person, the same every render. Gaps vary by `variance`,
 * letters inside a word come in bursts, a new word waits a little, and
 * punctuation waits longer. The gaps are scaled so the last character lands
 * where steady typing at `cps` would (`typingFrames`), so swapping cadence in
 * keeps a shot's length.
 *
 * The same list drives the picture and the sound: `<Typewriter times={keys}>`
 * and `sfx: keys.map((f, i) => ({ src: "audio/sfx/typing.wav", at: AT + f, hit: i * 7 + 3 }))`.
 */
export function typingCadence(text: string, fps: number, options: TypingOptions = {}): number[] {
  const { cps = 18, seed = text, variance = 0.45, space = 1.8, punctuation = 4, burst = 0.75 } = options;
  const chars = Array.from(text);
  if (chars.length === 0) return [];
  const rnd = random(seed);
  const gaps = chars.map((ch, i) => {
    const prev = chars[i - 1];
    const jitter = 1 + variance * (rnd() * 2 - 1);
    // A word picks its own speed, so one word comes out fast and the next more carefully.
    const shape =
      i === 0
        ? 1
        : /[.,;:!?]/.test(prev)
          ? punctuation
          : /\s/.test(prev) && !/\s/.test(ch)
            ? space
            : /\s/.test(ch)
              ? 1
              : burst;
    return Math.max(0.2, shape * jitter);
  });
  const total = gaps.reduce((a, b) => a + b, 0);
  const span = (chars.length / cps) * fps;
  let time = 0;
  // Up to whole frames, so the last key lands exactly on typingFrames.
  const keys = gaps.map((gap) => {
    time += (gap / total) * span;
    return Math.ceil(time - 1e-6);
  });
  // Two keys on one frame read as a paste and sound as one: pull earlier keys back a frame where there is room.
  for (let i = keys.length - 2; i >= 0; i--) keys[i] = Math.max(0, Math.min(keys[i], keys[i + 1] - 1));
  return keys;
}

/** Characters appear one by one, like typing. Optional caret. */
export function Typewriter({
  children,
  at = 0,
  cps = 18,
  cadence,
  times,
  caret = true,
  style,
}: {
  children: string;
  at?: number;
  /** Characters per second. */
  cps?: number;
  /** Type like a person (`typingCadence`) instead of at a steady rate: `true`, or its options. */
  cadence?: boolean | TypingOptions;
  /** Frame (after `at`) each character appears, e.g. from `typingCadence`, to share with the sound. */
  times?: number[];
  caret?: boolean;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const chars = Array.from(children);
  const keys =
    times ?? (cadence ? typingCadence(children, fps, { cps, ...(cadence === true ? {} : cadence) }) : undefined);
  const shown = keys
    ? keys.filter((f) => frame - at >= f).length
    : Math.max(0, Math.min(chars.length, Math.floor(((frame - at) / fps) * cps)));
  const typing = shown < chars.length && frame >= at;
  // Solid while typing, then a 1 s blink.
  const on = typing || Math.floor((frame - at) / (fps / 2)) % 2 === 0;
  return (
    <span style={style}>
      {chars.slice(0, shown).join("")}
      {caret && (
        <span
          style={{
            display: "inline-block",
            width: "0.06em",
            height: "1.1em",
            marginLeft: "0.04em",
            verticalAlign: "-0.15em",
            background: "currentColor",
            opacity: on ? 1 : 0,
          }}
        />
      )}
    </span>
  );
}

/** Frames a Typewriter needs to finish: the same with or without `cadence` (or the last of `times`). */
export const typingFrames = (text: string, fps: number, cps: number | number[] = 18) =>
  Array.isArray(cps) ? (cps.at(-1) ?? 0) : Math.ceil((Array.from(text).length / cps) * fps);
