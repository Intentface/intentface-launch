import { type DeclaredText, useVideoInfo, waitFor } from "@intentface-launch/core";
import { useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { serve } from "./reads.js";

/*
 * Shapes for the library's shape effects (Chrome, Glass, LiquidMetal,
 * Obsidian, Neon, ThinFilm, Frost, Plastic, Holographic, Emboss, …) from
 * anything a canvas can draw: a word in a font the page has loaded, an SVG
 * path, a logo. The library takes a custom shape as a signed distance field
 * (`shapeSdfUrl`: 512 × 512, distance in widths of the field, negative
 * inside) that shaders.com bakes on its server; this bakes it in the page,
 * so a headline in the video's own typeface can be chrome, glass or metal.
 */

/** The field's side, in texels: the size the library reads. */
const SIZE = 512;
/** Drawn at twice the field's size, then averaged down: edges a quarter texel exact. */
const SUPER = 2;
const INF = 1e20;

export type TextSource = {
  text: string;
  /** A CSS font shorthand with its size in CSS pixels: `'600 320px "Intent Sans"'`. The size is the shape's size on screen at scale 1. */
  font: string;
  /** Extra space between letters, in em (as CSS `letter-spacing`, but in em). */
  letterSpacing?: number;
};

export type PathSource = {
  /** SVG path data, one string or several (filled with the non-zero rule, as SVG does). */
  path: string | string[];
  /** The paths' coordinate box, `[x, y, width, height]`, as an SVG viewBox. */
  viewBox: [number, number, number, number];
  /** The shape's width on screen at scale 1, in CSS pixels (default the viewBox's). */
  width?: number;
};

export type DrawSource = {
  /** Draws the shape in white on a transparent canvas whose user space is `width` × `height`. */
  draw: (ctx: CanvasRenderingContext2D) => void;
  width: number;
  height: number;
  /** Names the drawing, for the cache: the same key is the same shape. */
  key: string;
};

export type ShapeSource = (TextSource | PathSource | DrawSource) & {
  /** Space around the shape inside the field, as a fraction of its side (default 0.08): room for bevels, rims and glows. */
  pad?: number;
};

/** A box in CSS pixels. */
type Box = { x: number; y: number; width: number; height: number };

export type ShapeAt = {
  /** Scale on top of the shape's own size (default 1). */
  scale?: number;
  /** Degrees, clockwise, about the shape's centre. */
  rotation?: number;
  /**
   * Extrude it into a solid (`svgExtrude3D`): `depth` and `bevel` in widths
   * of the field, `rotX`, `rotY`, `rotZ` in degrees. Effects that ray-march a
   * solid (Chrome, Glass, Plastic, …) then light its sides.
   */
  extrude?: { depth?: number; bevel?: number; rotX?: number; rotY?: number; rotZ?: number };
  /** The layer's size in CSS pixels (`useShapes` fills in the video's; `Shaders` `width`/`height` when they differ). */
  frame?: [number, number];
};

export type Shape = {
  /** The field, for a shape effect's `shapeSdfUrl`. */
  url: string;
  /** The shape's ink at scale 1, in CSS pixels. For text, relative to the text's origin (left end of the baseline). */
  box: Box;
  /** The field's side at scale 1, in CSS pixels. */
  side: number;
  /**
   * Props that put the shape's centre at (x, y), in the layer's CSS pixels:
   * spread them into a shape effect's props.
   *
   *   { type: "Chrome", props: { ...word.at(960, 540), bevelWidth: 0.01 } }
   */
  at(x: number, y: number, options?: ShapeAt): ShapeProps;
  /**
   * The text a text shape shows, centred at (x, y), for `Shaders`' `text` (so
   * `check` reads it as it reads DOM text). Empty for other shapes.
   */
  text(x: number, y: number, options?: { scale?: number; opacity?: number; bleed?: boolean }): DeclaredText[];
};

export type ShapeProps = {
  shapeSdfUrl: string;
  center: { x: number; y: number };
  scale: number;
  rotation: number;
  shapeType?: string;
  shape?: string;
};

// --- Baking ------------------------------------------------------------------------------

/** One row or column of the exact squared Euclidean distance transform (Felzenszwalb and Huttenlocher). */
function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

function edt2d(grid: Float64Array, n: number) {
  const f = new Float64Array(n);
  const v = new Uint16Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < n; x++) edt1d(grid, x, n, n, f, v, z);
  for (let y = 0; y < n; y++) edt1d(grid, y * n, 1, n, f, v, z);
}

/**
 * The field of what `paint` draws on an n × n canvas: from each pixel's
 * coverage, partly covered pixels placing the edge inside them (as TinySDF
 * does), then averaged down to SIZE and stored as the library's compact
 * format (uint16, distance in widths of the field, -1 → 0, 1 → 65535).
 */
function bake(paint: (ctx: CanvasRenderingContext2D, n: number) => void): ArrayBuffer {
  const n = SIZE * SUPER;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Shape: no 2D canvas");
  ctx.fillStyle = "#fff";
  paint(ctx, n);
  const alpha = ctx.getImageData(0, 0, n, n).data;
  const outer = new Float64Array(n * n);
  const inner = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const a = alpha[i * 4 + 3] / 255;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  edt2d(outer, n);
  edt2d(inner, n);
  const out = new Uint16Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let dy = 0; dy < SUPER; dy++) {
        for (let dx = 0; dx < SUPER; dx++) {
          const i = (y * SUPER + dy) * n + x * SUPER + dx;
          sum += Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
        }
      }
      const d = sum / (SUPER * SUPER) / n;
      out[y * SIZE + x] = Math.max(0, Math.min(65535, Math.round((d + 1) * 32767.5)));
    }
  }
  return out.buffer;
}

// --- Shapes ------------------------------------------------------------------------------

function measureInk(source: TextSource) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Shape: no 2D canvas");
  ctx.font = source.font;
  const size = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(source.font)?.[1] ?? "16");
  ctx.letterSpacing = `${(source.letterSpacing ?? 0) * size}px`;
  const m = ctx.measureText(source.text);
  return {
    size,
    box: {
      x: -m.actualBoundingBoxLeft,
      y: -m.actualBoundingBoxAscent,
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    },
  };
}

const keyOf = (source: ShapeSource) =>
  "text" in source
    ? `text|${source.font}|${source.letterSpacing ?? 0}|${source.pad ?? ""}|${source.text}`
    : "path" in source
      ? `path|${source.viewBox.join(",")}|${source.width ?? ""}|${source.pad ?? ""}|${[source.path].flat().join("|")}`
      : `draw|${source.key}|${source.width}x${source.height}|${source.pad ?? ""}`;

const made = new Map<string, Shape>();
const making = new Map<string, Promise<Shape>>();

async function make(source: ShapeSource): Promise<Shape> {
  const pad = source.pad ?? 0.08;
  let box: Box;
  let size = 0;
  let paint: (ctx: CanvasRenderingContext2D) => void;
  if ("text" in source) {
    await document.fonts.load(source.font, source.text);
    const ink = measureInk(source);
    box = ink.box;
    size = ink.size;
    paint = (ctx) => {
      ctx.font = source.font;
      ctx.letterSpacing = `${(source.letterSpacing ?? 0) * size}px`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(source.text, 0, 0);
    };
  } else if ("path" in source) {
    const [vx, vy, vw, vh] = source.viewBox;
    const k = (source.width ?? vw) / vw;
    box = { x: 0, y: 0, width: vw * k, height: vh * k };
    const paths = [source.path].flat().map((d) => new Path2D(d));
    paint = (ctx) => {
      ctx.scale(k, k);
      ctx.translate(-vx, -vy);
      for (const p of paths) ctx.fill(p);
    };
  } else {
    box = { x: 0, y: 0, width: source.width, height: source.height };
    paint = source.draw;
  }
  // The ink centred in the field, its longer side spanning all but the padding.
  const side = Math.max(box.width, box.height) / (1 - 2 * pad);
  const buffer = bake((ctx, n) => {
    const k = n / side;
    ctx.setTransform(k, 0, 0, k, n / 2 - k * (box.x + box.width / 2), n / 2 - k * (box.y + box.height / 2));
    paint(ctx);
  });
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
  serve(url, buffer);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const content = "text" in source ? source.text : "";
  return {
    url,
    box,
    side,
    at(x, y, { scale = 1, rotation = 0, extrude, frame } = {}) {
      const [w, h] = frame ?? [1920, 1080];
      const props: ShapeProps = {
        shapeSdfUrl: url,
        center: { x: x / w, y: y / h },
        scale: (side * scale) / h,
        rotation,
      };
      if (extrude) {
        props.shapeType = "svgExtrude3D";
        props.shape = JSON.stringify({
          type: "svgExtrude3D",
          depth: 0.12,
          bevel: 0.02,
          rotX: 0,
          rotY: 0,
          rotZ: 0,
          ...extrude,
        });
      }
      return props;
    },
    text(x, y, { scale = 1, opacity = 1, bleed } = {}) {
      if (!content) return [];
      return [
        {
          text: content,
          x: x + (box.x - cx) * scale,
          y: y + (box.y - cy) * scale,
          width: box.width * scale,
          height: box.height * scale,
          size: size * scale,
          weight: Number(/\b([1-9]00)\b/.exec("text" in source ? source.font : "")?.[1] ?? 400),
          opacity,
          bleed,
        },
      ];
    },
  };
}

/** A shape, baked once per source for the page (fonts load first). */
export function shape(source: ShapeSource): Promise<Shape> {
  const key = keyOf(source);
  const known = made.get(key);
  if (known) return Promise.resolve(known);
  let job = making.get(key);
  if (!job) {
    job = make(source).then((s) => {
      made.set(key, s);
      making.delete(key);
      return s;
    });
    making.set(key, job);
  }
  return job;
}

/**
 * Shapes for shape effects, baked in the page: null until they are ready,
 * and the frame waits for them, so the first frame a worker renders already
 * has them. Pass them to `Shaders` in the tree:
 *
 *   const [word] = useShapes([{ text: "launch", font: '600 360px "Intent Sans"' }]);
 *   <Shaders text={word?.text(960, 540)} components={(f) => word ? [
 *     { type: "Chrome", props: { ...word.at(960 - f, 540), bevelWidth: 0.008 } },
 *   ] : []} />
 */
export function useShapes(sources: ShapeSource[]): (Shape | null)[] {
  const keys = sources.map(keyOf);
  const key = keys.join("\n");
  const [, bump] = useState(0);
  const { width, height } = useVideoInfo();
  const frame: [number, number] = [width, height];
  const now = keys.map((k) => {
    const s = made.get(k);
    return s ? { ...s, at: (x: number, y: number, o: ShapeAt = {}) => s.at(x, y, { frame, ...o }) } : null;
  });

  useLayoutEffect(() => {
    if (keys.every((k) => made.has(k))) return;
    waitFor(
      Promise.all(sources.map(shape)).then(() => flushSync(() => bump((n) => n + 1))),
      "Shader shapes",
    );
    // `key` names the sources.
  }, [key]);

  return now;
}
