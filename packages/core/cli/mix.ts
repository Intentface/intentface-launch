import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { editPieces } from "../engine/motion.js";
import type { AudioDuck, AudioEdit, AudioStem, Sound, VoiceLine } from "../engine/video.js";
import { type Info, launchBrowser, openRenderer, startServer } from "./browser.js";
import { loudnessTarget, measureLoudness } from "./loudness.js";
import { loadRules } from "./rules.js";
import { decode, librarySound, loudest, onset, peakOf, RATE, type Stereo } from "./sfx.js";
import { assetPath, outDir, root } from "./util.js";

/** Bump when the mix changes for the same inputs, so cached mixes are rebuilt. */
const VERSION = 4;

const hitCache = new Map<string, Stereo[]>();

/**
 * The separate hits in a recording (keystrokes, taps): onsets that rise within
 * 12 dB of the loudest, at least 120 ms apart, each cut just before the next
 * (at most 0.5 s) with a short fade.
 */
function hits(file: string): Stereo[] {
  const known = hitCache.get(file);
  if (known) return known;
  const pcm = decode(file);
  const hop = RATE / 1000;
  const frames = pcm.length / 2;
  const db: number[] = [];
  for (let i = 0; i + hop <= frames; i += hop) {
    let sum = 0;
    for (let j = i; j < i + hop; j++) sum += ((pcm[j * 2] + pcm[j * 2 + 1]) / 2) ** 2;
    db.push(10 * Math.log10(sum / hop + 1e-12));
  }
  const top = Math.max(...db);
  const starts: number[] = [];
  for (let ms = 1; ms < db.length; ms++) {
    if (db[ms] <= top - 30 || db[ms - 1] > top - 30) continue;
    // A press is loud; the quieter release after it is part of the same hit.
    if (Math.max(...db.slice(ms, ms + 30)) > top - 12 && ms - (starts.at(-1) ?? -1000) > 120) starts.push(ms);
  }
  const out = starts.map((ms, i) => {
    const from = Math.max(0, ms - 3) * hop;
    const to = Math.min(((starts[i + 1] ?? ms + 500) - 5) * hop, (ms + 500) * hop, frames);
    return fadeOut(pcm.slice(from * 2, to * 2), 0.03);
  });
  if (out.length === 0) throw new Error(`${file}: no separate hits found`);
  hitCache.set(file, out);
  return out;
}

function fadeOut(clip: Stereo, seconds: number) {
  const n = clip.length / 2;
  const fade = Math.min(n, Math.round(seconds * RATE));
  for (let j = n - fade; j < n; j++) {
    const w = (n - j) / fade;
    clip[j * 2] *= w;
    clip[j * 2 + 1] *= w;
  }
  return clip;
}

/** A sound's source file: relative to the video's folder, a URL in the launch folder, or "sfx:<id>" from the library. */
function soundFile(videoId: string, src: string) {
  if (src.startsWith("sfx:")) return librarySound(src).file;
  return src.startsWith("/") ? assetPath(src) : join(root(), "videos", videoId, src);
}

/** The sound as it will be placed: trimmed or picked out of a recording, faded, at its level. */
function prepare(videoId: string, s: Sound): { clip: Stereo; align: number } {
  const file = soundFile(videoId, s.src);
  if (!existsSync(file)) throw new Error(`Sound not found: ${s.src} (${relative(process.cwd(), file)})`);
  let clip: Stereo;
  if (s.hit !== undefined) {
    const all = hits(file);
    clip = all[((Math.round(s.hit) % all.length) + all.length) % all.length].slice();
  } else {
    const pcm = decode(file);
    const from = Math.round((s.from ?? 0) * RATE) * 2;
    const to = s.to !== undefined ? Math.round(s.to * RATE) * 2 : pcm.length;
    clip = fadeOut(pcm.slice(from, to), s.fade ?? 0.01);
  }
  const peak = peakOf(clip);
  const gain = s.peak !== undefined ? 10 ** (s.peak / 20) / (peak || 1) : 10 ** ((s.gain ?? 0) / 20);
  if (gain !== 1) for (let i = 0; i < clip.length; i++) clip[i] *= gain;
  const align = s.align ?? "onset";
  return {
    clip,
    align: typeof align === "number" ? align : align === "start" ? 0 : align === "peak" ? loudest(clip) : onset(clip),
  };
}

/** Add a clip into a mix, starting `seconds` in, scaled by `gain` and, when given, a gain per sample frame of the mix. */
function add(mix: Stereo, clip: Stereo, seconds: number, gain = 1, envelope?: Float32Array) {
  const start = Math.round(seconds * RATE) * 2;
  for (let j = Math.max(0, -start); j < clip.length && start + j < mix.length; j++) {
    const k = start + j;
    mix[k] += clip[j] * (envelope ? gain * envelope[k >> 1] : gain);
  }
}

/** Ramps at each edge of a stem's mute, against clicks: short enough to land on the frame. */
const RAMP = Math.round(0.005 * RATE);

/** 1 where a stem plays, 0 over its muted frame ranges `[from, to)`, with 5 ms ramps starting at each edge. */
function muteEnvelope(frames: number, ranges: [number, number][], fps: number) {
  const env = new Float32Array(frames).fill(1);
  for (const [from, to] of ranges) {
    const a = Math.round((from / fps) * RATE);
    const b = Math.round((to / fps) * RATE);
    for (let i = Math.max(0, a); i < Math.min(frames, b + RAMP); i++) {
      const g = i < b ? 1 - Math.min(1, (i - a) / RAMP) : Math.min(1, (i - b) / RAMP);
      env[i] = Math.min(env[i], g);
    }
  }
  return env;
}

/** Quadratic fades on the music: in from frame 0, out to the last sample, even to the ear. */
function fade(bus: Stereo, fadeIn: number, fadeOut: number) {
  const n = bus.length / 2;
  const fin = Math.round(fadeIn * RATE);
  const fout = Math.round(fadeOut * RATE);
  for (let i = 0; i < Math.min(n, fin); i++) {
    const g = (i / fin) ** 2;
    bus[i * 2] *= g;
    bus[i * 2 + 1] *= g;
  }
  for (let i = Math.max(0, n - fout); i < n; i++) {
    const g = ((n - i) / fout) ** 2;
    bus[i * 2] *= g;
    bus[i * 2 + 1] *= g;
  }
}

export const DUCK: Required<AudioDuck> = { amount: -8, attack: 0.15, release: 0.5, hold: 0.3 };

/**
 * The music's gain under the voice, per sample frame: down by `amount` dB
 * while the voice sounds (within 30 dB of its loudest 10 ms, gaps under
 * `hold` bridged), reached by the time it starts (the mix is offline, so the
 * duck looks ahead by `attack`), back up over `release` after it stops; ramps
 * are linear in dB. Also the stretches it is ducked, in seconds.
 */
function duckEnvelope(voice: Stereo, duck: Required<AudioDuck>) {
  const frames = voice.length / 2;
  const hop = RATE / 100;
  const hops = Math.ceil(frames / hop);
  const level = new Float64Array(hops);
  for (let h = 0; h < hops; h++) {
    let sum = 0;
    const end = Math.min(frames, (h + 1) * hop);
    for (let i = h * hop; i < end; i++) sum += ((voice[i * 2] + voice[i * 2 + 1]) / 2) ** 2;
    level[h] = 10 * Math.log10(sum / hop + 1e-12);
  }
  const top = Math.max(...level);
  const floor = Math.max(top - 30, -60);
  const active = Array.from(level, (v) => v > floor);
  const hold = Math.round(duck.hold * 100);
  let last = -1;
  for (let h = 0; h < hops; h++) {
    if (!active[h]) continue;
    if (last >= 0 && h - last - 1 <= hold) for (let k = last + 1; k < h; k++) active[k] = true;
    last = h;
  }
  const depth = -Math.abs(duck.amount);
  const attack = Math.max(1, duck.attack * 100);
  const release = Math.max(1, duck.release * 100);
  const db = new Float64Array(hops + 1);
  // Distance since the voice stopped (forward) and until it starts (backward).
  let since = Number.POSITIVE_INFINITY;
  for (let h = 0; h <= hops; h++) {
    if (active[h]) {
      since = -1;
      db[h] = depth;
    } else db[h] = depth * Math.max(0, 1 - ++since / release);
  }
  let until = Number.POSITIVE_INFINITY;
  for (let h = hops; h >= 0; h--) {
    if (active[h]) until = 0;
    else db[h] = Math.min(db[h], depth * Math.max(0, 1 - ++until / attack));
  }
  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / hop;
    const h = Math.floor(t);
    env[i] = 10 ** ((db[h] + (db[h + 1] - db[h]) * (t - h)) / 20);
  }
  const spans: [number, number][] = [];
  for (let h = 0; h < hops; h++) {
    if (!active[h]) continue;
    if (h > 0 && active[h - 1]) spans[spans.length - 1][1] = (h + 1) / 100;
    else spans.push([h / 100, (h + 1) / 100]);
  }
  return { env, spans };
}

/** Where a video's beats are, for `audio.edit`. */
const beatsFile = (videoId: string) => join(root(), "videos", videoId, "audio", "beats.json");

/**
 * The track (or a stem) as `audio.edit` plays it: the pieces `editPieces`
 * gives, each placed where the edited track has it, with an equal-power
 * crossfade that ends on the seam, so the beat after it comes whole from the
 * piece that follows.
 */
function edited(track: Stereo, videoId: string, edit: AudioEdit[]): Stereo {
  const file = beatsFile(videoId);
  if (!existsSync(file)) throw new Error(`audio.edit needs the track's beats: run \`beats ${videoId}\` first`);
  const pieces = editPieces(JSON.parse(readFileSync(file, "utf8")).beats, edit);
  const n = track.length / 2;
  const last = pieces[pieces.length - 1];
  const out = new Float32Array(Math.max(0, Math.round((last.at + n / RATE - last.from) * RATE)) * 2);
  pieces.forEach((p, i) => {
    const fin = Math.round(p.crossfade * RATE);
    const fout = Math.round((pieces[i + 1]?.crossfade ?? 0) * RATE);
    const from = Math.round(p.from * RATE) - fin;
    const to = Number.isFinite(p.to) ? Math.round(p.to * RATE) : n;
    const at = Math.round(p.at * RATE) - fin;
    for (let k = 0; from + k < to; k++) {
      const s = from + k;
      const o = at + k;
      if (s < 0 || s >= n || o < 0 || o * 2 >= out.length) continue;
      let g = 1;
      if (k < fin) g *= Math.sin(((k + 0.5) / fin) * (Math.PI / 2));
      if (to - s <= fout) g *= Math.sin(((to - s - 0.5) / fout) * (Math.PI / 2));
      out[o * 2] += track[s * 2] * g;
      out[o * 2 + 1] += track[s * 2 + 1] * g;
    }
  });
  return out;
}

export type Mix = {
  file: string;
  lufs: number;
  peak: number;
  /** Loudest 3 s, LUFS. */
  shortTerm: number;
  sounds: number;
  /** Voice lines and stems in the mix. */
  voices: number;
  stems: number;
  /** Where the music ducks under the voice, in frames. */
  ducked: [number, number][];
};

type Audio = NonNullable<Info["audio"]>;
const voicesOf = (a?: Audio): VoiceLine[] => (a?.voice ? [a.voice].flat() : []);
const stemsOf = (a?: Audio): (AudioStem & { name: string })[] =>
  Object.entries(a?.stems ?? {}).map(([name, s]) => ({ name, ...(typeof s === "string" ? { src: s } : s) }));

/** Whether the video's audio is built by the mixer, or the music plays as it is. */
export const needsMix = (info: Pick<Info, "sfx" | "audio">) =>
  Boolean(
    info.sfx?.length ||
      voicesOf(info.audio).length ||
      stemsOf(info.audio).length ||
      info.audio?.fadeIn ||
      info.audio?.fadeOut ||
      info.audio?.edit?.length,
  );

function existing(videoId: string, src: string, what: string) {
  const file = soundFile(videoId, src);
  if (!existsSync(file)) throw new Error(`${what} not found: ${src} (${relative(process.cwd(), file)})`);
  return file;
}

/**
 * The video's one audio file when it has sound effects, a voice-over, stems,
 * fades or a music edit: the music (from `audio`, or its stems with their
 * mutes, replayed by `edit`, at its offset and volume, faded, ducked under
 * the voice), the voice on its frames,
 * and every effect on its frame, mastered to the loudness target (gain, then
 * an oversampled limiter for the true peak, with correcting passes if the
 * limiter cost loudness; the gain also keeps the loudest 3 s under a
 * preset's short-term ceiling), or summed untouched when the audio is
 * "as-delivered". Written to out/mix.wav and reused until an input or the
 * target changes. Null when there is nothing to mix: the music plays as it is.
 */
export async function mixAudio(videoId: string, info: Info, name = "mix"): Promise<Mix | null> {
  if (!needsMix(info)) return null;
  const rules = await loadRules();
  const a = info.audio;
  const target = loudnessTarget(rules.loudness, a?.loudness);
  const asDelivered = target === null;
  const sfx = info.sfx ?? [];
  const voices = voicesOf(a);
  const stems = stemsOf(a);
  const duck = { ...DUCK, ...a?.duck };
  const music = a && !stems.length ? assetPath(a.src) : null;
  const files = [
    ...new Set([
      ...(music ? [music] : []),
      ...stems.map((s) => soundFile(videoId, s.src)),
      ...voices.map((v) => soundFile(videoId, v.src)),
      ...sfx.map((s) => soundFile(videoId, s.src)),
      ...(a?.edit?.length ? [beatsFile(videoId)] : []),
    ]),
  ];
  const key = createHash("sha1")
    .update(
      JSON.stringify({
        VERSION,
        sfx,
        audio: a,
        duck,
        fps: info.fps,
        length: info.durationInFrames,
        target,
        files: files.map((f) => (existsSync(f) ? [f, statSync(f).size, statSync(f).mtimeMs] : [f])),
      }),
    )
    .digest("hex");
  const dir = outDir(videoId);
  const file = join(dir, `${name}.wav`);
  const meta = join(dir, `${name}.json`);
  if (existsSync(file) && existsSync(meta)) {
    const known = JSON.parse(readFileSync(meta, "utf8"));
    if (known.key === key) return { file, ...known.result };
  }

  const frames = Math.round((info.durationInFrames / info.fps) * RATE);
  const offset = a?.offset ?? 0;
  const volume = a?.volume ?? 1;
  const track = (pcm: Stereo) => (a?.edit?.length ? edited(pcm, videoId, a.edit) : pcm);
  // The music bus: the track, or its stems with their mutes.
  const mix = new Float32Array(frames * 2);
  for (const stem of stems) {
    const mute = stem.mute?.length ? muteEnvelope(frames, stem.mute, info.fps) : undefined;
    const pcm = track(decode(existing(videoId, stem.src, `Stem ${stem.name}`)));
    add(mix, pcm, -offset, volume * (stem.volume ?? 1), mute);
  }
  if (music && existsSync(music)) add(mix, track(decode(music)), -offset, volume);
  if (a?.fadeIn || a?.fadeOut) fade(mix, a.fadeIn ?? 0, a.fadeOut ?? 0);

  let ducked: [number, number][] = [];
  if (voices.length) {
    const voice = new Float32Array(frames * 2);
    for (const v of voices)
      add(voice, decode(existing(videoId, v.src, "Voice")), (v.at ?? 0) / info.fps, v.volume ?? 1);
    if (duck.amount !== 0) {
      const { env, spans } = duckEnvelope(voice, duck);
      for (let i = 0; i < mix.length; i++) mix[i] *= env[i >> 1];
      ducked = spans.map(([s, e]) => [Math.round(s * info.fps), Math.round(e * info.fps)]);
    }
    for (let i = 0; i < mix.length; i++) mix[i] += voice[i];
  }
  for (const s of sfx) {
    const { clip, align } = prepare(videoId, s);
    add(mix, clip, s.at / info.fps - align);
  }

  const pcm = Buffer.from(mix.buffer);
  const rawIn = ["-f", "f32le", "-ac", "2", "-ar", String(RATE), "-i", "-"];
  const before = target ? measureLoudness({ args: rawIn, input: pcm }) : null;
  // To the integrated target, unless that would put the loudest 3 s over a short-term ceiling.
  let gain = 0;
  if (target && before && Number.isFinite(before.lufs)) {
    gain = target.lufs - before.lufs;
    if (target.shortTerm !== undefined && Number.isFinite(before.shortTerm))
      gain = Math.min(gain, target.shortTerm - 0.3 - before.shortTerm);
  }
  let after = { lufs: Number.NaN, peak: Number.NaN, shortTerm: Number.NaN, range: Number.NaN };
  // The limiter takes loudness off a mix with high peaks: up to two more passes with the gain corrected.
  for (let pass = 0; pass < 3; pass++) {
    const chain = target
      ? [
          `volume=${gain.toFixed(2)}dB`,
          "aresample=192000",
          // Limit to just under the ceiling, oversampled so the true peak stays under it too.
          `alimiter=limit=${(10 ** ((target.peak - 0.6) / 20)).toFixed(3)}:attack=2:release=60:level=false`,
          `aresample=${RATE}`,
        ]
      : [];
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-y", ...rawIn, ...(chain.length ? ["-af", chain.join(",")] : []), "-c:a", "pcm_s24le", file],
      { input: pcm, maxBuffer: 1 << 30 },
    );
    after = measureLoudness({ file });
    if (!target || !Number.isFinite(after.lufs)) break;
    // Short-term capped: the integrated target is out of reach on purpose.
    const aim =
      target.shortTerm !== undefined && after.shortTerm > target.shortTerm
        ? target.shortTerm - 0.3 - after.shortTerm
        : target.lufs - after.lufs;
    const capped =
      target.shortTerm !== undefined && after.shortTerm >= target.shortTerm - 0.6 && after.lufs < target.lufs;
    if (Math.abs(aim) <= 0.2 || capped) break;
    gain += aim;
  }
  const result = {
    lufs: after.lufs,
    peak: after.peak,
    shortTerm: after.shortTerm,
    sounds: sfx.length,
    voices: voices.length,
    stems: stems.length,
    ducked,
  };
  writeFileSync(meta, `${JSON.stringify({ key, result }, null, 2)}\n`);
  const parts = [
    `${sfx.length} ${sfx.length === 1 ? "sound" : "sounds"}`,
    voices.length &&
      `voice (${voices.length} ${voices.length === 1 ? "file" : "lines"}${ducked.length ? `, music ${-Math.abs(duck.amount)} dB under it at frames ${ducked.map(([s, e]) => `${s}-${e}`).join(", ")}` : ""})`,
    stems.length && `${stems.length} stems`,
    (a?.fadeIn || a?.fadeOut) && `fades ${a?.fadeIn ?? 0}s in, ${a?.fadeOut ?? 0}s out`,
    a?.edit?.length && `music edited (${a.edit.length} replay${a.edit.length === 1 ? "" : "s"})`,
  ].filter(Boolean);
  console.log(
    `  ${relative(process.cwd(), file)} · ${parts.join(" · ")} · ${after.lufs} LUFS (short-term max ${after.shortTerm}), ${after.peak} dBTP${asDelivered ? " (as delivered, not mastered)" : ""}`,
  );
  return { file, ...result };
}

/** `pnpm launch mix <id>`: the mix on its own, to listen to or measure. */
export async function mixVideo(videoId: string) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const { info } = await openRenderer(browser, url, videoId, 1);
  await browser.close();
  const mixed = await mixAudio(videoId, info);
  if (!mixed) console.log("  Nothing to mix (no sfx, voice, stems or fades): the music plays as it is.");
  else console.log(`  ${relative(process.cwd(), mixed.file)}`);
}
