import { useFrame, useVideoInfo, waitFor } from "@intentface-launch/core";
import {
  defaultObjectSizing,
  getShaderColorFromString,
  LiquidMetalShapes,
  liquidMetalFragmentShader,
  ShaderFitOptions,
  ShaderMount,
  toProcessedLiquidMetal,
} from "@paper-design/shaders";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type CanvasPicture, picture } from "./image.js";

/*
 * Paper's shaders (shaders.paper.design, Apache-2.0: liquid metal, mesh and
 * grain gradients, dithering, halftones, fluted glass, god rays, …) on the
 * video's clock. Paper's own mount animates on requestAnimationFrame and sizes
 * its canvas from a ResizeObserver; here its speed is 0, its canvas is sized
 * before the first frame, and every frame is drawn synchronously at the
 * frame's time (its `setFrame`), so any frame renders alone, the same every
 * time.
 */

/** A uniform's value as Paper's mount takes it; images are given as URLs and loaded first. */
type Value = number | boolean | number[] | number[][];

/** Paper's mount, with the sizing state it keeps private (set here so the canvas has its size before the first frame). */
type Mount = {
  parentWidth: number;
  parentHeight: number;
  devicePixelsSupported: boolean;
  handleResize: () => void;
  setUniforms: (uniforms: Record<string, unknown>) => void;
  setFrame: (ms: number) => void;
  dispose: () => void;
};

const images = new Map<string, Promise<HTMLImageElement>>();

/** An image, loaded and decoded once per URL. */
function image(url: string): Promise<HTMLImageElement> {
  let job = images.get(url);
  if (!job) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    job = img.decode().then(() => img);
    images.set(url, job);
  }
  return job;
}

export type PaperShaderProps = {
  /** A Paper fragment shader (`meshGradientFragmentShader`, `liquidMetalFragmentShader`, …). */
  fragment: string;
  /** Its uniforms, as Paper names them (`u_colorBack`, …): numbers, booleans, vectors (colours via `getShaderColorFromString`). */
  uniforms: Record<string, Value>;
  /** Uniforms that take an image, as URLs (loaded before the first frame). */
  images?: Record<string, string>;
  /** Image uniforms that want mipmaps (Paper's liquid metal does: `["u_image"]`). */
  mipmaps?: string[];
  /** Paper's time in seconds at this frame (default: the frame's time; scale it for speed). */
  time?: number;
  /** The layer's size in CSS pixels (default the video's). */
  width?: number;
  height?: number;
  /** Drawing-buffer pixels per CSS pixel (default 2: Paper renders at 2× for clean edges). */
  resolution?: number;
  /**
   * Draw it once, as a picture (an <img>), instead of a live canvas: a still
   * that any number of copies share. A page curl or a page flip draws the
   * outgoing shot once per strip of paper, and a live WebGL canvas in each
   * would run the page out of contexts and memory; a still costs one image.
   */
  still?: boolean;
  style?: CSSProperties;
  className?: string;
};

/**
 * One of Paper's shaders as a layer filling its parent, frame-locked. Paper's
 * React components each pass a fragment shader and their uniforms to the
 * same mount; this takes the same pair. `LiquidMetal` below is one, ready to use.
 */
export function PaperShader({
  fragment,
  uniforms,
  images: imageUrls = {},
  mipmaps = [],
  time,
  width,
  height,
  resolution = 2,
  still = false,
  style,
  className,
}: PaperShaderProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  const mount = useRef<Mount | null>(null);
  const w = width ?? video.width;
  const h = height ?? video.height;
  const keys = Object.entries(imageUrls)
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  const [loaded, setLoaded] = useState<Record<string, HTMLImageElement> | null>(null);

  // Images first: Paper's mount takes them loaded.
  useLayoutEffect(() => {
    const entries = Object.entries(imageUrls);
    waitFor(
      Promise.all(entries.map(([k, url]) => image(url).then((img) => [k, img] as const))).then((list) =>
        flushSync(() => setLoaded(Object.fromEntries(list))),
      ),
      "Paper images",
    );
    // `keys` names the images.
  }, [keys]);

  const all = { ...uniforms, ...(loaded ?? {}) } as Record<string, Value | HTMLImageElement>;
  const seconds = time ?? frame / video.fps;
  // A still is named by everything it draws: copies with the same props share one picture.
  const stillKey = still
    ? `${hash(fragment)}|${keys}|${JSON.stringify(uniforms)}|${seconds}|${w}x${h}@${resolution}|${mipmaps.join(",")}`
    : "";
  const [picture, setPicture] = useState<string | null>(() => stills.get(stillKey)?.url ?? null);
  const known = still ? (stills.get(stillKey)?.url ?? null) : null;

  // The mount, once its images are in: at speed 0, sized now rather than by its observer.
  useLayoutEffect(() => {
    const parent = host.current;
    if (still || !parent || !loaded) return;
    const m = mount_(parent, fragment, all, w, h, resolution, mipmaps);
    mount.current = m;
    return () => {
      mount.current = null;
      m.dispose();
    };
    // Built once per shader and set of images; uniforms change in place.
  }, [fragment, loaded, w, h, resolution, still]);

  // Every frame: the uniforms, then a synchronous draw at the frame's time.
  useLayoutEffect(() => {
    const m = mount.current;
    if (!m) return;
    m.setUniforms(all);
    m.setFrame(seconds * 1000);
  });

  // A still: drawn once into a mount of its own, off the page, kept as a picture.
  useLayoutEffect(() => {
    if (!still || !loaded || known) return;
    let entry = stills.get(stillKey);
    if (!entry) {
      const job = new Promise<string>((done, fail) => {
        const parent = document.createElement("div");
        const m = mount_(parent, fragment, all, w, h, resolution, mipmaps);
        m.setUniforms(all);
        m.setFrame(seconds * 1000);
        const canvas = parent.querySelector("canvas");
        if (!canvas) {
          m.dispose();
          fail(new Error("Paper shader: no canvas to keep as a still"));
          return;
        }
        canvas.toBlob((blob) => {
          m.dispose();
          if (blob) done(URL.createObjectURL(blob));
          else fail(new Error("Paper shader: the still gave no image"));
        }, "image/png");
      });
      entry = { job, url: null };
      stills.set(stillKey, entry);
      const made = entry;
      job.then((url) => {
        made.url = url;
      });
    }
    waitFor(
      entry.job.then((url) => flushSync(() => setPicture(url))),
      "Paper still",
    );
  }, [still, loaded, stillKey]);

  if (still) {
    const url = known ?? picture;
    return url ? (
      <img
        alt=""
        src={url}
        // Painted with the frame it first appears in (a page curl mounts a fresh copy per strip).
        decoding="sync"
        className={className}
        data-launch-check="off"
        style={{ position: "absolute", left: 0, top: 0, width: w, height: h, ...style }}
      />
    ) : null;
  }

  return (
    <div
      ref={host}
      className={className}
      data-launch-check="off"
      style={{ position: "absolute", left: 0, top: 0, width: w, height: h, ...style }}
    />
  );
}

/** Stills drawn so far, by what they draw: the job, and its picture once made. */
const stills = new Map<string, { job: Promise<string>; url: string | null }>();

/** A short name for a long string (a fragment shader), for a key. */
function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Paper's mount in `parent`, at speed 0, sized now rather than by its observer. */
function mount_(
  parent: HTMLElement,
  fragment: string,
  uniforms: Record<string, unknown>,
  w: number,
  h: number,
  resolution: number,
  mipmaps: string[],
): Mount {
  const m = new ShaderMount(
    parent,
    fragment,
    uniforms as never,
    { preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true, antialias: false },
    0,
    0,
    resolution,
    Number.POSITIVE_INFINITY,
    mipmaps,
  ) as unknown as Mount;
  m.devicePixelsSupported = false;
  m.parentWidth = w;
  m.parentHeight = h;
  m.handleResize();
  return m;
}

// --- Liquid metal --------------------------------------------------------------------------

const processed = new Map<string, Promise<string>>();

/** A shape picture prepared as Paper's liquid metal reads it (edge gradient in red, coverage in green), once per picture. */
function prepare(url: string): Promise<string> {
  let job = processed.get(url);
  if (!job) {
    job = toProcessedLiquidMetal(url).then((r) => URL.createObjectURL(r.pngBlob));
    processed.set(url, job);
  }
  return job;
}

export type LiquidMetalProps = {
  /**
   * The shape the metal fills, drawn in white on a transparent canvas the size
   * of the layer (a pill, a ring round a button, a logo, a word), or a URL
   * of such a picture. Without one, Paper's own `preset` shape.
   */
  shape?: CanvasPicture | string;
  preset?: keyof typeof LiquidMetalShapes;
  /**
   * 0 polished (crisp bands of reflection, colour split along them) to 1
   * matte (the bands broad and soft, no split, lower contrast): sets
   * softness, the colour split, the band count and the edge flow, which the
   * props below override one by one.
   */
  matte?: number;
  /** Behind the shape (default transparent). */
  colorBack?: string;
  /** Burned into the metal (default white: plain silver). */
  colorTint?: string;
  repetition?: number;
  softness?: number;
  shiftRed?: number;
  shiftBlue?: number;
  distortion?: number;
  contour?: number;
  /** The direction the bands flow, in degrees. */
  angle?: number;
  /** How fast it flows (1 is Paper's own speed). */
  speed?: number;
  /** Seconds of flow added on top of the frame's (a push as it is clicked). */
  flow?: number;
  /**
   * Draw it as it is at this frame, once, as a picture (PaperShader's
   * `still`): the metal stops flowing, and every copy shares the one image,
   * so a page curl can carry it.
   */
  still?: number;
  /** How the shape sits in the layer (default contain, at scale 1: it fills the layer as drawn). */
  scale?: number;
  width?: number;
  height?: number;
  resolution?: number;
  style?: CSSProperties;
};

/**
 * Liquid metal (Paper's shader): polished metal whose reflections flow as
 * bands through a shape and bend round its edges, the colour splitting where
 * they bend; `matte` takes it from mirror chrome to brushed, satin metal.
 * For the liquid-metal UI look: a ring of it round a button, a pill of it, a
 * logo cast in it. Frame-locked; the shape is prepared once (Paper's solver,
 * a few hundred milliseconds) and the frame waits for it.
 */
export function LiquidMetal({
  shape,
  preset = "none",
  matte = 0,
  colorBack = "#00000000",
  colorTint = "#ffffff",
  repetition,
  softness,
  shiftRed,
  shiftBlue,
  distortion,
  contour,
  angle = 70,
  speed = 1,
  flow = 0,
  still,
  scale = 1,
  width,
  height,
  resolution,
  style,
}: LiquidMetalProps) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const [url, setUrl] = useState<string | null>(null);
  const key = typeof shape === "string" ? shape : (shape?.key ?? "");

  useLayoutEffect(() => {
    if (!shape) return;
    waitFor(
      (typeof shape === "string" ? Promise.resolve(shape) : picture(shape))
        .then(prepare)
        .then((u) => flushSync(() => setUrl(u))),
      "Liquid metal shape",
    );
    // `key` names the shape.
  }, [key]);

  if (shape && !url) return null;
  const m = Math.min(1, Math.max(0, matte));
  const mix = (a: number, b: number) => a + (b - a) * m;
  return (
    <PaperShader
      fragment={liquidMetalFragmentShader}
      images={url ? { u_image: url } : {}}
      mipmaps={["u_image"]}
      time={((still ?? frame) / fps) * speed + flow}
      still={still !== undefined}
      width={width}
      height={height}
      resolution={resolution}
      style={style}
      uniforms={{
        u_colorBack: getShaderColorFromString(colorBack),
        u_colorTint: getShaderColorFromString(colorTint),
        u_repetition: repetition ?? mix(2, 1.25),
        u_softness: softness ?? mix(0.1, 0.85),
        u_shiftRed: shiftRed ?? mix(0.3, 0.02),
        u_shiftBlue: shiftBlue ?? mix(0.3, 0.02),
        u_distortion: distortion ?? mix(0.07, 0.02),
        u_contour: contour ?? mix(0.4, 0.18),
        u_angle: angle,
        u_isImage: !!url,
        u_shape: LiquidMetalShapes[preset],
        u_fit: ShaderFitOptions.contain,
        u_scale: scale,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: defaultObjectSizing.originX,
        u_originY: defaultObjectSizing.originY,
        u_worldWidth: 0,
        u_worldHeight: 0,
      }}
    />
  );
}
