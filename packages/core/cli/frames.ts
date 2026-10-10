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

async function toRaw(image: Buffer, expect: { width: number; height: number }) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== expect.width || info.height !== expect.height) {
    throw new Error(`Captured ${info.width}×${info.height}, expected ${expect.width}×${expect.height}`);
  }
  return data;
}

/**
 * One finished output frame as raw RGB24. Seeks once to learn whether any
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
  const shoot = () => r.shoot(format, 90, r.scale, o.region);
  const request: BlurRequest | null = await r.seek(frame);
  const global = o.samples ?? 1;
  const layer = !o.noBlur && request ? request : null;
  const samples = Math.max(global, layer?.samples ?? 1);
  if (samples <= 1) return { raw: await toRaw(await shoot(), size), blurred: false };

  const angle = layer?.angle ?? o.angle ?? 180;
  const phase = layer?.phase ?? o.phase ?? -angle / 2;
  const times = subframes(frame, samples, angle, phase, o.step ?? 1);
  const shots: Buffer[] = [];
  for (const t of times) {
    await r.seek(t);
    shots.push(await shoot());
  }
  // Nothing changed across the shutter (a global supersample on a still frame).
  if (shots[0].equals(shots[shots.length - 1]) && !layer) return { raw: await toRaw(shots[0], size), blurred: false };
  const raws = await Promise.all(shots.map((shot) => toRaw(shot, size)));
  const sums = new Uint32Array(raws[0].length);
  for (const raw of raws) for (let i = 0; i < raw.length; i++) sums[i] += raw[i];
  const out = Buffer.allocUnsafe(sums.length);
  const n = raws.length;
  const half = n >> 1;
  for (let i = 0; i < sums.length; i++) out[i] = (sums[i] + half) / n;
  return { raw: out, blurred: true };
}

export const encodePng = (raw: Buffer, width: number, height: number) =>
  sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();

export const encodeJpeg = (raw: Buffer, width: number, height: number, quality = 84) =>
  sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
