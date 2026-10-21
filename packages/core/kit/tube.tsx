import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { type DeclaredText, declareText, isTextHidden, useFrame, useVideoInfo } from "../engine/index.js";

/*
 * A picture on a cathode-ray tube, modelled part by part in the order light
 * goes through a real set. The picture is drawn small with Canvas 2D, one row
 * per scanline (and half again as much detail across, as an analogue line
 * carries); then the phosphor holds it and fades, red, green and blue at their
 * own rates; light scatters in the faceplate (halation); each line is a beam
 * whose spot widens as it brightens; an aperture grille, slot mask or shadow
 * mask sits on the glass; and the glass bends, darkens at its edges and
 * reflects the room. Power on and off, a channel change rolling through snow,
 * a degauss and worn tape are events on frames.
 *
 * Phosphor that remembers earlier frames would make a frame depend on the
 * frames before it. Here it is computed, not kept: each frame draws the
 * picture again at the frames before it, as many as the slowest phosphor
 * takes to fade to black, and lets them decay, so any frame renders alone.
 */

const VS = /* glsl */ `attribute vec2 a; varying vec2 v_uv;
void main(){ v_uv = a*0.5+0.5; gl_Position = vec4(a,0.0,1.0); }`;

// Phosphor: the brighter of the new picture and the previous one decayed.
const FS_PERSIST = /* glsl */ `precision mediump float;
varying vec2 v_uv;
uniform sampler2D uCur; uniform sampler2D uPrev; uniform vec3 uDecay; uniform float uFloor;
void main(){
  vec3 c = texture2D(uCur, v_uv).rgb;
  vec3 p = texture2D(uPrev, v_uv).rgb;
  vec3 pd = sqrt(p*p*uDecay) - uFloor;
  gl_FragColor = vec4(max(c, pd), 1.0);
}`;

// Halation: a separable 9-tap gaussian in linear light, stored in gamma 2.
const FS_BLUR = /* glsl */ `precision mediump float;
varying vec2 v_uv;
uniform sampler2D uTex; uniform vec2 uDir;
vec3 L(vec2 o){ vec3 c = texture2D(uTex, v_uv+o).rgb; return c*c; }
void main(){
  vec3 s = L(vec2(0.0))*0.2270;
  s += (L(uDir)+L(-uDir))*0.1945;
  s += (L(2.0*uDir)+L(-2.0*uDir))*0.1216;
  s += (L(3.0*uDir)+L(-3.0*uDir))*0.0540;
  s += (L(4.0*uDir)+L(-4.0*uDir))*0.0162;
  gl_FragColor = vec4(sqrt(s), 1.0);
}`;

const FS_TUBE = /* glsl */ `precision highp float;
varying vec2 v_uv;
uniform sampler2D uSrc; uniform sampler2D uBloom; uniform sampler2D uRaw;
uniform vec2 uRes; uniform vec2 uSrcRes;
uniform float uTime, uTick, uCurv, uMaskType, uMaskDark, uMaskGain, uDegauss;
uniform float uPowerX, uPowerY, uLevel, uRoll, uStatic, uBypass, uFlat, uConv, uBloomAmt;
uniform float uSplitX, uSplitY, uCurvX, uCurvY, uCorner, uHum, uFlicker, uNoise;
uniform float uVig, uGlare, uLift, uBeamMin, uBeamMax, uBright, uSat, uMaskScale;
uniform float uVhs, uDot, uMaskMix;

float hash(vec2 p){
  p = fract(p*vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
// Snow: new every frame (uTick), the same on every motion-blur subframe of it.
vec3 snow(float x, float line){
  float cx = floor(x*uSrcRes.x*0.5);
  float n = hash(vec2(cx*1.37 + line*17.11, line*3.31 - cx*0.73) + fract(uTick*0.1189)*vec2(113.1, 71.7));
  return vec3(n*n*0.9);
}
// Tape: line jitter, head switching at the bottom, a rolling tracking band,
// dropout speckles, and colour smeared and delayed while brightness stays sharp.
vec3 rowColor(float x, float y, float line, vec2 offR, vec2 offB){
  float spk = 0.0;
  if (uVhs > 0.0) {
    float fr = floor(uTime*29.97);
    float jit = (hash(vec2(line*0.37, fr)) - 0.5) * 0.0010;
    float hs = 1.0 - smoothstep(0.0, 0.04, y);
    jit += hs * (0.010 + 0.012*hash(vec2(line, fr + 3.0)));
    float bp = fract(uTime*0.085)*1.4 - 0.2;
    float band = 1.0 - smoothstep(0.0, 0.03, abs(y - bp));
    jit += band * (hash(vec2(line*1.7, fr*0.5)) - 0.5) * 0.025;
    x += jit * uVhs;
    float h = hash(vec2(floor(x*uSrcRes.x*0.33), line + fr*0.73));
    spk = step(0.985 - band*0.12 - hs*0.05, h) * (band + hs*0.6 + 0.04) * min(uVhs, 1.0);
  }
  float r = texture2D(uSrc, vec2(x, y) + offR).r;
  float g = texture2D(uSrc, vec2(x, y)).g;
  float b = texture2D(uSrc, vec2(x, y) + offB).b;
  vec3 c = vec3(r, g, b);
  if (uVhs > 0.0) {
    float px = 1.0/uSrcRes.x;
    vec3 ch = (texture2D(uSrc, vec2(x - 1.5*px, y)).rgb + texture2D(uSrc, vec2(x - 3.5*px, y)).rgb
             + texture2D(uSrc, vec2(x - 5.5*px, y)).rgb + texture2D(uSrc, vec2(x - 7.5*px, y)).rgb) * 0.25;
    vec3 ln = (texture2D(uSrc, vec2(x - px, y)).rgb + texture2D(uSrc, vec2(x + px, y)).rgb) * 0.5;
    float Y = mix(dot(c, vec3(0.299, 0.587, 0.114)), dot(ln, vec3(0.299, 0.587, 0.114)), 0.45);
    float I = dot(ch, vec3(0.596, -0.274, -0.322)) * 0.85;
    float Q = dot(ch, vec3(0.211, -0.523, 0.312)) * 0.85;
    vec3 v = vec3(Y + 0.956*I + 0.621*Q, Y - 0.272*I - 0.647*Q, Y - 1.106*I + 1.703*Q);
    c = mix(c, clamp(v, 0.0, 1.0), clamp(uVhs, 0.0, 1.0)) + spk;
  }
  c = mix(c, snow(x, line), uStatic);
  return c*c;
}
// The beam's spot across a line: wider when brighter, the same energy whatever its width.
vec3 beam(vec3 c, float d){
  vec3 s = mix(vec3(uBeamMin), vec3(uBeamMax), sqrt(c));
  return c * exp(-(d*d)/(2.0*s*s)) / (s*2.5066);
}
vec3 maskAt(vec2 fc){
  if (uMaskType > 2.5) return vec3(1.0);
  fc = floor(fc/uMaskScale) + 0.5;
  vec3 m = vec3(uMaskDark);
  float x;
  if (uMaskType < 0.5) {
    x = mod(fc.x, 3.0);
  } else if (uMaskType < 1.5) {
    float triad = floor(fc.x/3.0);
    float yy = mod(fc.y + mod(triad, 2.0)*2.0, 4.0);
    if (yy < 1.0) return vec3(uMaskDark*0.55);
    x = mod(fc.x, 3.0);
  } else {
    float row = floor(fc.y*0.5);
    x = mod(fc.x + mod(row, 2.0), 3.0);
  }
  if (x < 1.0) m.r = 1.0; else if (x < 2.0) m.g = 1.0; else m.b = 1.0;
  return m;
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  if (uBypass > 0.5) { gl_FragColor = vec4(texture2D(uRaw, v_uv).rgb, 1.0); return; }

  vec2 p = (v_uv*2.0 - 1.0) * (1.0 + uCurv*0.03);
  vec2 w = p * (1.0 + uCurv*vec2(uCurvX*p.y*p.y, uCurvY*p.x*p.x));
  vec2 uv = w*0.5 + 0.5;

  vec3 glass = vec3(0.016, 0.018, 0.017);
  vec2 edge = (1.0 - abs(w)) * uRes * 0.5;
  float rad = mix(0.012, uCorner, uCurv) * uRes.y;
  float dist = length(max(vec2(rad) - edge, 0.0)) - rad;
  float inside = clamp(-dist/1.5, 0.0, 1.0);
  if (inside <= 0.0) { gl_FragColor = vec4(glass, 1.0); return; }

  // Power on and off squeeze the raster; a channel change rolls it.
  float sx = max(uPowerX, 0.001), sy = max(uPowerY, 0.003);
  vec2 suv = (uv - 0.5)/vec2(sx, sy) + 0.5;
  float gain = min(inversesqrt(sx*sy), 8.0) * uLevel;
  // The squeezed raster's own edges, then the roll (which wraps, with the blanking band between frames).
  float vis = step(0.0, suv.x)*step(suv.x, 1.0)*step(0.0, suv.y)*step(suv.y, 1.0);
  float blankH = 0.09;
  suv.y = mod(suv.y + uRoll*(1.0 + blankH), 1.0 + blankH);
  vis *= step(suv.y, 1.0);

  // The two nearest scanlines.
  float ly = suv.y*uSrcRes.y - 0.5;
  float base = floor(ly);
  float f = ly - base;
  float y0 = (base + 0.5)/uSrcRes.y;
  float y1 = (base + 1.5)/uSrcRes.y;

  // Convergence drifts towards the edges, a degauss wobbles it; the guns' fixed misregistration on top.
  float cx = w.x * uConv / uSrcRes.x;
  vec2 wob = uDegauss*vec2(sin(w.y*7.0 + uTime*31.0), sin(w.x*5.0 - uTime*27.0));
  vec2 split = vec2(uSplitX/uSrcRes.x, uSplitY/uSrcRes.y);
  vec2 offR = vec2(cx + wob.x*0.012, wob.y*0.004) + split;
  vec2 offB = vec2(-cx*1.2 - wob.y*0.010, -wob.x*0.004) - split;

  vec3 c0 = rowColor(suv.x, y0, base, offR, offB);
  vec3 c1 = rowColor(suv.x, y1, base + 1.0, offR, offB);
  vec3 col = mix(beam(c0, f) + beam(c1, 1.0 - f), mix(c0, c1, f), uFlat);
  col *= gain * vis;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(lum), col, uSat), 0.0) * uBright;

  col *= 1.0 + uDegauss*0.6*vec3(
    sin(w.x*3.0 + uTime*20.0),
    sin(w.y*3.4 + uTime*23.0 + 2.0),
    sin((w.x + w.y)*2.6 + uTime*17.0 + 4.0));
  col = max(col, 0.0);

  // Switched off, the last of the beam's charge: a bright spot with a glow round it, fading.
  vec2 dq = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float dd = dot(dq, dq);
  col += vec3(1.0, 0.97, 0.93) * uDot * (exp(-dd / 0.00006) * 3.0 + exp(-dd / 0.0025) * 0.12);

  // Too fine to resolve at this size (a contact sheet, a thumbnail), the mask shows as its average.
  col *= mix(vec3(1.0), maskAt(fc) * uMaskGain, uMaskMix);

  vec3 bl = texture2D(uBloom, clamp(suv, 0.0, 1.0)).rgb;
  col += bl*bl * uBloomAmt * gain * vis;

  float vig = pow(clamp(16.0*uv.x*uv.y*(1.0 - uv.x)*(1.0 - uv.y), 0.0, 1.0), uVig);
  col *= vig;
  col *= 1.0 - uHum*(0.5 + 0.5*sin((uv.y + uTime*0.11)*6.2831));
  col *= 1.0 - uFlicker*hash(vec2(uTick, 3.1));

  col += vec3(0.0030, 0.0036, 0.0034)*uLift;
  vec2 gq = w - vec2(-0.55, 0.62);
  col += exp(-dot(gq, gq)*3.0) * uGlare * uCurv;
  col += (hash(fc + fract(uTick*0.0173)*vec2(91.7, 37.3)) - 0.5) * uNoise;

  // Highlights roll off instead of clipping.
  col = max(col, 0.0);
  vec3 over = max(col - 0.8, 0.0);
  col = min(col, vec3(0.8)) + 0.2*(1.0 - exp(-over/0.2));
  gl_FragColor = vec4(mix(glass, sqrt(col), inside), 1.0);
}`;

/** How long red, green and blue phosphor glow after the beam passes, in seconds. */
export const phosphors = {
  /** A colour set's: motion leaves a faint smear, warm at its tail. */
  standard: [0.02, 0.014, 0.007],
  /** A little longer: fast motion smears into soft trails. */
  slow: [0.05, 0.04, 0.025],
  /** Streaks behind anything quick (a starfield, a flying logo). */
  trails: [0.09, 0.07, 0.04],
  /** Long-persistence green, as on a scope or radar: a moving trace leaves a tail. */
  long: [0.3, 0.45, 0.25],
} satisfies Record<string, [number, number, number]>;

/** The masks a colour tube can have: stripes, staggered slots, or dots in triangles; `none` for a mono tube. */
const MASKS = { grille: 0, slot: 1, shadow: 2, none: 3 } as const;

export type TubeSettings = {
  /** Brightness (default 1). */
  bright: number;
  /** Saturation (default 1). */
  sat: number;
  /** The beam's width in dark and in bright parts, in lines (0.27, 0.5): highlights bleed into the gaps between lines, shadows leave them open. */
  beamMin: number;
  beamMax: number;
  /** The guns' fixed misregistration: red one way, blue the other, in picture pixels and in lines (0.8, 0). */
  splitX: number;
  splitY: number;
  /** Convergence error growing towards the edges (0.7). */
  conv: number;
  /** How much light the mask lets through between its stripes or dots (0.42); brightness is compensated. */
  maskDark: number;
  /** Mask pitch in CSS pixels per stripe or dot, kept in proportion at any render scale (2: a triad 6 px wide, which still reads as a mask after a platform's recompress; 1 is a monitor's, finer than delivered video shows). */
  maskScale: number;
  /** Halation: how much glow, and how wide (0.22, 1). */
  bloom: number;
  bloomRadius: number;
  /** Barrel curvature top and bottom, at the sides (0.045, 0.05), and the corners' rounding (0.045), at `curvature` 1. */
  curvX: number;
  curvY: number;
  corner: number;
  /** Edge darkening (0.16). */
  vignette: number;
  /** The room's reflection, top left (0.006). */
  glare: number;
  /** The grey of unlit phosphor (1). */
  lift: number;
  /** Per-pixel noise (0: noise that changes every frame compresses into blocks), flicker (0.012), the slow hum bar (0.028). */
  noise: number;
  flicker: number;
  hum: number;
};

const DEFAULTS: TubeSettings = {
  bright: 1,
  sat: 1,
  beamMin: 0.27,
  beamMax: 0.5,
  splitX: 0.8,
  splitY: 0,
  conv: 0.7,
  maskDark: 0.42,
  maskScale: 2,
  bloom: 0.22,
  bloomRadius: 1,
  curvX: 0.045,
  curvY: 0.05,
  corner: 0.045,
  vignette: 0.16,
  glare: 0.006,
  lift: 1,
  noise: 0,
  flicker: 0.012,
  hum: 0.028,
};

export type TubeScreen = {
  /** The picture's size in its own units: `height` is the line count, `width` keeps units square at the tube's aspect. */
  width: number;
  height: number;
  fps: number;
  /** True while `check` measures what is behind text: draw the picture without its text. */
  textHidden: boolean;
};

/**
 * Draws the picture for `frame` (fractional on motion-blur subframes) in
 * `screen` units, and returns the text it drew, in the same units, for `check`.
 * It is called for earlier frames too (for the phosphor), so it must be a pure
 * function of the frame: no state carried between calls.
 */
export type TubeDraw = (ctx: CanvasRenderingContext2D, frame: number, screen: TubeScreen) => DeclaredText[] | undefined;

export type TubeProps = {
  draw: TubeDraw;
  /** Scanlines (default the height over 2.9: 372 at 1080, a broadcast set's look; more is finer and flatter). */
  lines?: number;
  /** Phosphor decay: a preset from `phosphors` or seconds for red, green and blue (default `standard`). */
  phosphor?: keyof typeof phosphors | readonly [number, number, number];
  /** The mask on the glass (default `grille`). */
  mask?: keyof typeof MASKS;
  /** Curved glass, 0 flat to 1 (default 1). */
  curvature?: number;
  /** The frame the set is switched on (the raster opens from a line, through snow) and off (it collapses to a dot that fades). Before `on` and after `off`, the glass is dark. */
  power?: { on?: number; off?: number };
  /** Frames of channel changes: a burst of snow and the picture rolling down and settling. Switch what `draw` shows on the same frame. */
  tune?: readonly number[];
  /** Frames of a degauss: the colours swim and wobble for 1.8 s. */
  degauss?: readonly number[];
  /** Snow over the picture, 0 to 1: no signal at 0.9. */
  snow?: number;
  /** Tape wear, 0 to 2: line jitter, head switching, a tracking band, dropouts, smeared colour (default 0). */
  tape?: number;
  /** Everything else, as on a set's service menu. */
  settings?: Partial<TubeSettings>;
  /** The picture without the tube. */
  bypass?: boolean;
  /** The layer's size in CSS pixels (default the video's). */
  width?: number;
  height?: number;
  /** Drawing pixels per CSS pixel, on top of the render's own scale (default 1). */
  resolution?: number;
  style?: CSSProperties;
  className?: string;
};

const smooth = (a: number, b: number, x: number) => {
  const s = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return s * s * (3 - 2 * s);
};

/** The last event at or before `frame`, as seconds since it. */
function since(events: readonly number[] | undefined, frame: number, fps: number) {
  let last = Number.NEGATIVE_INFINITY;
  for (const e of events ?? []) if (e <= frame && e > last) last = e;
  return (frame - last) / fps;
}

/** Frames until a fully lit pixel of the slowest phosphor has faded to black. */
function historyFrames(tau: readonly number[], fps: number) {
  const dt = 1 / fps;
  const floor = Math.max(1.2 / 255, dt * 0.5);
  const decay = Math.exp(-dt / Math.max(...tau));
  let p = 1;
  let n = 0;
  while (p > 0 && n < 180) {
    p = Math.sqrt(p * p * decay) - floor;
    n++;
  }
  return n;
}

/** Where a point of the picture (0 → 1) lands on the glass, by inverting the bend once. */
function toGlass(u: number, v: number, curv: number, s: TubeSettings) {
  const wx = u * 2 - 1;
  const wy = v * 2 - 1;
  const k = 1 + curv * 0.03;
  const px = wx / (k * (1 + curv * s.curvX * wy * wy));
  const py = wy / (k * (1 + curv * s.curvY * wx * wx));
  return [px * 0.5 + 0.5, py * 0.5 + 0.5, 1 / k] as const;
}

type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Target = { t: WebGLTexture; f: WebGLFramebuffer };
type State = {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  src: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  programs: { persist: Program; blur: Program; tube: Program };
  size?: {
    srcW: number;
    srcH: number;
    bW: number;
    bH: number;
    tex: WebGLTexture;
    p0: Target;
    p1: Target;
    b1: Target;
    b2: Target;
  };
};

function program(gl: WebGLRenderingContext, fs: string): Program {
  const shader = (type: number, source: string) => {
    const o = gl.createShader(type);
    if (!o) throw new Error("Tube: cannot create a shader");
    gl.shaderSource(o, source);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(`Tube: ${gl.getShaderInfoLog(o)}`);
    return o;
  };
  const p = gl.createProgram();
  if (!p) throw new Error("Tube: cannot create a program");
  gl.attachShader(p, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "a");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Tube: ${gl.getProgramInfoLog(p)}`);
  const u: Program["u"] = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function texture(gl: WebGLRenderingContext, w: number, h: number) {
  const t = gl.createTexture();
  if (!t) throw new Error("Tube: cannot create a texture");
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return t;
}

function target(gl: WebGLRenderingContext, w: number, h: number): Target {
  const t = texture(gl, w, h);
  const f = gl.createFramebuffer();
  if (!f) throw new Error("Tube: cannot create a framebuffer");
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f };
}

function clear(gl: WebGLRenderingContext, t: Target) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function pass(
  gl: WebGLRenderingContext,
  prog: Program,
  to: Target | null,
  w: number,
  h: number,
  inputs: [string, WebGLTexture][],
  set: (u: Program["u"]) => void,
) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.f : null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(prog.p);
  inputs.forEach(([name, tex], i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name] ?? null, i);
  });
  set(prog.u);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/**
 * A picture drawn with Canvas 2D, shown on a cathode-ray tube: test cards,
 * idents, teletext, a scope's trace, an 80s logo on tape. Fills its parent.
 * `draw` paints the picture at the tube's line count; the rest is the set:
 * `phosphor`, `mask`, `curvature`, events on frames (`power`, `tune`,
 * `degauss`), `snow` and `tape`, and `settings` for the fine values.
 *
 * Text `draw` returns is declared to `check`, mapped onto the glass; it is
 * left out while the raster is squeezed, rolling or under snow.
 *
 * Cost: one WebGL context, and `draw` runs once per frame of phosphor memory
 * (about 9 frames for `standard`, 55 for `long`) on a picture of about
 * 1000 × 372, so keep it to paths, fills and text.
 */
export function Tube({
  draw,
  lines,
  phosphor = "standard",
  mask = "grille",
  curvature = 1,
  power,
  tune,
  degauss,
  snow = 0,
  tape = 0,
  settings,
  bypass = false,
  width,
  height,
  resolution = 1,
  style,
  className,
}: TubeProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<State | null>(null);

  // A fresh canvas per mount: a context once lost cannot be had again from the same canvas.
  useLayoutEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    parent.appendChild(canvas);
    const gl = canvas.getContext("webgl", {
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error("Tube: WebGL is not available");
    const src = document.createElement("canvas");
    const ctx = src.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!ctx) throw new Error("Tube: Canvas 2D is not available");
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    state.current = {
      gl,
      canvas,
      src,
      ctx,
      programs: { persist: program(gl, FS_PERSIST), blur: program(gl, FS_BLUR), tube: program(gl, FS_TUBE) },
    };
    return () => {
      state.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  // Paint the current frame, every render.
  useLayoutEffect(() => {
    const s = state.current;
    if (!s || s.gl.isContextLost()) return;
    const { gl, canvas, src, ctx, programs } = s;
    const cfg = { ...DEFAULTS, ...settings };
    const fps = video.fps;
    const cssW = width ?? video.width;
    const cssH = height ?? video.height;
    // Device pixels, so the mask and scanlines keep their place in the frame at any render scale.
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(2, Math.round(cssW * resolution * dpr));
    const H = Math.max(2, Math.round(cssH * resolution * dpr));
    const aspect = cssW / cssH;
    const srcH = Math.round(Math.min(480, Math.max(120, lines ?? cssH / 2.9)));
    const srcW = Math.round(Math.min(srcH * aspect * 1.5, 1600));
    const LW = srcH * aspect;
    const SX = srcW / LW;

    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    if (!s.size || s.size.srcW !== srcW || s.size.srcH !== srcH) {
      if (s.size) {
        gl.deleteTexture(s.size.tex);
        for (const o of [s.size.p0, s.size.p1, s.size.b1, s.size.b2]) {
          gl.deleteTexture(o.t);
          gl.deleteFramebuffer(o.f);
        }
      }
      src.width = srcW;
      src.height = srcH;
      const bW = Math.ceil(srcW / 4);
      const bH = Math.ceil(srcH / 4);
      s.size = {
        srcW,
        srcH,
        bW,
        bH,
        tex: texture(gl, srcW, srcH),
        p0: target(gl, srcW, srcH),
        p1: target(gl, srcW, srcH),
        b1: target(gl, bW, bH),
        b2: target(gl, bW, bH),
      };
    }
    const { tex, p0, p1, b1, b2, bW, bH } = s.size;

    // The picture at this frame and the frames before it, each decaying into the next.
    const hidden = isTextHidden();
    const screen: TubeScreen = { width: LW, height: srcH, fps, textHidden: hidden };
    const tau = typeof phosphor === "string" ? phosphors[phosphor] : phosphor;
    const dt = 1 / fps;
    const decay = tau.map((v) => Math.exp(-dt / Math.max(1e-4, v)));
    const history = bypass ? 0 : historyFrames(tau, fps);
    let texts: DeclaredText[] = [];
    let prev = p0;
    let next = p1;
    clear(gl, prev);
    for (let k = history; k >= 0; k--) {
      const f = frame - k;
      if (f < 0 && k > 0) continue;
      ctx.setTransform(SX, 0, 0, 1, 0, 0);
      const drawn = draw(ctx, f, screen);
      if (k === 0) texts = drawn || [];
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      pass(
        gl,
        programs.persist,
        next,
        srcW,
        srcH,
        [
          ["uCur", tex],
          ["uPrev", prev.t],
        ],
        (u) => {
          gl.uniform3f(u.uDecay ?? null, decay[0], decay[1], decay[2]);
          gl.uniform1f(u.uFloor ?? null, Math.max(1.2 / 255, dt * 0.5));
        },
      );
      [prev, next] = [next, prev];
    }
    const lit = prev;

    // Halation from the lit phosphor.
    pass(gl, programs.blur, b1, bW, bH, [["uTex", lit.t]], (u) =>
      gl.uniform2f(u.uDir ?? null, (2.25 * cfg.bloomRadius) / srcW, 0),
    );
    pass(gl, programs.blur, b2, bW, bH, [["uTex", b1.t]], (u) =>
      gl.uniform2f(u.uDir ?? null, 0, (1.5 * cfg.bloomRadius) / srcH),
    );

    // Events: power, channel changes, degauss.
    let px = 1;
    let py = 1;
    let level = 1;
    let stat = snow;
    let roll = 0;
    let spot = 0;
    if (power?.on !== undefined) {
      const tp = (frame - power.on) / fps;
      if (tp < 0) level = 0;
      px = smooth(0, 0.16, tp);
      py = Math.max(0.004, smooth(0.2, 0.7, tp));
      if (tp >= 0 && tp < 1.1) stat = Math.max(stat, (1 - smooth(0.3, 1.1, tp)) * 0.5);
    }
    if (power?.off !== undefined && frame >= power.off) {
      const to = (frame - power.off) / fps;
      py = Math.min(py, Math.max(0.004, 1 - smooth(0, 0.22, to)));
      px = Math.min(px, Math.max(0.001, 1 - smooth(0.18, 0.34, to)));
      level *= 1 - smooth(0.34, 0.8, to);
      spot = smooth(0.2, 0.34, to) * (1 - smooth(0.34, 0.9, to));
    }
    const ts = since(tune, frame, fps);
    if (ts < 0.9) {
      stat = Math.max(stat, ts < 0.14 ? 1 : (1 - smooth(0.14, 0.5, ts)) * 0.8);
      const e = smooth(0.06, 0.9, ts);
      roll = (1 - e) * (1 - e) * 0.6;
    }
    const td = since(degauss, frame, fps);
    const dg = td < 1.8 ? (1 - td / 1.8) ** 2 : 0;

    const maskType = MASKS[mask];
    const maskGain =
      maskType === 3
        ? 1
        : 1 /
          (maskType === 1
            ? (0.75 * (1 + 2 * cfg.maskDark)) / 3 + 0.25 * cfg.maskDark * 0.55
            : (1 + 2 * cfg.maskDark) / 3);
    pass(
      gl,
      programs.tube,
      null,
      W,
      H,
      [
        ["uSrc", lit.t],
        ["uBloom", b2.t],
        ["uRaw", tex],
      ],
      (u) => {
        const f1 = (name: string, v: number) => gl.uniform1f(u[name] ?? null, v);
        gl.uniform2f(u.uRes ?? null, W, H);
        gl.uniform2f(u.uSrcRes ?? null, srcW, srcH);
        f1("uTime", (frame / fps) % 1000);
        f1("uTick", Math.floor(frame + 1e-6) % 100000);
        f1("uCurv", curvature);
        f1("uMaskType", maskType);
        f1("uMaskDark", cfg.maskDark);
        f1("uMaskGain", maskGain);
        const pitch = cfg.maskScale * resolution * dpr;
        f1("uMaskScale", Math.max(1, Math.round(pitch)));
        f1("uMaskMix", Math.min(1, Math.max(0, (pitch - 0.75) / 0.75)));
        f1("uSplitX", cfg.splitX);
        f1("uSplitY", cfg.splitY);
        f1("uCurvX", cfg.curvX);
        f1("uCurvY", cfg.curvY);
        f1("uCorner", cfg.corner);
        f1("uHum", cfg.hum);
        f1("uFlicker", cfg.flicker);
        f1("uNoise", cfg.noise);
        f1("uVig", cfg.vignette);
        f1("uGlare", cfg.glare);
        f1("uLift", cfg.lift);
        f1("uBeamMin", cfg.beamMin);
        f1("uBeamMax", Math.max(cfg.beamMin, cfg.beamMax));
        f1("uBright", cfg.bright);
        f1("uSat", cfg.sat);
        f1("uVhs", tape);
        f1("uDot", spot);
        f1("uDegauss", dg);
        f1("uPowerX", px);
        f1("uPowerY", py);
        f1("uLevel", level);
        f1("uRoll", roll);
        f1("uStatic", Math.min(1, stat));
        f1("uBypass", bypass ? 1 : 0);
        f1("uFlat", Math.min(1, Math.max(0, (2.4 - H / srcH) / 0.9)));
        f1("uConv", cfg.conv);
        f1("uBloomAmt", cfg.bloom);
      },
    );

    // The text the picture shows, where it lands on the glass; none while the raster is disturbed.
    const steady = level > 0.99 && px > 0.99 && py > 0.99 && roll < 0.01 && stat < 0.3;
    const k = cssH / srcH;
    const curv = bypass ? 0 : curvature;
    declareText(
      canvas,
      hidden || !steady
        ? []
        : texts.map((t) => {
            const [u, v, scale] = toGlass((t.x + t.width / 2) / LW, (t.y + t.height / 2) / srcH, curv, cfg);
            const w = t.width * k * scale;
            const h = t.height * k * scale;
            return { ...t, x: u * cssW - w / 2, y: v * cssH - h / 2, width: w, height: h, size: t.size * k * scale };
          }),
    );
  });

  return (
    <div ref={host} className={className} style={{ position: "absolute", inset: 0, background: "#000", ...style }} />
  );
}
