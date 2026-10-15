import type { DeclaredText } from "@intentface-launch/core";
import type { CanvasPicture } from "@intentface-launch/core/kit";
import type { ComponentConfig } from "shaders/core";

/*
 * Pictures as inputs for the library's filters and masks (Halftone, Ascii,
 * CRTScreen, Dither, Glass over a word, a mask a plasma fills): drawn on a
 * canvas in the page, in the video's own fonts, and handed to `ImageTexture`
 * as a URL. And a video file's frames, frame exact, for the library's
 * `VideoTexture`, which plays on the wall clock.
 */

// Pictures are core's (the kit draws text and stills the same way); re-exported here for ImageTexture.
export { type CanvasPicture, picture, usePictures } from "@intentface-launch/core/kit";

/**
 * A video file's frame at `seconds` as an `ImageTexture` node, frame exact
 * (the frames `<Clip>` shows), so a shader can refract, dither or print a
 * clip: `clipTexture("/videos/x/media/clip.mp4", start + frame / fps)`.
 * `objectFit` defaults to `cover`.
 */
export function clipTexture(
  src: string,
  seconds: number,
  props: Record<string, unknown> & { objectFit?: "cover" | "contain" | "fill" | "scale-down" } = {},
  id?: string,
): ComponentConfig {
  const url = `/__launch/clip?src=${encodeURIComponent(src)}&t=${Math.max(0, seconds).toFixed(5)}`;
  return { type: "ImageTexture", id, props: { objectFit: "cover", ...props, url } };
}

/**
 * A node's `transform` that scales and turns it about `anchor` (a point in the
 * layer, CSS pixels; default its centre), then moves it by (dx, dy) CSS
 * pixels (y down). The library takes offsets as fractions of the layer, in
 * the space after its scale and rotation; this takes plain pixels. Moves a
 * picture drawn once (a shadow, a word) every frame without drawing it again.
 */
export function shift(
  dx: number,
  dy: number,
  {
    scale = 1,
    rotation = 0,
    anchor,
    frame = [1920, 1080],
  }: { scale?: number; rotation?: number; anchor?: [number, number]; frame?: [number, number] } = {},
) {
  const [w, h] = frame;
  const [ax, ay] = anchor ?? [w / 2, h / 2];
  const r = (rotation * Math.PI) / 180;
  const ox = (dx * Math.cos(r) - dy * Math.sin(r)) / scale;
  const oy = (dx * Math.sin(r) + dy * Math.cos(r)) / scale;
  return { offsetX: ox / w, offsetY: oy / h, scale, rotation, anchorX: ax / w, anchorY: ay / h };
}

export type TextPicture = {
  text: string;
  /** A CSS font shorthand with its size in px. */
  font: string;
  /** Where the text's baseline starts (or its centre or end, by `align`), in the layer's CSS pixels. */
  x: number;
  y: number;
  color?: string;
  align?: CanvasTextAlign;
  /** In em. */
  letterSpacing?: number;
  /** The layer's size (default 1920 × 1080). */
  frame?: [number, number];
};

/**
 * A line of text as a full-layer picture, in a font the page has loaded,
 * for `ImageTexture` (a filter to work on, a mask for a plasma, a label under
 * a glass cursor), with the text it shows for `Shaders`' `text`, so `check`
 * still reads it. Draw it once and move it with `shift`.
 */
export function textPicture(spec: TextPicture): {
  picture: CanvasPicture;
  text: (options?: { dx?: number; dy?: number; scale?: number; opacity?: number }) => DeclaredText[];
} {
  const [w, h] = spec.frame ?? [1920, 1080];
  const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(spec.font)?.[1] ?? "16");
  const weight = Number(/\b([1-9]00)\b/.exec(spec.font)?.[1] ?? 400);
  const key = `text|${spec.font}|${spec.text}|${spec.x},${spec.y}|${spec.color}|${spec.align}|${spec.letterSpacing}|${w}x${h}`;
  const setUp = (ctx: CanvasRenderingContext2D) => {
    ctx.font = spec.font;
    ctx.letterSpacing = `${(spec.letterSpacing ?? 0) * size}px`;
    ctx.textAlign = spec.align ?? "left";
    ctx.textBaseline = "alphabetic";
  };
  return {
    picture: {
      key,
      width: w,
      height: h,
      fonts: [spec.font],
      draw: (ctx) => {
        setUp(ctx);
        ctx.fillStyle = spec.color ?? "#fff";
        ctx.fillText(spec.text, spec.x, spec.y);
      },
    },
    text: ({ dx = 0, dy = 0, scale = 1, opacity = 1 } = {}) => {
      const ctx = measurer();
      setUp(ctx);
      const m = ctx.measureText(spec.text);
      const left = spec.x - m.actualBoundingBoxLeft;
      const top = spec.y - m.actualBoundingBoxAscent;
      const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      // Scaled about the layer's centre, as `shift` scales by default.
      const sx = (v: number) => w / 2 + (v - w / 2) * scale + dx;
      const sy = (v: number) => h / 2 + (v - h / 2) * scale + dy;
      return [
        {
          text: spec.text,
          x: sx(left),
          y: sy(top),
          width: width * scale,
          height: height * scale,
          size: size * scale,
          weight,
          opacity,
        },
      ];
    },
  };
}

let probe: CanvasRenderingContext2D | null = null;
function measurer() {
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Picture: no 2D canvas");
  return probe;
}
