import { statSync } from "node:fs";
import { run } from "./ffmpeg.js";

/**
 * Files made from a finished mp4 for where an mp4 does not play: a GIF for a README, an issue or a
 * chat, and a poster frame for a link preview or a thumbnail.
 */

/** The largest GIF worth handing out: GitHub refuses README images over 10 MB, chat apps recompress well before. */
const GIF_BUDGET = 8e6;

/**
 * GIF settings, best first. A GIF has 256 colours and no motion prediction, so its size follows how
 * much of the frame changes: flat type on a plain ground fits at the top, a busy camera move only
 * further down. Each is tried until one fits the budget.
 */
const GIF_STEPS = [
  { width: 960, fps: 30 },
  { width: 800, fps: 25 },
  { width: 640, fps: 20 },
  { width: 480, fps: 15 },
  { width: 360, fps: 12 },
];

/** A looping GIF of `mp4`, as large and smooth as fits `budget` bytes. `width` caps the first try. */
export async function writeGif(mp4: string, target: string, options: { width?: number; budget?: number } = {}) {
  const { width, budget = GIF_BUDGET } = options;
  const steps = width ? [{ width, fps: 25 }, ...GIF_STEPS.filter((s) => s.width < width)] : GIF_STEPS;
  let last = { width: 0, fps: 0, bytes: 0 };
  for (const step of steps) {
    // One palette for the whole clip, weighted to what moves; dither only where the picture changes,
    // so held frames compress to almost nothing.
    await run([
      "-i",
      mp4,
      "-vf",
      `fps=${step.fps},scale=${step.width}:-2:flags=lanczos,split[a][b];` +
        "[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
      "-loop",
      "0",
      target,
    ]);
    last = { ...step, bytes: statSync(target).size };
    if (last.bytes <= budget) break;
  }
  return { file: target, ...last, fits: last.bytes <= budget };
}

/**
 * Frame `index` of `mp4` (counted in its own frames) as a PNG, and for a landscape video also a
 * 1200×630 JPEG (the size link previews use), cut from the middle of the frame. By index, not by
 * time: a 30 fps preview has no frame at an odd timeline frame, and a seek picks the next one.
 */
export async function writePoster(mp4: string, index: number, target: string, size: { width: number; height: number }) {
  const files = [target];
  await run(["-i", mp4, "-vf", `select=eq(n\\,${index})`, "-frames:v", "1", "-fps_mode", "passthrough", target]);
  const aspect = size.width / size.height;
  if (aspect >= 1.6 && aspect <= 2.1) {
    const og = target.replace(/\.png$/, "-og.jpg");
    await run([
      "-i",
      target,
      "-vf",
      "scale=1200:630:force_original_aspect_ratio=increase:flags=lanczos,crop=1200:630",
      "-q:v",
      "2",
      og,
    ]);
    files.push(og);
  }
  return files;
}
