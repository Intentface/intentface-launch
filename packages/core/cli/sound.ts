import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import sharp from "sharp";
import { type Info, launchBrowser, openRenderer, startServer } from "./browser.js";
import { decode, fft } from "./levels.js";
import { type Measured, measureLoudness } from "./loudness.js";
import { mixAudio } from "./mix.js";
import { assetPath, outDir, root } from "./util.js";

const RATE = 48000;
/** Envelopes and detection run on a 1 ms grid. */
const MS = RATE / 1000;

/** Bands of the report, in Hz. A boom lives in sub and low, a riser climbs into high and air. */
export const SOUND_BANDS = {
  sub: [0, 60],
  low: [60, 250],
  mid: [250, 2000],
  high: [2000, 8000],
  air: [8000, 0],
} as const;
export type SoundBand = keyof typeof SOUND_BANDS;
const BAND_NAMES = Object.keys(SOUND_BANDS) as SoundBand[];
/** RMS window per band: long enough for a cycle of its lowest note, short enough for a transient. */
const WINDOW: Record<SoundBand, number> = { sub: 30, low: 15, mid: 8, high: 5, air: 5 };

export type SoundEvent = {
  /**
   * start/end: first and last sound. impact: a hit across bands. boom: a
   * sustained rise in sub and low. cut: a sustained band drops away at once
   * (a riser cut off). riser: rising brightness or high-band level. sweep:
   * brightness moving without the level. swell: level rising. pulse: hits at a
   * steady rate. tail: the decay after the last hit. gap: silence inside.
   */
  kind: "start" | "end" | "impact" | "boom" | "cut" | "riser" | "sweep" | "swell" | "pulse" | "tail" | "gap";
  /** Seconds into the audio analysed. */
  at: number;
  /** Video frame (fractional, to the half frame). */
  frame: number;
  /** For stretches: where it ends. */
  end?: number;
  endFrame?: number;
  /** Bands it happens in, strongest first. */
  bands?: SoundBand[];
  /** dB it rises (or falls) by. */
  change?: number;
  /** Seconds of its loudest moment (a boom's peak). */
  peak?: number;
  /** The note of a boom or impact, from its strongest partial below 250 Hz: "F1 43.6 Hz". */
  pitch?: string;
  /** One line in words. */
  detail: string;
};

export type SoundReport = {
  file: string;
  duration: number;
  fps: number;
  /** Seconds into the file at frame 0. */
  offset: number;
  loudness: Measured;
  /** Estimated key, and how well the pitch content fits it (0 to 1). */
  key: { name: string; confidence: number };
  /** Values per second of `bands` and `centroid`. */
  rate: number;
  /** Band levels in dB (0 dBFS full scale), `rate` per second. */
  bands: Record<SoundBand, number[]>;
  /** Spectral centroid in Hz (brightness), `rate` per second; 0 where silent. */
  centroid: number[];
  /** Seconds where each band starts a sound. */
  onsets: Record<SoundBand, number[]>;
  events: SoundEvent[];
};

// ----------------------------------------------------------------------------
// Signal helpers

function biquad(input: Float64Array, type: "lp" | "hp", f: number, q: number) {
  const w = (2 * Math.PI * f) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const [b0, b1, b2] = type === "lp" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const [a0, a1, a2] = [1 + alpha, -2 * c, 1 - alpha];
  const out = new Float64Array(input.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    out[i] = y;
  }
  return out;
}

/** Fourth-order Butterworth, as two biquads. */
const butter = (s: Float64Array, type: "lp" | "hp", f: number) => biquad(biquad(s, type, f, 0.5412), type, f, 1.3066);

/** RMS level in dB on the 1 ms grid, over `window` ms centred on each point. */
function envelope(s: Float64Array, window: number) {
  const sum = new Float64Array(s.length + 1);
  for (let i = 0; i < s.length; i++) sum[i + 1] = sum[i] + s[i] * s[i];
  const n = Math.ceil(s.length / MS);
  const out = new Float64Array(n);
  const half = Math.round((window * MS) / 2);
  for (let k = 0; k < n; k++) {
    const c = k * MS;
    const a = Math.max(0, c - half);
    const b = Math.min(s.length, c + half);
    out[k] = 10 * Math.log10((sum[b] - sum[a]) / Math.max(1, b - a) + 1e-12);
  }
  return out;
}

function smooth(v: ArrayLike<number>, width: number) {
  const half = Math.max(0, Math.floor(width / 2));
  const out = new Float64Array(v.length);
  let acc = 0;
  let count = 0;
  for (let i = -half; i < v.length; i++) {
    const add = i + half;
    if (add < v.length) {
      acc += v[add];
      count++;
    }
    const drop = i - half - 1;
    if (drop >= 0) {
      acc -= v[drop];
      count--;
    }
    if (i >= 0) out[i] = acc / count;
  }
  return out;
}

function median(v: ArrayLike<number>, width: number) {
  const half = Math.floor(width / 2);
  return Float64Array.from({ length: v.length }, (_, i) => {
    const part = Array.from({ length: 2 * half + 1 }, (_, k) => v[Math.min(v.length - 1, Math.max(0, i - half + k))]);
    return part.sort((a, b) => a - b)[half];
  });
}

const percentile = (v: ArrayLike<number>, p: number) => {
  const sorted = Array.from(v).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : Number.NaN;
};
const mean = (v: ArrayLike<number>, a: number, b: number) => {
  let s = 0;
  let n = 0;
  for (let i = Math.max(0, a); i < Math.min(v.length, b); i++) {
    s += v[i];
    n++;
  }
  return n ? s / n : Number.NaN;
};
const maxOf = (v: ArrayLike<number>, a: number, b: number) => {
  let m = Number.NEGATIVE_INFINITY;
  for (let i = Math.max(0, a); i < Math.min(v.length, b); i++) m = Math.max(m, v[i]);
  return m;
};
const minOf = (v: ArrayLike<number>, a: number, b: number) => {
  let m = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, a); i < Math.min(v.length, b); i++) m = Math.min(m, v[i]);
  return m;
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const note = (hz: number) => {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
};

/** Hann-windowed power spectrum of `n` samples from `start`. */
function spectrum(x: Float32Array, start: number, n: number, hann: Float64Array) {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (x[start + i] ?? 0) * hann[i];
  fft(re, im);
  const power = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) power[k] = re[k] * re[k] + im[k] * im[k];
  return power;
}

const hannOf = (n: number) => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));

/** The strongest partial below 250 Hz after `t`: the note of a boom or a hit. */
function pitchAt(x: Float32Array, t: number) {
  const n = 16384;
  const power = spectrum(x, Math.round((t + 0.01) * RATE), n, hannOf(n));
  const bin = RATE / n;
  let best = 0;
  for (let k = Math.ceil(25 / bin); k <= 250 / bin; k++) if (power[k] > power[best]) best = k;
  if (!best) return undefined;
  const [a, b, c] = [power[best - 1], power[best], power[best + 1]].map((p) => Math.log(p + 1e-20));
  const hz = (best + (0.5 * (a - c)) / (a - 2 * b + c || 1)) * bin;
  return `${note(hz)} ${hz.toFixed(1)} Hz`;
}

// Krumhansl-Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function keyOf(chroma: number[]) {
  const corr = (a: number[], b: number[]) => {
    const ma = a.reduce((s, v) => s + v, 0) / 12;
    const mb = b.reduce((s, v) => s + v, 0) / 12;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < 12; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    return num / Math.sqrt(da * db || 1);
  };
  let best = { name: "unknown", confidence: 0 };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [profile, mode] of [
      [MAJOR, "major"],
      [MINOR, "minor"],
    ] as const) {
      const rotated = Array.from({ length: 12 }, (_, i) => profile[(i - tonic + 12) % 12]);
      const c = corr(chroma, rotated);
      if (c > best.confidence) best = { name: `${NOTES[tonic]} ${mode}`, confidence: Math.round(c * 100) / 100 };
    }
  }
  return best;
}

/** Runs where `slope` stays above `min`, bridging dips shorter than `gap` points. */
function runs(slope: ArrayLike<number>, min: number, gap: number) {
  const out: [number, number][] = [];
  let start = -1;
  let last = -1;
  for (let i = 0; i <= slope.length; i++) {
    const on = i < slope.length && slope[i] > min;
    if (on) {
      if (start < 0 || i - last > gap) {
        if (start >= 0) out.push([start, last]);
        start = i;
      }
      last = i;
    }
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

// ----------------------------------------------------------------------------
// Analysis

type Spectral = { rate: number; hop: number; frames: Float64Array[]; centroid: Float64Array; level: Float64Array };

const SPEC_N = 4096;

function stft(x: Float32Array, hop: number): Spectral {
  const hann = hannOf(SPEC_N);
  const count = Math.ceil(x.length / hop);
  const frames: Float64Array[] = [];
  const centroid = new Float64Array(count);
  const level = new Float64Array(count);
  const bin = RATE / SPEC_N;
  for (let f = 0; f < count; f++) {
    const power = spectrum(x, f * hop - SPEC_N / 2, SPEC_N, hann);
    frames.push(power);
    let num = 0;
    let den = 0;
    let energy = 0;
    // Weighted by magnitude, as librosa does: power would let the bass decide alone.
    for (let k = Math.ceil(30 / bin); k < 16000 / bin; k++) {
      const m = Math.sqrt(power[k]);
      num += k * bin * m;
      den += m;
      energy += power[k];
    }
    centroid[f] = den > 0 ? num / den : 0;
    level[f] = 10 * Math.log10(energy / (SPEC_N * SPEC_N) + 1e-12);
  }
  return { rate: RATE / hop, hop, frames, centroid, level };
}

type Change = { band: SoundBand; at: number; change: number; level: number };

export function analyseSound(
  x: Float32Array,
  { fps = 60, offset = 0, file = "", loudness }: { fps?: number; offset?: number; file?: string; loudness: Measured },
): SoundReport & { spectral: Spectral } {
  const duration = x.length / RATE;
  const frameOf = (t: number) => Math.round((t - offset) * fps * 2) / 2;
  const signal = Float64Array.from(x);

  // 1. Band envelopes on the 1 ms grid.
  const env = {} as Record<SoundBand, Float64Array>;
  for (const band of BAND_NAMES) {
    const [lo, hi] = SOUND_BANDS[band];
    let s = signal;
    if (lo) s = butter(s, "hp", lo);
    if (hi) s = butter(s, "lp", hi);
    env[band] = smooth(envelope(s, WINDOW[band]), 5);
  }
  const all = smooth(envelope(signal, 10), 5);
  const n = all.length;
  const loud = percentile(
    all.filter((v) => v > -100),
    0.98,
  );
  const silence = Math.max(loud - 50, -90);
  const sounding = (i: number) => all[i] > silence;
  const ref = Object.fromEntries(
    BAND_NAMES.map((b) => [
      b,
      percentile(
        env[b].filter((_, i) => sounding(i)),
        0.98,
      ),
    ]),
  ) as Record<SoundBand, number>;

  // 2. Onsets per band: a sharp rise to an audible level.
  const onsets = {} as Record<SoundBand, number[]>;
  const strength = new Map<string, number>();
  for (const band of BAND_NAMES) {
    const e = env[band];
    const list: number[] = [];
    for (let t = 30; t < n - 60; t++) {
      const d = e[t + 8] - e[t - 8];
      if (d < 7) continue;
      if (e[t + 9] - e[t - 7] > d || e[t + 7] - e[t - 9] > d) continue;
      const post = maxOf(e, t, t + 60);
      const pre = minOf(e, t - 30, t);
      if (post < Math.max(ref[band] - 24, loud - 45)) continue;
      // 3 dB up, moved later by half the RMS window, which hears the sound that early.
      let i = t;
      while (i > t - 30 && e[i - 1] >= pre + 3) i--;
      const at = i + Math.round(WINDOW[band] / 2);
      if (list.length && at - list[list.length - 1] * 1000 < 50) {
        const prev = `${band}:${list[list.length - 1]}`;
        if ((strength.get(prev) ?? 0) >= post - pre) continue;
        list.pop();
      }
      list.push(at / 1000);
      strength.set(`${band}:${at / 1000}`, post - pre);
    }
    onsets[band] = list.map(r3);
  }

  // 3. Sustained steps per band: the level 20 to 150 ms after against 20 to 150 ms before.
  const rises: Change[] = [];
  const drops: Change[] = [];
  for (const band of BAND_NAMES) {
    const e = env[band];
    const step = new Float64Array(n);
    for (let t = 150; t < n - 150; t++) step[t] = mean(e, t + 20, t + 150) - mean(e, t - 150, t - 20);
    for (let t = 150; t < n - 150; t++) {
      const s = step[t];
      const peak = s >= 8 && s === maxOf(step, t - 60, t + 61);
      const trough = s <= -12 && s === minOf(step, t - 60, t + 61);
      if (!peak && !trough) continue;
      const before = mean(e, t - 150, t - 20);
      const after = mean(e, t + 20, t + 150);
      if (peak && after < Math.max(ref[band] - 18, loud - 40)) continue;
      if (trough && before < Math.max(ref[band] - 24, loud - 40)) continue;
      // Where it is heard: 3 dB into a rise, 6 dB into a drop.
      let at = t;
      // (The RMS window is centred, so it hears a change early: half a window for a rise, a quarter for a drop.)
      if (peak) {
        // Back from the middle of the step to where it was last within 3 dB of before.
        let i = t + 60;
        while (i > t - 120 && e[i - 1] >= before + 3) i--;
        at = i + Math.round(WINDOW[band] / 2);
      } else {
        // A cut drops a band that had been sounding for a while, not the decay of something that just began.
        if (mean(e, t - 400, t - 150) < before - 6) continue;
        let i = t + 60;
        while (i > t - 120 && e[i - 1] <= before - 6) i--;
        at = i + Math.round(WINDOW[band] / 4);
      }
      (peak ? rises : drops).push({ band, at: at / 1000, change: r1(s), level: r1(peak ? after : before) });
    }
  }

  // 4. Spectral frames: centroid, chroma, and the picture.
  const hop = Math.min(960, Math.max(120, Math.round(x.length / 1100)));
  const spectral = stft(x, hop);
  const sr = spectral.rate;
  const gate = (f: number) => spectral.level[f] > silence + 10;
  // Pitch classes from long windows (16384 samples, 2.9 Hz bins) every 50 ms, so notes down
  // to 65 Hz land in their own semitone; each sounding frame counts once, however loud.
  const chroma = new Array(12).fill(0);
  const LONG = 16384;
  const longHann = hannOf(LONG);
  const longBin = RATE / LONG;
  const pitchClass = Array.from({ length: LONG / 2 }, (_, k) =>
    k * longBin < 65 || k * longBin > 2100
      ? -1
      : ((Math.round(69 + 12 * Math.log2((k * longBin) / 440)) % 12) + 12) % 12,
  );
  for (let c = 0; c + LONG / 2 < x.length; c += RATE / 20) {
    if (all[Math.round(c / MS)] <= silence + 10) continue;
    const power = spectrum(x, c - LONG / 2, LONG, longHann);
    const frame = new Array(12).fill(0);
    for (let k = 0; k < power.length; k++) if (pitchClass[k] >= 0) frame[pitchClass[k]] += Math.sqrt(power[k]);
    const top = Math.max(...frame) || 1;
    for (let i = 0; i < 12; i++) chroma[i] += frame[i] / top;
  }
  const key = keyOf(chroma);

  // 5. Events.
  const events: SoundEvent[] = [];
  const bass = (b: SoundBand) => b === "sub" || b === "low";
  const near = (list: Change[], t: number, within: number) => list.filter((c) => Math.abs(c.at - t) <= within);
  const anyOnsets = (t: number, within: number) =>
    BAND_NAMES.filter((b) => onsets[b].some((o) => Math.abs(o - t) <= within));

  // Booms and impacts, from bass rises and from onsets that stand out.
  const used = new Set<Change>();
  /** Booms and impacts found from a bass step: never taken for a pulse's hits. */
  const stepped = new Set<number>();
  for (const r of [...rises].filter((c) => bass(c.band)).sort((a, b) => b.change - a.change)) {
    if (used.has(r)) continue;
    const together = near(rises, r.at, 0.06);
    for (const c of together) used.add(c);
    const stepAt = Math.min(...together.filter((c) => bass(c.band)).map((c) => c.at));
    // A sharp onset times it better than a step, whose windows are long; sub's own window is the longest.
    const sharpAt = BAND_NAMES.filter((b) => b !== "sub").flatMap((b) =>
      onsets[b].filter((o) => Math.abs(o - stepAt) <= 0.03),
    );
    const at = sharpAt.length ? Math.min(...sharpAt) : stepAt;
    if (events.some((e) => (e.kind === "boom" || e.kind === "impact") && Math.abs(e.at - at) < 0.1)) continue;
    const sharp = anyOnsets(at, 0.03).filter((b) => !bass(b));
    const bands = [
      ...new Set([...together.sort((a, b) => b.change - a.change).map((c) => c.band), ...anyOnsets(at, 0.03)]),
    ];
    // Its loudest moment: the bass level's peak within half a second.
    const i0 = Math.round(at * 1000);
    let peakAt = i0;
    const bassLevel = (i: number) => Math.max(env.sub[i], env.low[i]);
    for (let i = i0; i < Math.min(n, i0 + 500); i++) if (bassLevel(i) > bassLevel(peakAt)) peakAt = i;
    const cut = near(drops, at, 0.06).filter((c) => !bass(c.band));
    // A hit is loud: a soft tone fading in from silence rises as far, but stays well under the track.
    if (maxOf(all, i0, i0 + 120) < loud - 12) continue;
    // A boom is the bass's: when the mids rise as much and nothing is sharp, it is a whoosh or a swell.
    const bassDominant =
      maxOf(env.sub, i0, i0 + 150) >= maxOf(env.mid, i0, i0 + 150) ||
      maxOf(env.low, i0, i0 + 150) >= maxOf(env.mid, i0, i0 + 150);
    if (!sharp.length && !cut.length && !bassDominant) continue;
    const kind = cut.length || !sharp.length ? "boom" : "impact";
    stepped.add(r3(at));
    events.push({
      kind,
      at: r3(at),
      frame: frameOf(at),
      bands,
      change: Math.max(...together.map((c) => c.change)),
      peak: r3(peakAt / 1000),
      pitch: pitchAt(x, at),
      detail: `${bands.join(", ")} +${Math.max(...together.map((c) => c.change)).toFixed(0)} dB, peaks ${(peakAt / 1000).toFixed(2)} s`,
    });
  }
  // Hits across several bands that rise clear of what was sounding.
  const allOnsets = [...new Set(BAND_NAMES.flatMap((b) => onsets[b]))].sort((a, b) => a - b);
  for (const t of allOnsets) {
    if (events.some((e) => Math.abs(e.at - t) < 0.1)) continue;
    const bands = anyOnsets(t, 0.025);
    const i = Math.round(t * 1000);
    const rise = maxOf(all, i, i + 50) - minOf(all, i - 40, i);
    if (bands.length < 2 || rise < 10 || maxOf(all, i, i + 50) < loud - 8) continue;
    events.push({
      kind: "impact",
      at: r3(t),
      frame: frameOf(t),
      bands,
      change: r1(rise),
      pitch: pitchAt(x, t),
      detail: `${bands.join(", ")} +${rise.toFixed(0)} dB`,
    });
  }
  // Cuts: sustained bands that drop away at once.
  const cutUsed = new Set<Change>();
  for (const d of [...drops].sort((a, b) => a.change - b.change)) {
    if (cutUsed.has(d)) continue;
    const together = near(drops, d.at, 0.06);
    for (const c of together) cutUsed.add(c);
    const at = Math.min(...together.map((c) => c.at));
    if (events.some((e) => e.kind === "cut" && Math.abs(e.at - at) < 0.1)) continue;
    const bands = together.sort((a, b) => a.change - b.change).map((c) => c.band);
    const into = events.find((e) => e.kind === "boom" && Math.abs(e.at - at) <= 0.06);
    events.push({
      kind: "cut",
      at: r3(at),
      frame: frameOf(at),
      bands,
      change: Math.min(...together.map((c) => c.change)),
      detail: `${bands.join(", ")} ${Math.min(...together.map((c) => c.change)).toFixed(0)} dB${into ? ", into the boom" : ""}`,
    });
  }

  // Pulses: a band whose rises repeat at a steady period. Each second (in
  // quarter-second steps) the autocorrelation of each band's onset strength
  // picks a period from 60 to 600 ms; neighbouring seconds that agree on it
  // make one pulse. Softer than onsets: a bed that throbs counts.
  const STEP = 5;
  const points = Math.floor(n / STEP);
  const strengthOf = (e: Float64Array) =>
    Float64Array.from({ length: points }, (_, k) => {
      let m = 0;
      for (let i = k * STEP; i < (k + 1) * STEP; i++) m = Math.max(m, (e[i + 5] ?? 0) - (e[i - 5] ?? 0));
      return m;
    });
  const pulseBands: SoundBand[] = ["low", "mid", "high", "air"];
  const strengths = Object.fromEntries(pulseBands.map((b) => [b, strengthOf(env[b])])) as Record<string, Float64Array>;
  // All bands together, like spectral flux: a pulse can move between bands as a riser masks one.
  const together = Float64Array.from({ length: points }, (_, k) =>
    pulseBands.reduce((sum, b) => sum + strengths[b][k], 0),
  );
  const span = 1000 / STEP;
  type Candidate = { period: number; r: number; band: SoundBand | "all" };
  const windows: { at: number; candidates: Candidate[] }[] = [];
  for (let w0 = 0; w0 + span <= points; w0 += 250 / STEP) {
    if (mean(all, w0 * STEP, (w0 + span) * STEP) < loud - 30) continue;
    const candidates: Candidate[] = [];
    for (const band of [...pulseBands, "all" as const]) {
      const v = (band === "all" ? together : strengths[band]).subarray(w0, w0 + span);
      const m = mean(v, 0, v.length);
      let var0 = 0;
      for (const x of v) var0 += (x - m) ** 2;
      if (var0 < 1e-6 || (band !== "all" && mean(env[band], w0 * STEP, (w0 + span) * STEP) < ref[band] - 30)) continue;
      const r = (lag: number) => {
        let c = 0;
        for (let i = 0; i + lag < v.length; i++) c += (v[i] - m) * (v[i + lag] - m);
        return (c / var0) * (v.length / (v.length - lag));
      };
      const lags = Array.from({ length: 120 - 12 + 1 }, (_, i) => 12 + i);
      const rs = lags.map(r);
      const top = Math.max(...rs);
      // Every peak is a candidate (a later second may only share one of them); the shortest period
      // that is nearly as strong as the best leads, since its multiples correlate too.
      rs.forEach((x, i) => {
        if (x >= 0.4 && x >= (rs[i - 1] ?? -1) && x >= (rs[i + 1] ?? -1))
          candidates.push({ period: lags[i] * STEP, r: x >= top * 0.85 ? 2 - i / rs.length : x, band });
      });
    }
    if (candidates.length) windows.push({ at: w0 * STEP, candidates: candidates.sort((a, b) => b.r - a.r) });
  }
  // Chain neighbouring seconds that share a period (in any band), from the strongest start.
  for (let i = 0; i < windows.length; ) {
    const period0 = windows[i].candidates[0].period;
    const run: Candidate[] = [windows[i].candidates[0]];
    let j = i;
    // A second or two where a riser masks the pulse is bridged when it comes back.
    for (;;) {
      const k = [j + 1, j + 2, j + 3].find(
        (k) =>
          k < windows.length &&
          windows[k].at - windows[j].at <= 750 &&
          windows[k].candidates.some((c) => Math.abs(c.period - period0) <= period0 * 0.1),
      );
      if (k === undefined) break;
      const match = windows[k].candidates.find((c) => Math.abs(c.period - period0) <= period0 * 0.1);
      if (match) run.push(match);
      j = k;
    }
    if (j > i) {
      const period = run.reduce((sum, x) => sum + x.period, 0) / run.length / 1000;
      const band = [...run].sort((a, b) => b.r - a.r)[0].band;
      // Trim to the first and last strong rise inside the run.
      const v = together;
      const [a0, b0] = [windows[i].at / STEP, (windows[j].at + 1000) / STEP];
      // (Against its typical rise, not its biggest: a hit inside the run would hide the rest.)
      const strong = percentile(v.subarray(a0, b0), 0.9) * 0.5;
      let a = a0;
      while (a < b0 && v[a] < strong) a++;
      let b = Math.min(b0, v.length - 1);
      while (b > a && v[b] < strong) b--;
      const t0 = (a * STEP) / 1000;
      // A cut or a boom ends it.
      const stop = events.find((e) => (e.kind === "cut" || e.kind === "boom") && e.at > t0 + period);
      const t1 = Math.min((b * STEP) / 1000, stop?.at ?? Number.POSITIVE_INFINITY);
      if (t1 - t0 >= period * 3)
        events.push({
          kind: "pulse",
          at: r3(t0),
          frame: frameOf(t0),
          end: r3(t1),
          endFrame: frameOf(t1),
          bands: band === "all" ? undefined : [band],
          detail: `every ${period.toFixed(3)} s (${(60 / period).toFixed(1)} a minute, ${(period * fps).toFixed(1)} frames)${band === "all" ? "" : `, strongest in ${band}`}`,
        });
    }
    i = j + 1;
  }
  // Inside a pulse, impacts are its hits: keep the first.
  for (const p of events.filter((e) => e.kind === "pulse")) {
    for (let k = events.length - 1; k >= 0; k--) {
      const e = events[k];
      if (e.kind === "impact" && !stepped.has(e.at) && e.at > p.at + 0.02 && e.at <= (p.end ?? 0) + 0.02)
        events.splice(k, 1);
    }
  }

  // Risers and sweeps: brightness (centroid) and the top bands climbing; swells: the level climbing.
  const w = Math.max(1, Math.round(0.15 * sr));
  // Brightness in octaves, held through silence, smoothed over 0.3 s so a pulsing bed does not break a climb.
  let held = Math.log2(spectral.centroid.find((c, f) => gate(f) && c > 0) || 1000);
  const logC = smooth(
    median(
      Float64Array.from(spectral.centroid, (c, f) => {
        if (gate(f) && c > 0) held = Math.log2(c);
        return held;
      }),
      9,
    ),
    2 * w,
  );
  const atRate = (v: Float64Array) =>
    Float64Array.from(
      { length: spectral.level.length },
      (_, f) => v[Math.min(v.length - 1, Math.round((f / sr) * 1000))],
    );
  const highs = smooth(atRate(env.high), w);
  const airs = smooth(atRate(env.air), w);
  // The top of the spectrum: whichever of high and air climbs more over a stretch.
  const topLift = (a: number, b: number) => Math.max(highs[b] - highs[a], airs[b] - airs[a]);
  const level = smooth(atRate(all), w);
  const slopeOf = (v: Float64Array) =>
    Float64Array.from(v, (_, f) => (v[Math.min(v.length - 1, f + w)] - v[Math.max(0, f - w)]) / ((2 * w) / sr));
  const ranges: SoundEvent[] = [];
  const climb = (v: Float64Array, min: number, need: number, minLength: number) =>
    runs(slopeOf(v), min, Math.round(0.15 * sr))
      .map(([a, b]) => [Math.max(0, a - w), Math.min(v.length - 1, b + w)] as [number, number])
      .map(([a, b]) => {
        // Trim to where the climb starts and stops.
        let lo = a;
        let hi = b;
        const total = v[b] - v[a];
        while (lo < hi && v[lo + 1] - v[a] < total * 0.05) lo++;
        while (hi > lo && v[b] - v[hi - 1] < Math.abs(total) * 0.05) hi--;
        return [lo, hi] as [number, number];
      })
      .filter(([a, b]) => (b - a) / sr >= minLength && Math.abs(v[b] - v[a]) >= need);
  const brighter = climb(logC, 0.35, 0.6, 0.4);
  const toTop = [...climb(highs, 8, 12, 0.4), ...climb(airs, 8, 12, 0.4)];
  for (const [a, b] of [...brighter, ...toTop].sort((p, q) => p[0] - q[0])) {
    const t0 = a / sr;
    const t1 = b / sr;
    // Climbs that overlap or nearly touch are one riser.
    const joins = (r: SoundEvent) => t0 < (r.end ?? 0) + 0.3 && t1 > r.at - 0.3;
    if (ranges.some(joins)) {
      const r = ranges.find(joins);
      if (r) {
        r.at = r3(Math.min(r.at, t0));
        r.end = r3(Math.max(r.end ?? 0, t1));
      }
      continue;
    }
    ranges.push({ kind: "riser", at: r3(t0), frame: 0, end: r3(t1), detail: "" });
  }
  for (const r of ranges) {
    // A riser that is cut off ends at the cut.
    const cutOff = events.find((e) => e.kind === "cut" && e.at > r.at && Math.abs(e.at - (r.end ?? r.at)) < 0.3);
    if (cutOff) r.end = cutOff.at;
    const [a, b] = [Math.round(r.at * sr), Math.min(logC.length - 1, Math.round((r.end ?? r.at) * sr))];
    const c0 = 2 ** logC[a];
    const c1 = 2 ** logC[Math.max(a, b - 1)];
    const lift = level[Math.max(a, b - 1)] - level[a];
    const lifted = topLift(a, Math.max(a, b - 1));
    r.kind = lift >= 3 || lifted >= 12 ? "riser" : "sweep";
    r.frame = frameOf(r.at);
    r.endFrame = frameOf(r.end ?? r.at);
    r.change = r1(lift);
    r.detail = `centroid ${Math.round(c0)} → ${Math.round(c1)} Hz, level ${lift >= 0 ? "+" : ""}${lift.toFixed(0)} dB, high or air ${lifted >= 0 ? "+" : ""}${lifted.toFixed(0)} dB`;
    // Brightness moving while the sound dies away is a decay, not a sweep.
    if (r.kind === "sweep" && lift < -6) continue;
    events.push(r);
  }
  for (const [a, b] of climb(level, 6, 8, 0.5)) {
    const [t0, t1] = [a / sr, b / sr];
    if (events.some((e) => (e.kind === "riser" || e.kind === "sweep") && t0 < (e.end ?? 0) && t1 > e.at)) continue;
    events.push({
      kind: "swell",
      at: r3(t0),
      frame: frameOf(t0),
      end: r3(t1),
      endFrame: frameOf(t1),
      change: r1(level[b] - level[a]),
      detail: `level +${(level[b] - level[a]).toFixed(0)} dB`,
    });
  }

  // Start, end, gaps.
  // First sound: 30 ms or more of it, so a click at the head of the file does not count.
  let first = 0;
  while (first < n && !(sounding(first) && minOf(all, first, first + 30) > silence)) first++;
  // A hit can be the first sound.
  first = Math.min(first, ...events.map((e) => Math.round(e.at * 1000)));
  let last = n - 1;
  while (last > first && !sounding(last)) last--;
  if (first < n) {
    events.push({ kind: "start", at: r3(first / 1000), frame: frameOf(first / 1000), detail: "first sound" });
    for (let i = first, quiet = -1; i <= last; i++) {
      if (!sounding(i)) {
        if (quiet < 0) quiet = i;
      } else if (quiet >= 0) {
        if (i - quiet >= 250)
          events.push({
            kind: "gap",
            at: r3(quiet / 1000),
            frame: frameOf(quiet / 1000),
            end: r3(i / 1000),
            endFrame: frameOf(i / 1000),
            detail: `${((i - quiet) / 1000).toFixed(2)} s of silence`,
          });
        quiet = -1;
      }
    }
  }

  // Tail: from the last hit, the level falls away to silence.
  const hits = events.filter((e) => e.kind === "boom" || e.kind === "impact" || e.kind === "cut");
  const lastHit = hits.sort((a, b) => b.at - a.at)[0];
  if (lastHit && first < n) {
    const slow = smooth(all, 200);
    const i0 = Math.round((lastHit.peak ?? lastHit.at) * 1000);
    let peakAt = i0;
    for (let i = i0; i < Math.min(n, i0 + 800); i++) if (slow[i] > slow[peakAt]) peakAt = i;
    let start = peakAt;
    while (start < last && slow[start] > slow[peakAt] - 3) start++;
    const stop = last;
    if ((stop - start) / 1000 >= 0.5 && slow[stop] < slow[start] - 12) {
      const rate = (slow[start] - slow[Math.max(start, stop - 50)]) / ((stop - start) / 1000);
      events.push({
        kind: "tail",
        at: r3(start / 1000),
        frame: frameOf(start / 1000),
        end: r3(stop / 1000),
        endFrame: frameOf(stop / 1000),
        detail: `decays to silence, about ${rate.toFixed(0)} dB a second`,
      });
    }
  }
  if (first < n)
    events.push({ kind: "end", at: r3((last + 1) / 1000), frame: frameOf((last + 1) / 1000), detail: "last sound" });
  events.sort((a, b) => a.at - b.at || (a.kind === "cut" ? -1 : 1));

  // 6. Envelopes for the report, at 100 per second.
  const rate = 100;
  const at100 = (v: Float64Array) =>
    Array.from({ length: Math.ceil(duration * rate) }, (_, k) =>
      Math.max(-100, r1(v[Math.min(v.length - 1, Math.round((k / rate) * 1000))])),
    );
  return {
    file,
    duration: r3(duration),
    fps,
    offset,
    loudness,
    key,
    rate,
    bands: Object.fromEntries(BAND_NAMES.map((b) => [b, at100(env[b])])) as Record<SoundBand, number[]>,
    centroid: Array.from({ length: Math.ceil(duration * rate) }, (_, k) => {
      const f = Math.min(spectral.centroid.length - 1, Math.round((k / rate) * sr));
      return gate(f) ? Math.round(spectral.centroid[f]) : 0;
    }),
    onsets,
    events,
    spectral,
  };
}

// ----------------------------------------------------------------------------
// Finding an event (for `hits`)

/**
 * The time, in seconds of the analysed audio, of the sound a hit names: a
 * number is taken as it is; a kind ("boom", "impact", "cut", "onset", or
 * "riser" for its end) is the nearest such event to `near`.
 */
export function findSound(report: SoundReport, sound: number | string, near: number): number | null {
  if (typeof sound === "number") return sound;
  const kind = sound.trim().toLowerCase();
  const times =
    kind === "onset"
      ? BAND_NAMES.flatMap((b) => report.onsets[b])
      : report.events
          .filter((e) => e.kind === kind)
          .map((e) => (kind === "riser" || kind === "swell" || kind === "sweep" ? (e.end ?? e.at) : e.at));
  if (!times.length) return null;
  return times.sort((a, b) => Math.abs(a - near) - Math.abs(b - near))[0];
}

// ----------------------------------------------------------------------------
// The picture

const MAGMA = [
  [0, 0, 4],
  [28, 16, 68],
  [79, 18, 123],
  [129, 37, 129],
  [181, 54, 122],
  [229, 80, 100],
  [251, 135, 97],
  [254, 194, 135],
  [252, 253, 191],
];
const colour = (v: number) => {
  const x = Math.min(1, Math.max(0, v)) * (MAGMA.length - 1);
  const i = Math.min(MAGMA.length - 2, Math.floor(x));
  const t = x - i;
  return MAGMA[i].map((c, k) => Math.round(c + (MAGMA[i + 1][k] - c) * t));
};
const KIND_COLOUR: Record<SoundEvent["kind"], string> = {
  start: "#9aa0a6",
  end: "#9aa0a6",
  impact: "#ffd54a",
  boom: "#ff6b4a",
  cut: "#4ad8ff",
  riser: "#ff9de2",
  sweep: "#c59dff",
  swell: "#9dffb0",
  pulse: "#ffe9a8",
  tail: "#8fb4ff",
  gap: "#666c75",
};
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const frameLabel = (f: number) => `f${Number.isInteger(f) ? f : f.toFixed(1)}`;

/** A spectrogram with a frame ruler, the band edges, the centroid and the events: one small image. */
export async function soundPng(report: SoundReport & { spectral: Spectral }, title: string) {
  const W = 1200;
  const left = 46;
  const right = 14;
  const plotW = W - left - right;
  const labelsTop = 26;
  const specTop = labelsTop + 44;
  const specH = 300;
  const rulerTop = specTop + specH;
  const { spectral, duration, fps, offset } = report;
  const ranges = report.events.filter((e) => e.end !== undefined && e.kind !== "gap");
  const points = report.events.filter((e) => e.end === undefined);
  // Lanes for the ranges, so labels never overlap.
  const lanes: number[] = [];
  const laneOf = new Map<SoundEvent, number>();
  const xOf = (t: number) => left + (t / duration) * plotW;
  for (const r of ranges.sort((a, b) => a.at - b.at)) {
    const x0 = xOf(r.at);
    const x1 = Math.max(xOf(r.end ?? r.at), x0 + 8 + (r.kind.length + 18) * 6.2);
    let lane = lanes.findIndex((end) => end < x0 - 4);
    if (lane < 0) {
      lanes.push(0);
      lane = lanes.length - 1;
    }
    lanes[lane] = x1;
    laneOf.set(r, lane);
  }
  const rangesTop = rulerTop + 40;
  const H = rangesTop + Math.max(1, lanes.length) * 20 + 8;

  // The spectrogram, on a log frequency axis from 20 Hz to 20 kHz.
  const lo = Math.log(20);
  const hi = Math.log(20000);
  const bin = RATE / SPEC_N;
  const cols = spectral.frames.length;
  const db = new Float32Array(plotW * specH);
  for (let x = 0; x < plotW; x++) {
    const c0 = Math.floor((x / plotW) * cols);
    const c1 = Math.max(c0 + 1, Math.floor(((x + 1) / plotW) * cols));
    for (let y = 0; y < specH; y++) {
      const hz = Math.exp(hi - ((hi - lo) * y) / (specH - 1));
      const k = hz / bin;
      const k0 = Math.floor(k);
      const t = k - k0;
      let p = 0;
      for (let c = c0; c < Math.min(c1, cols); c++) {
        const f = spectral.frames[c];
        p = Math.max(p, (f[k0] ?? 0) * (1 - t) + (f[k0 + 1] ?? 0) * t);
      }
      db[y * plotW + x] = 10 * Math.log10(p + 1e-20);
    }
  }
  const topDb = percentile(
    db.filter((_, i) => i % 7 === 0),
    0.997,
  );
  const rgb = Buffer.alloc(plotW * specH * 3);
  for (let i = 0; i < db.length; i++) {
    const [r, g, b] = colour((db[i] - (topDb - 80)) / 80);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  const yOf = (hz: number) => specTop + ((hi - Math.log(hz)) / (hi - lo)) * (specH - 1);

  const svg: string[] = [];
  const text = (x: number, y: number, s: string, o: { fill?: string; size?: number; anchor?: string } = {}) =>
    svg.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${o.fill ?? "#d7dadf"}" font-size="${o.size ?? 11}" font-family="Helvetica, Arial, sans-serif" text-anchor="${o.anchor ?? "start"}">${xml(s)}</text>`,
    );
  text(left, 17, title, { size: 13, fill: "#f2f3f5" });
  // Band edges.
  for (const [name, [a, b]] of Object.entries(SOUND_BANDS)) {
    const edge = a || 20;
    if (a)
      svg.push(
        `<line x1="${left}" x2="${left + plotW}" y1="${yOf(a)}" y2="${yOf(a)}" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="3 4"/>`,
      );
    const mid = Math.sqrt(edge * (b || 20000));
    text(left + 4, yOf(mid) + 4, name, { fill: "#ffffff", size: 10 });
  }
  for (const hz of [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000])
    text(left - 4, yOf(hz) + 4, hz >= 1000 ? `${hz / 1000}k` : String(hz), {
      anchor: "end",
      size: 10,
      fill: "#9aa0a6",
    });
  // Centroid.
  const pts: string[] = [];
  report.centroid.forEach((c, k) => {
    if (c > 20) pts.push(`${xOf(k / report.rate).toFixed(1)},${yOf(c).toFixed(1)}`);
    else if (pts.length && pts[pts.length - 1] !== "M") pts.push("M");
  });
  const path = pts
    .join(" ")
    .split(" M")
    .map((seg) => seg.trim().replace(/^M\s*/, ""))
    .filter((seg) => seg.includes(" "))
    .map((seg) => `<polyline points="${seg}" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="1.2"/>`);
  svg.push(...path);
  text(left + plotW - 4, specTop + 14, "white line: centroid", { anchor: "end", size: 10, fill: "#ffffff" });
  // Frame ruler.
  const frames = (duration - 0) * fps;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];
  const tick = steps.find((s) => (s / frames) * plotW >= 6) ?? 1200;
  const label = steps.find((s) => s >= tick && (s / frames) * plotW >= 56) ?? 1200;
  svg.push(`<line x1="${left}" x2="${left + plotW}" y1="${rulerTop + 0.5}" y2="${rulerTop + 0.5}" stroke="#9aa0a6"/>`);
  const firstFrame = Math.ceil(-offset * fps);
  for (let f = Math.ceil(firstFrame / tick) * tick; f <= frames + firstFrame; f += tick) {
    const x = xOf(f / fps + offset);
    if (x < left || x > left + plotW) continue;
    const major = f % label === 0;
    svg.push(`<line x1="${x}" x2="${x}" y1="${rulerTop}" y2="${rulerTop + (major ? 9 : 4)}" stroke="#9aa0a6"/>`);
    if (major) {
      text(x, rulerTop + 21, `f${f}`, { anchor: "middle", size: 10 });
      text(x, rulerTop + 33, `${(f / fps + offset).toFixed(2)}s`, { anchor: "middle", size: 9, fill: "#9aa0a6" });
    }
  }
  // Point events: a line through the spectrogram, a label above in one of three rows. Where
  // they crowd (a run of drum hits), the hits that find no room keep their line, without a label.
  const rowY = [labelsTop + 11, labelsTop + 24, labelsTop + 37];
  const importance = (e: SoundEvent) => (e.kind === "boom" || e.kind === "cut" ? 0 : e.kind === "impact" ? 1 : 2);
  const placed = new Map<SoundEvent, number>();
  for (const e of [...points].sort((a, b) => importance(a) - importance(b) || a.at - b.at)) {
    const x = xOf(e.at);
    const width = `${e.kind} ${frameLabel(e.frame)}`.length * 6.2 + 6;
    const free = (r: number) =>
      [...placed].every(
        ([o, row]) =>
          row !== r || x + width < xOf(o.at) - 2 || x > xOf(o.at) + `${o.kind} ${frameLabel(o.frame)}`.length * 6.2 + 6,
      );
    const row = [0, 1, 2].find(free);
    if (row !== undefined) placed.set(e, row);
  }
  for (const e of points) {
    const x = xOf(e.at);
    const c = KIND_COLOUR[e.kind];
    const row = placed.get(e);
    svg.push(
      `<line x1="${x}" x2="${x}" y1="${row === undefined ? specTop : rowY[row] - 9}" y2="${rulerTop}" stroke="${c}" stroke-width="1.2" stroke-opacity="${row === undefined ? 0.55 : 0.9}"/>`,
    );
    const label = `${e.kind} ${frameLabel(e.frame)}`;
    // Near the right edge the label sits left of its line.
    const flip = x + label.length * 6.2 + 6 > W;
    if (row !== undefined)
      text(flip ? x - 3 : x + 3, rowY[row], label, { fill: c, size: 11, anchor: flip ? "end" : "start" });
  }
  // Ranges in lanes under the ruler.
  for (const [e, lane] of laneOf) {
    const x0 = xOf(e.at);
    const x1 = xOf(e.end ?? e.at);
    const y = rangesTop + lane * 20;
    const c = KIND_COLOUR[e.kind];
    svg.push(`<rect x="${x0}" y="${y}" width="${Math.max(2, x1 - x0)}" height="5" rx="2" fill="${c}"/>`);
    text(x0, y + 16, `${e.kind} ${frameLabel(e.frame)}–${frameLabel(e.endFrame ?? e.frame)}`, { fill: c, size: 10 });
  }
  for (const g of report.events.filter((e) => e.kind === "gap"))
    svg.push(
      `<rect x="${xOf(g.at)}" y="${specTop}" width="${xOf(g.end ?? g.at) - xOf(g.at)}" height="${specH}" fill="#000" fill-opacity="0.35"/>`,
    );

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join("")}</svg>`,
  );
  return sharp({ create: { width: W, height: H, channels: 3, background: "#121316" } })
    .composite([
      { input: rgb, raw: { width: plotW, height: specH, channels: 3 }, left, top: specTop },
      { input: overlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

// ----------------------------------------------------------------------------
// The command

/**
 * The video's audio as heard: the mix when it has one, else the music at its offset and volume.
 * `music`: the same without the sound effects (out/mix-music.wav), for finding the track's own
 * events, which an effect placed on them would otherwise move.
 */
export async function heardAudio(videoId: string, info: Info, { music = false }: { music?: boolean } = {}) {
  const mixed = music ? await mixAudio(videoId, { ...info, sfx: [] }, "mix-music") : await mixAudio(videoId, info);
  if (mixed)
    return {
      file: mixed.file,
      samples: decode(mixed.file),
      offset: 0,
      loudness: measureLoudness({ file: mixed.file }),
    };
  if (!info.audio) return null;
  const file = assetPath(info.audio.src);
  if (!existsSync(file)) throw new Error(`audio not found: ${info.audio.src}`);
  const track = decode(file);
  const offset = info.audio.offset ?? 0;
  const volume = info.audio.volume ?? 1;
  const length = Math.round((info.durationInFrames / info.fps) * RATE);
  const samples = new Float32Array(length);
  const shift = Math.round(offset * RATE);
  for (let i = 0; i < length; i++) samples[i] = (track[i + shift] ?? 0) * volume;
  const loudness = measureLoudness({ file, from: offset, duration: length / RATE, volume });
  return { file, samples, offset: 0, loudness };
}

const fmtTime = (t: number) => `${t.toFixed(3)} s`;

/** The report as lines: one per event, a cut into a boom on one line. */
export function soundLines(report: SoundReport) {
  const lines: string[] = [];
  const events = report.events;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const next = events[i + 1];
    const when =
      e.end !== undefined
        ? `${e.at.toFixed(2)}–${e.end.toFixed(2)} s  ${frameLabel(e.frame)}–${frameLabel(e.endFrame ?? e.frame)}`
        : `${fmtTime(e.at)}  ${frameLabel(e.frame)}`;
    const pair = [e.kind, next?.kind].sort().join(" ");
    if (pair === "boom cut" && Math.abs(next.at - e.at) <= 0.06) {
      const [cut, boom] = e.kind === "cut" ? [e, next] : [next, e];
      lines.push(
        `${when.padEnd(30)} cut to boom · ${cut.bands?.join(", ")} cut at ${fmtTime(cut.at)} ${frameLabel(cut.frame)}; boom ${boom.detail}${boom.pitch ? `, ${boom.pitch}` : ""}`,
      );
      i++;
      continue;
    }
    lines.push(`${when.padEnd(30)} ${e.kind} · ${e.detail}${e.pitch ? `, ${e.pitch}` : ""}`);
  }
  return lines;
}

/**
 * `pnpm launch sound <id> [file]`: the events of the video's audio as heard
 * (or of a file), with seconds and frames, plus loudness, key, band envelopes
 * and onsets per band, written to out/sound.json; `png` adds a spectrogram.
 */
export async function sound(
  videoId: string,
  file: string | undefined,
  { png = false, fps }: { png?: boolean; fps?: number },
) {
  const dir = join(root(), "videos", videoId);
  let samples: Float32Array;
  let source: string;
  let offset = 0;
  let loudness: Measured;
  let rate = fps ?? 60;
  let name = "sound";
  if (file) {
    source = isAbsolute(file) ? file : join(dir, file);
    if (!existsSync(source)) throw new Error(`No such file: ${relative(root(), source)}`);
    samples = decode(source);
    loudness = measureLoudness({ file: source });
    name = `sound-${basename(source).replace(/\.[^.]+$/, "")}`;
  } else {
    const { url } = await startServer();
    const browser = await launchBrowser();
    const { info } = await openRenderer(browser, url, videoId, 1);
    await browser.close();
    rate = fps ?? info.fps;
    const heard = await heardAudio(videoId, info);
    if (heard) {
      ({ samples, loudness, offset } = heard);
      source = heard.file;
    } else {
      const audio = join(dir, "audio");
      const track = existsSync(audio)
        ? readdirSync(audio).find((f) => /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(f))
        : undefined;
      if (!track) throw new Error(`No audio on ${videoId} and none in ${relative(root(), audio)}/`);
      source = join(audio, track);
      samples = decode(source);
      loudness = measureLoudness({ file: source });
    }
  }
  const report = analyseSound(samples, { fps: rate, offset, file: relative(dir, source), loudness });
  const { spectral, ...json } = report;
  const target = join(outDir(videoId), `${name}.json`);
  writeFileSync(target, `${JSON.stringify(json)}\n`);
  const l = report.loudness;
  console.log(
    `  ${relative(process.cwd(), target)} · ${report.duration.toFixed(2)} s · key estimate ${report.key.name} (${report.key.confidence}) · ${l.lufs} LUFS, short-term max ${l.shortTerm}, ${l.peak} dBTP, range ${l.range} LU`,
  );
  for (const line of soundLines(report)) console.log(`    ${line}`);
  console.log(
    `  onsets: ${BAND_NAMES.map((b) => `${b} ${report.onsets[b].length}`).join(" · ")} (times in the json, with band levels and centroid at ${report.rate}/s)`,
  );
  if (png) {
    const image = join(outDir(videoId), `${name}.png`);
    writeFileSync(
      image,
      await soundPng(
        report,
        `${report.file} · ${report.duration.toFixed(2)} s at ${rate} fps · key estimate ${report.key.name} · ${l.lufs} LUFS, short-term max ${l.shortTerm}, ${l.peak} dBTP`,
      ),
    );
    console.log(`  ${relative(process.cwd(), image)}`);
  }
}
