import { spawnSync } from "node:child_process";
import type { LoudnessPreset, VideoConfig } from "../engine/video.js";

export type LoudnessTarget = {
  /** Integrated loudness, LUFS. */
  lufs: number;
  /** Allowed deviation from it, LU. */
  tolerance: number;
  /** True-peak ceiling, dBTP. */
  peak: number;
  /** Ceiling for the maximum short-term (3 s) loudness, LUFS, where the delivery spec sets one. */
  shortTerm?: number;
};

/**
 * Delivery specs by name, for `audio.loudness`. `web` is core's default.
 * Integrated loudness is gated (EBU R128 / ITU-R BS.1770); short-term is the
 * loudest 3 s window.
 */
export const LOUDNESS_PRESETS: Record<LoudnessPreset, LoudnessTarget> = {
  /** YouTube, Spotify, social feeds: what players normalise to. */
  web: { lufs: -14, tolerance: 1, peak: -1 },
  /** Podcast apps (Apple's spec; AES TD1004 for spoken word). */
  podcast: { lufs: -16, tolerance: 1, peak: -1 },
  /** EBU R128 broadcast: programmes. */
  broadcast: { lufs: -23, tolerance: 0.5, peak: -1 },
  /** EBU R128 s1, short-form content (spots, promos, idents, stings): R128 plus a maximum short-term loudness of +5 LU. */
  sting: { lufs: -23, tolerance: 0.5, peak: -1, shortTerm: -18 },
  /** ATSC A/85, US broadcast. */
  atsc: { lufs: -24, tolerance: 2, peak: -2 },
};

type Own = NonNullable<VideoConfig["audio"]>["loudness"];

/** What a video's audio is held to: the project's rules, a named preset, or its own numbers. Null when "as-delivered". */
export function loudnessTarget(project: LoudnessTarget, own: Own): LoudnessTarget | null {
  if (own === "as-delivered") return null;
  if (typeof own === "string") {
    const preset = LOUDNESS_PRESETS[own];
    if (!preset)
      throw new Error(
        `audio.loudness: no preset "${own}" (${Object.keys(LOUDNESS_PRESETS).join(", ")}, or "as-delivered")`,
      );
    return { ...preset };
  }
  return { ...project, ...own };
}

/** The name of a video's loudness target, for reports. */
export const loudnessName = (own: Own) =>
  own === undefined ? "project" : typeof own === "string" ? own : "the video's own";

export type Measured = {
  /** Integrated loudness, LUFS. */
  lufs: number;
  /** True peak, dBTP. */
  peak: number;
  /** Loudest short-term (3 s) loudness, LUFS. */
  shortTerm: number;
  /** Loudness range, LU. */
  range: number;
};

/**
 * Loudness of a file (or raw input, `args` before `-i -` with `input`), from
 * ffmpeg's ebur128 filter: integrated, true peak, the short-term maximum and
 * the range. `from`, `duration` and `volume` measure a stretch of it at a level.
 */
export function measureLoudness(
  source: { file: string; from?: number; duration?: number; volume?: number } | { args: string[]; input: Buffer },
): Measured {
  const input =
    "file" in source
      ? [
          ...(source.from ? ["-ss", String(Math.max(0, source.from))] : []),
          ...(source.duration ? ["-t", String(source.duration)] : []),
          "-i",
          source.file,
        ]
      : source.args;
  const volume =
    "file" in source && source.volume !== undefined && source.volume !== 1 ? `volume=${source.volume},` : "";
  const run = spawnSync(
    "ffmpeg",
    // Padded to 3 s of silence, so a clip shorter than the short-term window still gets one
    // (the gate ignores silence, so integrated loudness does not change).
    ["-hide_banner", "-nostats", ...input, "-af", `${volume}apad=whole_dur=3,ebur128=peak=true`, "-f", "null", "-"],
    { input: "input" in source ? source.input : undefined, maxBuffer: 1 << 30 },
  );
  const log = run.stderr.toString();
  const summary = log.slice(log.lastIndexOf("Summary:"));
  const num = (m: RegExpMatchArray | null) => (m ? (m[1] === "-inf" ? -Infinity : Number(m[1])) : Number.NaN);
  let shortTerm = -Infinity;
  for (const m of log.matchAll(/ S:\s*(-?[\d.]+|-inf)/g)) shortTerm = Math.max(shortTerm, num(m));
  return {
    lufs: num(summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/)),
    peak: num(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/)),
    shortTerm: Math.round(shortTerm * 10) / 10,
    range: num(summary.match(/LRA:\s+(-?[\d.]+) LU/)),
  };
}

/** "-14.0 LUFS, short-term max -11.2, -1.1 dBTP". */
export const loudnessLine = (m: Measured) => `${m.lufs} LUFS, short-term max ${m.shortTerm}, ${m.peak} dBTP`;
