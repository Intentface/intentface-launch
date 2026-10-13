import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { formatSuffix, type Info, launchBrowser, openRenderer, StalledFrame, startServer, within } from "./browser.js";
import { writeCaptions } from "./captions.js";
import { writeGif, writePoster } from "./deliver.js";
import { ffmpeg, finished, REC709_FILTER, REC709_TAGS, run, write } from "./ffmpeg.js";
import { grab } from "./frames.js";
import { writeLicences } from "./licences.js";
import { mixAudio } from "./mix.js";
import { resolveFrame } from "./review.js";
import { assetPath, outDir, rocketBar, timer } from "./util.js";

export type RenderOptions = {
  /** Output size multiplier: 0.5 for a quick 960×540 animatic, 2 for 4K. */
  scale?: number;
  /** Motion-blur samples per frame (1 = off). After Effects defaults to 16. */
  blur?: number;
  /** Shutter angle in degrees: 180 is the film look, 360 a full frame of smear. */
  angle?: number;
  /** When the shutter opens relative to the frame, in degrees. −angle/2 centres the blur. */
  phase?: number;
  workers?: number;
  from?: number;
  to?: number;
  /** Final frame rate. Previews can drop to 30. */
  fps?: number;
  audio?: boolean;
  crf?: number;
  /** Also keep a ProRes 422 HQ master. */
  master?: boolean;
  name?: string;
  quick?: boolean;
  /** Keep the chunks a failed or stopped render finished, and render only the rest. */
  resume?: boolean;
  /** Samples for every 3D stage (8 for a quick review cut); default: each stage's own. */
  samples?: number;
  /**
   * Render only these shots again (ids) and reuse every other chunk from the last render with the
   * same settings: after a change to one shot, minutes instead of the whole film.
   */
  shots?: string[];
  /** Also a looping GIF under 8 MB (`true`), or one at most this many pixels wide. */
  gif?: boolean | number;
  /** Also a poster: this frame (a frame name, as `still` takes) as a PNG, and a 1200×630 JPEG for link previews. */
  poster?: string;
};

/** New browsers to try a stalled frame in before giving up. */
const RETRIES = 2;

/** Frames per chunk: what a failure costs, and what `--resume` skips. */
const CHUNK = 60;

export async function render(videoId: string, options: RenderOptions = {}) {
  const { scale = 1, blur = 1, angle = 180, audio = true, crf = 16, master = false, quick = false } = options;
  const elapsed = timer();
  const phase = options.phase ?? -angle / 2;
  const stageSamples = options.samples;
  const { url } = await startServer();
  const probeBrowser = await launchBrowser();
  const probe = await openRenderer(probeBrowser, url, videoId, scale);
  const info: Info = probe.info;
  await probeBrowser.close();
  // Mixed first, so a missing sound fails before minutes of frames.
  const mixed = audio ? await mixAudio(videoId, info) : null;

  const fps = options.fps ?? info.fps;
  const step = info.fps / fps;
  if (!Number.isInteger(step)) throw new Error(`--fps must divide ${info.fps}`);
  const from = options.from ?? 0;
  const to = Math.min(options.to ?? info.durationInFrames, info.durationInFrames);
  const frames: number[] = [];
  for (let f = from; f < to; f += step) frames.push(f);

  const out = outDir(videoId);
  // Previews keep their own chunks, so a review cut never throws away the final's.
  const work = join(out, `.chunks${quick ? "-preview" : ""}${formatSuffix(info)}`);
  // Chunks from another render (other size, blur or fps) cannot be reused.
  const settings = JSON.stringify({
    scale,
    blur,
    angle,
    phase,
    fps,
    quick,
    samples: stageSamples ?? null,
    format: info.format,
    variant: info.variant,
  });
  const settingsFile = join(work, "settings.json");
  const keep = options.resume || !!options.shots?.length;
  const reusable = keep && existsSync(settingsFile) && readFileSync(settingsFile, "utf8") === settings;
  if (keep && !reusable) console.warn("  No chunks from a render with these settings; rendering everything.");
  if (!reusable) rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  writeFileSync(settingsFile, settings);

  const all = Array.from({ length: Math.ceil(frames.length / CHUNK) }, (_, i) => {
    const mine = frames.slice(i * CHUNK, (i + 1) * CHUNK);
    return { frames: mine, file: join(work, `frames-${String(mine[0]).padStart(6, "0")}.mkv`) };
  });
  if (reusable && options.shots?.length) {
    // The named shots' frames, with the transition that leads into each, are drawn again.
    const ranges = options.shots.map((id) => {
      const shot = info.shots.find((s) => s.id === id);
      if (!shot) throw new Error(`No shot "${id}" in ${videoId} (shots: ${info.shots.map((s) => s.id).join(", ")})`);
      return [shot.from - (shot.transition?.frames ?? 0), shot.from + shot.duration] as const;
    });
    let dropped = 0;
    for (const c of all) {
      if (!c.frames.some((f) => ranges.some(([a, b]) => f >= a && f < b))) continue;
      if (existsSync(c.file)) {
        rmSync(c.file);
        dropped++;
      }
    }
    console.log(
      `  Drawing ${options.shots.join(", ")} again (${dropped} chunk${dropped === 1 ? "" : "s"}); the rest comes from the last render.`,
    );
  }
  const todo = all.filter((c) => !existsSync(c.file));
  if (todo.length < all.length) console.log(`  Reusing ${all.length - todo.length} of ${all.length} chunks.`);

  const workers = Math.max(1, Math.min(options.workers ?? Math.min(8, cpus().length - 2), todo.length));
  const width = Math.round(info.width * scale);
  const height = Math.round(info.height * scale);
  const failed: string[] = [];
  let done = frames.length - todo.reduce((n, c) => n + c.frames.length, 0);
  let moving = 0;
  let lastReport = 0;
  let lastReportAt = Date.now();
  let tick = 0;
  const report = setInterval(() => {
    const line = `  ${done}/${frames.length} frames · ${elapsed()}`;
    if (process.stdout.isTTY) process.stdout.write(`\r\x1b[K  ${rocketBar(done / frames.length, tick++)}${line}`);
    // In a log: every tenth, and at least every 15 s, so a slow stretch is told from a stuck one.
    else if (done - lastReport >= frames.length / 10 || Date.now() - lastReportAt > 15_000) {
      console.log(line);
      lastReport = done;
      lastReportAt = Date.now();
    }
  }, 500);

  // Workers take chunks from one queue, so a slow stretch (3D) is shared out,
  // and a chunk that fails costs only itself: the others are kept for --resume.
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: workers }, async () => {
      // One browser per worker: pages in a shared browser queue on one GPU process.
      let browser = await launchBrowser();
      let renderer = await openRenderer(browser, url, videoId, scale, { samples: stageSamples });
      const fresh = async () => {
        // The stall is in the browser's GPU process, shared by all its pages,
        // and closing a wedged browser can hang too: abandon it for a new one.
        within(browser.close(), 10_000).catch(() => {});
        browser = await launchBrowser();
        renderer = await openRenderer(browser, url, videoId, scale, { samples: stageSamples });
      };
      const options = { samples: blur, angle, phase, step, noBlur: quick, format: quick ? "jpeg" : "png" } as const;
      for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
        const partial = chunk.file.replace(/\.mkv$/, ".partial.mkv");
        // Raw RGB in; blur is already averaged in grab(). Lossless intermediate:
        // the final pass does the colour conversion once.
        const encoder = ffmpeg([
          "-f",
          "rawvideo",
          "-pix_fmt",
          "rgb24",
          "-s",
          `${width}x${height}`,
          "-framerate",
          String(fps),
          "-i",
          "-",
          "-c:v",
          "libx264rgb",
          "-crf",
          "0",
          "-preset",
          "ultrafast",
          partial,
        ]);
        try {
          for (const frame of chunk.frames) {
            let grabbed: Awaited<ReturnType<typeof grab>> | undefined;
            for (let attempt = 0; !grabbed; attempt++) {
              try {
                grabbed = await grab(renderer, frame, options);
              } catch (error) {
                if (!(error instanceof StalledFrame) || attempt === RETRIES) throw error;
                console.warn(`\n  Frame ${frame}: ${error.message}. Retrying in a new browser.`);
                await fresh();
              }
            }
            const { raw, blurred } = grabbed;
            if (blurred) moving++;
            await write(encoder, raw);
            done++;
          }
          encoder.stdin?.end();
          await finished(encoder);
          renameSync(partial, chunk.file);
        } catch (error) {
          encoder.kill();
          const range = `${chunk.frames[0]}–${chunk.frames.at(-1)}`;
          console.warn(`\n  Frames ${range} failed: ${error instanceof Error ? error.message : error}`);
          failed.push(range);
          await fresh();
        }
      }
      await within(browser.close(), 10_000).catch(() => {});
    }),
  );
  clearInterval(report);
  if (process.stdout.isTTY) process.stdout.write(`\r\x1b[K  ${rocketBar(done / frames.length, tick)}\n`);
  console.log(`  ${frames.length} frames, ${moving} motion-blurred · ${elapsed()}`);
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} chunk(s) failed (frames ${failed.join(", ")}). ` +
        "Run the same command with --resume to render only those; finished chunks are kept.",
    );
  }

  const list = join(work, "chunks.txt");
  writeFileSync(list, all.map((c) => `file '${c.file}'`).join("\n"));

  // Another format renders beside the default: <id>-vertical.mp4, preview-vertical.mp4.
  const name = options.name ?? `${scale < 1 || quick ? "preview" : videoId}${formatSuffix(info)}`;
  const target = join(out, `${name}.mp4`);
  const audioFile = mixed ? mixed.file : audio && info.audio ? assetPath(info.audio.src) : null;
  if (audioFile && !existsSync(audioFile)) console.warn(`  audio not found: ${audioFile}`);
  const withAudio = audioFile && existsSync(audioFile);
  // The mix starts at the video's first frame, at its final level.
  const offset = (mixed ? 0 : (info.audio?.offset ?? 0)) + from / info.fps;
  const volume = mixed ? 1 : (info.audio?.volume ?? 1);
  const seconds = (to - from) / info.fps;

  await run([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    ...(withAudio ? ["-ss", String(Math.max(0, offset)), "-i", audioFile] : []),
    "-vf",
    // 4:2:0 needs even sides: a half-size preview of a 1080×1350 video is 540×675. Crops at most
    // one pixel row or column, and only when a side is odd.
    `crop=trunc(iw/2)*2:trunc(ih/2)*2,${REC709_FILTER}`,
    "-c:v",
    "libx264",
    "-preset",
    quick ? "veryfast" : "slow",
    "-crf",
    String(crf),
    "-profile:v",
    "high",
    "-r",
    String(fps),
    ...REC709_TAGS,
    ...(withAudio ? ["-c:a", "aac", "-b:a", "320k", "-af", `volume=${volume}`, "-map", "0:v", "-map", "1:a"] : []),
    "-t",
    String(seconds),
    "-movflags",
    "+faststart",
    target,
  ]);

  if (master) {
    await run([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      ...(withAudio ? ["-ss", String(Math.max(0, offset)), "-i", audioFile] : []),
      "-vf",
      REC709_FILTER.replace("yuv420p", "yuv422p10le"),
      "-c:v",
      "prores_ks",
      "-profile:v",
      "3",
      ...REC709_TAGS,
      ...(withAudio ? ["-c:a", "pcm_s16le", "-map", "0:v", "-map", "1:a"] : []),
      "-t",
      String(seconds),
      join(out, `${name}-master.mov`),
    ]);
  }
  // The chunks stay: they are what `--shots` and `--resume` reuse. A render with other settings replaces them.
  const mb = (statSync(target).size / 1e6).toFixed(1);
  console.log(`  ${target} · ${width}×${height} · ${fps} fps · ${mb} MB · ${elapsed()}`);
  if (options.gif) {
    const gif = await writeGif(target, join(out, `${name}.gif`), {
      width: typeof options.gif === "number" ? options.gif : undefined,
    });
    console.log(
      `  ${gif.file} · ${gif.width} px wide · ${gif.fps} fps · ${(gif.bytes / 1e6).toFixed(1)} MB${
        gif.fits ? "" : " (over 8 MB even at the smallest setting: render a shorter --from/--to range)"
      }`,
    );
  }
  if (options.poster !== undefined) {
    const frame = resolveFrame(info, options.poster);
    if (frame < from || frame >= to)
      throw new Error(`--poster ${options.poster} (frame ${frame}) is outside the render`);
    const index = Math.floor((frame - from) / step);
    const files = await writePoster(target, index, join(out, `${name}-poster.png`), { width, height });
    for (const f of files) console.log(`  ${f}`);
  }
  // Sidecar captions under the mp4's name, so players pick them up, and the licence manifest.
  for (const f of writeCaptions(info, out, name)) console.log(`  ${f}`);
  const licences = writeLicences(videoId, info);
  console.log(
    `  ${licences.file} · ${licences.files.length} external file(s)${
      licences.missing.length
        ? `, ${licences.missing.length} with no licence recorded: ${licences.missing.join(", ")}`
        : ""
    }`,
  );
  return target;
}

/**
 * The variants `--variant` names: one, or for "all" the video itself
 * (`undefined`) and every variant it declares. Pass each to `setVariant`.
 */
export async function variantList(videoId: string, flag: string | undefined): Promise<(string | undefined)[]> {
  if (flag !== "all") return [flag];
  const { url } = await startServer();
  const browser = await launchBrowser();
  try {
    const probe = await openRenderer(browser, url, videoId, 1);
    return [undefined, ...probe.info.variants];
  } finally {
    await browser.close();
  }
}
