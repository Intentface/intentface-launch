import { useFrame, useVideoInfo, waitFor } from "@intentface-launch/core";
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import {
  type ComponentConfig,
  createGpuUniformsMap,
  type GpuShaderDefinition,
  getNaturalSize,
  getRegisteredShader,
  type NodeMetadata,
  resolveBoundingBox,
  rootPassthrough,
  shaderRendererGPU,
} from "shaders/core";
import { load } from "./definitions.js";

export type { ComponentConfig } from "shaders/core";

/**
 * Components whose frame depends on the frames before it (particles, fluids,
 * feedback): rendering frame 40 straight from frame 0 differs from rendering
 * the frames in between. Measured over the whole library (shaders@4.0.4) by
 * rendering frame 40 both ways; InkFlow and Liquify follow the pointer and
 * simulate once it moves, so they are stepped too. They are stepped one whole
 * frame at a time from the start of the shot, and seeking backwards replays
 * them from there.
 */
const SIMULATIONS = new Set([
  "Boids",
  "DataMosh",
  "FloatingParticles",
  "InkFlow",
  "KeyFrames",
  "Liquify",
  "MagneticFilings",
  "ParticleField",
  "ParticleFlow",
  "Particles",
  "PixelSort",
  "ReactionDiffusion",
  "Smoke",
  "SmokeFill",
  "SmokeFlow",
  "Surface3D",
  "TimeTrail",
]);

/** Components that cannot be rendered frame by frame, and what to use instead. */
const UNSUPPORTED: Record<string, string> = {
  CursorRipples: "it follows a live pointer, which a video does not have",
  CursorTrail: "it follows a live pointer, which a video does not have",
  WebcamTexture: "it reads a camera",
  ObjectTracker: "it reads a camera",
  VideoTexture: "the video plays on the wall clock; put a <Clip> (frame exact) in the scene instead",
  HTMLInCanvas: "DOM as input is not wired to the video's paint yet",
  DOMTexture: "DOM as input is not wired to the video's paint yet",
  Text: "it fetches its font from Google at runtime, and `check` cannot read it; set type in the DOM (Slam, Reveal, the product's fonts)",
};

/**
 * Components whose solver gives a different picture on every run on the GPU
 * (measured: a third of Fog's pixels change between two renders of the same
 * frame). Render workers each start from a fresh renderer, so the video would
 * jump where their chunks meet.
 */
const UNREPEATABLE: Record<string, string> = { Fog: "Smoke, SmokeFlow or a noise field (FractalNoise, CurlNoise)" };

/**
 * Run `work` with `Math.random` seeded from `key`. Some components draw
 * random numbers (a fluid's start time); the library does it inside build
 * and render, synchronously, so a seeded generator for the length of the
 * call makes them the same in every render. Returns what `work` returns.
 */
function seeded<T>(key: number, work: () => T): T {
  const original = Math.random;
  // mulberry32, seeded from the key's bits.
  let a = (Math.imul(Math.round(key * 1e4) | 0, 0x9e3779b1) ^ 0x2545f491) >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return work();
  } finally {
    Math.random = original;
  }
}

/** Props every component takes that are node metadata rather than uniforms (as the library's own bindings split them). */
const METADATA = new Set([
  "opacity",
  "blendMode",
  "visible",
  "transform",
  "boundingBox",
  "maskSource",
  "maskType",
  "flow",
  "absolute",
]);

const DRIVERS = ["map", "mouse", "mouse-position", "auto-animate"];
const isDriver = (v: unknown): v is { type: string } =>
  typeof v === "object" && v !== null && DRIVERS.includes(String((v as { type?: unknown }).type));

/** Definitions loaded so far, by component type. */
const loaded = new Map<string, GpuShaderDefinition>();

/** Load the definitions a tree needs (each module once per page). */
async function loadAll(placed: Placed[]) {
  for (const type of new Set(placed.map((p) => p.node.type))) {
    if (loaded.has(type)) continue;
    const def = (await load(type)) ?? getRegisteredShader(type);
    if (!def) throw new Error(`Shaders: no component "${type}" (see the library's component list)`);
    loaded.set(type, def);
  }
}

const definition = (type: string) => loaded.get(type) as GpuShaderDefinition;

const defaultOf = (def: GpuShaderDefinition, key: string) => (def.props[key] as { default?: unknown }).default;

export type ShadersProps = {
  /**
   * The layer tree, as the Shaders library's vanilla API takes it
   * (`{ type: "Aurora", props: { … }, children: [] }`, first at the bottom).
   * A function of the (possibly fractional) frame animates props.
   */
  components: ComponentConfig[] | ((frame: number) => ComponentConfig[]);
  /** The layer's size in CSS pixels (default the video's); the canvas fills its parent at that resolution. */
  width?: number;
  height?: number;
  /** Drawing-buffer pixels per CSS pixel, over the render's own scale (default 1; 0.5 for soft fields). */
  resolution?: number;
  style?: CSSProperties;
  className?: string;
};

/** A node of the tree with the id it is registered under. */
type Placed = { id: string; parent: string; order: number; node: ComponentConfig };

/** Every node with a stable id: its own `id`, or its path in the tree. */
function place(tree: ComponentConfig[]): Placed[] {
  const out: Placed[] = [];
  const walk = (nodes: ComponentConfig[], parent: string, path: string) =>
    nodes.forEach((node, order) => {
      const id = node.id ?? `${path}${order}:${node.type}`;
      out.push({ id, parent, order, node });
      walk(node.children ?? [], id, `${path}${order}.`);
    });
  walk(tree, "root", "");
  return out;
}

/** Images the tree shows (ImageTexture `url`s), which the frame waits for. */
const imagesOf = (placed: Placed[]) =>
  placed.flatMap(({ node }) =>
    node.type === "ImageTexture" && typeof node.props?.url === "string" ? [node.props.url as string] : [],
  );

/**
 * Wait until every image is on the GPU. The library loads an image when a
 * render first asks for it and registers its size just before writing its
 * pixels, in one task, so a registered size means the texture is written.
 */
async function imagesLoaded(urls: string[], render: () => Promise<void>) {
  const deadline = performance.now() + 30_000;
  while (urls.some((url) => !getNaturalSize(url))) {
    if (performance.now() > deadline)
      throw new Error(`Shaders: images did not load in 30 s: ${urls.filter((u) => !getNaturalSize(u)).join(", ")}`);
    await render();
    await new Promise((done) => setTimeout(done, 16));
  }
  // The image's size reaches layout on the next animation frame, and the new
  // composition is only drawn from the render after it has drawn once.
  await new Promise((done) => requestAnimationFrame(done));
  await render();
}

/** Throws on what cannot be rendered frame by frame; returns whether the tree simulates. */
function inspect(placed: Placed[]): boolean {
  let simulates = false;
  for (const { node } of placed) {
    if (node.type in UNSUPPORTED) throw new Error(`Shaders: ${node.type} is not supported: ${UNSUPPORTED[node.type]}`);
    if (node.type in UNREPEATABLE)
      throw new Error(
        `Shaders: ${node.type} renders differently every run, so frames from different render workers would not join; use ${UNREPEATABLE[node.type]}`,
      );
    if (SIMULATIONS.has(node.type)) simulates = true;
    for (const [name, value] of Object.entries(node.props ?? {})) {
      if (isDriver(value) && value.type !== "map")
        throw new Error(
          `Shaders: ${node.type}.${name} is a ${value.type} driver, which follows the pointer or the wall clock; make it a function of the frame (components={(f) => …})`,
        );
    }
  }
  if (simulates && imagesOf(placed).length)
    throw new Error(
      "Shaders: a simulation (PixelSort, DataMosh, …) over an ImageTexture is not supported: every render moves the simulation on, and the image arrives after a varying number of them",
    );
  return simulates;
}

/** The props every component takes, as the library reads them. */
type Universal = {
  blendMode?: string;
  opacity?: number;
  visible?: boolean;
  maskSource?: string;
  maskType?: string;
  transform?: Record<string, unknown>;
  boundingBox?: Parameters<typeof resolveBoundingBox>[0];
  flow?: unknown;
  absolute?: boolean;
};

function metadataOf(node: ComponentConfig, order: number): NodeMetadata {
  const p = (node.props ?? {}) as Record<string, unknown> & Universal;
  const maps = Object.fromEntries(Object.entries(p).filter(([k, v]) => !METADATA.has(k) && isDriver(v)));
  return {
    blendMode: p.blendMode ?? "normal",
    opacity: p.opacity,
    visible: p.visible,
    renderOrder: order,
    id: node.id,
    maps: Object.keys(maps).length ? maps : undefined,
    mask: p.maskSource ? { source: p.maskSource, type: p.maskType ?? "alpha" } : undefined,
    transform: p.transform
      ? {
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
          scale: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          edges: "transparent",
          ...p.transform,
        }
      : undefined,
    boundingBox: resolveBoundingBox(p.boundingBox),
    flow: p.flow,
    absolute: p.absolute,
  } as NodeMetadata;
}

type Gpu = {
  renderer: ReturnType<typeof shaderRendererGPU>;
  canvas: HTMLCanvasElement;
  /** Seconds the renderer's clocks have reached. */
  clock: number;
  /** Renders a simulation has had: each one moves it on. */
  steps: number;
  /** The size last asked of the renderer, in CSS pixels. */
  size: string;
  /** What is registered: the tree's shape, and each node's props as last set. */
  shape: string;
  props: Map<string, Record<string, unknown>>;
};

/** A renderer on a new canvas in `parent`, frame-locked, with its clocks at 0. */
async function open(parent: HTMLElement): Promise<Gpu> {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block";
  parent.appendChild(canvas);
  const renderer = shaderRendererGPU();
  let failed: string | null = null;
  renderer.setOnUnavailable((reason, error) => {
    failed = `Shaders: WebGPU is unavailable (${reason})${error ? `: ${error}` : ""}`;
  });
  await renderer.initialize({ canvas, colorSpace: "srgb", observeElement: false, forceFullFrameRate: true });
  if (failed) throw new Error(failed);
  renderer.stopAnimation();
  renderer.setFrameLocked(true);
  renderer.registerNode("root", rootPassthrough.fragment, null, null, {}, rootPassthrough);
  return { renderer, canvas, clock: 0, steps: 0, size: "", shape: "", props: new Map() };
}

function close(g: Gpu) {
  g.renderer.cleanup();
  g.canvas.remove();
}

const shapeOf = (placed: Placed[]) => placed.map((p) => `${p.parent}>${p.id}`).join("|");

/** Register the tree on a renderer that has none. */
function build(g: Gpu, placed: Placed[]) {
  for (const { id, parent, order, node } of placed) {
    const def = definition(node.type);
    const given = (node.props ?? {}) as Record<string, unknown>;
    const props = Object.fromEntries(
      Object.keys(def.props).map((key) => {
        const value = given[key] !== undefined ? given[key] : defaultOf(def, key);
        return [key, isDriver(value) ? defaultOf(def, key) : value];
      }),
    );
    g.renderer.registerNode(
      id,
      def.fragment,
      parent,
      metadataOf(node, order),
      createGpuUniformsMap(def, props, id),
      def,
    );
    g.props.set(id, { ...given });
  }
  g.shape = shapeOf(placed);
}

/** Set the props that changed since the last frame, in place: no recompiling for a moving value. */
function update(g: Gpu, placed: Placed[]) {
  for (const { id, order, node } of placed) {
    const before = g.props.get(id) ?? {};
    const after = (node.props ?? {}) as Record<string, unknown>;
    let metadata = false;
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
      if (METADATA.has(key) || isDriver(after[key]) || isDriver(before[key])) {
        metadata = true;
        continue;
      }
      const def = definition(node.type);
      if (key in def.props) g.renderer.updateUniformValue(id, key, after[key] ?? defaultOf(def, key));
    }
    if (metadata) g.renderer.updateNodeMetadata(id, metadataOf(node, order));
    g.props.set(id, { ...after });
  }
}

/**
 * The Shaders library's WebGPU components (shaders.com) as a layer filling its
 * parent, on the video's clock. The library's own bindings run on the wall
 * clock; this drives its renderer frame-locked instead, so every frame is a
 * function of its frame number: the clocks are moved to the frame's time
 * before each render, props that change are set in place, and the frame
 * waits for the GPU.
 *
 * Simulations (ReactionDiffusion, Boids and the like) cannot jump: they are
 * stepped a whole frame at a time from the start of the shot (a still late
 * in a shot replays the steps before it), and fractional frames show the
 * whole frame before them.
 */
export function Shaders({ components, width, height, resolution = 1, style, className }: ShadersProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  /** The renderer, and the chain every use of it goes through: it takes one frame at a time. */
  const state = useRef<{ gpu: Gpu | null; queue: Promise<unknown>; closed: boolean } | null>(null);
  const placed = place(typeof components === "function" ? components(frame) : components);
  const simulates = inspect(placed);
  const cssWidth = (width ?? video.width) * resolution;
  const cssHeight = (height ?? video.height) * resolution;

  // Released with the shot, once a frame in flight has finished.
  useLayoutEffect(() => {
    const s = { gpu: null as Gpu | null, queue: Promise.resolve() as Promise<unknown>, closed: false };
    state.current = s;
    return () => {
      s.closed = true;
      state.current = null;
      s.queue.finally(() => s.gpu && close(s.gpu));
    };
  }, []);

  // Render the current frame, every render.
  useLayoutEffect(() => {
    const s = state.current;
    const parent = host.current;
    if (!s || !parent) return;
    const fps = video.fps;
    // Simulations step whole frames; everything else renders at the exact time.
    const target = simulates ? Math.floor(frame) / fps : frame / fps;
    const draw = async () => {
      if (s.closed) return;
      await loadAll(placed);
      let g = s.gpu;
      // A new tree, or a simulation asked to run backwards: a fresh renderer,
      // its clocks at the start of the shot (re-registering nodes in place
      // keeps a simulation's buffers and its nodes' own clocks).
      if (!g || shapeOf(placed) !== g.shape || (simulates && target < g.clock - 1e-6)) {
        if (g) close(g);
        g = s.gpu = await open(parent);
        const fresh = g;
        seeded(-1, () => build(fresh, placed));
      } else update(g, placed);
      const size = `${cssWidth}x${cssHeight}`;
      if (g.size !== size) {
        // The renderer applies a new size on the next animation frame, and
        // sizing the canvas clears it: let that happen before drawing.
        g.size = size;
        g.renderer.resize(cssWidth, cssHeight);
        await new Promise((done) => requestAnimationFrame(done));
      }
      const r = g.renderer;
      // Renders with no time ask for new images until they are on the GPU.
      const images = imagesOf(placed);
      if (images.length) await imagesLoaded(images, () => seeded(target, () => r.renderSyntheticFrame(0)));
      if (!simulates) {
        // Effects that compute in passes of their own (the blurs, glow) show
        // what they computed on the render before; a second render at the same
        // time brings them up to this frame.
        await seeded(target, () => r.renderSyntheticFrame(target - g.clock, { waitForGpu: false }));
        g.clock = target;
        await seeded(target, () => r.renderSyntheticFrame(0));
        return;
      }
      // Every render moves a simulation on, so each step is rendered once, in
      // order from the shot's start, and a frame already shown is not redrawn.
      const step = 1 / fps;
      if (g.steps === 0) {
        await seeded(0, () => r.renderSyntheticFrame(0));
        g.steps = 1;
      }
      while (g.clock < target - 1e-6) {
        g.clock += step;
        await seeded(g.steps++, () => r.renderSyntheticFrame(step, { waitForGpu: g.clock >= target - 1e-6 }));
      }
    };
    // A failure is logged as an error, which fails the frame in a render (and
    // shows in the studio); later frames still get their turn.
    s.queue = s.queue.then(draw).catch((e) => console.error(e instanceof Error ? e.message : e));
    waitFor(s.queue, "Shaders frame");
  });

  return (
    <div
      ref={host}
      className={className}
      data-launch-check="off"
      style={{ position: "absolute", inset: 0, ...style }}
    />
  );
}
