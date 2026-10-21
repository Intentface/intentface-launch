import sharp from "sharp";
import type { BlurRequest } from "../engine/timeline.js";
import type { Region, Renderer } from "./browser.js";

export type GrabOptions = {
  /** Global supersampling on top of what the layers ask for (1 = none). */
  samples?: number;
  angle?: number;
  phase?: number;
  /** Timeline frames one output frame spans (2 when rendering 60 fps at 30). */
  step?: number;
  /** Ignore layer blur requests (quick previews). */
  noBlur?: boolean;
  format?: "png" | "jpeg";
  /** Only this part of the frame, in CSS pixels. */
  region?: Region;
  /**
   * RGBA out (straight alpha) instead of RGB: `"page"` keeps the page's own transparency (open the
   * renderer with `alpha`), `"black"` keys light on black by brightness (see `unmultiply`).
   */
  alpha?: "page" | "black";
};

/**
 * Sample times for one output frame, as After Effects does it: N samples
 * across the open shutter, each at the centre of its slice of the exposure.
 */
export function subframes(frame: number, samples: number, angle: number, phase: number, step = 1) {
  if (samples <= 1) return [frame];
  return Array.from({ length: samples }, (_, i) =>
    Math.max(0, frame + ((phase + ((i + 0.5) * angle) / samples) / 360) * step),
  );
}

async function toRaw(image: Buffer, expect: { width: number; height: number }, channels: 3 | 4 = 3) {
  const decoded = channels === 4 ? sharp(image).ensureAlpha() : sharp(image).removeAlpha();
  const { data, info } = await decoded.raw().toBuffer({ resolveWithObject: true });
  // Chrome leaves white under fully transparent pixels: black there, so an editor that reads the
  // file as premultiplied does not lay a white haze over the picture.
  if (channels === 4) for (let i = 3; i < data.length; i += 4) if (data[i] === 0) data.fill(0, i - 3, i);
  if (info.width !== expect.width || info.height !== expect.height) {
    throw new Error(`Captured ${info.width}×${info.height}, expected ${expect.width}×${expect.height}`);
  }
  return data;
}

/**
 * Light on black as straight RGBA, keyed by brightness (After Effects' Unmult): alpha is the
 * brightest channel and the colour is divided by it. Laid over black it gives the frame back;
 * over other footage, light stays light and black is not there.
 */
export function unmultiply(rgb: Buffer): Buffer {
  const out = Buffer.allocUnsafe((rgb.length / 3) * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const r = rgb[i];
    const g = rgb[i + 1];
    const b = rgb[i + 2];
    const a = Math.max(r, g, b);
    out[o] = a ? Math.round((r * 255) / a) : 0;
    out[o + 1] = a ? Math.round((g * 255) / a) : 0;
    out[o + 2] = a ? Math.round((b * 255) / a) : 0;
    out[o + 3] = a;
  }
  return out;
}

/** The mean of straight-alpha RGBA frames, averaged premultiplied (as the shutter would see them). */
function averageRgba(raws: Buffer[]): Buffer {
  const length = raws[0].length;
  const out = Buffer.allocUnsafe(length);
  const n = raws.length;
  for (let i = 0; i < length; i += 4) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (const raw of raws) {
      const alpha = raw[i + 3];
      r += raw[i] * alpha;
      g += raw[i + 1] * alpha;
      b += raw[i + 2] * alpha;
      a += alpha;
    }
    out[i] = a ? Math.round(r / a) : 0;
    out[i + 1] = a ? Math.round(g / a) : 0;
    out[i + 2] = a ? Math.round(b / a) : 0;
    out[i + 3] = Math.round(a / n);
  }
  return out;
}

/**
 * One finished output frame as raw RGB24 (RGBA with `alpha`). Seeks once to learn whether any
 * <MotionBlur> layer is moving; if so, captures the subframes and averages
 * them in 32-bit sums, so dark gradients keep their precision.
 */
export async function grab(
  r: Renderer,
  frame: number,
  o: GrabOptions = {},
): Promise<{ raw: Buffer; blurred: boolean }> {
  const format = o.format ?? "png";
  const area = o.region ?? { x: 0, y: 0, width: r.info.width, height: r.info.height };
  const size = { width: Math.round(area.width * r.scale), height: Math.round(area.height * r.scale) };
  // JPEG has no alpha.
  const shoot = () => r.shoot(o.alpha === "page" ? "png" : format, 90, r.scale, o.region);
  const channels = o.alpha === "page" ? 4 : 3;
  const finish = (raw: Buffer) => (o.alpha === "black" ? unmultiply(raw) : raw);
  const request: BlurRequest | null = await r.seek(frame);
  const global = o.samples ?? 1;
  const layer = !o.noBlur && request ? request : null;
  const samples = Math.max(global, layer?.samples ?? 1);
  if (samples <= 1) return { raw: finish(await toRaw(await shoot(), size, channels)), blurred: false };

  const angle = layer?.angle ?? o.angle ?? 180;
  const phase = layer?.phase ?? o.phase ?? -angle / 2;
  const times = subframes(frame, samples, angle, phase, o.step ?? 1);
  const shots: Buffer[] = [];
  for (const t of times) {
    await r.seek(t);
    shots.push(await shoot());
  }
  // Nothing changed across the shutter (a global supersample on a still frame).
  if (shots[0].equals(shots[shots.length - 1]) && !layer)
    return { raw: finish(await toRaw(shots[0], size, channels)), blurred: false };
  const raws = await Promise.all(shots.map((shot) => toRaw(shot, size, channels)));
  if (channels === 4) return { raw: averageRgba(raws), blurred: true };
  const sums = new Uint32Array(raws[0].length);
  for (const raw of raws) for (let i = 0; i < raw.length; i++) sums[i] += raw[i];
  const out = Buffer.allocUnsafe(sums.length);
  const n = raws.length;
  const half = n >> 1;
  for (let i = 0; i < sums.length; i++) out[i] = (sums[i] + half) / n;
  return { raw: finish(out), blurred: true };
}

export const encodePng = (raw: Buffer, width: number, height: number, channels: 3 | 4 = 3) =>
  sharp(raw, { raw: { width, height, channels } }).png().toBuffer();

export const encodeJpeg = (raw: Buffer, width: number, height: number, quality = 84) =>
  sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
