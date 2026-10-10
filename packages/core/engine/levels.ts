/**
 * What `intentface-launch levels` writes beside an audio file
 * (`<file>.levels.json`): envelopes at `rate` values per second, each 0 to 1
 * against the track's own loud level (rising in 40 ms, falling in 200 ms).
 */
export type Levels = {
  file: string;
  duration: number;
  rate: number;
  /** Loudness. */
  rms: number[];
  /** 20 to 60 Hz: sub bass, a boom's body (files written before it was added have none). */
  sub?: number[];
  /** 60 to 250 Hz: weight, pressure. */
  low: number[];
  /** 250 to 2000 Hz: the body of a voice or a melody. */
  mid: number[];
  /** 2 to 8 kHz: consonants, hats, air. */
  high: number[];
  /** Seconds where something starts: a syllable, a hit. */
  onsets: number[];
  /** [start, end] seconds of sound between silences of 180 ms or more: a voice's phrases. */
  phrases: [number, number][];
};

export type Band = "rms" | "sub" | "low" | "mid" | "high";

/**
 * Read a levels file in a scene, by time in seconds (fractional frames welcome).
 * Import the JSON statically so no frame waits for it:
 *
 *   import data from "./audio/voice.levels.json";
 *   const voice = audioLevels(data);
 *   const r = voice.at(frame / fps, "rms");
 */
export function audioLevels(data: Levels) {
  const { rate } = data;
  const sums = new Map<Band, Float64Array>();
  const values = (band: Band) => data[band] ?? [];
  const value = (band: Band, i: number) => values(band)[Math.min(values(band).length - 1, Math.max(0, i))] ?? 0;

  /** The envelope at `t`, interpolated between analysis frames. */
  const at = (t: number, band: Band = "rms") => {
    const x = t * rate;
    const i = Math.floor(x);
    return value(band, i) + (value(band, i + 1) - value(band, i)) * (x - i);
  };

  /** Running integral (value-seconds) of a band, built once. */
  const integral = (band: Band) => {
    let sum = sums.get(band);
    if (!sum) {
      const list = values(band);
      sum = new Float64Array(list.length + 1);
      for (let i = 0; i < list.length; i++) sum[i + 1] = sum[i] + list[i] / rate;
      sums.set(band, sum);
    }
    return sum;
  };
  const area = (t: number, band: Band) => {
    const sum = integral(band);
    if (sum.length < 2) return 0;
    const x = Math.min(Math.max(t * rate, 0), sum.length - 1);
    const i = Math.min(Math.floor(x), sum.length - 2);
    return sum[i] + (sum[i + 1] - sum[i]) * (x - i);
  };

  return {
    data,
    at,
    /** The mean over `window` seconds centred on `t`: slow pressure instead of syllables. */
    smooth: (t: number, window: number, band: Band = "rms") =>
      window <= 0 ? at(t, band) : (area(t + window / 2, band) - area(t - window / 2, band)) / window,
    /**
     * The integral of `band` from 0 to `t`, in value-seconds. Use it as a phase
     * that runs faster while the sound is loud: noise drifting with a voice.
     */
    accumulate: (t: number, band: Band = "rms") => area(t, band),
    /** A pulse from the onsets before `t`: 1 on an onset, decaying over `decay` seconds, summed and capped at 1. */
    pulse: (t: number, decay = 0.08) => {
      let p = 0;
      for (const o of data.onsets) {
        if (o > t) break;
        if (t - o < decay * 6) p += Math.exp(-(t - o) / decay);
      }
      return Math.min(1, p);
    },
    /** The phrase sounding at `t`, or null in a silence. */
    phraseAt: (t: number) => data.phrases.find(([s, e]) => t >= s && t < e) ?? null,
  };
}
