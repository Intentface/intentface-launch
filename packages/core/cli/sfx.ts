import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { CORE } from "./project.js";
import { root } from "./util.js";

// Measuring a sound: shared by the mixer (placing it) and the library (indexing it).

export const RATE = 48000;

/** Interleaved L R float samples at RATE. */
export type Stereo = Float32Array;

const decoded = new Map<string, { size: number; mtime: number; pcm: Stereo }>();

/** A file as 48 kHz stereo float, kept for the process (and re-read when the file changes). */
export function decode(file: string): Stereo {
  const { size, mtimeMs } = statSync(file);
  const known = decoded.get(file);
  if (known && known.size === size && known.mtime === mtimeMs) return known.pcm;
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vn", "-f", "f32le", "-ac", "2", "-ar", String(RATE), "-"],
    { maxBuffer: 1 << 30 },
  );
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  decoded.set(file, { size, mtime: mtimeMs, pcm });
  return pcm;
}

export const peakOf = (clip: Stereo) => clip.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** Seconds to the first sample within 20 dB of the peak: where the sound is heard to start. */
export function onset(clip: Stereo) {
  const peak = peakOf(clip);
  const i = clip.findIndex((v) => Math.abs(v) > peak * 0.1);
  return Math.max(0, i) / 2 / RATE;
}

/** Seconds to the middle of the loudest 10 ms (windows stepped by 1 ms). */
export function loudest(clip: Stereo) {
  const frames = clip.length / 2;
  const width = RATE / 100;
  const step = RATE / 1000;
  // Energy per sample frame, summed so any window is a difference.
  const sums = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) sums[i + 1] = sums[i] + clip[i * 2] ** 2 + clip[i * 2 + 1] ** 2;
  let best = -1;
  let at = 0;
  for (let i = 0; i + width <= frames; i += step) {
    const sum = sums[i + width] - sums[i];
    if (sum > best) [best, at] = [sum, i];
  }
  return Math.min(frames, at + width / 2) / RATE;
}

/**
 * How loud a sound effect gets: its loudest 400 ms (EBU momentary loudness,
 * padded so a 50 ms click is measured too) and its true peak.
 */
export function effectLoudness(file: string) {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "apad=pad_dur=0.4,ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  let lufs = Number.NEGATIVE_INFINITY;
  for (const m of run.stderr.matchAll(/\bM:\s*(-?[\d.]+)/g)) lufs = Math.max(lufs, Number(m[1]));
  const summary = run.stderr.slice(run.stderr.lastIndexOf("Summary:"));
  const peak = Number(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1] ?? Number.NaN);
  return { lufs, peak };
}

// The library: sounds shared by every video, by id.

export const CATEGORIES = [
  "riser",
  "whoosh",
  "impact",
  "sub-drop",
  "ui",
  "typing",
  "shimmer",
  "swell",
  "reverse",
  "stinger",
  "logo",
  "ambience",
] as const;

export type SfxEntry = {
  /** Referenced in `sfx` as `src: "sfx:<id>"`. From the file's path ("whoosh/soft-03.wav" → "whoosh-soft-03") unless written by hand. */
  id: string;
  /** Relative to the folder that holds index.json. */
  file: string;
  /** One of CATEGORIES (or any word). Guessed from the folder and name on first index, then kept. */
  category: string;
  tags: string[];
  /** Measured by `sfx index`, in seconds: length, where it is heard to start, the middle of its loudest 10 ms. */
  duration: number;
  onset: number;
  peakOffset: number;
  /** Measured: loudest 400 ms (momentary LUFS) and true peak (dBTP). */
  lufs: number;
  peak: number;
  /** Written by hand: the licence ("CC0", "CC-BY 4.0", "ElevenLabs paid plan") and where it came from (a URL, a generator). */
  license: string | null;
  source: string | null;
  /** The generation prompt, for generated sounds. */
  prompt?: string;
  [extra: string]: unknown;
};

export type Library = { name: "project" | "core"; dir: string; sounds: SfxEntry[] };

const INDEX = "index.json";
const AUDIO = /\.(wav|mp3|m4a|aac|flac|ogg|aif|aiff)$/i;

/** The libraries in the order ids resolve: the launch folder's `sfx/`, then the pack core ships. */
export function libraries(): Library[] {
  const dirs: [Library["name"], string][] = [
    ["project", join(root(), "sfx")],
    ["core", join(CORE, "sfx")],
  ];
  const out: Library[] = [];
  const seen = new Set<string>();
  for (const [name, dir] of dirs) {
    const index = join(dir, INDEX);
    if (seen.has(resolve(dir)) || !existsSync(index)) continue;
    seen.add(resolve(dir));
    out.push({ name, dir, sounds: readIndex(index) });
  }
  return out;
}

function readIndex(file: string): SfxEntry[] {
  const json = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(json) ? json : (json.sounds ?? []);
}

/** A library sound by id ("whoosh-soft-03", or "sfx:whoosh-soft-03"), from the first library that has it. */
export function librarySound(id: string): { entry: SfxEntry; file: string; library: Library["name"] } {
  const bare = id.replace(/^sfx:/, "");
  const all = libraries();
  for (const lib of all) {
    const entry = lib.sounds.find((s) => s.id === bare);
    if (entry) return { entry, file: join(lib.dir, entry.file), library: lib.name };
  }
  const near = all
    .flatMap((l) => l.sounds.map((s) => s.id))
    .filter((other) => other.startsWith(bare.split("-")[0]))
    .slice(0, 8);
  throw new Error(
    all.length === 0
      ? `No sound library for ${id}: index one with \`sfx index\` (sfx/ in the launch folder)`
      : `No sound "${bare}" in the library${near.length ? `; close: ${near.join(", ")}` : ""} (sfx find lists them)`,
  );
}

const SYNONYMS: [string, string[]][] = [
  ["logo", ["logo", "sonic"]],
  ["stinger", ["stinger", "sting"]],
  ["reverse", ["reverse", "reversed", "rev"]],
  ["sub-drop", ["subdrop", "drop", "sub"]],
  ["riser", ["riser", "rise", "build", "uplifter"]],
  ["whoosh", ["whoosh", "woosh", "swoosh", "swish", "whip", "swipe", "pass"]],
  ["impact", ["impact", "boom", "hit", "thud", "whoomp", "punch", "slam"]],
  ["typing", ["typing", "keystroke", "keystrokes", "keyboard", "keys", "key", "type"]],
  ["ui", ["ui", "click", "tick", "blip", "tap", "pop", "toggle", "beep", "success", "error", "notification"]],
  ["shimmer", ["shimmer", "glass", "sparkle", "chime", "twinkle"]],
  ["swell", ["swell", "pad", "bloom"]],
  ["ambience", ["ambience", "ambient", "room"]],
];

/** Category and tags from a file's path: the folder if it names a category, else the first word that does. */
export function guess(file: string): { category: string; tags: string[] } {
  const lower = file.toLowerCase().replace(AUDIO, "");
  const words = lower.split(/[/\\\s._-]+/).filter((w) => w && !/^\d+$/.test(w));
  // Plurals name the same thing: "ticks" is a tick.
  const singular = words.flatMap((w) => (w.length > 3 && w.endsWith("s") ? [w, w.slice(0, -1)] : [w]));
  const folder = lower.split(/[/\\]/).length > 1 ? lower.split(/[/\\]/)[0] : null;
  let category = folder && (CATEGORIES as readonly string[]).includes(folder) ? folder : null;
  if (!category && /sub[-_ ]?drop/.test(lower)) category = "sub-drop";
  if (!category) category = SYNONYMS.find(([, w]) => w.some((x) => singular.includes(x)))?.[0] ?? "other";
  const own = new Set([category, ...(SYNONYMS.find(([c]) => c === category)?.[1] ?? [])]);
  // A whip is a kind of whoosh: keep the word as a tag.
  const tags = [...new Set(words.filter((w) => (!own.has(w) && !own.has(w.replace(/s$/, ""))) || w === "whip"))];
  return { category, tags };
}

const idOf = (file: string) =>
  file
    .replace(AUDIO, "")
    .toLowerCase()
    .split(/[/\\]/)
    .join("-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

function audioFiles(dir: string, sub = ""): string[] {
  return readdirSync(join(dir, sub), { withFileTypes: true }).flatMap((d) => {
    // raw/ holds unfinished sources; _files are scratch.
    if (d.name.startsWith("_") || d.name.startsWith(".") || d.name === "raw" || d.name === "out") return [];
    const rel = sub ? `${sub}/${d.name}` : d.name;
    if (d.isDirectory()) return audioFiles(dir, rel);
    return AUDIO.test(d.name) ? [rel] : [];
  });
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);

/**
 * `sfx index`: measure every audio file in a library folder (the launch
 * folder's sfx/, or `dir`) and write index.json. Measurements are always
 * redone; ids, categories, tags, licences, sources, prompts and any other
 * hand-written fields are kept. New files get a guessed category and tags,
 * and `license`/`source` when given (else they are listed as missing).
 */
export function indexLibrary(options: { dir?: string; license?: string; source?: string } = {}) {
  const dir = options.dir
    ? isAbsolute(options.dir)
      ? options.dir
      : resolve(process.env.INIT_CWD ?? process.cwd(), options.dir)
    : join(root(), "sfx");
  if (!existsSync(dir)) throw new Error(`No folder ${relative(process.cwd(), dir) || dir}: put sounds in it first`);
  const indexFile = join(dir, INDEX);
  const before = existsSync(indexFile) ? readIndex(indexFile) : [];
  const byFile = new Map(before.map((e) => [e.file, e]));
  const ids = new Set<string>();
  const sounds: SfxEntry[] = [];
  const added: string[] = [];
  for (const file of audioFiles(dir).sort()) {
    const known = byFile.get(file);
    const id = known?.id ?? idOf(file);
    if (ids.has(id)) {
      console.warn(`  skipped ${file}: id "${id}" is taken (rename it, or give it its own id in index.json)`);
      continue;
    }
    ids.add(id);
    const path = join(dir, file);
    const pcm = decode(path);
    const { lufs, peak } = effectLoudness(path);
    const guessed = guess(file);
    const entry: SfxEntry = {
      id,
      file,
      category: known?.category ?? guessed.category,
      tags: known?.tags ?? guessed.tags,
      duration: r3(pcm.length / 2 / RATE),
      onset: r3(onset(pcm)),
      peakOffset: r3(loudest(pcm)),
      lufs: r1(lufs),
      peak: r1(peak),
      license: known?.license ?? options.license ?? null,
      source: known?.source ?? options.source ?? null,
    };
    // Hand-written fields (prompt, notes, anything else) come along.
    if (known) for (const [k, v] of Object.entries(known)) if (!(k in entry)) entry[k] = v;
    if (!known) added.push(id);
    sounds.push(entry);
  }
  const gone = before.filter((e) => !sounds.some((s) => s.file === e.file)).map((e) => e.id);
  writeFileSync(indexFile, `${JSON.stringify({ sounds }, null, 2)}\n`);
  const shown = relative(process.cwd(), indexFile);
  console.log(`  ${shown.startsWith("..") ? indexFile : shown} · ${sounds.length} sounds`);
  if (added.length) console.log(`  new: ${added.join(", ")} (check each category and tags)`);
  if (gone.length) console.log(`  removed (file gone): ${gone.join(", ")}`);
  const unlicensed = sounds.filter((s) => !s.license).map((s) => s.id);
  if (unlicensed.length)
    console.warn(
      `  no licence: ${unlicensed.join(", ")}\n  Write each one's "license" and "source" in index.json (or index with --license … --source …).`,
    );
  const other = sounds.filter((s) => !(CATEGORIES as readonly string[]).includes(s.category)).map((s) => s.id);
  if (other.length) console.warn(`  category not one of ${CATEGORIES.join(", ")}: ${other.join(", ")}`);
}

export type SfxQuery = { text?: string; category?: string; tags?: string[]; max?: number; min?: number };

/** Library sounds matching a query, from every library; an id the project overrides shows once, as the project's. */
export function findSfx(query: SfxQuery = {}) {
  const seen = new Set<string>();
  const out: (SfxEntry & { library: Library["name"]; overrides?: boolean })[] = [];
  const libs = libraries();
  for (const lib of libs) {
    for (const s of lib.sounds) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      if (query.category && s.category !== query.category) continue;
      if (query.tags?.some((t) => !s.tags.includes(t))) continue;
      if (query.max !== undefined && s.duration > query.max) continue;
      if (query.min !== undefined && s.duration < query.min) continue;
      const text = query.text?.toLowerCase();
      if (text && ![s.id, s.category, ...s.tags, s.prompt ?? ""].some((w) => w.toLowerCase().includes(text))) continue;
      const overrides =
        lib.name === "project" && libs.some((l) => l.name === "core" && l.sounds.some((c) => c.id === s.id));
      out.push({ ...s, library: lib.name, ...(overrides ? { overrides } : {}) });
    }
  }
  return out;
}

/** `sfx find`: one line per match. */
export function printSfx(query: SfxQuery, json = false) {
  const found = findSfx(query);
  if (json) {
    console.log(JSON.stringify(found, null, 2));
    return;
  }
  if (!libraries().length) {
    console.log("  No sound library: put sounds in sfx/ in the launch folder and run `sfx index`.");
    return;
  }
  if (!found.length) {
    console.log("  Nothing matches.");
    return;
  }
  const width = Math.max(...found.map((s) => s.id.length)) + 4;
  for (const s of found) {
    const where = s.library === "core" ? "core" : s.overrides ? "project, over core" : "project";
    console.log(
      `  ${`sfx:${s.id}`.padEnd(width + 4)}${s.category.padEnd(9)}${s.duration.toFixed(2).padStart(5)} s  peak ${s.peakOffset.toFixed(2)} s  ${(Number.isFinite(s.lufs) ? s.lufs.toFixed(1) : "-inf").padStart(5)} LUFS  ${(s.tags.join(", ") || "-").padEnd(22)} ${s.license ?? "NO LICENCE"} (${where})`,
    );
  }
  console.log(
    `\n  ${found.length} ${found.length === 1 ? "sound" : "sounds"}. In sfx: { src: "sfx:<id>", at, align: "peak" }`,
  );
}
