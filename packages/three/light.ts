import { useContext, useLayoutEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  Mesh,
  type Object3D,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  ZeroFactor,
} from "three";
import type { Vec3 } from "./lens.js";
import { StageContext } from "./stage.js";

/**
 * Light on a <Stage3D>: beams, rings and glows that only add to the frame, in
 * the stage's HDR sum, so they bloom, blur with the lens and streak with the
 * shutter like real light. Build them once, pose them from the frame in a
 * stage item's `update(t)` (see `useStageItem`).
 *
 * Colour comes from a flat colour, a linear gradient laid over the world's
 * xy plane (a logo's gradient, so light that falls on the logo carries exactly
 * its colours), or a spectrum: the beam splits into one sub-beam per colour,
 * fanned by `spread`, like white light through a prism.
 */

/** A linear gradient over the world's xy plane, as in an SVG with userSpaceOnUse. Colours are sRGB. */
export type LightGradient = {
  from: [number, number];
  to: [number, number];
  /** Up to 4 colours, evenly spaced, or with offsets. */
  stops: (string | { offset: number; color: string })[];
};

export type LightColour = {
  /** One colour (sRGB). */
  color?: string;
  /** Colour by where the light falls on the xy plane. */
  gradient?: LightGradient;
  /** Split into one sub-beam per colour (Beam only). With `gradient`, `spectrumMix` 0 recombines into it. */
  spectrum?: string[];
};

export type BeamPose = {
  /** Where the beam comes from. */
  from: Vec3;
  direction: Vec3;
  /** Distance along `direction` where the light starts. Default 0. */
  start?: number;
  /** Distance along `direction` where it ends. */
  end: number;
  /** Core width in world units. Soft light glows a little beyond it. */
  width: number;
  /** Brightness, linear: 1 is the colour itself; above 1 blooms. Split across spectrum sub-beams. */
  gain?: number;
  /** 0: soft light with a volumetric halo. 1: a crisp stroke exactly `width` wide. */
  hard?: number;
  /** 0: even along its length. 1: falls off away from the source. Default 1. */
  taper?: number;
  /** 0: bright at the source. 1: soft at both ends, a streak in flight. */
  streak?: number;
  /** Angle between neighbouring spectrum sub-beams, in degrees. */
  spread?: number;
  /** Axis the spectrum fans around. Default world z (the fan lies in the xy plane). */
  spreadAxis?: Vec3;
  /** 1: sub-beams in their spectrum colours. 0: all in the gradient (or `color`). */
  spectrumMix?: number;
  /** How far depth (z) shifts the gradient, per world unit. 0 is exact on the plane. */
  iris?: number;
  visible?: boolean;
};

export type RingPose = {
  center: Vec3;
  /** The ring's axis. Default +x (the ring lies in the yz plane). */
  normal?: Vec3;
  radius: number;
  /** Radius of the tube, world units. */
  tube: number;
  /** Scale across the ring's local z, towards 0 to flatten it into a line. */
  squash?: number;
  /**
   * 0 (default): a hard torus, evenly lit to its edge. 1: a glowing tube, a
   * gaussian across its width that fades out by 2.5 `tube` from its centre line.
   */
  soft?: number;
  gain?: number;
  iris?: number;
  visible?: boolean;
};

export type WavePose = {
  center: Vec3;
  /** The wave's axis. Default +x (it spreads in the yz plane). */
  normal?: Vec3;
  /** Radius of the wave front. */
  radius: number;
  /** Softness of the front, world units: the light spreads this far either side. */
  width: number;
  /** How far behind the front the light trails, in widths. Default 3. */
  trail?: number;
  gain?: number;
  iris?: number;
  visible?: boolean;
};

export type GlowPose = { at: Vec3; size: number; gain?: number; visible?: boolean };

/** Additive into the stage's float sum; the alpha stays the stage's. */
export const ADDITIVE = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: DoubleSide,
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;

// Stops mix in sRGB (as an SVG gradient does), then go linear.
export const COLOUR_GLSL = /* glsl */ `
uniform vec2 gFrom;
uniform vec2 gTo;
uniform vec3 gStops[4];
uniform float gAt[4];
uniform int gCount;
uniform float iris;
uniform vec3 tint;
uniform float tintMix;
uniform float gain;
varying vec3 vWorld;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 lightColour(vec3 p) {
  vec3 c = gStops[0];
  if (gCount > 1) {
    vec2 d = gTo - gFrom;
    float t = clamp(dot(p.xy - gFrom, d) / dot(d, d), 0.0, 1.0) + iris * p.z;
    t = 1.0 - abs(mod(t, 2.0) - 1.0);
    for (int i = 1; i < 4; i++) {
      if (i >= gCount) break;
      if (t <= gAt[i]) { c = mix(gStops[i - 1], gStops[i], (t - gAt[i - 1]) / max(1e-5, gAt[i] - gAt[i - 1])); break; }
      c = gStops[i];
    }
  }
  return toLinear(mix(c, tint, tintMix));
}`;

// A ribbon that faces the camera: position.x runs 0..1 along the beam (the
// mesh's local x, scaled to its length), position.y -1..1 across its extent.
const EXTENT = 2.0;
const BEAM_VERTEX = /* glsl */ `
uniform float width;
varying vec2 vBeam;
varying float vLength;
varying vec3 vWorld;
void main() {
  vec3 p0 = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 p1 = (modelMatrix * vec4(1.0, 0.0, 0.0, 1.0)).xyz;
  vec3 at = mix(p0, p1, position.x);
  // Guarded: a beam of zero length, or one pointing straight at the eye of a
  // lens sample, has no facing direction, and one NaN poisons the float sum.
  vec3 axis = p1 - p0;
  axis = dot(axis, axis) > 1e-12 ? normalize(axis) : vec3(1.0, 0.0, 0.0);
  vec3 across = cross(axis, cameraPosition - at);
  vec3 side = dot(across, across) > 1e-10
    ? normalize(across)
    : normalize(cross(axis, abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 w = at + side * position.y * width * ${EXTENT.toFixed(2)};
  vBeam = position.xy;
  vLength = length(p1 - p0);
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

// Soft: a gaussian core half the width wide plus a faint wide halo (light in
// air). Hard: a stroke exactly `width` wide, antialiased.
const BEAM_FRAGMENT = /* glsl */ `
${COLOUR_GLSL}
uniform float width;
uniform float hard;
uniform float taper;
uniform float streak;
varying vec2 vBeam;
varying float vLength;
void main() {
  float d = abs(vBeam.y) * ${EXTENT.toFixed(2)};
  // The halo reaches zero before the ribbon's edge, and fades out over a
  // width at each end, so soft light never shows the quad it is drawn on.
  float fromStart = vBeam.x * vLength / max(width, 1e-4);
  float fromEnd = (1.0 - vBeam.x) * vLength / max(width, 1e-4);
  float caps = smoothstep(0.0, 0.6, fromStart) * smoothstep(0.0, 1.2, fromEnd);
  float soft = (exp(-d * d / 0.09) + 0.3 * exp(-d * d / 0.6)) * caps;
  float fw = fwidth(d);
  float edge = 1.0 - smoothstep(0.5 - fw, 0.5 + fw, d);
  float x = vBeam.x;
  float fall = smoothstep(0.0, 0.04, x) * pow(1.0 - x, 1.4);
  float flight = smoothstep(0.0, 0.4, x) * smoothstep(1.0, 0.7, x);
  float along = mix(1.0, mix(fall, flight, streak), taper * (1.0 - hard));
  vec3 c = lightColour(vWorld) * mix(soft, edge, hard) * along * gain;
  if (any(isnan(c)) || any(isinf(c))) discard;
  gl_FragColor = vec4(c, 1.0);
}`;

// A torus from a plane's uv, so radius and tube are independent uniforms. A
// soft ring is drawn on a wider tube, and its normal says how far each point
// is from the centre line as the camera sees it.
const RING_VERTEX = /* glsl */ `
uniform float radius;
uniform float tube;
uniform float squash;
uniform float soft;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  float u = uv.x * 6.2831853;
  float v = uv.y * 6.2831853;
  float t = tube * mix(1.0, 2.5, soft);
  float r = radius + t * cos(v);
  vec3 p = vec3(t * sin(v), r * cos(u), r * sin(u) * squash);
  vNormal = mat3(modelMatrix) * vec3(sin(v), cos(v) * cos(u), cos(v) * sin(u) / squash);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// A soft wave front on a flat annulus, built from a plane's uv: uv.x runs
// round the circle, uv.y across the front, from `trail` widths behind it to
// two widths ahead.
const WAVE_VERTEX = /* glsl */ `
uniform float radius;
uniform float width;
uniform float trail;
varying float vFront;
varying vec3 vWorld;
void main() {
  float u = uv.x * 6.2831853;
  float k = mix(-trail, 2.0, uv.y);
  float r = max(0.0, radius + k * width);
  vFront = radius + k * width > 0.0 ? k : -1e3;
  vec4 w = modelMatrix * vec4(0.0, r * cos(u), r * sin(u), 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WAVE_FRAGMENT = /* glsl */ `
${COLOUR_GLSL}
uniform float trail;
varying float vFront;
void main() {
  float k = vFront;
  // Sharper ahead of the front, a long soft trail behind it, like a ripple of light.
  float lightness = k > 0.0 ? exp(-k * k / 0.6) : exp(-k * k / max(0.1, 0.35 * trail * trail));
  vec3 c = lightColour(vWorld) * lightness * gain;
  if (any(isnan(c))) discard;
  gl_FragColor = vec4(c, 1.0);
}`;

// Soft: a gaussian of the distance from the tube's centre line, seen from this
// sample's eye (front and back faces both add, as for the hard torus).
const RING_FRAGMENT = /* glsl */ `
${COLOUR_GLSL}
uniform float tube;
uniform float soft;
varying vec3 vNormal;
void main() {
  float k = 1.0;
  if (soft > 0.0) {
    float c = abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld)));
    float d = mix(1.0, 2.5, soft) * sqrt(max(0.0, 1.0 - c * c));
    k = exp(-2.0 * soft * d * d);
  }
  vec3 col = lightColour(vWorld) * gain * k;
  if (any(isnan(col))) discard;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Encode a linear channel as the shaders' sRGB input (exact inverse of their decode, also above 1). */
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export const srgb = (c: string) => {
  const k = new Color().setStyle(c).convertLinearToSRGB();
  return new Vector3(k.r, k.g, k.b);
};

export function colourUniforms(colour: LightColour, tint?: string) {
  const g = colour.gradient;
  const stops = g
    ? g.stops.map((s, i) =>
        typeof s === "string" ? { offset: g.stops.length > 1 ? i / (g.stops.length - 1) : 0, color: s } : s,
      )
    : [{ offset: 0, color: colour.color ?? "#ffffff" }];
  const padded = [...stops, ...Array(4).fill(stops[stops.length - 1])].slice(0, 4);
  return {
    gFrom: { value: g?.from ?? [0, 0] },
    gTo: { value: g?.to ?? [1, 0] },
    gStops: { value: padded.map((s) => srgb(s.color)) },
    gAt: { value: padded.map((s) => s.offset) },
    gCount: { value: Math.min(4, stops.length) },
    iris: { value: 0 },
    tint: { value: srgb(tint ?? colour.color ?? "#ffffff") },
    tintMix: { value: tint || (colour.color && !g) ? 1 : 0 },
    gain: { value: 1 },
  };
}

let beamGeometry: PlaneGeometry | null = null;
let ringGeometry: PlaneGeometry | null = null;

const X = new Vector3(1, 0, 0);
const v = new Vector3();
const axis = new Vector3();
const d = new Vector3();

/** A beam of light: soft, tapering, optionally split into a spectrum. Pose it every sample. */
export class Beam {
  readonly object = new Group();
  private readonly parts: { mesh: Mesh; material: ShaderMaterial }[];

  constructor(private readonly colour: LightColour = {}) {
    beamGeometry ??= new PlaneGeometry(1, 2, 24, 1).translate(0.5, 0, 0);
    const tints = colour.spectrum?.length ? colour.spectrum : [undefined];
    this.parts = tints.map((tint) => {
      const material = new ShaderMaterial({
        uniforms: {
          ...colourUniforms(colour, tint),
          width: { value: 1 },
          hard: { value: 0 },
          taper: { value: 1 },
          streak: { value: 0 },
        },
        vertexShader: BEAM_VERTEX,
        fragmentShader: BEAM_FRAGMENT,
        ...ADDITIVE,
      });
      const mesh = new Mesh(beamGeometry as PlaneGeometry, material);
      mesh.frustumCulled = false;
      this.object.add(mesh);
      return { mesh, material };
    });
  }

  /**
   * Colour every part in linear light (channels may exceed 1), replacing the
   * constructor's colour. For light computed by wavelength, such as a prism's
   * output.
   */
  setLinearColor(rgb: Vec3) {
    for (const { material } of this.parts) {
      material.uniforms.tint.value.set(...rgb.map(linearToSrgb));
      material.uniforms.tintMix.value = 1;
    }
  }

  pose(p: BeamPose) {
    const n = this.parts.length;
    const start = p.start ?? 0;
    const visible = (p.visible ?? true) && p.end > start && (p.gain ?? 1) > 0;
    this.object.visible = visible;
    if (!visible) return;
    const dir = v.set(...p.direction).normalize();
    // The fan axis, made perpendicular to the beam.
    axis.set(...(p.spreadAxis ?? [0, 0, 1]));
    axis.addScaledVector(dir, -axis.dot(dir));
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).addScaledVector(dir, -dir.y);
    axis.normalize();
    const spread = ((p.spread ?? 0) * Math.PI) / 180;
    const mix = this.colour.spectrum?.length && !this.colour.color ? (p.spectrumMix ?? 1) : undefined;
    this.parts.forEach(({ mesh, material }, i) => {
      d.copy(dir).applyAxisAngle(axis, (i - (n - 1) / 2) * spread);
      mesh.position.set(p.from[0] + d.x * start, p.from[1] + d.y * start, p.from[2] + d.z * start);
      mesh.quaternion.setFromUnitVectors(X, d);
      mesh.scale.set(p.end - start, 1, 1);
      const u = material.uniforms;
      u.width.value = p.width;
      u.gain.value = (p.gain ?? 1) / n;
      u.hard.value = p.hard ?? 0;
      u.taper.value = p.taper ?? 1;
      u.streak.value = p.streak ?? 0;
      u.iris.value = p.iris ?? 0;
      if (mix !== undefined) u.tintMix.value = mix;
    });
  }
}

/** A ring of light (a torus): echoes on a surface, a rim. Flattened edge-on, it is a bar. */
export class Ring {
  readonly object: Mesh;
  private readonly material: ShaderMaterial;

  constructor(colour: LightColour = {}) {
    ringGeometry ??= new PlaneGeometry(1, 1, 192, 12);
    this.material = new ShaderMaterial({
      uniforms: {
        ...colourUniforms(colour),
        radius: { value: 1 },
        tube: { value: 1 },
        squash: { value: 1 },
        soft: { value: 0 },
      },
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      ...ADDITIVE,
    });
    this.object = new Mesh(ringGeometry, this.material);
    this.object.frustumCulled = false;
  }

  pose(p: RingPose) {
    const visible = (p.visible ?? true) && (p.gain ?? 1) > 0;
    this.object.visible = visible;
    if (!visible) return;
    this.object.position.set(...p.center);
    this.object.quaternion.setFromUnitVectors(X, v.set(...(p.normal ?? [1, 0, 0])).normalize());
    const u = this.material.uniforms;
    u.radius.value = p.radius;
    u.tube.value = p.tube;
    u.squash.value = Math.max(0.001, p.squash ?? 1);
    u.soft.value = Math.min(1, Math.max(0, p.soft ?? 0));
    u.gain.value = p.gain ?? 1;
    u.iris.value = p.iris ?? 0;
  }
}

/**
 * A soft wave of light spreading from a point on a surface: a blurred front
 * with a long trail, where a `Ring` is a crisp line. Move its `center` along
 * the normal as it grows and it travels off the surface, through the focal
 * plane, into bokeh.
 */
export class Wave {
  readonly object: Mesh;
  private readonly material: ShaderMaterial;

  constructor(colour: LightColour = {}) {
    ringGeometry ??= new PlaneGeometry(1, 1, 192, 12);
    this.material = new ShaderMaterial({
      uniforms: {
        ...colourUniforms(colour),
        radius: { value: 1 },
        width: { value: 1 },
        trail: { value: 3 },
      },
      vertexShader: WAVE_VERTEX,
      fragmentShader: WAVE_FRAGMENT,
      ...ADDITIVE,
    });
    this.object = new Mesh(ringGeometry, this.material);
    this.object.frustumCulled = false;
  }

  pose(p: WavePose) {
    const visible = (p.visible ?? true) && (p.gain ?? 1) > 0 && p.radius > 0;
    this.object.visible = visible;
    if (!visible) return;
    this.object.position.set(...p.center);
    this.object.quaternion.setFromUnitVectors(X, v.set(...(p.normal ?? [1, 0, 0])).normalize());
    const u = this.material.uniforms;
    u.radius.value = p.radius;
    u.width.value = p.width;
    u.trail.value = p.trail ?? 3;
    u.gain.value = p.gain ?? 1;
    u.iris.value = p.iris ?? 0;
  }
}

let glowTexture: CanvasTexture | null = null;

/** A soft point of light that always faces the camera. Keep it small: under depth of field a large one is a grey disk. */
export class Glow {
  readonly object: Sprite;

  constructor(color = "#ffffff") {
    glowTexture ??= makeGlowTexture();
    this.object = new Sprite(new SpriteMaterial({ map: glowTexture, ...ADDITIVE, color }));
    this.base = new Color(color);
  }

  private readonly base: Color;

  pose(p: GlowPose) {
    const visible = (p.visible ?? true) && (p.gain ?? 1) > 0;
    this.object.visible = visible;
    if (!visible) return;
    this.object.position.set(...p.at);
    this.object.scale.setScalar(p.size);
    this.object.material.color.copy(this.base).multiplyScalar(p.gain ?? 1);
  }
}

// Light on black, not white with alpha: additive blending adds the rgb.
function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, a] of [
    [0, 1],
    [0.06, 0.55],
    [0.2, 0.16],
    [0.45, 0.04],
    [1, 0],
  ]) {
    r.addColorStop(at, `rgba(255,255,255,${a})`);
  }
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/**
 * Put your own three.js objects on the enclosing <Stage3D>. `build` runs once
 * and returns the object and an `update(t)` that poses it at a (fractional)
 * frame; the stage calls it once per sample.
 *
 *   useStageItem(() => { const beam = new Beam({ color: "#fff" }); return { object: beam.object, update: (t) => beam.pose(…) }; });
 */
export function useStageItem(build: () => { object: Object3D; update(t: number): void }) {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("useStageItem must be used inside <Stage3D>");
  // Built once per mount, by design: `build` is usually an inline function.
  const item = useMemo(build, []);
  useLayoutEffect(() => stage.add(item), [stage, item]);
}
