import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { useFrame, useVideoInfo, waitFor } from "../engine/index.js";
import type { Rect } from "./camera.js";
import type { CursorKey } from "./cursor.js";
import type { ProductLook } from "./look.js";

/** Written by `pnpm launch capture` next to the frames folder. */
export type CaptureManifest = {
  name: string;
  /** Served path of the frames folder, e.g. "/videos/x/captures/search/". */
  dir: string;
  url: string;
  fps: number;
  /** Viewport in CSS pixels. Frames are this × `scale`. */
  width: number;
  height: number;
  scale: number;
  frames: number;
  format: "jpg" | "png";
  marks: CaptureMark[];
  /** Names of vector snapshots taken (see <Snapshot>). */
  snapshots?: string[];
  /** The product's fonts and colours as each snapshot showed them (see `useProductLook`). */
  looks?: Record<string, ProductLook>;
  /** Every pointer move the script made, for a synthetic cursor that matches. */
  pointer?: PointerMove[];
};

export type PointerMove = {
  /** Capture frames the move starts and ends on. */
  start: number;
  end: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  click: boolean;
};

export type CaptureMark = {
  name: string;
  /** Capture frame when it was recorded (a click happens on this frame). */
  frame: number;
  kind: "mark" | "click" | "type" | "scroll";
  /** Element box in viewport CSS pixels at that frame. */
  rect: Rect;
};

const pad = (n: number) => String(n).padStart(6, "0");
const frameSrc = (m: CaptureManifest, i: number) => `${m.dir}${pad(i)}.${m.format}`;

// Studio playback preloads ahead so frames are decoded before they are needed.
const cache = new Map<string, HTMLImageElement>();
function preload(src: string) {
  if (cache.has(src)) return;
  const img = new Image();
  img.src = src;
  cache.set(src, img);
  if (cache.size > 600) cache.delete(cache.keys().next().value as string);
}

/** Look up a recorded mark. Throws with the known names if it is missing. */
export function mark(m: CaptureManifest, name: string): CaptureMark {
  const found = m.marks.find((x) => x.name === name);
  if (!found)
    throw new Error(`Capture "${m.name}" has no mark "${name}". Marks: ${m.marks.map((x) => x.name).join(", ")}`);
  return found;
}

/**
 * The box of one or more marks, in content pixels: `"editor:instructions"`,
 * or a union of several, `"editor:instructions+editor:options"` (or an array
 * of names). Framings written as mark names follow the capture when a
 * recapture moves the UI, where numbers would frame whatever is there now.
 */
export function markRect(m: CaptureManifest, names: string | readonly string[]): Rect {
  const list = (typeof names === "string" ? names.split("+") : names).map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) throw new Error(`markRect: no mark names given for capture "${m.name}"`);
  const rects = list.map((n) => mark(m, n).rect);
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Play a captured frame sequence. One capture frame per video frame by
 * default; `start` skips into it and `rate` retimes it. Holds the last
 * frame when the capture runs out. Laid out at the capture's CSS size, so
 * the extra pixels of a 2× capture are there when a Camera pushes in.
 */
export function Capture({
  source,
  start = 0,
  rate = 1,
  style,
}: {
  source: CaptureManifest;
  start?: number;
  rate?: number;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const ref = useRef<HTMLImageElement>(null);
  const index = Math.max(0, Math.min(source.frames - 1, Math.round(start + frame * rate * (source.fps / fps))));
  const src = frameSrc(source, index);

  useLayoutEffect(() => {
    const img = ref.current;
    if (!img) return;
    waitFor(
      img.decode().catch(() => {}),
      `Capture ${img.src.split("/").slice(-2).join("/")}`,
    );
    for (let i = 1; i <= 30 && index + i < source.frames; i++) preload(frameSrc(source, index + i));
  }, [index, source]);

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      style={{ position: "absolute", left: 0, top: 0, width: source.width, height: source.height, ...style }}
    />
  );
}

/**
 * Cursor keys that retrace the capture's pointer, in sequence frames. Put the
 * <Cursor> in the same coordinates as the <Capture> and they line up exactly.
 */
export function cursorKeys(source: CaptureManifest, fps: number, start = 0, rate = 1): CursorKey[] {
  const moves = source.pointer ?? [];
  if (moves.length === 0) return [];
  const t = (f: number) => captureTime(source, f, fps, start, rate);
  return [
    { at: t(moves[0].start), to: moves[0].from },
    ...moves.map((m) => ({ at: t(m.end), travel: t(m.end) - t(m.start), to: m.to, click: m.click, arc: 0 })),
  ];
}

/** Sequence frame at which capture frame `captureFrame` shows, for a given start and rate. */
export const captureTime = (source: CaptureManifest, captureFrame: number, fps: number, start = 0, rate = 1) =>
  (captureFrame - start) / (rate * (source.fps / fps));
