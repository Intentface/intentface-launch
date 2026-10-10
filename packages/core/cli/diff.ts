import { existsSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { launchBrowser, openRenderer, type Region, type Renderer, startServer } from "./browser.js";
import { grab } from "./frames.js";
import { describeFrame, resolveFrame, tileImage } from "./review.js";
import { outDir } from "./util.js";

/** How far apart two images are. */
export type Difference = {
  /** Mean absolute difference per channel, 0 to 255. */
  mean: number;
  /** Largest difference of any channel of any pixel, 0 to 255. */
  max: number;
  /** Fraction of pixels whose largest channel difference is over `threshold`. */
  changed: number;
  threshold: number;
  /** Where those pixels are, in the images' pixels; null when none are. */
  box: Region | null;
};

/** Levels (of 255) under which a pixel counts as the same: encoding and anti-aliasing noise. */
export const THRESHOLD = 16;

/**
 * Compares two RGB24 images of the same size. Also returns a picture of the
 * difference: the first image dimmed to grey, with every changed pixel in
 * magenta, full strength from 48 levels.
 */
export function compareImages(a: Buffer, b: Buffer, width: number, height: number, threshold = THRESHOLD) {
  if (a.length !== b.length || a.length !== width * height * 3) throw new Error("compareImages: sizes differ");
  const image = Buffer.alloc(a.length);
  let sum = 0;
  let max = 0;
  let changed = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    const d = Math.max(dr, dg, db);
    sum += dr + dg + db;
    if (d > max) max = d;
    if (d > threshold) {
      changed++;
      const x = p % width;
      const y = (p - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const grey = (0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]) * 0.35;
    const k = Math.min(1, d / 48);
    image[i] = grey + (255 - grey) * k;
    image[i + 1] = grey * (1 - k);
    image[i + 2] = grey + (160 - grey) * k;
  }
  const diff: Difference = {
    mean: Math.round((sum / a.length) * 100) / 100,
    max,
    changed: changed / (width * height),
    threshold,
    box: x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 },
  };
  return { diff, image };
}

/** "0.8% of pixels over 16 levels (max 180, mean 0.42), in 812,420 300×88", or "identical". */
export function describeDifference(d: Difference, offset: { x: number; y: number } = { x: 0, y: 0 }, scale = 1) {
  if (!d.box) return d.max === 0 ? "identical" : `no pixel over ${d.threshold} levels (max ${d.max}, mean ${d.mean})`;
  const pct = d.changed * 100;
  const where = `${Math.round(offset.x + d.box.x / scale)},${Math.round(offset.y + d.box.y / scale)} ${Math.round(d.box.width / scale)}×${Math.round(d.box.height / scale)}`;
  return `${pct < 0.01 ? pct.toFixed(4) : pct.toFixed(2)}% of pixels over ${d.threshold} levels (max ${d.max}, mean ${d.mean}), in ${where}`;
}

const isImage = (s: string) => /\.(png|jpe?g|webp)$/i.test(s);

/** An image file as RGB24 at `size` (the video's frame at the compared scale), then cropped. */
async function imageFile(file: string, size: { width: number; height: number }, crop: Region | null) {
  const path = resolve(process.cwd(), file);
  // Resized to the frame first, so a crop names the same pixels in both.
  const full = await sharp(path).removeAlpha().resize(size.width, size.height, { fit: "fill" }).raw().toBuffer();
  if (!crop) return full;
  return sharp(full, { raw: { width: size.width, height: size.height, channels: 3 } })
    .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .raw()
    .toBuffer();
}

export type DiffOptions = {
  /** The frame to look at, named as `still --at` names it. */
  frame: string;
  /** What to compare it with: another frame name, or an image file (.png, .jpg). */
  against: string;
  /** The video `against` is a frame of (default: the same video). */
  againstVideo?: string;
  /** Frames count from this shot's start. */
  shot?: string;
  /** Only this region, in video pixels. */
  crop?: Region;
  /** Magnification of the crop (default: about 960 px wide). */
  zoom?: number;
  /** Tile width in the image (default: the crop's size, else 640). */
  size?: number;
  /** Levels (of 255) under which a pixel counts as the same (default 16). */
  threshold?: number;
};

/**
 * Two frames side by side with their difference, to prove a handoff (3D to
 * SVG, capture to snapshot, animation to the static logo) lands pixel for
 * pixel. Frames render as `still` renders them, motion blur included.
 */
export async function diff(videoId: string, o: DiffOptions) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const crop = o.crop && {
    x: Math.round(o.crop.x),
    y: Math.round(o.crop.y),
    width: Math.round(o.crop.width),
    height: Math.round(o.crop.height),
  };
  const zoom = crop ? (o.zoom ?? Math.min(4, Math.max(1, Math.round(960 / crop.width)))) : 1;
  const file = isImage(o.against) && !o.againstVideo ? resolve(process.cwd(), o.against) : null;
  if (file && !existsSync(file)) throw new Error(`No image ${o.against}`);
  let r = await openRenderer(browser, url, videoId, 1);
  // Against a file, compare at the file's resolution (a 1080p still at 1×,
  // a 4K one at 2×) and magnify only for the picture; frames render at the zoom.
  const meta = file ? await sharp(file).metadata() : null;
  const scale = meta?.width ? meta.width / r.info.width : zoom;
  if (scale !== 1) {
    await r.close();
    r = await openRenderer(browser, url, videoId, scale);
  }
  const area = crop ?? { x: 0, y: 0, width: r.info.width, height: r.info.height };
  const w = Math.round(area.width * scale);
  const h = Math.round(area.height * scale);
  const region = crop && { x: area.x, y: area.y, width: area.width, height: area.height };

  const frameOf = async (renderer: Renderer, token: string) => {
    const frame = resolveFrame(renderer.info, token, renderer === r ? o.shot : undefined);
    const { raw } = await grab(renderer, frame, { region });
    const d = describeFrame(renderer.info, frame);
    const prefix = renderer === r ? "" : `${renderer.info.id} `;
    return { raw, caption: `${prefix}f${frame} · ${d.label}${d.note ? ` · ${d.note}` : ""}`, name: `f${frame}` };
  };

  const a = await frameOf(r, o.frame);
  let b: { raw: Buffer; caption: string; name: string };
  if (file && meta) {
    const size = { width: Math.round(r.info.width * scale), height: Math.round(r.info.height * scale) };
    const scaled = crop && {
      x: Math.round(crop.x * scale),
      y: Math.round(crop.y * scale),
      width: w,
      height: h,
    };
    const resized = Math.abs(meta.width / (meta.height ?? 1) - r.info.width / r.info.height) > 0.01;
    b = {
      raw: await imageFile(file, size, scaled ?? null),
      caption: `${basename(file)} (${meta.width}×${meta.height}${resized ? ", other shape: stretched" : ""})`,
      name: basename(file).replace(/\.\w+$/, ""),
    };
  } else if (o.againstVideo && o.againstVideo !== videoId) {
    const other = await openRenderer(browser, url, o.againstVideo, scale);
    if (other.info.width !== r.info.width || other.info.height !== r.info.height)
      throw new Error(
        `${o.againstVideo} is ${other.info.width}×${other.info.height}, ${videoId} is ${r.info.width}×${r.info.height}`,
      );
    b = await frameOf(other, o.against);
    b.name = `${o.againstVideo}-${b.name}`;
  } else b = await frameOf(r, o.against);

  const { diff: d, image } = compareImages(a.raw, b.raw, w, h, o.threshold);
  const tile = o.size ?? (crop ? Math.round(area.width * zoom) : Math.min(w, 640));
  const tiles = await Promise.all(
    [a.raw, b.raw, image].map(async (raw) => {
      const png = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
        .resize(tile, null, { kernel: tile > w ? "nearest" : "lanczos3" })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString("base64")}`;
    }),
  );
  const summary = describeDifference(d, area, scale);
  const png = await tileImage(
    browser,
    [
      { src: tiles[0], caption: a.caption },
      { src: tiles[1], caption: b.caption },
      { src: tiles[2], caption: `difference: ${summary}` },
    ],
    { columns: 3, width: tile, height: Math.round((tile * h) / w) },
  );
  await browser.close();
  const out = join(
    outDir(videoId, "diffs"),
    `${a.name}-vs-${b.name}${crop ? `-crop${crop.x}_${crop.y}_${crop.width}x${crop.height}` : ""}.png`,
  );
  writeFileSync(out, png);
  return { file: relative(process.cwd(), out) || out, a: a.caption, b: b.caption, summary, difference: d };
}
