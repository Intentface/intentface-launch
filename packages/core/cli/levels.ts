import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { Levels } from "../engine/levels.js";
import { root } from "./util.js";

const RATE = 48000;
/** Analysis window: 2048 samples at 48 kHz, about 43 ms. */
const WINDOW = 2048;
/** Envelopes follow a rise in 40 ms and a fall in 200 ms, so motion jumps with a syllable and settles after it. */
const ATTACK = 0.04;
const RELEASE = 0.2;
/** Envelopes span this many dB below the track's loud level (its 98th percentile). */
const RANGE = 30;
export const BANDS = { sub: [20, 60], low: [60, 250], mid: [250, 2000], high: [2000, 8000] } as const;

/**
 * Per-frame levels of an audio file, for scenes that move with the sound
 * (a voice orb, a meter, a logo that breathes with the music): a loudness
 * envelope and three band envelopes, onsets, and the phrases between silences.
 * Writes `<file>.levels.json` beside the audio; read it in a scene with
 * `audioLevels()`.
 */
export function levels(videoId: string, files: string[], { rate = 60 } = {}) {
  const dir = join(root(), "videos", videoId);
  if (!files.length) {
    const audio = join(dir, "audio");
    const track = existsSync(audio) ? readdirSync(audio).find((f) => /\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(f)) : null;
    if (!track) throw new Error(`No audio file in ${relative(root(), audio)}/; name one: levels ${videoId} <file>`);
    files = [join("audio", track)];
  }
  for (const file of files) {
    const path = isAbsolute(file) ? file : join(dir, file);
    if (!existsSync(path)) throw new Error(`No such file: ${relative(root(), path)}`);
    const result = analyse(decode(path), rate);
    const target = path.replace(/\.[^.]+$/, ".levels.json");
    writeFileSync(target, `${JSON.stringify({ file: relative(dir, path), ...result })}\n`);
    console.log(
      `  ${relative(root(), target)} · ${result.duration.toFixed(2)}s · ${result.onsets.length} onsets · ${result.phrases.length} phrases`,
    );
    for (const [s, e] of result.phrases) console.log(`    ${s.toFixed(2)} to ${e.toFixed(2)}`);
  }
}

/** An audio file as mono samples at 48 kHz. */
export function decode(file: string, rate = RATE): Float32Array {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(rate), "-"], {
    maxBuffer: 1 << 30,
  });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();

/** In-place radix-2 FFT (`re.length` a power of two). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  let table = twiddles.get(n);
  if (!table) {
    table = { cos: new Float64Array(n / 2), sin: new Float64Array(n / 2) };
    for (let k = 0; k < n / 2; k++) {
      table.cos[k] = Math.cos((-2 * Math.PI * k) / n);
      table.sin[k] = Math.sin((-2 * Math.PI * k) / n);
    }
    twiddles.set(n, table);
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len / 2;
    const stride = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const c = table.cos[k * stride];
        const s = table.sin[k * stride];
        const xr = re[i + k + half] * c - im[i + k + half] * s;
        const xi = re[i + k + half] * s + im[i + k + half] * c;
        re[i + k + half] = re[i + k] - xr;
        im[i + k + half] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

const db = (power: number) => 10 * Math.log10(power + 1e-12);
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const round = (v: number) => Math.round(v * 1000) / 1000;

export function analyse(samples: Float32Array, rate: number): Omit<Levels, "file"> {
  const duration = samples.length / RATE;
  const count = Math.ceil(duration * rate);
  const hann = Float64Array.from({ length: WINDOW }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW));
  const binHz = RATE / WINDOW;
  const raw = {
    rms: [] as number[],
    sub: [] as number[],
    low: [] as number[],
    mid: [] as number[],
    high: [] as number[],
  };
  /** Positive change of the log spectrum: high where something starts. */
  const flux: number[] = [];
  let previous: Float64Array | null = null;
  const re = new Float64Array(WINDOW);
  const im = new Float64Array(WINDOW);
  for (let f = 0; f < count; f++) {
    const centre = Math.round((f / rate) * RATE);
    let sum = 0;
    for (let i = 0; i < WINDOW; i++) {
      const x = samples[centre - WINDOW / 2 + i] ?? 0;
      sum += x * x;
      re[i] = x * hann[i];
      im[i] = 0;
    }
    raw.rms.push(db(sum / WINDOW));
    fft(re, im);
    const mag = new Float64Array(WINDOW / 2);
    for (let k = 0; k < WINDOW / 2; k++) mag[k] = re[k] * re[k] + im[k] * im[k];
    for (const band of ["sub", "low", "mid", "high"] as const) {
      const [lo, hi] = BANDS[band];
      let p = 0;
      for (let k = Math.ceil(lo / binHz); k <= Math.floor(hi / binHz); k++) p += mag[k];
      raw[band].push(db(p));
    }
    let change = 0;
    const log = mag.map((m) => Math.log1p(m * 100));
    if (previous) for (let k = 2; k < log.length; k++) change += Math.max(0, log[k] - previous[k]);
    flux.push(change);
    previous = log;
  }

  // Loud level of the track: where it is sounding at all, its 98th percentile.
  const top = percentile(raw.rms, 0.98);
  const silent = Math.max(top - 40, -70);

  const follow = (values: number[]) => {
    const sounding = values.filter((_, i) => raw.rms[i] > silent);
    const ref = percentile(sounding.length ? sounding : values, 0.98);
    const up = 1 - Math.exp(-1 / (ATTACK * rate));
    const down = 1 - Math.exp(-1 / (RELEASE * rate));
    let env = 0;
    return values.map((v) => {
      const x = Math.min(1, Math.max(0, 1 + (v - ref) / RANGE));
      env += (x - env) * (x > env ? up : down);
      return round(env);
    });
  };

  // Onsets: a peak in the flux above its own neighbourhood, while there is sound, at least 80 ms apart.
  const onsets: number[] = [];
  const reach = Math.round(0.25 * rate);
  const fluxTop = percentile(flux, 0.99);
  for (let f = 1; f < count - 1; f++) {
    if (raw.rms[f] < silent + 6 || flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
    const near = flux.slice(Math.max(0, f - reach), f + reach + 1);
    const mean = near.reduce((a, b) => a + b, 0) / near.length;
    if (flux[f] < mean * 1.6 + fluxTop * 0.08) continue;
    const t = f / rate;
    if (t - (onsets.at(-1) ?? -1) < 0.08) continue;
    onsets.push(round(t));
  }

  // Phrases: sound between silences of at least 180 ms; blips under 60 ms do not count.
  const phrases: [number, number][] = [];
  let start = -1;
  let quiet = 0;
  for (let f = 0; f <= count; f++) {
    const on = f < count && raw.rms[f] > silent + 6;
    if (on) {
      if (start < 0) start = f;
      quiet = 0;
    } else if (start >= 0 && (++quiet >= 0.18 * rate || f === count)) {
      const end = f - quiet + 1;
      if ((end - start) / rate >= 0.06) phrases.push([round(start / rate), round(end / rate)]);
      start = -1;
      quiet = 0;
    }
  }

  return {
    duration: round(duration),
    rate,
    rms: follow(raw.rms),
    sub: follow(raw.sub),
    low: follow(raw.low),
    mid: follow(raw.mid),
    high: follow(raw.high),
    onsets,
    phrases,
  };
}
