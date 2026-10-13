/**
 * The licence manifest: every external file a video uses (music, stems,
 * voice, sound effects, footage, fonts, HDRIs, LUTs, models, images), with
 * the licence recorded for it, written to out/licences.json by
 * `pnpm launch licences <id>` and by every render. `check` warns about files
 * with no licence recorded.
 *
 * A licence is recorded either beside the file, as `<file>.license.json`
 * (or `.licence.json`), or in `videos/<id>/licences.json`, keyed by path from
 * the video's folder (a leading "/" for the launch folder, `*` and `**` as
 * globs):
 *
 *   { "audio/track.mp3": { "licence": "Suno Pro, commercial use", "source": "https://suno.com/song/…" },
 *     "audio/sfx/*": { "licence": "ElevenLabs paid plan", "author": "generated" } }
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { type Info, launchBrowser, openRenderer, startServer } from "./browser.js";
import { project } from "./project.js";
import { librarySound } from "./sfx.js";
import { outDir, root } from "./util.js";

export type Licence = { licence: string; source?: string; author?: string; notes?: string };

export type LicensedFile = {
  /** Path from the launch folder (or absolute, outside it). */
  file: string;
  kind: string;
  /** What uses it: "music", "sfx in hook", "referenced in video.tsx", "in the video folder". */
  uses: string[];
  licence?: Licence;
  /** Where the licence was found. */
  recordedIn?: string;
};

const KINDS: Record<string, string> = {
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".ogg": "audio",
  ".flac": "audio",
  ".aif": "audio",
  ".aiff": "audio",
  ".mp4": "video",
  ".mov": "video",
  ".webm": "video",
  ".m4v": "video",
  ".woff": "font",
  ".woff2": "font",
  ".ttf": "font",
  ".otf": "font",
  ".hdr": "hdri",
  ".exr": "hdri",
  ".cube": "lut",
  ".glb": "model",
  ".gltf": "model",
  ".usdz": "model",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".avif": "image",
  ".gif": "image",
  ".svg": "image",
  ".lottie": "animation",
};

const REFERENCE = new RegExp(
  `["'\`]([^"'\`\\s]+(?:${Object.keys(KINDS).join("|").replace(/\./g, "\\.")}))["'\`]`,
  "gi",
);

/** Folders in a video that hold our own output or the product's own captured UI, not external files. */
// reference/ holds the person's screenshots of what to show: read by the agent, not put in frame.
const SKIP = new Set(["out", "captures", "node_modules", "reference"]);

function walk(dir: string, out: string[] = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** A src as videos write it: relative to the video's folder, or a URL in the launch folder (or a product's public folder). */
function resolveSrc(videoDir: string, src: string, from = videoDir): string | null {
  if (/^[a-z]+:/i.test(src)) return null;
  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  const candidates = clean.startsWith("/")
    ? [
        join(root(), clean),
        ...project()
          .products.filter((p) => p.public)
          .map((p) => join(p.path, p.public as string, clean)),
      ]
    : [join(from, clean), join(videoDir, clean)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const glob = (pattern: string) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\/?/g, "\0")
      .replace(/\*/g, "[^/]*")
      .replace(/\0/g, ".*")}$`,
  );

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${relative(root(), file)}: ${error instanceof Error ? error.message : error}`);
  }
}

function normalise(entry: unknown): Licence | undefined {
  if (!entry || typeof entry !== "object") return typeof entry === "string" ? { licence: entry } : undefined;
  const e = entry as Record<string, string>;
  const licence = e.licence ?? e.license;
  return licence ? { licence, source: e.source, author: e.author, notes: e.notes } : undefined;
}

/** Every external file `videoId` uses, with its licence where one is recorded. */
export function licenceManifest(videoId: string, info: Info): { files: LicensedFile[]; missing: string[] } {
  const videoDir = join(root(), "videos", videoId);
  const found = new Map<string, LicensedFile>();
  const use = (
    path: string | null,
    kind: string | undefined,
    what: string,
    known?: { licence?: Licence; at: string },
  ) => {
    // Renders (a Clip of another video) and captures of the product are our own.
    if (!path || /[/\\]videos[/\\][^/\\]+[/\\](out|captures)[/\\]/.test(path)) return;
    const file = relative(root(), path).startsWith("..") ? path : relative(root(), path);
    const entry = found.get(file) ?? { file, kind: kind ?? KINDS[extname(path).toLowerCase()] ?? "file", uses: [] };
    if (!entry.uses.includes(what)) entry.uses.push(what);
    if (known?.licence && !entry.licence) {
      entry.licence = known.licence;
      entry.recordedIn = known.at;
    }
    found.set(file, entry);
  };

  // What the mix plays.
  const audio = info.audio;
  if (audio) {
    use(resolveSrc(videoDir, audio.src), "music", "music");
    for (const [name, stem] of Object.entries(audio.stems ?? {}))
      use(resolveSrc(videoDir, typeof stem === "string" ? stem : stem.src), "music", `stem ${name}`);
    for (const line of [audio.voice ?? []].flat()) use(resolveSrc(videoDir, line.src), "voice", "voice-over");
  }
  for (const s of info.sfx) {
    const what = s.shot ? `sfx in ${s.shot}` : "sfx";
    if (s.src.startsWith("sfx:")) {
      // The sound library records licences in its index.json.
      const { entry, file, library } = librarySound(s.src);
      const licence = normalise({ licence: entry.license, source: entry.source ?? undefined });
      use(file, "sfx", what, { licence, at: `${library} sound library index.json` });
    } else use(resolveSrc(videoDir, s.src), "sfx", what);
  }

  // Files the video's code names (Clip sources, fonts, HDRIs, LUTs, images).
  for (const file of walk(videoDir).filter((f) => /\.(tsx?|jsx?|css)$/.test(f))) {
    for (const [, src] of readFileSync(file, "utf8").matchAll(REFERENCE)) {
      use(resolveSrc(videoDir, src, dirname(file)), undefined, `referenced in ${relative(videoDir, file)}`);
    }
  }
  // Media sitting in the video's folder.
  for (const file of walk(videoDir)) {
    if (KINDS[extname(file).toLowerCase()]) use(file, undefined, "in the video folder");
  }

  // Licences: a sidecar beside the file, else the video's licences.json.
  const mapFile = join(videoDir, "licences.json");
  const map = existsSync(mapFile) ? (readJson(mapFile) as Record<string, unknown>) : {};
  const patterns = Object.entries(map).map(([key, value]) => ({ key, test: glob(key), value }));
  for (const entry of found.values()) {
    const abs = entry.file.startsWith("/") ? entry.file : join(root(), entry.file);
    for (const suffix of [".license.json", ".licence.json"]) {
      if (!entry.licence && existsSync(abs + suffix)) {
        entry.licence = normalise(readJson(abs + suffix));
        entry.recordedIn = relative(root(), abs + suffix);
      }
    }
    if (entry.licence) continue;
    const fromVideo = relative(videoDir, abs);
    const fromRoot = `/${relative(root(), abs)}`;
    const hit = patterns.find((p) => p.test.test(fromVideo) || p.test.test(fromRoot));
    if (hit) {
      entry.licence = normalise(hit.value);
      entry.recordedIn = `${relative(root(), mapFile)} "${hit.key}"`;
    }
  }
  const files = [...found.values()].sort((a, b) => a.file.localeCompare(b.file));
  return { files, missing: files.filter((f) => !f.licence).map((f) => f.file) };
}

/** Write out/licences.json; returns the manifest. */
export function writeLicences(videoId: string, info: Info) {
  const manifest = licenceManifest(videoId, info);
  const file = join(outDir(videoId), "licences.json");
  writeFileSync(file, `${JSON.stringify({ video: videoId, ...manifest }, null, 2)}\n`);
  return { ...manifest, file };
}

/** `pnpm launch licences <id>`. */
export async function licences(videoId: string) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const { info } = await openRenderer(browser, url, videoId, 1);
  await browser.close();
  const { files, missing, file } = writeLicences(videoId, info);
  for (const f of files) {
    const l = f.licence;
    console.log(
      `  ${l ? "ok  " : "warn"}  ${f.kind.padEnd(6)} ${f.file}${l ? `  ${l.licence}` : "  no licence recorded"}`,
    );
  }
  console.log(`\n  ${relative(process.cwd(), file)} · ${files.length} file(s), ${missing.length} without a licence`);
  if (missing.length) {
    console.log(
      `  Record each in videos/${videoId}/licences.json ({ "<path>": { "licence": "…", "source": "…" } }) or a <file>.license.json beside it.`,
    );
  }
}
