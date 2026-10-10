/**
 * How long text has to stay on screen to be read. Subtitling practice is
 * 17 characters per second for general audiences and 12 to 15 on TV; in a
 * motion piece the text competes with movement, so the default is 14, and
 * anything that needs more than 17 to fit is a warning.
 */

export type ReadingOptions = {
  /** Characters per second the viewer reads (default 14). */
  cps?: number;
  /** Words per second, for short words that characters undercount (default 3). */
  wps?: number;
  /** Seconds added after the last word is read, before the text may leave (default 0.3). */
  settle?: number;
  /** Seconds of entrance animation before the text is readable, added to the hold (default 0: the hold starts once it lands). */
  entry?: number;
  /** Shortest and longest hold, in seconds (default 1 and 5). */
  min?: number;
  max?: number;
  /** Technical copy (code, numbers, product names) reads slower: 1.25× the reading part. */
  audience?: "general" | "technical";
  /** Busy motion behind or around the text: 1.2× the reading part. */
  competingMotion?: "low" | "high";
};

export type Reading = {
  seconds: number;
  frames: number;
  /** Characters per second the viewer actually needs at this hold. */
  cps: number;
  warnings: string[];
};

const CEILING_CPS = 17;

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const chars = (text: string) => Array.from(text.replace(/\s+/g, " ").trim()).length;

/**
 * The hold for `text`: `clamp(entry + max(chars / cps, words / wps) × factor + settle, min, max)`.
 * Measured from when the text lands unless `entry` is given.
 */
export function readingTime(text: string, fps: number, options: ReadingOptions = {}): Reading {
  const {
    cps = 14,
    wps = 3,
    settle = 0.3,
    entry = 0,
    min = 1,
    max = 5,
    audience = "general",
    competingMotion = "low",
  } = options;
  const n = chars(text);
  const factor = (audience === "technical" ? 1.25 : 1) * (competingMotion === "high" ? 1.2 : 1);
  const read = Math.max(n / cps, words(text).length / wps) * factor;
  const seconds = Math.min(max, Math.max(min, entry + read + settle));
  const available = seconds - entry - settle;
  const needed = available > 0 ? n / available : Number.POSITIVE_INFINITY;
  const warnings = lintText(text);
  if (needed > CEILING_CPS) {
    warnings.push(
      `${n} characters in ${seconds.toFixed(1)} s is ${needed.toFixed(0)} cps (ceiling ${CEILING_CPS}): cut words or split across shots`,
    );
  }
  return { seconds, frames: Math.ceil(seconds * fps), cps: needed, warnings };
}

/** The reading-time floor rounded up to whole beats: what a shot or a text hold should last. */
export function readingTimeOnBeats(
  text: string,
  beat: { framesPerBeat: number; fps: number },
  options: ReadingOptions = {},
): Reading & { beats: number } {
  const reading = readingTime(text, beat.fps, options);
  const beats = Math.max(1, Math.ceil(reading.frames / beat.framesPerBeat - 1e-6));
  return { ...reading, beats, frames: Math.round(beats * beat.framesPerBeat) };
}

/**
 * The frame each word should appear at, for kinetic type without a voice-over:
 * a word lands when a reader at `cps` gets to it.
 */
export function wordTimings(text: string, { start = 0, cps = 14, fps }: { start?: number; cps?: number; fps: number }) {
  let before = 0;
  return words(text).map((word) => {
    const at = Math.round(start + (before / cps) * fps);
    before += Array.from(word).length + 1;
    return { word, at };
  });
}

/**
 * Problems with the text itself. `headline` (the default) caps it at 6 words;
 * `line` is anything else on screen. Both use subtitle limits: 42 characters
 * per line, 2 lines.
 */
export function lintText(text: string, kind: "headline" | "line" = "headline"): string[] {
  const warnings: string[] = [];
  const lines = text.split("\n").map((l) => l.trim());
  const count = words(text).length;
  if (kind === "headline" && count > 6) warnings.push(`${count} words: a headline reads best at 6 or fewer`);
  for (const line of lines) {
    const n = Array.from(line).length;
    if (n > 42) warnings.push(`"${line.slice(0, 24)}…" is ${n} characters: keep lines to 42`);
  }
  if (lines.length > 2) warnings.push(`${lines.length} lines: keep on-screen text to 2`);
  return warnings;
}
