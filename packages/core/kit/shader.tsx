import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { useFrame, useVideoInfo } from "../engine/index.js";

/*
 * Fragment shaders as layers, painted once per frame from the frame number:
 * mesh gradients, noise, grain, glows, light leaks, dither, scanlines and
 * halftone. A shader cannot see the DOM under it, so it makes pictures and
 * overlays; it composites with the shot through `mix-blend-mode`.
 */

/** A uniform's value: a number, a vector, a CSS colour (vec3 or vec4), or an array of those for a uniform array. */
export type UniformValue = number | boolean | string | readonly (number | string | readonly number[])[];

/**
 * Declared before every shader's source: the standard uniforms, `v_uv`
 * (0 → 1, origin top left, as on screen) and helpers for deterministic noise.
 * A shader's `frag` is the rest: its own uniforms, then `void main()`.
 *
 *   u_time        seconds, from the frame (fractional on motion-blur subframes)
 *   u_frame       the frame in the enclosing shot or Sequence
 *   u_progress    0 → 1, from the `progress` prop
 *   u_seed        from the `seed` prop
 *   u_resolution  the drawing buffer's size in pixels
 *
 *   hash11(x), hash12(p), noise(p) (value noise, 0 → 1), fbm(p) (5 octaves),
 *   toLinear(c), toSrgb(c), dither8() (±half a step of 8-bit, against banding)
 */
export const shaderPrelude = /* glsl */ `
precision highp float;
uniform float u_time;
uniform float u_frame;
uniform float u_progress;
uniform float u_seed;
uniform vec2 u_resolution;
varying vec2 v_uv;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.02 + 17.0;
    a *= 0.5;
  }
  return v / 0.96875;
}
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float dither8() { return (hash12(gl_FragCoord.xy + fract(u_seed * 0.137) * 97.0) - 0.5) / 255.0; }
`;

const vertex = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

type Uniform = { location: WebGLUniformLocation; type: number; size: number };
type GL = { gl: WebGLRenderingContext; canvas: HTMLCanvasElement; uniforms: Map<string, Uniform> };

function compile(gl: WebGLRenderingContext, type: number, source: string, label: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Shader: could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Line numbers in the log count from the prelude; say where `frag` starts.
    const offset = shaderPrelude.split("\n").length;
    throw new Error(
      `Shader: ${label} does not compile (frag starts at line ${offset}):\n${gl.getShaderInfoLog(shader)}`,
    );
  }
  return shader;
}

function build(gl: WebGLRenderingContext, frag: string): Map<string, Uniform> {
  const program = gl.createProgram();
  if (!program) throw new Error("Shader: could not create a program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex, "vertex shader"));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, shaderPrelude + frag, "frag"));
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Shader: does not link:\n${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);
  // One triangle that covers the viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uniforms = new Map<string, Uniform>();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (location) uniforms.set(info.name.replace(/\[0\]$/, ""), { location, type: info.type, size: info.size });
  }
  return uniforms;
}

const colours = new Map<string, number[]>();
let probe: CanvasRenderingContext2D | null = null;

/** A CSS colour as sRGB 0 → 1 with alpha. Hex is parsed directly; anything else through a 1×1 canvas. */
export function colourOf(css: string): number[] {
  const hit = colours.get(css);
  if (hit) return hit;
  let rgba: number[];
  const hex = /^#([0-9a-f]{3,8})$/i.exec(css.trim())?.[1];
  if (hex && (hex.length === 3 || hex.length === 4)) {
    rgba = [...hex].map((c) => Number.parseInt(c + c, 16) / 255);
  } else if (hex && (hex.length === 6 || hex.length === 8)) {
    rgba = (hex.match(/../g) ?? []).map((c) => Number.parseInt(c, 16) / 255);
  } else {
    if (!probe) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      probe = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!probe) throw new Error("Shader: no 2D canvas to read colours with");
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    // getImageData is not premultiplied.
    rgba = [r / 255, g / 255, b / 255, a / 255];
  }
  if (rgba.length === 3) rgba.push(1);
  colours.set(css, rgba);
  return rgba;
}

/** A value flattened to floats, colours to `components` channels each. */
function flatten(value: UniformValue, components: number, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (typeof value === "boolean") out.push(value ? 1 : 0);
  else if (typeof value === "string") out.push(...colourOf(value).slice(0, components === 4 ? 4 : 3));
  else for (const item of value) flatten(item as UniformValue, components, out);
  return out;
}

function set(gl: WebGLRenderingContext, { location, type, size }: Uniform, value: UniformValue) {
  const components =
    type === gl.FLOAT_VEC2 ? 2 : type === gl.FLOAT_VEC3 ? 3 : type === gl.FLOAT_VEC4 ? 4 : type === gl.FLOAT ? 1 : 0;
  if (type === gl.INT || type === gl.BOOL) {
    gl.uniform1i(location, Math.round(flatten(value, 1)[0] ?? 0));
    return;
  }
  if (!components) return;
  const values = flatten(value, components);
  const data = new Float32Array(components * size);
  data.set(values.slice(0, data.length));
  if (components === 1) gl.uniform1fv(location, data);
  else if (components === 2) gl.uniform2fv(location, data);
  else if (components === 3) gl.uniform3fv(location, data);
  else gl.uniform4fv(location, data);
}

export type ShaderProps = {
  /** The fragment shader after the prelude (`shaderPrelude`): its own uniforms, then `void main()` writing premultiplied `gl_FragColor`. */
  frag: string;
  /** Values for the uniforms `frag` declares, by name. Types follow the declarations. */
  uniforms?: Record<string, UniformValue>;
  /** `u_progress` (default 0). */
  progress?: number;
  /** `u_seed`: same seed, same picture (default 0). */
  seed?: number;
  /** The layer's size in CSS pixels (default the video's); the canvas fills its parent at that resolution. */
  width?: number;
  height?: number;
  /** Drawing-buffer pixels per CSS pixel (default 1; 0.5 for soft fields that do not need detail). */
  resolution?: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * A fragment shader as a layer filling its parent. It paints in a layout
 * effect, synchronously, every time the frame changes, into a canvas that keeps
 * its drawing buffer for the screenshot, so the frame is never captured
 * before it is drawn. The WebGL context is made on mount and released on
 * unmount: a page holds about 16 at once, so keep a few per shot (shots
 * unmount when they leave the screen).
 */
export function Shader({
  frag,
  uniforms = {},
  progress = 0,
  seed = 0,
  width,
  height,
  resolution = 1,
  style,
  className,
}: ShaderProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<GL | null>(null);

  // A fresh canvas per mount: a context once lost cannot be had again from the same canvas.
  useLayoutEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    parent.appendChild(canvas);
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error("Shader: WebGL is not available");
    state.current = { gl, canvas, uniforms: build(gl, frag) };
    return () => {
      state.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [frag]);

  // Paint the current frame, every render.
  useLayoutEffect(() => {
    const s = state.current;
    if (!s || s.gl.isContextLost()) return;
    const { gl, canvas } = s;
    const w = Math.max(1, Math.round((width ?? video.width) * resolution));
    const h = Math.max(1, Math.round((height ?? video.height) * resolution));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, w, h);
    const builtins: Record<string, UniformValue> = {
      u_time: frame / video.fps,
      u_frame: frame,
      u_progress: progress,
      u_seed: seed,
      u_resolution: [w, h],
    };
    for (const [name, uniform] of s.uniforms) {
      const value = name in uniforms ? uniforms[name] : builtins[name];
      if (value !== undefined) set(gl, uniform, value);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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

// --- Library -----------------------------------------------------------------------------

/** Fragment shaders for `<Shader frag={shaders.meshGradient} … />`; each has a component below that sets its uniforms. */
export const shaders = {
  /** Up to 8 colours (`u_colors`, `u_count`) blended around drifting points, the space between warped by noise. */
  meshGradient: /* glsl */ `
uniform vec3 u_colors[8];
uniform float u_count;
uniform float u_speed;
uniform float u_warp;
uniform float u_sharpness;
void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time * u_speed;
  vec2 w = vec2(fbm(p * 1.3 + vec2(u_seed * 3.1, t * 0.15)), fbm(p * 1.3 + vec2(t * 0.15, u_seed * 1.7 + 9.0)));
  p += u_warp * (w - 0.5);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_count) break;
    float f = float(i) + u_seed * 7.13;
    vec2 c = vec2(0.1 + 0.8 * hash11(f * 1.37 + 0.5), 0.1 + 0.8 * hash11(f * 2.71 + 3.3));
    c += 0.22 * vec2(sin(t * (0.5 + 0.4 * hash11(f + 1.7)) + f * 2.1), cos(t * (0.4 + 0.4 * hash11(f + 3.1)) + f * 1.3));
    c.x *= aspect;
    float weight = 1.0 / (pow(distance(p, c), u_sharpness) + 0.001);
    sum += toLinear(u_colors[i]) * weight;
    total += weight;
  }
  gl_FragColor = vec4(toSrgb(sum / total) + dither8(), 1.0);
}`,

  /** Flowing domain-warped noise through a ramp of up to 4 colours (`u_colors`, `u_count`). */
  noiseField: /* glsl */ `
uniform vec3 u_colors[4];
uniform float u_count;
uniform float u_scale;
uniform float u_speed;
uniform float u_contrast;
void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y) * u_scale + u_seed * 11.0;
  float t = u_time * u_speed;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  float v = fbm(p + 2.0 * q + vec2(t * 0.6, -t * 0.3));
  v = clamp((v - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float x = v * (u_count - 1.0);
  vec3 col = u_colors[0];
  for (int i = 1; i < 4; i++) {
    if (float(i) >= u_count) break;
    col = mix(col, u_colors[i], smoothstep(0.0, 1.0, clamp(x - float(i - 1), 0.0, 1.0)));
  }
  gl_FragColor = vec4(col + dither8(), 1.0);
}`,

  /** Film grain: mid-grey noise, new every frame, for `mix-blend-mode: overlay`. */
  filmGrain: /* glsl */ `
uniform float u_amount;
uniform float u_size;
void main() {
  vec2 p = gl_FragCoord.xy / u_size;
  float f = floor(u_frame + 0.001);
  vec2 o = vec2(hash11(f + u_seed * 13.0), hash11(f * 1.7 + u_seed)) * 1000.0;
  // Two octaves of value noise, roughly gaussian around 0.5.
  float g = (noise(p + o) + noise(p * 2.1 + o.yx) + hash12(gl_FragCoord.xy + o)) / 3.0;
  float v = 0.5 + (g - 0.5) * 2.0 * u_amount;
  gl_FragColor = vec4(vec3(v), 1.0);
}`,

  /** A soft light at a point (`u_center`, 0 → 1), a gaussian core in a wide halo; premultiplied, for `plus-lighter` or `screen`. */
  glow: /* glsl */ `
uniform vec2 u_center;
uniform vec3 u_color;
uniform float u_radius;
uniform float u_intensity;
void main() {
  vec2 d = (v_uv - u_center) * u_resolution;
  float r = length(d) / u_radius;
  float light = exp(-r * r * 2.0) + 0.35 * exp(-r * 0.9);
  float a = clamp(light * u_intensity, 0.0, 1.0);
  gl_FragColor = vec4((u_color + dither8()) * a, a);
}`,

  /** A light leak: warm soft blobs drifting across with `u_progress`; premultiplied, for `screen` or `plus-lighter`. */
  lightLeak: /* glsl */ `
uniform vec3 u_colors[3];
uniform float u_intensity;
uniform float u_angle;
void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  vec2 dir = vec2(cos(u_angle), sin(u_angle));
  float travel = mix(-0.8, 1.8, u_progress);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float f = float(i) + u_seed * 3.7;
    vec2 c = vec2(0.5 * aspect, 0.5) + dir * (travel - 0.5) * aspect * (0.8 + 0.3 * hash11(f))
      + vec2(hash11(f * 5.1) - 0.5, hash11(f * 9.3) - 0.5) * 0.7;
    float r = 0.35 + 0.35 * hash11(f * 2.3);
    float w = fbm(p * 2.0 + f + u_time * 0.2) * 0.25;
    float d = length(p - c) / r + w;
    col += toLinear(u_colors[i]) * exp(-d * d * 1.6);
  }
  col = toSrgb(col) * u_intensity;
  float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.0)) + dither8() * a, a);
}`,

  /** Ordered (Bayer 8×8) dither between two colours of a gradient (`u_source` 0) or flowing noise (1). */
  dither: /* glsl */ `
uniform vec3 u_colors[2];
uniform float u_pixel;
uniform float u_source;
uniform float u_angle;
uniform float u_speed;
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_pixel);
  vec2 uv = (cell * u_pixel + 0.5 * u_pixel) / u_resolution;
  uv.y = 1.0 - uv.y;
  float v;
  if (u_source < 0.5) {
    vec2 dir = vec2(cos(u_angle), sin(u_angle));
    v = clamp(dot(uv - 0.5, dir) + 0.5 + (u_progress - 0.5), 0.0, 1.0);
  } else {
    float aspect = u_resolution.x / u_resolution.y;
    v = fbm(vec2(uv.x * aspect, uv.y) * 3.0 + u_seed * 7.0 + vec2(u_time * u_speed, 0.0));
    v = clamp((v - 0.5) * 1.8 + 0.5, 0.0, 1.0);
  }
  float on = step(bayer8(cell), v);
  gl_FragColor = vec4(mix(u_colors[0], u_colors[1], on), 1.0);
}`,

  /** Scanlines (dark lines every `u_spacing` px, rolling at `u_speed` px/s) and a vignette; premultiplied black. */
  scanlines: /* glsl */ `
uniform float u_spacing;
uniform float u_strength;
uniform float u_speed;
uniform float u_vignette;
void main() {
  float y = gl_FragCoord.y + u_time * u_speed;
  float line = 0.5 - 0.5 * cos(6.2831853 * y / u_spacing);
  vec2 c = v_uv - 0.5;
  float vig = smoothstep(0.35, 0.85, length(c * vec2(1.0, u_resolution.y / u_resolution.x) * 1.6)) * u_vignette;
  float a = clamp(line * u_strength + vig, 0.0, 1.0);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`,

  /** Halftone dots on a rotated grid, sized by a gradient (`u_source` 0) or noise (1); ink over paper, or ink alone. */
  halftone: /* glsl */ `
uniform vec4 u_ink;
uniform vec4 u_paper;
uniform float u_cell;
uniform float u_angle;
uniform float u_source;
uniform float u_speed;
// GLSL ES 1.0 has no transpose().
mat2 transpose_rot(mat2 m) { return mat2(m[0][0], m[1][0], m[0][1], m[1][1]); }
void main() {
  float s = sin(u_angle);
  float c = cos(u_angle);
  mat2 rot = mat2(c, -s, s, c);
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 g = rot * frag / u_cell;
  vec2 centre = (floor(g) + 0.5);
  vec2 at = (transpose_rot(rot) * (centre * u_cell)) / u_resolution;
  float v;
  if (u_source < 0.5) {
    v = clamp(at.x * 0.9 + 0.05 + (u_progress - 0.5), 0.0, 1.0);
  } else {
    float aspect = u_resolution.x / u_resolution.y;
    v = fbm(vec2(at.x * aspect, at.y) * 2.5 + u_seed * 5.0 + vec2(0.0, u_time * u_speed));
    v = clamp((v - 0.5) * 2.0 + 0.5, 0.0, 1.0);
  }
  float d = length(g - centre);
  float r = 0.5 * sqrt(v) * 1.15;
  float aa = 1.0 / u_cell;
  float dot = 1.0 - smoothstep(r - aa, r + aa, d);
  vec4 ink = vec4(u_ink.rgb * u_ink.a, u_ink.a);
  vec4 paper = vec4(u_paper.rgb * u_paper.a, u_paper.a);
  gl_FragColor = mix(paper, ink, dot);
}`,
};

type Preset = Omit<ShaderProps, "frag" | "uniforms">;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * An animated mesh gradient: `colors` (2 to 8) pooled around points that
 * drift on their own paths, the borders between them warped by noise. Blends
 * in linear light and is dithered, so it does not band on dark colours.
 */
export function MeshGradient({
  colors,
  speed = 0.25,
  warp = 0.35,
  sharpness = 2.5,
  resolution = 0.5,
  ...rest
}: Preset & { colors: string[]; speed?: number; warp?: number; sharpness?: number }) {
  return (
    <Shader
      frag={shaders.meshGradient}
      resolution={resolution}
      uniforms={{ u_colors: colors, u_count: colors.length, u_speed: speed, u_warp: warp, u_sharpness: sharpness }}
      {...rest}
    />
  );
}

/** Flowing, domain-warped noise through a ramp of `colors` (2 to 4): smoke, aurora, a living background. */
export function NoiseField({
  colors,
  scale = 2.2,
  speed = 0.15,
  contrast = 1.4,
  resolution = 0.5,
  ...rest
}: Preset & { colors: string[]; scale?: number; speed?: number; contrast?: number }) {
  return (
    <Shader
      frag={shaders.noiseField}
      resolution={resolution}
      uniforms={{ u_colors: colors, u_count: colors.length, u_scale: scale, u_speed: speed, u_contrast: contrast }}
      {...rest}
    />
  );
}

/** Film grain over the shot, new every frame (`mix-blend-mode: overlay`). `amount` 0.05 to 0.15 reads as film. */
export function FilmGrain({ amount = 0.1, size = 1.4, style, ...rest }: Preset & { amount?: number; size?: number }) {
  return (
    <Shader
      frag={shaders.filmGrain}
      uniforms={{ u_amount: amount, u_size: size }}
      style={{ mixBlendMode: "overlay", pointerEvents: "none", ...style }}
      {...rest}
    />
  );
}

/** A soft light at `at` (0 → 1 across the layer), added to what is under it. */
export function LightGlow({
  at = [0.5, 0.5],
  color = "#fff",
  radius = 240,
  intensity = 0.8,
  style,
  ...rest
}: Preset & { at?: [number, number]; color?: string; radius?: number; intensity?: number }) {
  return (
    <Shader
      frag={shaders.glow}
      uniforms={{ u_center: at, u_color: color, u_radius: radius * (rest.resolution ?? 1), u_intensity: intensity }}
      style={{ mixBlendMode: "plus-lighter", pointerEvents: "none", ...style }}
      {...rest}
    />
  );
}

/** A light leak drifting across the frame as `progress` runs 0 → 1, screened over the shot. */
export function LightLeak({
  colors = ["#ff7a1a", "#ff3d5a", "#ffd36b"],
  intensity = 0.9,
  angle = 20,
  resolution = 0.5,
  style,
  ...rest
}: Preset & { colors?: string[]; intensity?: number; angle?: number }) {
  return (
    <Shader
      frag={shaders.lightLeak}
      resolution={resolution}
      uniforms={{ u_colors: colors, u_intensity: intensity, u_angle: rad(angle) }}
      style={{ mixBlendMode: "screen", pointerEvents: "none", ...style }}
      {...rest}
    />
  );
}

/** Ordered dither between two colours: a gradient (moved by `progress`) or flowing noise, in `pixel`-sized cells. */
export function Dither({
  colors = ["#111111", "#f2f2f2"],
  pixel = 4,
  source = "gradient",
  angle = 0,
  speed = 0.1,
  ...rest
}: Preset & {
  colors?: [string, string];
  pixel?: number;
  source?: "gradient" | "noise";
  angle?: number;
  speed?: number;
}) {
  return (
    <Shader
      frag={shaders.dither}
      uniforms={{
        u_colors: colors,
        u_pixel: pixel * (rest.resolution ?? 1),
        u_source: source === "noise" ? 1 : 0,
        u_angle: rad(angle),
        u_speed: speed,
      }}
      {...rest}
    />
  );
}

/** CRT scanlines with a vignette, darkening the shot under them. */
export function Scanlines({
  spacing = 4,
  strength = 0.22,
  speed = 0,
  vignette = 0.35,
  style,
  ...rest
}: Preset & { spacing?: number; strength?: number; speed?: number; vignette?: number }) {
  const k = rest.resolution ?? 1;
  return (
    <Shader
      frag={shaders.scanlines}
      uniforms={{ u_spacing: spacing * k, u_strength: strength, u_speed: speed * k, u_vignette: vignette }}
      style={{ pointerEvents: "none", ...style }}
      {...rest}
    />
  );
}

/** Halftone dots in `cell`-pixel cells at `angle`, sized by a gradient or noise. Paper `transparent` for ink only. */
export function Halftone({
  ink = "#111111",
  paper = "#f4f1ea",
  cell = 14,
  angle = 45,
  source = "gradient",
  speed = 0.1,
  ...rest
}: Preset & {
  ink?: string;
  paper?: string;
  cell?: number;
  angle?: number;
  source?: "gradient" | "noise";
  speed?: number;
}) {
  return (
    <Shader
      frag={shaders.halftone}
      uniforms={{
        u_ink: ink,
        u_paper: paper,
        u_cell: cell * (rest.resolution ?? 1),
        u_angle: rad(angle),
        u_source: source === "noise" ? 1 : 0,
        u_speed: speed,
      }}
      {...rest}
    />
  );
}
