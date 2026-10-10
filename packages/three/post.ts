import {
  AddEquation,
  Color,
  CustomBlending,
  type Data3DTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type Texture,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

/**
 * The finishing stack, applied to the stage's own pixels after the samples
 * are averaged (so bloom and grain do not multiply with the lens samples).
 * All of it is off by default: the output is the UI's exact colours.
 */
export type Post = {
  /** Glow around highlights above `threshold` (linear, 1 = white). A number is the strength. */
  bloom?: number | { strength: number; threshold?: number; radius?: number };
  /** Darkening towards the corners, 0 to 1. 0.25 is a lens; 0.5 is a look. */
  vignette?: number;
  /** Colour fringing at the corners, in pixels at 1080p. 1 to 2 is subtle. */
  aberration?: number;
  /** A named grade or your own. */
  grade?: GradeName | Grade;
  /** A .cube LUT (URL in the launch folder), applied after the grade to display colours. */
  lut?: string;
  /** How much of the LUT, 0 to 1. */
  lutMix?: number;
  /**
   * Film halation: a warm, tight glow that bright light bleeds into, as it
   * scatters back through the film base. Computed from the frame's own
   * highlights. A number is the strength (0.3 is subtle, 1 is a look).
   */
  halation?: number | { strength: number; threshold?: number; radius?: number; color?: string };
  /**
   * Lens ghosts: faint reflections between lens elements, mirrored through
   * the centre of frame from wherever bright light is, and a thin ring. They
   * move as the light moves. A number is the strength (0.2 to 0.5 is faint).
   */
  ghosts?:
    | number
    | {
        strength: number;
        /** Only light above this (linear) makes ghosts. Default 0.9. */
        threshold?: number;
        /** How many disc ghosts, 0 to 6. Default 4. */
        count?: number;
        /** Brightness of the ring ghost relative to the discs. Default 0.4. */
        ring?: number;
        /** Radius of the ring, as a fraction of the frame height. Default 0.32. */
        ringRadius?: number;
        /** Colour fringes on the ghosts. Default 0.04. */
        dispersion?: number;
      };
};

export type Grade = {
  /** Around middle grey, in stops: 1.1 is a touch punchier. */
  contrast?: number;
  saturation?: number;
  /** −1 cool to 1 warm. */
  temperature?: number;
  /** −1 green to 1 magenta. */
  tint?: number;
  /** Added to the shadows, per channel (linear). A few thousandths is a lot. */
  lift?: [number, number, number];
  /** Multiplies the highlights, per channel. */
  gain?: [number, number, number];
};

/** The grade library: starting points, tuned on UI on a dark stage. */
export const grades = {
  neutral: {},
  warm: { temperature: 0.35, saturation: 1.04, lift: [0.004, 0.002, 0] },
  cool: { temperature: -0.35, saturation: 0.98, lift: [0, 0.002, 0.006] },
  /** Deeper blacks, cool shadows, warm highlights, slightly restrained colour. */
  premium: { contrast: 1.12, saturation: 0.92, lift: [0, 0.002, 0.005], gain: [1.02, 1, 0.97] },
} satisfies Record<string, Grade>;

export type GradeName = keyof typeof grades;

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 13 taps (Jimenez, "Next generation post processing in Call of Duty"): a
// downsample that does not flicker as highlights cross pixels. The first
// level also cuts everything below the threshold, with a soft knee.
const DOWN_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec2 texel;
uniform float threshold;
uniform float prefilter;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(map, vUv + o * texel).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 0.125
    + (s(vec2(-2.0, 2.0)) + s(vec2(2.0, 2.0)) + s(vec2(-2.0, -2.0)) + s(vec2(2.0, -2.0))) * 0.03125
    + (s(vec2(0.0, 2.0)) + s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0))) * 0.0625
    + (s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0)) + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0))) * 0.125;
  if (prefilter > 0.5) {
    float knee = threshold * 0.5 + 1e-4;
    float b = max(c.r, max(c.g, c.b));
    float soft = clamp(b - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    c *= max(soft, b - threshold) / max(b, 1e-4);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const UP_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform sampler2D base;
uniform vec2 texel;
uniform float radius;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(map, vUv + o * texel * radius).rgb; }
void main() {
  vec3 c = s(vec2(0.0)) * 4.0
    + (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0
    + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
  gl_FragColor = vec4(texture2D(base, vUv).rgb + c / 16.0, 1.0);
}`;

/** A mip chain of blurs: wide, smooth glow for little cost. */
export class Bloom {
  private down: WebGLRenderTarget[] = [];
  private up: WebGLRenderTarget[] = [];
  private downMat = new ShaderMaterial({
    uniforms: { map: { value: null }, texel: { value: [0, 0] }, threshold: { value: 1 }, prefilter: { value: 0 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: DOWN_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  private upMat = new ShaderMaterial({
    uniforms: { map: { value: null }, base: { value: null }, texel: { value: [0, 0] }, radius: { value: 1 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: UP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  private quad = new Mesh(new PlaneGeometry(2, 2), this.downMat);
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(width: number, height: number, levels = 6) {
    this.scene.add(this.quad);
    let w = width;
    let h = height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      const opts = { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
      this.down.push(new WebGLRenderTarget(w, h, opts));
      this.up.push(new WebGLRenderTarget(w, h, opts));
    }
  }

  /** The glow for `input` (linear, premultiplied), at half resolution. */
  render(renderer: WebGLRenderer, input: Texture, inputSize: [number, number], threshold: number, radius: number) {
    const n = this.down.length;
    this.quad.material = this.downMat;
    let source = input;
    let size = inputSize;
    for (let i = 0; i < n; i++) {
      this.downMat.uniforms.map.value = source;
      this.downMat.uniforms.texel.value = [1 / size[0], 1 / size[1]];
      this.downMat.uniforms.threshold.value = threshold;
      this.downMat.uniforms.prefilter.value = i === 0 ? 1 : 0;
      renderer.setRenderTarget(this.down[i]);
      renderer.render(this.scene, this.camera);
      source = this.down[i].texture;
      size = [this.down[i].width, this.down[i].height];
    }
    this.quad.material = this.upMat;
    let upper = this.down[n - 1].texture;
    for (let i = n - 2; i >= 0; i--) {
      const from = i + 1 === n - 1 ? this.down[n - 1] : this.up[i + 1];
      this.upMat.uniforms.map.value = upper;
      this.upMat.uniforms.base.value = this.down[i].texture;
      this.upMat.uniforms.texel.value = [1 / from.width, 1 / from.height];
      this.upMat.uniforms.radius.value = radius;
      renderer.setRenderTarget(this.up[i]);
      renderer.render(this.scene, this.camera);
      upper = this.up[i].texture;
    }
    return upper;
  }

  dispose() {
    for (const t of [...this.down, ...this.up]) t.dispose();
    this.downMat.dispose();
    this.upMat.dispose();
  }
}

// Linear, premultiplied accumulation in; sRGB, premultiplied out. With every
// effect off this is the identity up to 0.8, so UI colours stay exact; only
// highlights above that roll off.
export const OUTPUT_FRAGMENT = /* glsl */ `
precision highp sampler3D;
uniform sampler2D map;
uniform sampler2D bloom;
uniform float bloomStrength;
uniform float exposure;
uniform float grain;
uniform float frame;
uniform vec2 resolution;
uniform float aberration;
uniform float vignette;
uniform float contrast;
uniform float saturation;
uniform vec3 white;
uniform vec3 lift;
uniform vec3 gain;
uniform sampler3D lut;
uniform float lutSize;
uniform float lutMix;
uniform sampler2D halation;
uniform float halationStrength;
uniform vec3 halationTint;
uniform sampler2D ghosts;
uniform float ghostStrength;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 shoulder(vec3 c) {
  vec3 over = max(c - 0.8, 0.0);
  return min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
}
vec3 toSrgb(vec3 c) {
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec4 sum = texture2D(map, vUv);
  if (aberration > 0.0) {
    // Radial: nothing at the centre, \`aberration\` pixels at the corners.
    vec2 d = (vUv - 0.5) * 2.0;
    vec2 o = d * aberration / resolution * 0.7071;
    sum.r = texture2D(map, vUv + o).r;
    sum.b = texture2D(map, vUv - o).b;
  }
  vec3 p = sum.rgb * exposure;
  float alpha = clamp(sum.a, 0.0, 1.0);
  if (bloomStrength > 0.0) {
    vec3 b = texture2D(bloom, vUv).rgb * bloomStrength;
    p += b;
    alpha = clamp(max(alpha, max(b.r, max(b.g, b.b))), 0.0, 1.0);
  }
  if (halationStrength > 0.0) {
    vec3 h = texture2D(halation, vUv).rgb;
    vec3 b = halationTint * dot(h, vec3(0.2126, 0.7152, 0.0722)) * halationStrength;
    p += b;
    alpha = clamp(max(alpha, max(b.r, max(b.g, b.b))), 0.0, 1.0);
  }
  if (ghostStrength > 0.0) {
    vec3 b = texture2D(ghosts, vUv).rgb * ghostStrength;
    p += b;
    alpha = clamp(max(alpha, max(b.r, max(b.g, b.b))), 0.0, 1.0);
  }
  vec3 c = alpha > 0.0 ? p / alpha : vec3(0.0);
  c *= white;
  if (contrast != 1.0) {
    c = max(c, 0.0);
    c = exp2((log2(c + 1e-5) - log2(0.18)) * contrast + log2(0.18)) - 1e-5;
  }
  c = c * gain + lift * (1.0 - clamp(c, 0.0, 1.0));
  if (saturation != 1.0) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
  }
  if (vignette > 0.0) {
    vec2 d = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
    float v = smoothstep(0.35, 1.1, length(d));
    c *= 1.0 - vignette * v * v;
  }
  c = toSrgb(shoulder(max(c, 0.0)));
  if (lutMix > 0.0) {
    vec3 uvw = clamp(c, 0.0, 1.0) * ((lutSize - 1.0) / lutSize) + 0.5 / lutSize;
    c = mix(c, texture(lut, uvw).rgb, lutMix);
  }
  vec2 q = gl_FragCoord.xy + mod(frame, 997.0) * vec2(17.31, 11.17);
  float n = hash(q) + hash(q + 71.3) - 1.0;
  c += n * (grain + 1.0 / 255.0);
  gl_FragColor = vec4(c * alpha, alpha);
}`;

export const outputUniforms = () => ({
  map: { value: null as Texture | null },
  bloom: { value: null as Texture | null },
  bloomStrength: { value: 0 },
  exposure: { value: 1 },
  grain: { value: 0 },
  frame: { value: 0 },
  resolution: { value: [1920, 1080] },
  aberration: { value: 0 },
  vignette: { value: 0 },
  contrast: { value: 1 },
  saturation: { value: 1 },
  white: { value: [1, 1, 1] },
  lift: { value: [0, 0, 0] },
  gain: { value: [1, 1, 1] },
  lut: { value: null as Data3DTexture | null },
  lutSize: { value: 2 },
  lutMix: { value: 0 },
  halation: { value: null as Texture | null },
  halationStrength: { value: 0 },
  halationTint: { value: [1, 0.3, 0.08] },
  ghosts: { value: null as Texture | null },
  ghostStrength: { value: 0 },
});

type Uniforms = ReturnType<typeof outputUniforms>;

/** Temperature and tint as channel multipliers that keep luminance. */
function whiteBalance(temperature = 0, tint = 0): [number, number, number] {
  const r = 1 + 0.12 * temperature;
  const g = 1 - 0.1 * tint;
  const b = 1 - 0.12 * temperature;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / l, g / l, b / l];
}

/** Set the output pass's grade and effect uniforms. `scale` is output height / 1080. */
export function applyPost(u: Uniforms, post: Post | undefined, scale: number) {
  const grade: Grade = typeof post?.grade === "string" ? grades[post.grade] : (post?.grade ?? {});
  u.contrast.value = grade.contrast ?? 1;
  u.saturation.value = grade.saturation ?? 1;
  u.white.value = whiteBalance(grade.temperature, grade.tint);
  u.lift.value = grade.lift ?? [0, 0, 0];
  u.gain.value = grade.gain ?? [1, 1, 1];
  u.vignette.value = post?.vignette ?? 0;
  u.aberration.value = (post?.aberration ?? 0) * scale;
}

export const bloomOptions = (b: Post["bloom"]) =>
  b === undefined || b === 0
    ? null
    : typeof b === "number"
      ? { strength: b, threshold: 1, radius: 1 }
      : { threshold: 1, radius: 1, ...b };

// Ghosts, drawn at quarter resolution from the blurred highlights. Each disc
// ghost is the highlights mirrored through the centre and scaled (a negative
// scale is mirrored), dimmer the larger it is, in a coating's tint; the ring
// is the highlights convolved with a circle at a mirrored position. Positions
// are in frame heights from the centre, so circles stay round.
const GHOST_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float aspect;
uniform int count;
uniform float scales[6];
uniform vec3 tints[6];
uniform float ring;
uniform float ringRadius;
uniform float ringScale;
uniform float dispersion;
varying vec2 vUv;
vec3 at(vec2 p) {
  vec2 uv = vec2(p.x / aspect, p.y) + 0.5;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  // Fade towards the frame's edges, where the blurred highlights are clamped.
  vec2 e = smoothstep(0.0, 0.08, uv) * smoothstep(1.0, 0.92, uv);
  return texture2D(map, uv).rgb * inside.x * inside.y * e.x * e.y;
}
void main() {
  vec2 P = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  vec3 c = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= count) break;
    float s = scales[i];
    vec3 g = vec3(
      at(P / (s * (1.0 + dispersion))).r,
      at(P / s).g,
      at(P / (s * (1.0 - dispersion))).b);
    c += g * tints[i] / max(1.0, s * s);
  }
  if (ring > 0.0) {
    vec3 r = vec3(0.0);
    for (int k = 0; k < 160; k++) {
      float a = float(k) * 0.03926991;
      vec2 o = vec2(cos(a), sin(a)) * ringRadius;
      r += vec3(
        at((P + o * (1.0 + dispersion)) / ringScale).r,
        at((P + o) / ringScale).g,
        at((P + o * (1.0 - dispersion)) / ringScale).b);
    }
    c += r / 160.0 * ring * 2.0;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

// Lens coatings reflect a little colour: green, amber, violet, cyan.
const GHOST_SCALES = [-0.55, -1.25, 0.38, -0.22, 1.6, -2.2];
const GHOST_TINTS = [
  [0.35, 0.7, 0.45],
  [0.75, 0.5, 0.25],
  [0.55, 0.4, 0.8],
  [0.35, 0.6, 0.75],
  [0.6, 0.55, 0.4],
  [0.4, 0.45, 0.7],
];

export const halationOptions = (h: Post["halation"]) =>
  h === undefined || h === 0
    ? null
    : typeof h === "number"
      ? { strength: h, threshold: 0.6, radius: 1, color: undefined as string | undefined }
      : { threshold: 0.6, radius: 1, ...h };

export const ghostOptions = (g: Post["ghosts"]) =>
  g === undefined || g === 0
    ? null
    : {
        threshold: 0.9,
        count: 4,
        ring: 0.4,
        ringRadius: 0.32,
        dispersion: 0.04,
        ...(typeof g === "number" ? { strength: g } : g),
      };

/** Halation and ghosts: post effects driven by where the bright light is in the frame. */
class LensLight {
  private halation: Bloom | null = null;
  private glow: Bloom | null = null;
  private soften: Bloom | null = null;
  private target: WebGLRenderTarget | null = null;
  private material = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      aspect: { value: 16 / 9 },
      count: { value: 4 },
      scales: { value: GHOST_SCALES },
      tints: { value: GHOST_TINTS.map(([r, g, b]) => new Vector3(r, g, b)) },
      ring: { value: 1 },
      ringRadius: { value: 0.32 },
      ringScale: { value: -0.8 },
      dispersion: { value: 0.04 },
    },
    vertexShader: QUAD_VERTEX,
    fragmentShader: GHOST_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  private quad = new Mesh(new PlaneGeometry(2, 2), this.material);
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.scene.add(this.quad);
  }

  render(renderer: WebGLRenderer, u: Uniforms, post: Post | undefined, input: Texture) {
    const size: [number, number] = [this.width, this.height];
    const h = halationOptions(post?.halation);
    if (h) {
      // A tight glow: four levels of the bloom chain instead of six.
      this.halation ??= new Bloom(this.width, this.height, 4);
      u.halation.value = this.halation.render(renderer, input, size, h.threshold, h.radius);
      u.halationStrength.value = h.strength;
      const tint = h.color ? new Color(h.color) : null;
      u.halationTint.value = tint ? [tint.r, tint.g, tint.b] : [1, 0.3, 0.08];
    } else u.halationStrength.value = 0;
    const g = ghostOptions(post?.ghosts);
    if (g) {
      this.glow ??= new Bloom(this.width, this.height, 5);
      const blurred = this.glow.render(renderer, input, size, g.threshold, 1);
      this.target ??= new WebGLRenderTarget(
        Math.max(1, Math.round(this.width / 4)),
        Math.max(1, Math.round(this.height / 4)),
        {
          type: HalfFloatType,
          depthBuffer: false,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
        },
      );
      const m = this.material.uniforms;
      m.map.value = blurred;
      m.aspect.value = this.width / this.height;
      m.count.value = Math.max(0, Math.min(6, Math.round(g.count)));
      m.ring.value = g.ring;
      m.ringRadius.value = g.ringRadius;
      m.dispersion.value = g.dispersion;
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
      // Ghosts are out of focus: soften them (and the ring's taps) with a short blur chain.
      const t = this.target;
      this.soften ??= new Bloom(t.width, t.height, 3);
      u.ghosts.value = this.soften.render(renderer, t.texture, [t.width, t.height], 0, 1);
      u.ghostStrength.value = g.strength;
    } else u.ghostStrength.value = 0;
  }

  dispose() {
    this.halation?.dispose();
    this.glow?.dispose();
    this.soften?.dispose();
    this.target?.dispose();
    this.material.dispose();
  }
}

const lensLights = new WeakMap<WebGLRenderer, LensLight>();

/**
 * Render the effects that come from the frame's own light (halation, ghosts)
 * into the output pass's uniforms. Call after the samples are summed, before
 * the output pass. Cheap when both are off.
 */
export function renderLensLight(
  renderer: WebGLRenderer,
  u: Uniforms,
  post: Post | undefined,
  input: Texture,
  size: [number, number],
) {
  if (!halationOptions(post?.halation) && !ghostOptions(post?.ghosts)) {
    u.halationStrength.value = 0;
    u.ghostStrength.value = 0;
    return;
  }
  let l = lensLights.get(renderer);
  if (!l) {
    l = new LensLight(size[0], size[1]);
    lensLights.set(renderer, l);
  }
  l.render(renderer, u, post, input);
}

export function disposeLensLight(renderer: WebGLRenderer) {
  lensLights.get(renderer)?.dispose();
  lensLights.delete(renderer);
}

// The accumulation blend: sample × weight added into the float sum.
export const ADD_BLEND = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
} as const;

export { QUAD_VERTEX };
