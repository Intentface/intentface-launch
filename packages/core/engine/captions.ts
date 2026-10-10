/**
 * Captions: cues on the video's timeline, exported as SRT and WebVTT
 * (`pnpm launch captions <id>`, and by `render` next to the mp4) and burned
 * into the picture with `burnCaptions` on the video.
 *
 * A cue without `until` holds for `readingTime()`. Lines wrap at 42
 * characters, two lines at most per cue; longer text becomes consecutive cues
 * that share its time by length (each its own reading time, without `until`).
 * A cue ends where the next begins.
 */
import { type ReadingOptions, readingTime } from "./reading.js";

export type Caption = {
  text: string;
  /** Start frame: from the video's start, or from `shot`'s start when one is given (default 0 there). */
  at?: number;
  /** End frame, counted as `at`. Default: `at` plus the text's reading time. */
  until?: number;
  /** Count `at` and `until` from this shot's start, so the cue moves with the shot on a retime. */
  shot?: string;
};

/** How burned-in captions look. Sizes are pixels at 1080p (scaled to the frame's short side). */
export type CaptionStyle = {
  /** Font size (default 40; 36 in a 9:16 frame, where lines are narrower). */
  size?: number;
  font?: string;
  weight?: number;
  color?: string;
  /** The box behind the text, for contrast over any picture (default black at 78%). */
  box?: string;
  /** Distance of the box's bottom edge above the bottom of the clear area (default 24). */
  lift?: number;
};

/** A cue as shown: absolute frames, already wrapped. */
export type CaptionCue = {
  text: string;
  lines: string[];
  from: number;
  to: number;
  /** Frames this cue's text needs to be read (`readingTime`); `check` flags cues shorter than that. */
  needs: number;
};

/** Characters per caption line (Netflix, BBC and most broadcast style guides). */
export const LINE = 42;
/** Lines per cue. */
export const LINES = 2;

/** Greedy word wrap at `max` characters; a word longer than a line is broken. */
export function wrapLines(text: string, max = LINE): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.replace(/\s+/g, " ").trim().split(" ")) {
    while (word.length > max) {
      if (line) lines.push(line);
      lines.push(word.slice(0, max));
      word = word.slice(max);
      line = "";
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Text as cues of at most two wrapped lines each, the words shared evenly
 * between them (so a long sentence never leaves one word on a cue of its own).
 */
export function splitCue(text: string): string[][] {
  return groupLines(text).map(balance);
}

/** Two lines of one cue, broken where they come closest to equal length (no orphan word on the second). */
function balance(lines: string[]): string[] {
  if (lines.length !== 2) return lines;
  const words = lines.join(" ").split(" ");
  let best = lines;
  for (let k = 1; k < words.length; k++) {
    const pair = [words.slice(0, k).join(" "), words.slice(k).join(" ")];
    if (pair.some((l) => l.length > LINE)) continue;
    if (Math.abs(pair[0].length - pair[1].length) < Math.abs(best[0].length - best[1].length)) best = pair;
  }
  return best;
}

function groupLines(text: string): string[][] {
  const lines = wrapLines(text);
  if (lines.length <= LINES) return [lines];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  for (let n = Math.ceil(lines.length / LINES); n <= lines.length; n++) {
    const target = text.length / n;
    const chunks: string[] = [];
    let chunk = "";
    for (const word of words) {
      const longer = chunk ? `${chunk} ${word}` : word;
      // Close the chunk when the word takes it further past the target than it is short of it.
      if (chunk && chunks.length < n - 1 && longer.length - target > target - chunk.length) {
        chunks.push(chunk);
        chunk = word;
      } else chunk = longer;
    }
    chunks.push(chunk);
    const groups = chunks.map((c) => wrapLines(c));
    if (groups.every((g) => g.length <= LINES)) return groups;
  }
  const groups: string[][] = [];
  for (let k = 0; k < lines.length; k += LINES) groups.push(lines.slice(k, k + LINES));
  return groups;
}

/**
 * Resolve cues to absolute frames, wrap them, split long ones, and keep them
 * from overlapping (a cue ends where the next one starts) or running past the end.
 */
export function resolveCaptions(
  captions: Caption[],
  {
    fps,
    shots,
    duration,
    reading,
  }: { fps: number; shots: { id: string; from: number }[]; duration: number; reading?: ReadingOptions },
): CaptionCue[] {
  const base = (c: Caption) => {
    if (!c.shot) return 0;
    const shot = shots.find((s) => s.id === c.shot);
    if (!shot) throw new Error(`Caption "${c.text}" names shot "${c.shot}", which the video does not have`);
    return shot.from;
  };
  const needs = (text: string) => readingTime(text, fps, reading).frames;
  const groupsOf = splitCue;
  const placed = captions
    .map((c) => {
      const text = c.text.replace(/\s+/g, " ").trim();
      const from = base(c) + (c.at ?? 0);
      // Without `until`, each cue it splits into gets its own reading time.
      const to =
        c.until !== undefined ? base(c) + c.until : from + groupsOf(text).reduce((n, g) => n + needs(g.join(" ")), 0);
      return { text, from, to };
    })
    .filter((c) => c.text)
    .sort((a, b) => a.from - b.from);
  const cues: CaptionCue[] = [];
  placed.forEach((c, i) => {
    const end = Math.min(c.to, placed[i + 1]?.from ?? Number.POSITIVE_INFINITY, duration);
    if (end <= c.from) return;
    const groups = groupsOf(c.text);
    const total = groups.reduce((n, g) => n + g.join(" ").length, 0);
    let start = c.from;
    groups.forEach((g, k) => {
      const stop = k === groups.length - 1 ? end : Math.round(start + ((end - c.from) * g.join(" ").length) / total);
      cues.push({ text: g.join(" "), lines: g, from: start, to: stop, needs: needs(g.join(" ")) });
      start = stop;
    });
  });
  return cues;
}

/** The cue on screen at `frame`, if any. */
export const cueAt = (cues: CaptionCue[], frame: number) => cues.find((c) => frame >= c.from && frame < c.to);
