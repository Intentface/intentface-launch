import { type DeclaredText, declareText, useFrame, useVideoInfo, waitFor } from "@intentface-launch/core";
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import {
  type ComponentConfig,
  createGpuUniformsMap,
  type GpuShaderDefinition,
  getRegisteredShader,
  type NodeMetadata,
  resolveBoundingBox,
  rootPassthrough,
  shaderRendererGPU,
} from "shaders/core";
import { load } from "./definitions.js";
import { isServed, readsBegun, settled, watch } from "./reads.js";

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
  CursorRipples: "it follows a pointer: give the layer one (`pointer={(f) => ({ x, y })}`)",
  CursorTrail: "it follows a pointer: give the layer one (`pointer={(f) => ({ x, y })}`)",
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
 * Run `work` with `Math.random` seeded from `key`, and `Date.now()` reading
 * `now` (milliseconds of the video's time). Some components draw random
 * numbers (a fluid's start time), and the library's fluid and ripple
 * simulations time their steps by the wall clock; it does both inside build
 * and render, synchronously, so a seeded generator and the video's own clock
 * for the length of the call make them the same in every render. Returns
 * what `work` returns.
 */
function seeded<T>(key: number, work: () => T, now = key * 1000): T {
  const original = Math.random;
  const clock = Date.now;
  // mulberry32, seeded from the key's bits.
  let a = (Math.imul(Math.round(key * 1e4) | 0, 0x9e3779b1) ^ 0x2545f491) >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Date.now = () => Math.round(1e6 + now);
  try {
    return work();
  } finally {
    Math.random = original;
    Date.now = clock;
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
  /**
   * Text the layer draws (a word as a shape, `shape.text(x, y)`), in its CSS
   * pixels: `check` reads it for reading time, size, safe area and contrast
   * as it reads DOM text. A layer without it is left out of the reading checks.
   */
  text?: DeclaredText[];
  /**
   * A pointer for the components that follow one (CursorRipples, CursorTrail,
   * Liquify, InkFlow, and \`mouse\` / \`mouse-position\` drivers): where it is at a
   * frame, in the layer's CSS pixels, and whether its button is down; null when
   * it is away. A \`Cursor\`'s path (\`cursorAt\`) makes the shader answer the
   * cursor on screen. Trees that follow it are stepped from the shot's start,
   * as simulations are. One pointer-driven layer on screen at a time: the
   * library reads one pointer for the page.
   */
  pointer?: (frame: number) => { x: number; y: number; down?: boolean } | null;
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

/** Components that need a pointer, and keep a history of it (so they are stepped like simulations). */
const POINTER = new Set(["CursorRipples", "CursorTrail"]);

/** Throws on what cannot be rendered frame by frame; returns whether the tree simulates. */
function inspect(placed: Placed[], pointer: boolean): boolean {
  let simulates = false;
  for (const { node } of placed) {
    if (pointer && POINTER.has(node.type)) {
      simulates = true;
      continue;
    }
    if (node.type in UNSUPPORTED) throw new Error(`Shaders: ${node.type} is not supported: ${UNSUPPORTED[node.type]}`);
    if (node.type in UNREPEATABLE)
      throw new Error(
        `Shaders: ${node.type} renders differently every run, so frames from different render workers would not join; use ${UNREPEATABLE[node.type]}`,
      );
    if (SIMULATIONS.has(node.type)) simulates = true;
    for (const [name, value] of Object.entries(node.props ?? {})) {
      if (isDriver(value) && value.type !== "map" && !(pointer && value.type !== "auto-animate"))
        throw new Error(
          `Shaders: ${node.type}.${name} is a ${value.type} driver, which follows the pointer or the wall clock; make it a function of the frame (components={(f) => …}), or give the layer a \`pointer\``,
        );
    }
  }
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
  /** What the tree reads by URL (images, fields), as last read in full. */
  media: string;
  /** Whether the pointer's button is down, as last told. */
  down: boolean;
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
  return { renderer, canvas, clock: 0, steps: 0, size: "", shape: "", media: "", down: false, props: new Map() };
}

function close(g: Gpu) {
  g.renderer.cleanup();
  g.canvas.remove();
}

/**
 * The tree's shape: its nodes, and the custom shape each shape effect reads
 * (a new field or shape type is compiled in, so it builds the tree afresh).
 */
const shapeOf = (placed: Placed[]) =>
  placed
    .map(({ parent, id, node }) => {
      const p = (node.props ?? {}) as Record<string, unknown> & Universal;
      const field = p.shapeSdfUrl ? `@${p.shapeSdfUrl}:${p.shapeType ?? ""}` : "";
      // Whether a node is moved, translucent, blended, masked or hidden changes
      // how it is composed: the library recompiles for it, on its own time, so
      // the frame would be drawn before the new program exists. Those start a
      // fresh renderer instead; their values then change in place.
      const composed = [
        moves(p.transform) ? "t" : "",
        typeof p.opacity === "number" && p.opacity < 1 ? "o" : "",
        p.blendMode && p.blendMode !== "normal" ? `b${p.blendMode}` : "",
        p.maskSource ? `m${p.maskSource}:${p.maskType ?? "alpha"}` : "",
        p.visible === false ? "h" : "",
      ].join("");
      return `${parent}>${id}${field}${composed ? `~${composed}` : ""}`;
    })
    .join("|");

/** Whether a node's `transform` moves, scales or turns it at all. */
function moves(transform: Record<string, unknown> | undefined) {
  if (!transform) return false;
  const n = (key: string, rest: number) => (typeof transform[key] === "number" ? (transform[key] as number) : rest);
  return n("offsetX", 0) !== 0 || n("offsetY", 0) !== 0 || n("rotation", 0) !== 0 || n("scale", 1) !== 1;
}

/** What a tree reads by URL: its images, and the shapes baked in the page (`useShapes`). */
const mediaOf = (placed: Placed[]) =>
  [
    ...imagesOf(placed),
    ...placed.flatMap(({ node }) => (isServed(node.props?.shapeSdfUrl) ? [node.props?.shapeSdfUrl as string] : [])),
  ]
    .sort()
    .join("\n");

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
export function Shaders({ components, width, height, resolution = 1, text, pointer, style, className }: ShadersProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  /** The renderer, and the chain every use of it goes through: it takes one frame at a time. */
  const state = useRef<{ gpu: Gpu | null; queue: Promise<unknown>; closed: boolean } | null>(null);
  const placed = place(typeof components === "function" ? components(frame) : components);
  const simulates = inspect(placed, !!pointer);
  const layerWidth = width ?? video.width;
  const layerHeight = height ?? video.height;
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
      // Count reads of what the tree loads by URL from before any node can ask for it.
      const media = mediaOf(placed);
      if (media) watch(media.split("\n"));
      let g = s.gpu;
      // A new tree, or a simulation asked to run backwards: a fresh renderer,
      // its clocks at the start of the shot (re-registering nodes in place
      // keeps a simulation's buffers and its nodes' own clocks).
      if (!g || shapeOf(placed) !== g.shape || (simulates && target < g.clock - 1e-6)) {
        if (g) close(g);
        g = s.gpu = await open(parent);
        const fresh = g;
        seeded(-1, () => build(fresh, placed), 0);
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
      const gpu = g;
      // The pointer where it is at \`time\` (seconds), as the mouse events the library listens for.
      const aim = (time: number) => {
        if (!pointer) return;
        const at = pointer(time * fps);
        const rect = gpu.canvas.getBoundingClientRect();
        const client = at
          ? {
              clientX: rect.left + (at.x / layerWidth) * rect.width,
              clientY: rect.top + (at.y / layerHeight) * rect.height,
            }
          : { clientX: rect.left - 1e4, clientY: rect.top - 1e4 };
        const down = !!at?.down;
        if (down && !gpu.down) window.dispatchEvent(new MouseEvent("mousedown", { ...client, button: 0 }));
        window.dispatchEvent(new MouseEvent("mousemove", client));
        if (!down && gpu.down) window.dispatchEvent(new MouseEvent("mouseup", { ...client, button: 0 }));
        gpu.down = down;
      };
      // Images and baked shapes are fetched when a node first renders (or its
      // URL changes) and written to the GPU after they decode: render once,
      // wait until every read has landed, and let layout take any new image
      // size on the next animation frame, before the frame is drawn for real.
      if (media && media !== g.media) {
        // A node starts loading a timeout after it is built, or in the render
        // after its URL changes: render, give the loaders their turn, wait for
        // what they read, and repeat until a render asks for nothing new.
        for (let round = 0; round < 8; round++) {
          const before = readsBegun();
          aim(g.clock);
          await seeded(target, () => r.renderSyntheticFrame(0), g.clock * 1000);
          await new Promise((done) => setTimeout(done, 0));
          await settled();
          if (round > 0 && readsBegun() === before) break;
        }
        await new Promise((done) => requestAnimationFrame(done));
        g.media = media;
      }
      if (!simulates) {
        // Effects that compute in passes of their own (the blurs, glow) show
        // what they computed on the render before; a second render at the same
        // time brings them up to this frame.
        aim(target);
        await seeded(target, () => r.renderSyntheticFrame(target - g.clock, { waitForGpu: false }));
        g.clock = target;
        await seeded(target, () => r.renderSyntheticFrame(0));
        return;
      }
      // Every render moves a simulation on, so each step is rendered once, in
      // order from the shot's start, and a frame already shown is not redrawn.
      const step = 1 / fps;
      if (g.steps === 0) {
        aim(0);
        await seeded(0, () => r.renderSyntheticFrame(0), 0);
        g.steps = 1;
      }
      while (g.clock < target - 1e-6) {
        g.clock += step;
        aim(g.clock);
        await seeded(
          g.steps++,
          () => r.renderSyntheticFrame(step, { waitForGpu: g.clock >= target - 1e-6 }),
          g.clock * 1000,
        );
      }
    };
    // A failure is logged as an error, which fails the frame in a render (and
    // shows in the studio); later frames still get their turn.
    s.queue = s.queue.then(draw).catch((e) => console.error(e instanceof Error ? e.message : e));
    waitFor(s.queue, "Shaders frame");
  });

  // Declared on the layer itself: the canvas inside is never read.
  useLayoutEffect(() => {
    if (text) declareText(host.current, text);
  });

  return (
    <div
      ref={host}
      className={className}
      data-launch-check={text ? undefined : "off"}
      style={{ position: "absolute", inset: 0, ...style }}
    />
  );
}
