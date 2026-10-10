import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { editBeats, findBreaths } from "../engine/motion.js";
import type { Info } from "./browser.js";
import { run } from "./ffmpeg.js";
import { CORE } from "./project.js";
import { root } from "./util.js";

export type Beats = {
  file: string;
  duration: number;
  bpm: number;
  /** 0 to 1: steadiness of the beat spacing and how clearly beats stand out. Below 0.5, cut by ear. */
  confidence: number;
  beats: number[];
  downbeats: number[];
  onsets: number[];
  /** Where the track changes character, with whether the energy goes up or down after. */
  sections: { time: number; beat: number; strength: number; change: "up" | "down" | "same" }[];
  /** Smoothed loudness, 0 to 1, `rate` values per second. */
  energy: { rate: number; values: number[] };
  /** With `--seams`: passages of whole bars that replay cleanly (`audio.edit`), best first. */
  seams?: Seam[];
};

export type Seam = {
  /** Beats [from, to): `audio.edit: [{ replay }]`. Negative, or past the last beat, on the grid extended at the track's tempo. */
  replay: [number, number];
  bars: number;
  /** Whether `from` is a detected downbeat. */
  downbeat: boolean;
  /** The passage in seconds of the track. */
  seconds: [number, number];
  /** 0 to 1: how alike the music is either side of the seam, in level, spectrum and harmony. */
  score: number;
  /** Mean dB apart, beat by beat around the seam and over the 150 ms at it. */
  db: number;
  /** 0 the same chord either side of the seam, 1 unrelated. */
  harmony: number;
  /** Suggested crossfade: short where a beat's attack sits on the seam, long across a pad. */
  crossfade: number;
};

/**
 * Detect the beats, sections, breaths and energy of the track in
 * videos/<id>/audio/ and write beats.json beside it. Compare `bpm` with the video's tempo() before relying on it:
 * generated tracks drift, and cuts should follow the track, not the grid.
 */
export async function beats(videoId: string, { seams = false } = {}) {
  const dir = join(root(), "videos", videoId, "audio");
  const track = existsSync(dir) ? readdirSync(dir).find((f) => /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(f)) : undefined;
  if (!track) throw new Error(`No audio file in ${relative(root(), dir)}/`);
  // libsndfile (under librosa) reads WAV, FLAC and Ogg, not AAC or Opus in an
  // MP4 container, so decode everything else with ffmpeg first.
  const tmp = mkdtempSync(join(tmpdir(), "launch-beats-"));
  let json: string;
  try {
    let input = join(dir, track);
    if (!/\.(wav|flac)$/i.test(track)) {
      const wav = join(tmp, "track.wav");
      await run(["-i", input, "-vn", "-c:a", "pcm_s16le", wav]);
      input = wav;
    }
    json = execFileSync("uv", ["run", "--quiet", join(CORE, "tools/beats.py"), input, ...(seams ? ["--seams"] : [])], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const result = JSON.parse(json) as Beats;
  const target = join(dir, "beats.json");
  const breaths = findBreaths(result.energy);
  writeFileSync(target, `${JSON.stringify({ ...result, file: track, breaths }, null, 2)}\n`);
  const s = (t: number) => `${t.toFixed(2)}s`;
  console.log(`  ${relative(root(), target)} · ${result.bpm} BPM · ${result.beats.length} beats · ${result.duration}s`);
  console.log(`  confidence ${result.confidence}${result.confidence < 0.5 ? ": low, check the cuts by ear" : ""}`);
  if (result.confidence < 0.5 && result.onsets.length) {
    console.log(
      `  fallback: tempo(<brief BPM>, fps) offset by the first strong onset, audio.offset = ${s(result.onsets[0])}`,
    );
  }
  for (const x of result.sections) console.log(`  section at ${s(x.time)} (beat ${x.beat}), energy ${x.change}`);
  for (const b of breaths) console.log(`  breath ${s(b.start)} to ${s(b.end)}`);
  if (seams) {
    const list = result.seams ?? [];
    console.log(
      list.length
        ? `  seams (replay: [from, to] beats; score 0 to 1; dB apart; harmony 0 same chord, 1 unrelated):`
        : "  no seams: too few beats",
    );
    for (const x of list.slice(0, 12)) {
      console.log(
        `    replay: [${x.replay.join(", ")}]  ${x.bars} bar${x.bars > 1 ? "s" : ""} · ${s(x.seconds[0])} to ${s(x.seconds[1])} · score ${x.score.toFixed(2)} · ${x.db} dB · harmony ${x.harmony}${x.downbeat ? " · on the downbeat" : ""} · crossfade ${x.crossfade}`,
      );
    }
  }
}

/** audio/beats.json of a video, or null. */
export function readBeats(videoId: string): Beats | null {
  const file = join(root(), "videos", videoId, "audio", "beats.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Beats) : null;
}

/**
 * Frame of every beat in the video, with its bar and beat in the bar (1-based):
 * from audio/beats.json when there is one (the track's real grid, after any
 * `audio.edit`), else from the video's bpm. Null when the video has neither.
 */
export function beatFrames(info: Info, videoId: string): { frame: number; bar: number; beat: number }[] | null {
  const found = readBeats(videoId);
  const offset = info.audio?.offset ?? 0;
  if (found) {
    const detected = editBeats(found, info.audio?.edit);
    const first = detected.downbeats[0] ?? detected.beats[0];
    const phase = Math.max(
      0,
      detected.beats.findIndex((b) => Math.abs(b - first) < 1e-3),
    );
    return detected.beats.map((t, i) => {
      const n = i - phase;
      return { frame: Math.round((t - offset) * info.fps), bar: Math.floor(n / 4) + 1, beat: (((n % 4) + 4) % 4) + 1 };
    });
  }
  if (!info.bpm) return null;
  const per = (60 / info.bpm) * info.fps;
  return Array.from({ length: Math.ceil(info.durationInFrames / per) }, (_, n) => ({
    frame: Math.round(n * per),
    bar: Math.floor(n / 4) + 1,
    beat: (n % 4) + 1,
  }));
}
