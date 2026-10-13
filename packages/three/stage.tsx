import { useFrame, useVideoInfo, waitFor } from "@intentface-launch/core";
import {
  addDebugView,
  type DebugView,
  isFrameSettled,
  isRenderMode,
  renderQuality,
} from "@intentface-launch/core/timeline";
import { type CSSProperties, createContext, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import {
  Color,
  CustomBlending,
  DepthTexture,
  ExternalTexture,
  FloatType,
  Group,
  HalfFloatType,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  type MeshPhysicalMaterial,
  NoBlending,
  NoToneMapping,
  type Object3D,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  SpotLight,
  type Texture,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";
import { htmlInCanvas, uploadElement } from "./dom-texture.js";
import { EffectChain } from "./effects.js";
import { type Environment, Environments } from "./environment.js";
import { aimThroughLens, diskSample, distanceTo, type Lens, pixelJitter, shutterSlot } from "./lens.js";
import { keyLight, type SoftBox } from "./lights.js";
import {
  ADD_BLEND,
  applyPost,
  Bloom,
  bloomOptions,
  disposeLensLight,
  OUTPUT_FRAGMENT,
  outputUniforms,
  type Post,
  QUAD_VERTEX,
  renderLensLight,
} from "./post.js";

export type { SoftBox } from "./lights.js";

export type Stage3DProps = {
  /** The camera at a (possibly fractional) frame. `rig()` and the named moves make these. */
  lens: (frame: number) => Lens;
  /** The key light at a frame. Default: a wide soft box above and to the left. */
  light?: (frame: number) => SoftBox;
  /** Several lights at a frame (replaces `light`): `threePoint()`, `rimLight()`, `sweep()`. */
  lights?: (frame: number) => SoftBox[];
  /** What glossy surfaces reflect: a strength, or a preset or HDRI file, optionally animated. */
  environment?: number | Environment | ((frame: number) => Environment);
  /**
   * Lens and time samples averaged per frame in renders. More = smoother bokeh and blur, and the
   * frame's cost grows with them (about 2 ms a sample past 32 at 1080p). A function of the frame
   * spends them where the blur is: `(f) => (f < 300 ? 256 : 32)` once the lens has stopped down.
   */
  samples?: number | ((frame: number) => number);
  /**
   * Merge the copies a defocused edge splits into across the lens samples, so bokeh is a smooth
   * disc, not a spiky sunflower of ghosts (default true). Costs one cheap pass per blurred sample.
   */
  smoothBokeh?: boolean;
  /** Samples per frame in the studio. */
  preview?: number;
  /**
   * Motion blur, spread over the same samples as the lens. `when` limits it to
   * the frames where things move (as [from, to) pairs), like <MotionBlur>.
   */
  shutter?: { angle?: number; phase?: number; when?: [number, number][] };
  /** Fill behind the scene. Default: transparent, so layers behind show through. */
  background?: string;
  /**
   * DOM painted behind the scene, inside it (the brand gradient, say). Unlike
   * a layer behind a transparent stage, glass panels refract and blur it.
   */
  backdrop?: ReactNode;
  /** Film grain amplitude in 8-bit steps / 255. Dither against banding is always on. */
  grain?: number;
  exposure?: number;
  /** Bloom, vignette, aberration, grade and LUT. */
  post?: Post;
  children?: ReactNode;
  style?: CSSProperties;
};

/** Something in the scene. Panels register one; anything built on Object3D can. */
export type StageItem = {
  object: Object3D;
  /** Pose for time `t` (fractional frame). Called once per sample. */
  update(t: number): void;
  /** Canvas child whose paint this item turns into a texture. */
  element?: HTMLElement | null;
  /** Upload `element` as a texture. Called during the canvas's paint event. */
  capture?(gl: WebGL2RenderingContext): void;
};

/** A ground plane under the scene. It reflects, catches shadows, or both; otherwise it is invisible. */
export type FloorConfig = {
  /** Height of the floor in world units (y up). */
  y: number;
  /** Reflection strength, 0 to 1. */
  reflect?: number;
  /** Blur of the reflection: 0 is a mirror, 0.3 polished stone, 1 satin. */
  roughness?: number;
  /** Shadow darkness, 0 to 1. Soft, from the area of the lights. */
  shadow?: number;
  /** Radius around `center` where the floor fades out, as [start, end]. */
  fade?: [number, number];
  /** Centre of the fade (x, z). */
  center?: [number, number];
};

export type StageContextValue = {
  add(item: StageItem): () => void;
  setFloor(floor: FloorConfig | null): void;
  /** HTML-in-Canvas available: DOM children can become textures. */
  live: boolean;
  /** The stage's camera, for DOM placed with it (`Overlay3D`). */
  lens(): (frame: number) => Lens;
  /** Draw the frame again: something joined the scene late (a `Panel` whose region was just measured). */
  refresh(): void;
  /** A layer above the canvas, painted as DOM (canvas children are not): `Overlay3D` renders here. */
  overlay: HTMLElement | null;
};

export { htmlInCanvas, uploadElement };

export const StageContext = createContext<StageContextValue | null>(null);

type PaintCanvas = HTMLCanvasElement & {
  requestPaint?: () => void;
  onpaint: ((e: Event & { changedElements?: Element[] }) => void) | null;
};

const ADD_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float weight;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vUv) * weight; }`;

// Bokeh smoothing. Every sample sees the scene through one point of the lens,
// and every pixel shares those points, so a defocused edge averages into
// n distinct copies of itself (a sunflower of ghosts: spiky, not a disc) until
// n is in the thousands. Each sample is blurred here, before it is added, by
// about the gap between neighbouring copies at that pixel's own depth: the
// copies merge into a smooth disc, and what is in focus (gap under a pixel)
// is left exactly as it was. Taps are weighed by their own blur, so a sharp
// foreground does not bleed into a blurred background.
const SMOOTH_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform sampler2D depthMap;
uniform float weight;
uniform float cocScale;
uniform float focus;
uniform float near;
uniform float far;
uniform float spread;
uniform vec2 texel;
uniform float seed;
varying vec2 vUv;
float distanceAt(vec2 uv) {
  float ndc = texture2D(depthMap, uv).x * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - ndc * (far - near));
}
// Radius in pixels of the gap between neighbouring copies of a point at this pixel's depth.
float gapAt(vec2 uv) {
  float d = distanceAt(uv);
  return 0.5 * cocScale * abs(d - focus) / d * spread;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float r = gapAt(vUv);
  vec4 own = texture2D(map, vUv);
  if (r < 0.6) { gl_FragColor = own * weight; return; }
  // A small disk of taps, turned per pixel and per sample, so the smoothing has no pattern of its own.
  float turn = hash(gl_FragCoord.xy + seed) * 6.2831853;
  vec4 acc = own;
  float total = 1.0;
  for (int k = 0; k < 12; k++) {
    float fr = sqrt((float(k) + 0.5) / 12.0);
    float a = float(k) * 2.39996323 + turn;
    vec2 off = vec2(cos(a), sin(a)) * fr * r;
    vec2 uv = vUv + off * texel;
    float w = clamp(gapAt(uv) / max(length(off), 0.001), 0.0, 1.0);
    acc += texture2D(map, uv) * w;
    total += w;
  }
  gl_FragColor = acc / total * weight;
}`;

// Debug views (`still --stage-debug`): a linear buffer encoded for display,
// or its alpha as grey.
const DEBUG_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform int mode;
varying vec2 vUv;
vec3 toSrgb(vec3 c) { return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 c = texture2D(map, vUv);
  gl_FragColor = mode == 1 ? vec4(vec3(c.a), 1.0) : vec4(toSrgb(clamp(c.rgb, 0.0, 1.0)), 1.0);
}`;

const FLOOR_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// The mirrored scene, rendered this sample from this sample's camera, read
// back in screen space and faded out towards the floor's edge.
const FLOOR_FRAGMENT = /* glsl */ `
uniform sampler2D reflection;
uniform vec2 resolution;
uniform float strength;
uniform vec2 fade;
uniform vec2 center;
varying vec3 vWorld;
void main() {
  vec4 r = texture2D(reflection, gl_FragCoord.xy / resolution);
  float d = length(vWorld.xz - center);
  float k = strength * (1.0 - smoothstep(fade.x, fade.y, d));
  gl_FragColor = r * k;
}`;

function halton(i: number, base: number) {
  let f = 1;
  let r = 0;
  for (let k = i + 1; k > 0; k = Math.floor(k / base)) {
    f /= base;
    r += f * (k % base);
  }
  return r;
}

function createGpu(canvas: HTMLCanvasElement, width: number, height: number, ratio: number) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
  // The output pass encodes and tone-maps; three renders linear everywhere else.
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.autoClear = false;
  renderer.shadowMap.type = PCFShadowMap;
  // Shadow maps are drawn once per sample, in the main pass only.
  renderer.shadowMap.autoUpdate = false;
  RectAreaLightUniformsLib.init();

  const w = Math.round(width * ratio);
  const h = Math.round(height * ratio);
  const sample = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: true });
  // Read back by the bokeh smoothing: each pixel's distance sets how far its copies sit apart.
  sample.depthTexture = new DepthTexture(w, h);
  const sum = new WebGLRenderTarget(w, h, { type: FloatType, depthBuffer: false });
  const reflection = new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: true });

  const add = new ShaderMaterial({
    uniforms: { map: { value: sample.texture }, weight: { value: 1 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: ADD_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    ...ADD_BLEND,
  });
  const smooth = new ShaderMaterial({
    uniforms: {
      map: { value: sample.texture },
      depthMap: { value: sample.depthTexture },
      weight: { value: 1 },
      cocScale: { value: 0 },
      focus: { value: 1 },
      near: { value: 1 },
      far: { value: 1000 },
      spread: { value: 0 },
      texel: { value: [1 / w, 1 / h] },
      seed: { value: 0 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: SMOOTH_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    ...ADD_BLEND,
  });
  const output = new ShaderMaterial({
    uniforms: outputUniforms(),
    vertexShader: QUAD_VERTEX,
    fragmentShader: OUTPUT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  });
  output.uniforms.map.value = sum.texture;
  output.uniforms.resolution.value = [w, h];
  const quad = new Mesh(new PlaneGeometry(2, 2), add);
  const quadScene = new Scene();
  quadScene.add(quad);
  const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    renderer,
    gl: renderer.getContext() as WebGL2RenderingContext,
    size: { w, h },
    sample,
    sum,
    reflection,
    add,
    smooth,
    output,
    quad,
    quadScene,
    quadCamera,
    environments: new Environments(renderer),
    bloom: null as Bloom | null,
    /** Made on the first frame with `post.effects`. */
    effects: null as EffectChain | null,
    /** Made on the first debug frame: a display-sized target and the material that encodes into it. */
    debug: null as { target: WebGLRenderTarget; material: ShaderMaterial; pixels: Uint8Array } | null,
    luts: new Map<string, { texture: Texture; size: number }>(),
    dispose() {
      sample.dispose();
      sum.dispose();
      reflection.dispose();
      add.dispose();
      smooth.dispose();
      output.dispose();
      this.bloom?.dispose();
      this.effects?.dispose();
      disposeLensLight(renderer);
      this.debug?.target.dispose();
      this.debug?.material.dispose();
      this.environments.dispose();
      for (const l of this.luts.values()) l.texture.dispose();
      renderer.dispose();
    },
  };
}

type Gpu = ReturnType<typeof createGpu>;

const defaultLight = () => keyLight();

/** One light slot: the area light that shades, and a spot that only casts its shadow. */
type Rig = { area: RectAreaLight; spot: SpotLight };

const mirror = new Matrix4();
const planeNormal = new Vector3();
const planePoint = new Vector3();
const clip = new Plane();
const lightRight = new Vector3();
const lightUp = new Vector3();
const lightFwd = new Vector3();

/**
 * A 3D stage rendered like a film camera: every frame averages `samples`
 * renders taken through different points of a real lens aperture (depth of
 * field with true bokeh and occlusion), at different moments of an open
 * shutter (motion blur), at different sub-pixel offsets (anti-aliasing),
 * summed in 32-bit float so dark gradients do not band.
 *
 * The same samples do the rest of the physics: shadows come from a different
 * point on each soft box every sample (so they are soft by the size of the
 * light), and a <Floor>'s reflection comes off a slightly different tilt of
 * the floor every sample (so it blurs with distance, like polished stone).
 *
 * Children are <Panel>s (live DOM as textured slabs), a <Floor>, or anything
 * that registers through StageContext. Everything is a function of the frame.
 */
export function Stage3D({
  lens,
  light = defaultLight,
  lights,
  environment = 1,
  samples = 96,
  smoothBokeh = true,
  preview = 8,
  shutter,
  background,
  backdrop,
  grain = 0.012,
  exposure = 1,
  post,
  children,
  style,
}: Stage3DProps) {
  const frame = useFrame();
  const { width, height, fps } = useVideoInfo();
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdropEl = useRef<HTMLDivElement>(null);
  const overlayParent = useRef<HTMLDivElement>(null);
  /** The frame or props changed since the canvas was last drawn. */
  const dirty = useRef(true);
  const gpu = useRef<Gpu | null>(null);
  const settled = useRef<(() => void)[]>([]);
  const props = {
    frame,
    fps,
    lens,
    light,
    lights,
    environment,
    samples,
    smoothBokeh,
    preview,
    shutter,
    background,
    grain,
    exposure,
    post,
  };
  const latest = useRef(props);
  latest.current = props;
  const [, setTick] = useState(0);
  const debugViews = useRef<DebugView[]>([]);

  const [world] = useState(() => {
    const scene = new Scene();
    // Everything that is mirrored for the floor's reflection: items and lights.
    const content = new Group();
    content.matrixAutoUpdate = false;
    scene.add(content);
    const camera = new PerspectiveCamera();
    const items = new Set<StageItem>();
    const rigs: Rig[] = [];
    const live = htmlInCanvas();
    const floor = {
      config: null as FloorConfig | null,
      mirror: null as Mesh<PlaneGeometry, ShaderMaterial> | null,
      catcher: null as Mesh<PlaneGeometry, ShadowMaterial> | null,
    };
    const backdrop = { texture: new ExternalTexture(null), gl: null as WebGLTexture | null, ready: false };
    // DOM textures have v = 0 at the top; the background quad expects it at the bottom.
    backdrop.texture.repeat.set(1, -1);
    backdrop.texture.offset.set(0, 1);
    const context: StageContextValue = {
      live,
      add(item) {
        items.add(item);
        content.add(item.object);
        return () => {
          items.delete(item);
          content.remove(item.object);
        };
      },
      setFloor(config) {
        floor.config = config;
      },
      lens: () => latest.current.lens,
      refresh: () => setTick((n) => n + 1),
      overlay: typeof document === "undefined" ? null : document.createElement("div"),
    };
    if (context.overlay)
      Object.assign(context.overlay.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    return { scene, content, camera, items, rigs, live, context, floor, backdrop };
  });

  function lightRig(i: number) {
    let rig = world.rigs[i];
    if (!rig) {
      const area = new RectAreaLight(0xffffff, 1, 1, 1);
      const spot = new SpotLight(0xffffff, 0);
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.5;
      world.content.add(area, spot, spot.target);
      rig = { area, spot };
      world.rigs.push(rig);
    }
    return rig;
  }

  function floorMeshes(g: Gpu, config: FloorConfig) {
    const f = world.floor;
    if ((config.reflect ?? 0) > 0 && !f.mirror) {
      const material = new ShaderMaterial({
        uniforms: {
          reflection: { value: g.reflection.texture },
          resolution: { value: [g.size.w, g.size.h] },
          strength: { value: 0 },
          fade: { value: [0, 1] },
          center: { value: [0, 0] },
        },
        vertexShader: FLOOR_VERTEX,
        fragmentShader: FLOOR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
      });
      f.mirror = new Mesh(new PlaneGeometry(1, 1), material);
      f.mirror.rotation.x = -Math.PI / 2;
      f.mirror.renderOrder = -1;
      world.scene.add(f.mirror);
    }
    if ((config.shadow ?? 0) > 0 && !f.catcher) {
      f.catcher = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ transparent: true, depthWrite: false }));
      f.catcher.rotation.x = -Math.PI / 2;
      f.catcher.receiveShadow = true;
      f.catcher.renderOrder = -1;
      world.scene.add(f.catcher);
      g.renderer.shadowMap.enabled = true;
    }
    const [start, end] = config.fade ?? [2500, 6000];
    const [cx, cz] = config.center ?? [0, 0];
    for (const m of [f.mirror, f.catcher]) {
      if (!m) continue;
      m.position.set(cx, config.y, cz);
      m.scale.set(end * 2, end * 2, 1);
    }
    if (f.mirror) {
      const u = f.mirror.material.uniforms;
      u.strength.value = config.reflect ?? 0;
      u.fade.value = [start, end];
      u.center.value = [cx, cz];
      f.mirror.visible = (config.reflect ?? 0) > 0;
    }
    if (f.catcher) {
      f.catcher.material.opacity = config.shadow ?? 0;
      f.catcher.visible = (config.shadow ?? 0) > 0;
    }
  }

  function environmentAt(t: number): Environment {
    const e = latest.current.environment;
    if (typeof e === "number") return { intensity: e };
    return typeof e === "function" ? e(t) : e;
  }

  /**
   * The passes behind a frame, as images for `still --stage-debug`: one
   * sample without post, what glass sees (three's transmission buffer), the
   * floor's reflection, the alpha of everything in the scene, and the backdrop.
   */
  function debugPasses(g: Gpu, drawOne: () => void, reflect: boolean): DebugView[] {
    const { renderer } = g;
    const { scene, content, camera, floor, backdrop } = world;
    const dw = Math.min(960, g.size.w);
    const dh = Math.round((dw * g.size.h) / g.size.w);
    g.debug ??= {
      target: new WebGLRenderTarget(dw, dh),
      material: new ShaderMaterial({
        uniforms: { map: { value: null }, mode: { value: 0 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: DEBUG_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        blending: NoBlending,
      }),
      pixels: new Uint8Array(dw * dh * 4),
    };
    const d = g.debug;
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const image = ctx.createImageData(dw, dh);
    const blank = () => {
      ctx.fillStyle = "#16161a";
      ctx.fillRect(0, 0, dw, dh);
      return canvas.toDataURL("image/jpeg", 0.9);
    };
    const snap = (texture: Texture, mode: 0 | 1) => {
      d.material.uniforms.map.value = texture;
      d.material.uniforms.mode.value = mode;
      g.quad.material = d.material;
      renderer.setRenderTarget(d.target);
      renderer.render(g.quadScene, g.quadCamera);
      renderer.readRenderTargetPixels(d.target, 0, 0, dw, dh, d.pixels);
      // GL rows run bottom up.
      for (let y = 0; y < dh; y++)
        image.data.set(d.pixels.subarray((dh - 1 - y) * dw * 4, (dh - y) * dw * 4), y * dw * 4);
      ctx.putImageData(image, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    };
    const views: DebugView[] = [];

    drawOne();
    views.push({ label: "one sample, no post", src: snap(g.sample.texture, 0) });
    let transmission: Texture | null = null;
    content.traverse((o) => {
      const m = (o as Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        if (transmission || !((mat as MeshPhysicalMaterial).transmission > 0)) continue;
        const u = (renderer.properties.get(mat) as { uniforms?: Record<string, { value: unknown }> }).uniforms;
        transmission = (u?.transmissionSamplerMap?.value as Texture | undefined) ?? null;
      }
    });
    views.push(
      transmission
        ? { label: "what glass sees (transmission)", src: snap(transmission, 0) }
        : { label: "what glass sees: no glass in frame", src: blank() },
    );
    views.push(
      reflect
        ? { label: "floor reflection", src: snap(g.reflection.texture, 0) }
        : { label: "floor reflection: no reflecting floor", src: blank() },
    );

    // The same camera, without backdrop and floor: how opaque each thing is.
    const shown = [floor.mirror?.visible, floor.catcher?.visible];
    if (floor.mirror) floor.mirror.visible = false;
    if (floor.catcher) floor.catcher.visible = false;
    scene.background = null;
    renderer.setRenderTarget(g.sample);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    views.push({ label: "alpha (white opaque, backdrop and floor off)", src: snap(g.sample.texture, 1) });

    // The backdrop alone, as the stage takes it in.
    content.visible = false;
    scene.background = backdrop.ready ? backdrop.texture : null;
    const p = latest.current;
    renderer.setRenderTarget(g.sample);
    renderer.setClearColor(p.background ? new Color(p.background) : new Color(0, 0, 0), p.background ? 1 : 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    views.push({
      label: backdrop.ready ? "backdrop" : p.background ? `background ${p.background} (no backdrop)` : "no backdrop",
      src: snap(g.sample.texture, 0),
    });
    content.visible = true;
    if (floor.mirror) floor.mirror.visible = !!shown[0];
    if (floor.catcher) floor.catcher.visible = !!shown[1];
    return views;
  }

  /** Draw the frame. `again`: the samples are summed already; only finish and present them. */
  function render(again = false) {
    const g = gpu.current;
    if (!g) return;
    const p = latest.current;
    const { renderer } = g;
    const { scene, content, camera, items, floor, backdrop } = world;
    // A draft (`still --samples 8`, `check`) overrides the stage's own count in renders.
    const own = typeof p.samples === "function" ? p.samples(p.frame) : p.samples;
    const n = Math.max(1, Math.round(isRenderMode() ? (renderQuality().samples ?? own) : p.preview));
    const s = p.shutter;
    const moving = !!s && (!s.when || s.when.some(([a, b]) => p.frame >= a - 1 && p.frame < b + 1));
    const angle = s?.angle ?? 180;
    const phase = s?.phase ?? -angle / 2;
    const clear = p.background ? new Color(p.background) : new Color(0, 0, 0);
    const config = floor.config;
    if (config) floorMeshes(g, config);
    const reflect = !!config && (config.reflect ?? 0) > 0;
    const shadows = !!config && (config.shadow ?? 0) > 0;

    /** One sample `i` of `n` at time `t`, into `g.sample` (and `g.reflection` with a reflecting floor). */
    const drawSample = (i: number, n: number, t: number) => {
      for (const item of items) item.update(t);

      const env = environmentAt(t);
      scene.environment = g.environments.get(env);
      scene.environmentIntensity = env.intensity ?? 1;
      scene.environmentRotation.set(0, ((env.rotation ?? 0) * Math.PI) / 180, 0);

      // Lights, and for shadows a point on each soft box's face for this sample.
      const boxes = p.lights ? p.lights(t) : [p.light(t)];
      const shadowSpot = [halton(i, 5) * 2 - 1, halton(i, 7) * 2 - 1];
      for (let k = 0; k < Math.max(boxes.length, world.rigs.length); k++) {
        const box = boxes[k];
        const rig = lightRig(k);
        rig.area.visible = !!box;
        rig.spot.visible = !!box && shadows && (box.shadow ?? k === 0);
        rig.spot.castShadow = rig.spot.visible;
        if (!box) continue;
        const target = box.target ?? [0, 0, 0];
        rig.area.position.set(...box.position);
        rig.area.lookAt(...target);
        rig.area.width = box.width;
        rig.area.height = box.height;
        rig.area.intensity = box.intensity ?? 2.5;
        rig.area.color.set(box.color ?? "#ffffff");
        if (rig.spot.visible) {
          lightFwd.set(target[0] - box.position[0], target[1] - box.position[1], target[2] - box.position[2]);
          const dist = lightFwd.length();
          lightFwd.normalize();
          lightRight
            .crossVectors(lightFwd, Math.abs(lightFwd.y) > 0.99 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0))
            .normalize();
          lightUp.crossVectors(lightRight, lightFwd).normalize();
          rig.spot.position
            .set(...box.position)
            .addScaledVector(lightRight, (shadowSpot[0] * box.width) / 2)
            .addScaledVector(lightUp, (shadowSpot[1] * box.height) / 2);
          rig.spot.target.position.set(...target);
          const reach = config?.fade?.[1] ?? 3000;
          rig.spot.angle = Math.min(1.4, Math.atan2(reach, dist));
          rig.spot.shadow.camera.near = dist * 0.1;
          rig.spot.shadow.camera.far = dist * 4;
        }
      }
      aimThroughLens(camera, p.lens(t), diskSample(i, n), pixelJitter(i, n), g.size.w, g.size.h);

      if (reflect && config) {
        // The world mirrored in the floor, tilted a little differently each
        // sample: averaged, a glossy reflection that softens with distance.
        const r = (config.roughness ?? 0.2) * 0.12;
        const [jx, jy] = diskSample(i * 7 + 3, n * 7);
        planeNormal.set(jx * r, 1, jy * r).normalize();
        planePoint.set(0, config.y, 0);
        const d = planeNormal.dot(planePoint);
        const [a, b, c] = [planeNormal.x, planeNormal.y, planeNormal.z];
        mirror.set(
          1 - 2 * a * a,
          -2 * a * b,
          -2 * a * c,
          2 * a * d,
          -2 * a * b,
          1 - 2 * b * b,
          -2 * b * c,
          2 * b * d,
          -2 * a * c,
          -2 * b * c,
          1 - 2 * c * c,
          2 * c * d,
          0,
          0,
          0,
          1,
        );
        content.matrix.copy(mirror);
        content.matrixWorldNeedsUpdate = true;
        clip.setFromNormalAndCoplanarPoint(planeNormal.clone().negate(), planePoint);
        renderer.clippingPlanes = [clip];
        // The backdrop stays: glass in the reflection refracts it, and being
        // screen-space it adds nothing where the floor shows it back.
        scene.background = backdrop.ready ? backdrop.texture : null;
        if (floor.mirror) floor.mirror.visible = false;
        if (floor.catcher) floor.catcher.visible = false;
        renderer.setRenderTarget(g.reflection);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        if (floor.mirror) floor.mirror.visible = true;
        if (floor.catcher) floor.catcher.visible = shadows;
        renderer.clippingPlanes = [];
        content.matrix.identity();
        content.matrixWorldNeedsUpdate = true;
      }

      scene.background = backdrop.ready ? backdrop.texture : null;
      if (shadows) renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(g.sample);
      renderer.setClearColor(clear, p.background ? 1 : 0);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
    };

    if (renderQuality().debug && isRenderMode() && !again) {
      debugViews.current = debugPasses(g, () => drawSample(0, 1, p.frame), reflect);
    }

    renderer.setRenderTarget(g.sum);
    renderer.setClearColor(0x000000, 0);
    if (!again) renderer.clear(true, false, false);
    g.quad.material = g.add;
    g.add.uniforms.weight.value = 1 / n;
    const smoothing = g.smooth.uniforms;
    smoothing.weight.value = 1 / n;
    // Neighbouring points of an n-point sunflower on a disk of radius R sit about R·√(π/n) apart.
    smoothing.spread.value = Math.sqrt(Math.PI / n);
    for (let i = 0; i < (again ? 0 : n); i++) {
      const t = moving ? p.frame + (phase + ((shutterSlot(i, n) + 0.5) / n) * angle) / 360 : p.frame;
      drawSample(i, n, t);
      renderer.setRenderTarget(g.sum);
      const lens = p.lens(t);
      if (p.smoothBokeh && n > 1 && (lens.aperture ?? 0) > 0) {
        const focus = lens.focus ?? distanceTo(lens);
        const halfH = focus * Math.tan(((lens.fov ?? 30) * Math.PI) / 360);
        smoothing.cocScale.value = ((lens.aperture ?? 0) / (2 * halfH)) * g.size.h;
        smoothing.focus.value = focus;
        smoothing.near.value = camera.near;
        smoothing.far.value = camera.far;
        smoothing.seed.value = i * 17.31;
        g.quad.material = g.smooth;
      } else {
        g.add.uniforms.map.value = g.sample.texture;
        g.quad.material = g.add;
      }
      renderer.render(g.quadScene, g.quadCamera);
    }
    g.quad.material = g.add;

    // postprocessing's effects on the averaged image, then the finishing: bloom
    // from it, then grade, vignette, LUT, grain.
    let image: Texture = g.sum.texture;
    if (p.post?.effects?.length) {
      g.effects ??= new EffectChain(renderer, g.size.w, g.size.h, camera);
      image = g.effects.render(g.sum.texture, p.post.effects, p.frame / p.fps);
    }
    const u = g.output.uniforms as ReturnType<typeof outputUniforms>;
    u.map.value = image;
    const bloom = bloomOptions(p.post?.bloom);
    if (bloom) {
      g.bloom ??= new Bloom(g.size.w, g.size.h);
      u.bloom.value = g.bloom.render(renderer, image, [g.size.w, g.size.h], bloom.threshold, bloom.radius);
      u.bloomStrength.value = bloom.strength;
    } else u.bloomStrength.value = 0;
    renderLensLight(renderer, u, p.post, image, [g.size.w, g.size.h]);
    applyPost(u, p.post, g.size.h / 1080);
    const lut = p.post?.lut ? g.luts.get(p.post.lut) : undefined;
    u.lut.value = (lut?.texture as never) ?? null;
    u.lutSize.value = lut?.size ?? 2;
    u.lutMix.value = lut ? (p.post?.lutMix ?? 1) : 0;
    u.exposure.value = p.exposure;
    u.grain.value = p.grain / 255;
    u.frame.value = p.frame;
    g.quad.material = g.output;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.render(g.quadScene, g.quadCamera);
  }

  function finish() {
    for (const done of settled.current.splice(0)) done();
  }

  useLayoutEffect(() => {
    const el = canvas.current as PaintCanvas | null;
    if (!el) return;
    const g = createGpu(el, width, height, window.devicePixelRatio);
    gpu.current = g;
    const removeDebug = addDebugView(() => debugViews.current);
    const overlay = world.context.overlay;
    if (overlay) overlayParent.current?.appendChild(overlay);
    if (world.live) {
      // Paint events are when canvas children have fresh pixels: capture the
      // ones that changed, then draw the frame with them.
      el.onpaint = (event) => {
        // In a render, paints after the frame was let go are screenshots of
        // the same frame: present the summed samples again instead of
        // drawing them all anew (the canvas must still be drawn in the paint,
        // or the screenshot never arrives).
        const again = isRenderMode() && isFrameSettled() && !dirty.current;
        dirty.current = false;
        const changed = again ? [] : event.changedElements;
        for (const item of world.items) {
          if (item.capture && item.element && (!changed || changed.includes(item.element))) item.capture(g.gl);
        }
        const b = backdropEl.current;
        if (b && !again && (!changed || changed.includes(b) || !world.backdrop.ready)) {
          world.backdrop.gl ??= g.gl.createTexture();
          world.backdrop.texture.sourceTexture = world.backdrop.gl;
          uploadElement(g.gl, world.backdrop.gl, b, false);
          world.backdrop.ready = true;
        }
        g.renderer.resetState();
        // Release the frame even if drawing throws; the error reaches the renderer as a page error.
        try {
          render(again);
        } finally {
          finish();
        }
      };
    }
    return () => {
      removeDebug();
      overlay?.remove();
      el.onpaint = null;
      finish();
      g.dispose();
      gpu.current = null;
    };
    // The GPU side is built once; per-frame state flows through `latest`.
  }, []);

  // Files the frame needs (HDRIs, LUTs) load once, and the render waits for them.
  const envUrl = (() => {
    const e = environment;
    if (typeof e === "number") return undefined;
    return typeof e === "function" ? e(frame).url : e.url;
  })();
  const lutUrl = post?.lut;
  useLayoutEffect(() => {
    const g = gpu.current;
    if (!g) return;
    if (envUrl && !g.environments.get({ url: envUrl }))
      waitFor(g.environments.load(envUrl), `Stage3D environment ${envUrl}`);
    if (lutUrl && !g.luts.has(lutUrl)) {
      waitFor(
        new LUTCubeLoader().loadAsync(lutUrl).then((r) => {
          g.luts.set(lutUrl, { texture: r.texture3D, size: r.size });
        }),
        `Stage3D LUT ${lutUrl}`,
      );
    }
  }, [envUrl, lutUrl]);

  // Every frame: wait for the children's paint (it carries this frame's DOM),
  // or draw straight away where DOM textures are not available.
  useLayoutEffect(() => {
    const el = canvas.current as PaintCanvas | null;
    if (!el) return;
    dirty.current = true;
    if (!world.live || !el.requestPaint) {
      render();
      return;
    }
    waitFor(
      new Promise<void>((resolve) => {
        settled.current.push(resolve);
        el.requestPaint?.();
        // A paint that never comes should not hang a render.
        setTimeout(() => {
          if (!settled.current.includes(resolve)) return;
          try {
            render();
          } finally {
            finish();
          }
        }, 3000);
      }),
      "Stage3D paint",
    );
  });

  // `layoutsubtree` lays children out (unpainted) so they can be drawn into the canvas.
  const subtree = world.live ? { layoutsubtree: "" } : {};
  const backdropBox: CSSProperties = { position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" };
  return (
    <StageContext.Provider value={world.context}>
      {/* Without DOM textures the backdrop is a plain layer behind (no refraction). */}
      {backdrop && !world.live && <div style={backdropBox}>{backdrop}</div>}
      <canvas
        ref={canvas}
        {...subtree}
        style={{ position: "absolute", left: 0, top: 0, width, height, display: "block", ...style }}
      >
        {backdrop && world.live && (
          <div ref={backdropEl} style={{ ...backdropBox, pointerEvents: "none" }}>
            {backdrop}
          </div>
        )}
        {children}
      </canvas>
      {/* Overlay3D content is portalled into a layer here, above the picture. */}
      <div
        ref={overlayParent}
        style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none" }}
      />
      {!world.live && !isRenderMode() && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            font: "12px ui-monospace, monospace",
            color: "rgb(255 255 255 / 0.6)",
          }}
        >
          UI textures need Chrome with chrome://flags/#canvas-draw-element
        </div>
      )}
    </StageContext.Provider>
  );
}
