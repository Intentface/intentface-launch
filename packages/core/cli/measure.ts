import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { launchBrowser, openRenderer, type Region, startServer } from "./browser.js";
import { describeFrame, resolveFrame } from "./review.js";
import { outDir } from "./util.js";

/**
 * Motion measured on rendered frames, frame by frame: what a sheet shows by eye, as numbers.
 *
 * Every frame of the range is rendered (cropped when asked) and reduced to its ink: pixels that
 * differ from the picture's background level, weighted by how much. From those come
 * - when the motion lands: the last frame that changes visibly before a quiet run (a 16-frame
 *   expo entrance lands visibly at about frame 11: the rest moves under half a pixel a frame),
 *   and how long it then holds;
 * - judder: how far the ink's centre strays from a smooth path (a cubic over nine frames), in
 *   pixels, and how often it turns back. Text scaled about its centre: 0.29 px and 30 turns;
 *   about its baseline: 0.04 px and none (videos/test-text-scale).
 */

/** Luma difference under which a pixel counts as unchanged: renderer dither, not motion. */
const NOISE = 2;
/** Share of pixels that must change for a frame to count as moving. */
const MOVING = 5e-4;
/** Quiet frames that must follow the last moving one: a held beat in the middle is not the end. */
const QUIET = 6;
/** Judder, in pixels, that shows as shaking on type that moves slower than about a pixel a frame. */
export const JUDDER = 0.1;

type Ink = { x: number; y: number; weight: number };

function modal(grey: Buffer) {
  const hist = new Uint32Array(256);
  for (const v of grey) hist[v]++;
  let best = 0;
  for (let i = 1; i < 256; i++) if (hist[i] > hist[best]) best = i;
  return best;
}

function ink(grey: Buffer, width: number, background: number): Ink {
  let w = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < grey.length; i++) {
    const d = Math.abs(grey[i] - background);
    if (d <= NOISE) continue;
    w += d;
    sx += d * (i % width);
    sy += d * Math.floor(i / width);
  }
  return w ? { x: sx / w, y: sy / w, weight: w / 255 } : { x: Number.NaN, y: Number.NaN, weight: 0 };
}

function changed(a: Buffer, b: Buffer) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > NOISE) n++;
  return n / a.length;
}

/** Least-squares cubic through (xs, ys), evaluated at x0. */
function cubicAt(xs: number[], ys: number[], x0: number) {
  // Normal equations on x centred at x0, so the value at x0 is the constant term.
  const m = Array.from({ length: 4 }, () => new Array(5).fill(0));
  for (let k = 0; k < xs.length; k++) {
    const t = xs[k] - x0;
    const p = [1, t, t * t, t * t * t];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) m[i][j] += p[i] * p[j];
      m[i][4] += p[i] * ys[k];
    }
  }
  for (let c = 0; c < 4; c++) {
    let pivot = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    if (Math.abs(m[c][c]) < 1e-12) return Number.NaN;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let j = c; j < 5; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m[0][4] / m[0][0];
}

/** How far a path strays from a smooth one: rms of each point against a cubic through its nine neighbours. */
export function judder(path: number[]) {
  const residuals: number[] = [];
  for (let i = 4; i < path.length - 4; i++) {
    const xs = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((d) => i + d);
    const fit = cubicAt(
      xs,
      xs.map((x) => path[x]),
      i,
    );
    if (Number.isFinite(fit)) residuals.push(path[i] - fit);
  }
  if (residuals.length === 0) return 0;
  return Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length);
}

/** Changes of direction along a path, ignoring steps under `eps`. */
export function turns(path: number[], eps = 0.01) {
  let sign = 0;
  let n = 0;
  for (let i = 1; i < path.length; i++) {
    const d = path[i] - path[i - 1];
    if (!Number.isFinite(d) || Math.abs(d) < eps) continue;
    const s = Math.sign(d);
    if (sign && s !== sign) n++;
    sign = s;
  }
  return n;
}

export type MeasureOptions = { shot?: string; from?: string; to?: string; crop?: Region };

export async function measure(videoId: string, o: MeasureOptions = {}) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const r = await openRenderer(browser, url, videoId, 1);
  const { info } = r;
  const shot = o.shot ? info.shots.find((s) => s.id === o.shot) : undefined;
  if (o.shot && !shot) throw new Error(`No shot "${o.shot}". Shots: ${info.shots.map((s) => s.id).join(", ")}`);
  const from = o.from !== undefined ? resolveFrame(info, o.from, o.shot) : (shot?.from ?? 0);
  const to =
    o.to !== undefined
      ? resolveFrame(info, o.to, o.shot)
      : shot
        ? shot.from + shot.duration - 1
        : info.durationInFrames - 1;
  if (to - from < 9) throw new Error("measure needs at least ten frames");

  const greys: Buffer[] = [];
  let width = 0;
  for (let f = from; f <= to; f++) {
    await r.seek(f);
    const png = await r.shoot("png", 92, 1, o.crop);
    const { data, info: size } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    greys.push(data);
    width = size.width;
  }
  await browser.close();

  const background = modal(greys[0]);
  const inks = greys.map((g) => ink(g, width, background));
  const motion = greys.map((g, i) => (i === 0 ? 0 : changed(greys[i - 1], g)));
  const moving = motion.map((m) => m > MOVING);

  // Lands: the last moving frame followed by a quiet run (or nothing moves after it).
  let start = moving.indexOf(true);
  let lands = -1;
  for (let i = moving.length - 1; i >= 0; i--) {
    if (!moving[i]) continue;
    const quiet = moving.slice(i + 1, i + 1 + QUIET);
    if (quiet.length === QUIET && quiet.every((m) => !m)) lands = i;
    else if (i + 1 + QUIET > moving.length) lands = -1;
    break;
  }
  if (start < 0) start = 0;
  const end = lands >= 0 ? lands : moving.length - 1;
  const xs = inks.slice(start, end + 1).map((k) => k.x);
  const ys = inks.slice(start, end + 1).map((k) => k.y);
  const speed =
    ys.length > 1
      ? ys.slice(1).reduce((a, y, i) => a + Math.hypot(y - ys[i], xs[i + 1] - xs[i]), 0) / (ys.length - 1)
      : 0;
  const result = {
    video: videoId,
    shot: o.shot,
    from,
    to,
    crop: o.crop,
    moves: moving.some(Boolean) ? from + start : null,
    lands: lands >= 0 ? from + lands : null,
    holds: lands >= 0 ? to - (from + lands) : 0,
    judder: { x: judder(xs), y: judder(ys) },
    turns: { x: turns(xs), y: turns(ys) },
    speed,
    frames: inks.map((k, i) => ({ frame: from + i, x: k.x, y: k.y, ink: k.weight, changed: motion[i] })),
  };

  const rel = (f: number) => `f${f} (${describeFrame(info, f, o.shot).label})`;
  const lines = [
    result.moves === null
      ? "nothing moves"
      : result.lands === null
        ? `moves from ${rel(result.moves)} and is still moving at ${rel(to)}`
        : `moves from ${rel(result.moves)}, lands ${rel(result.lands)}, then holds ${result.holds} frames`,
    `ink centre moves ${speed.toFixed(2)} px a frame on average while moving`,
    `judder ${result.judder.y.toFixed(3)} px vertically (${result.turns.y} turns), ${result.judder.x.toFixed(3)} px horizontally (${result.turns.x} turns)`,
  ];
  const worst = Math.max(result.judder.x, result.judder.y);
  // The ink's centre is the whole picture's: things entering and leaving move it too, so judder
  // names a cause only for one element (a crop, or a shot that shows one).
  if (worst > JUDDER && speed < 1)
    lines.push(
      o.crop
        ? `shakes: ${worst.toFixed(2)} px of judder on motion of ${speed.toFixed(2)} px a frame. Type scaled about its centre does this; scale it about its baseline (useBaseline; Slam and Reveal do)`
        : `${worst.toFixed(2)} px of judder on motion of ${speed.toFixed(2)} px a frame. If one element moves here, it shakes: type scaled about its centre does this (scale it about its baseline: useBaseline; Slam and Reveal do). If several do, things entering and leaving move the ink's centre too: --crop to one element before reading it`,
    );
  const file = join(
    outDir(videoId, "measure"),
    `${o.shot ?? "all"}-${from}-${to}${o.crop ? `-${o.crop.x}x${o.crop.y}` : ""}.json`,
  );
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  return { lines, file: relative(process.cwd(), file) || file, result };
}
