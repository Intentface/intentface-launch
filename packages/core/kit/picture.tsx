import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { declareText, waitFor } from "../engine/index.js";
import { useFontsReady } from "./fonts.js";

/*
 * Pictures drawn once on a canvas and kept as image URLs: every copy shows
 * the same decoded bitmap. For text under a camera that keeps moving (DOM
 * text snaps its glyphs to whole pixels and steps a pixel at a time; a
 * picture scales smoothly), for anything a page curl or a page flip copies
 * into each of its strips (an image survives that, a large canvas per copy
 * does not), and for the shaders add-on's textures and masks.
 */

export type CanvasPicture = {
  /** Names the drawing, for the cache: the same key is the same picture. */
  key: string;
  /** The picture's size in CSS pixels; drawn at `scale` device pixels per CSS pixel (default 2). */
  width: number;
  height: number;
  scale?: number;
  /** Fonts the drawing uses (CSS shorthands), loaded before it draws. */
  fonts?: string[];
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const made = new Map<string, string>();
const making = new Map<string, Promise<string>>();

async function make(source: CanvasPicture): Promise<string> {
  await Promise.all((source.fonts ?? []).map((font) => document.fonts.load(font)));
  const scale = source.scale ?? 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Picture: no 2D canvas");
  ctx.scale(scale, scale);
  source.draw(ctx);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error(`Picture ${source.key}: the canvas gave no image`);
  return URL.createObjectURL(blob);
}

/** A picture's URL, drawn once per key for the page. */
export function picture(source: CanvasPicture): Promise<string> {
  const known = made.get(source.key);
  if (known) return Promise.resolve(known);
  let job = making.get(source.key);
  if (!job) {
    job = make(source).then((url) => {
      made.set(source.key, url);
      making.delete(source.key);
      return url;
    });
    making.set(source.key, job);
  }
  return job;
}

/** Pictures' URLs: null until drawn, and the frame waits for them. */
export function usePictures(sources: CanvasPicture[]): (string | null)[] {
  const key = sources.map((s) => s.key).join("\n");
  const [, bump] = useState(0);
  const now = sources.map((s) => made.get(s.key) ?? null);

  useLayoutEffect(() => {
    if (sources.every((s) => made.has(s.key))) return;
    waitFor(
      Promise.all(sources.map(picture)).then(() => flushSync(() => bump((n) => n + 1))),
      "Pictures",
    );
    // `key` names the sources.
  }, [key]);

  return now;
}

let probe: CanvasRenderingContext2D | null = null;

/** A line's ink box from the left end of its baseline, as the canvas lays it out. */
function inkOf(text: string, font: string, spacing: number) {
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Picture: no 2D canvas");
  probe.font = font;
  probe.letterSpacing = `${spacing}px`;
  const m = probe.measureText(text);
  return {
    left: m.actualBoundingBoxLeft,
    right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
  };
}

export type TextImageProps = {
  text: string;
  /** A CSS font shorthand with its size in px: `'400 44px "Intent Sans"'`. */
  font: string;
  color?: string;
  /** Where the baseline sits, in the parent's CSS pixels: its left end, middle or right end by `align`. */
  x: number;
  y: number;
  align?: "left" | "center" | "right";
  /** Extra space between letters, in em. */
  letterSpacing?: number;
  /** Device pixels per CSS pixel the picture is drawn at: at least the largest zoom it is seen at (default 4). */
  scale?: number;
  /**
   * Declare it for `check` (reading time, size, contrast), as DOM text would
   * be (default true). Turn it off for text inside a page flip or a curl,
   * which copies it into every strip: declare it once, outside, instead.
   */
  declare?: boolean;
  /** Type larger than the frame on purpose: `check` skips the safe margin. */
  bleed?: boolean;
  style?: CSSProperties;
};

/**
 * A line of text as a picture: drawn once at `scale`, shown as an image laid
 * exactly where the text would be, so a camera can push in on it all the
 * while and it scales smoothly instead of stepping a pixel at a time. The
 * frame waits for its font and its picture.
 */
export function TextImage({
  text,
  font,
  color = "#fff",
  x,
  y,
  align = "left",
  letterSpacing = 0,
  scale = 4,
  declare = true,
  bleed,
  style,
}: TextImageProps) {
  const ready = useFontsReady(font, text);
  const declared = useRef<HTMLCanvasElement>(null);
  const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  const weight = Number(/\b([1-9]00)\b/.exec(font)?.[1] ?? 400);
  const spacing = letterSpacing * size;
  // Room round the ink, so antialiased edges are never cut by the picture's own.
  const pad = Math.ceil(size * 0.1) + 2;
  const ink = ready ? inkOf(text, font, spacing) : null;
  const box = ink && {
    width: ink.left + ink.right + pad * 2,
    height: ink.ascent + ink.descent + pad * 2,
  };
  const anchor = ink
    ? align === "center"
      ? (ink.right - ink.left) / 2
      : align === "right"
        ? ink.right
        : -ink.left
    : 0;
  const [url] = usePictures(
    ink && box
      ? [
          {
            key: `text|${font}|${color}|${letterSpacing}|${scale}|${text}`,
            width: box.width,
            height: box.height,
            scale,
            fonts: [font],
            draw: (ctx) => {
              ctx.font = font;
              ctx.letterSpacing = `${spacing}px`;
              ctx.textBaseline = "alphabetic";
              ctx.fillStyle = color;
              ctx.fillText(text, pad + ink.left, pad + ink.ascent);
            },
          },
        ]
      : [],
  );
  const left = ink ? x - anchor - ink.left - pad : x;
  const top = ink ? y - ink.ascent - pad : y;
  useLayoutEffect(() => {
    const canvas = declared.current;
    if (!canvas || !ink) return;
    declareText(canvas, [
      {
        text,
        x: pad,
        y: pad,
        width: ink.left + ink.right,
        height: ink.ascent + ink.descent,
        size,
        weight,
        bleed,
      },
    ]);
  });
  if (!box) return null;
  const place: CSSProperties = { position: "absolute", left, top, width: box.width, height: box.height, ...style };
  return (
    <>
      {url && <img alt="" src={url} decoding="sync" data-launch-check="off" style={place} />}
      {declare && <canvas ref={declared} width={1} height={1} style={place} />}
    </>
  );
}
