import { useFrame, useVideoInfo, waitFor } from "@intentface-launch/core";
import { isFrameSettled, isRenderMode } from "@intentface-launch/core/timeline";
import { type Effect, EffectAttribute, type EffectMaterial, EffectPass } from "postprocessing";
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type Camera,
  ExternalTexture,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  NoBlending,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { htmlInCanvas, uploadElement } from "./dom-texture.js";
import { QUAD_VERTEX } from "./post.js";

/**
 * Run `work` with `Math.random` seeded from `key`. postprocessing draws random
 * numbers when it builds an effect (noise textures) and on every update of
 * some (GlitchEffect); seeded, they are the same in every render of a frame.
 */
export function seededRandom<T>(key: number, work: () => T): T {
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

/**
 * A postprocessing effect, built once per mount (with `Math.random` seeded,
 * so its noise is the same in every render) and disposed with the shot. Set
 * its values in the render from the frame: `bloom.intensity = interpolate(…)`.
 */
export function usePostEffect<T extends Effect>(build: () => T): T {
  const [effect] = useState(() => seededRandom(0, build));
  useEffect(() => () => effect.dispose(), [effect]);
  return effect;
}

/** The seed each effect's next update runs with. */
const updateSeed = new WeakMap<Effect, number>();

/**
 * Give an effect's updates a random stream of its own, seeded per frame.
 * With one stream for all, an effect that makes objects on its first update
 * (three.js draws a UUID from `Math.random` for each) would shift the numbers
 * the next effect gets (GlitchEffect's) depending on which frame came first.
 */
function ownStream(effect: Effect) {
  if (updateSeed.has(effect)) return;
  updateSeed.set(effect, 0);
  const update = effect.update.bind(effect);
  effect.update = (renderer, input, delta) =>
    seededRandom(updateSeed.get(effect) ?? 0, () => update(renderer, input, delta));
}

const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float flipY;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vec2(vUv.x, flipY > 0.5 ? 1.0 - vUv.y : vUv.y)); }`;

const quad = (material: ShaderMaterial) => {
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), material));
  return scene;
};
const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

/**
 * postprocessing's effects over a texture, on the video's clock: time is set,
 * never accumulated (every pass renders with a delta of 0 at the frame's
 * time), and `Math.random` is seeded from the frame. Effects merge into as
 * few passes as postprocessing allows, in order.
 */
export class EffectChain {
  private targets: [WebGLRenderTarget, WebGLRenderTarget];
  private copy = new ShaderMaterial({
    uniforms: { map: { value: null }, flipY: { value: 0 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: COPY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
  private copyScene = quad(this.copy);
  private passes: EffectPass[] = [];
  private built: Effect[] = [];

  constructor(
    private renderer: WebGLRenderer,
    private width: number,
    private height: number,
    private camera: Camera = quadCamera,
  ) {
    const target = () =>
      new WebGLRenderTarget(width, height, {
        type: HalfFloatType,
        depthBuffer: false,
        colorSpace: LinearSRGBColorSpace,
      });
    this.targets = [target(), target()];
  }

  private build(effects: Effect[]) {
    for (const pass of this.passes) pass.fullscreenMaterial.dispose();
    this.passes = [];
    let group: Effect[] = [];
    let convolution = false;
    const flush = () => {
      if (!group.length) return;
      const pass = new EffectPass(this.camera, ...group);
      pass.setRenderer(this.renderer);
      pass.setSize(this.width, this.height);
      pass.initialize(this.renderer, true, HalfFloatType);
      this.passes.push(pass);
      group = [];
      convolution = false;
    };
    for (const effect of effects) {
      const attributes = effect.getAttributes();
      if (attributes & EffectAttribute.DEPTH)
        throw new Error(
          `${effect.name} needs the scene's depth, which a finished frame does not have (a Stage3D's lens already gives depth of field)`,
        );
      // postprocessing's own rules for one pass: one convolution effect, and no
      // effect that moves UVs (mainUv) once a convolution is in.
      const convolves = (attributes & EffectAttribute.CONVOLUTION) !== 0;
      const movesUv = /mainUv/.test(effect.getFragmentShader() ?? "");
      if (convolution && (convolves || movesUv)) flush();
      ownStream(effect);
      group.push(effect);
      convolution ||= convolves;
    }
    flush();
    this.built = [...effects];
  }

  /**
   * Apply `effects` to `input` at `seconds` and return the texture holding the
   * result. `flipY` for DOM textures, whose rows run top down.
   */
  render(input: Texture, effects: Effect[], seconds: number, { flipY = false } = {}): Texture {
    const { renderer } = this;
    if (effects.length !== this.built.length || effects.some((e, i) => e !== this.built[i])) this.build(effects);
    let [read, write] = this.targets;
    this.copy.uniforms.map.value = input;
    this.copy.uniforms.flipY.value = flipY ? 1 : 0;
    renderer.setRenderTarget(read);
    renderer.render(this.copyScene, quadCamera);
    for (const [i, effect] of effects.entries()) updateSeed.set(effect, seconds * 64 + i);
    seededRandom(seconds, () => {
      for (const pass of this.passes) {
        (pass.fullscreenMaterial as EffectMaterial).time = seconds;
        pass.render(renderer, read, write, 0, false);
        [read, write] = [write, read];
      }
    });
    return read.texture;
  }

  dispose() {
    for (const pass of this.passes) pass.fullscreenMaterial.dispose();
    for (const t of this.targets) t.dispose();
    this.copy.dispose();
  }
}

// Linear with straight alpha in (as the DOM uploads), sRGB premultiplied out:
// the chain's result onto the canvas.
const PRESENT_FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
vec3 toSrgb(vec3 c) { return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 c = texture2D(map, vUv);
  float a = clamp(c.a, 0.0, 1.0);
  gl_FragColor = vec4(toSrgb(clamp(c.rgb, 0.0, 1.0)) * a, a);
}`;

type PaintCanvas = HTMLCanvasElement & {
  requestPaint?: () => void;
  onpaint: ((e: Event & { changedElements?: Element[] }) => void) | null;
};

export type PostFXProps = {
  /** postprocessing effects (from `usePostEffect`), applied in order. */
  effects: Effect[];
  /** What the effects apply to: any DOM, laid out at the layer's size. */
  children: ReactNode;
  /** The layer's size in CSS pixels. Default: the video's. */
  width?: number;
  height?: number;
  style?: CSSProperties;
};

/**
 * postprocessing's effects (bloom, glitch, noise, chromatic aberration, …)
 * over any DOM: the children are drawn into a texture through Chrome's
 * HTML-in-Canvas, the effects run on the video's clock, and the result is
 * the layer. Without HTML-in-Canvas (the studio without the flag) the
 * children show as they are, without effects.
 */
export function PostFX({ effects, children, width, height, style }: PostFXProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const w = width ?? video.width;
  const h = height ?? video.height;
  const canvas = useRef<HTMLCanvasElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const settled = useRef<(() => void)[]>([]);
  const latest = useRef({ effects, seconds: frame / video.fps });
  latest.current = { effects, seconds: frame / video.fps };
  const [live] = useState(htmlInCanvas);

  useLayoutEffect(() => {
    const el = canvas.current as PaintCanvas | null;
    if (!el || !live) return;
    const renderer = new WebGLRenderer({
      canvas: el,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    const ratio = window.devicePixelRatio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const source = { gl: gl.createTexture(), texture: new ExternalTexture(null) };
    source.texture.sourceTexture = source.gl;
    const chain = new EffectChain(renderer, Math.round(w * ratio), Math.round(h * ratio));
    const present = new ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: PRESENT_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    const presentScene = quad(present);
    const finish = () => {
      for (const done of settled.current.splice(0)) done();
    };
    const draw = (upload: boolean) => {
      const div = content.current;
      if (upload && div && source.gl) uploadElement(gl, source.gl, div, false);
      renderer.resetState();
      const { effects, seconds } = latest.current;
      present.uniforms.map.value = chain.render(source.texture, effects, seconds, { flipY: true });
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(presentScene, quadCamera);
    };
    // Paint events are when the children have fresh pixels. In a render, paints
    // after the frame was let go are screenshots of the same frame: draw again
    // (the canvas must be drawn in the paint, or the screenshot never arrives).
    el.onpaint = () => {
      try {
        draw(!(isRenderMode() && isFrameSettled()));
      } finally {
        finish();
      }
    };
    return () => {
      el.onpaint = null;
      finish();
      chain.dispose();
      present.dispose();
      if (source.gl) gl.deleteTexture(source.gl);
      renderer.dispose();
    };
    // The GPU side is built once; the effects and the time flow through `latest`.
  }, [live]);

  // Every frame: wait for the children's paint, which carries this frame's DOM.
  useLayoutEffect(() => {
    const el = canvas.current as PaintCanvas | null;
    if (!el?.requestPaint) return;
    waitFor(
      new Promise<void>((resolve) => {
        settled.current.push(resolve);
        el.requestPaint?.();
        // A paint that never comes should not hang a render.
        setTimeout(() => {
          if (settled.current.includes(resolve)) {
            settled.current.splice(settled.current.indexOf(resolve), 1);
            resolve();
          }
        }, 3000);
      }),
      "PostFX paint",
    );
  });

  const box: CSSProperties = { position: "absolute", left: 0, top: 0, width: w, height: h };
  if (!live) return <div style={{ ...box, ...style }}>{children}</div>;
  return (
    <canvas ref={canvas} {...{ layoutsubtree: "" }} style={{ ...box, display: "block", ...style }}>
      <div ref={content} style={box}>
        {children}
      </div>
    </canvas>
  );
}
