import { BackSide, CylinderGeometry, Mesh, ShaderMaterial, Vector3 } from "three";
import type { Vec3 } from "./lens.js";
import { ADDITIVE, COLOUR_GLSL, colourUniforms, type LightColour } from "./light.js";

export type ConePose = {
  /** The light's source: the centre of its aperture. */
  from: Vec3;
  direction: Vec3;
  /** Distance along `direction` where the light becomes visible. Default 0. */
  start?: number;
  /** Distance where it ends (it fades out over the last `fade` of its length). */
  end: number;
  /** Radius of the aperture at `from`, world units. 0 is a point source. Default 0. */
  radius?: number;
  /** Full opening angle in degrees. 0 is a parallel beam (a shaft of light). Default 20. */
  angle?: number;
  /**
   * Brightness seen straight across the beam where it is narrowest. Further
   * out the light spreads over a wider section and dims (see `falloff`).
   */
  gain?: number;
  /** 0: a hard edge. 1: the edge fades over the outer half of the radius. Default 0.5. */
  soft?: number;
  /** 1: dims as it spreads, as real light does. 0: as bright at the end as at the source. Default 1. */
  falloff?: number;
  /** Fraction of the length over which the far end fades out. Default 0.35. */
  fade?: number;
  /** Unevenness of the haze, 0 (smooth air) to 1 (drifting smoke). Default 0. */
  haze?: number;
  /** Size of the haze's clumps, world units. Default 220. */
  hazeScale?: number;
  /** Moves the haze field; animate it with the frame for drifting air (`[f * 0.6, 0, 0]`). */
  hazeOffset?: Vec3;
  iris?: number;
  visible?: boolean;
};

// A frustum around the cone, drawn back faces only: every pixel the volume
// covers is drawn exactly once, also with the eye inside it. The fragment
// marches the eye's ray through the cone in its local frame (x along the axis).
const CONE_VERTEX = /* glsl */ `
uniform float start;
uniform float end;
uniform float radius;
uniform float slope;
uniform float hull;
varying vec3 vLocal;
varying vec3 vEye;
varying vec3 vWorld;
void main() {
  float x = mix(start, end, position.x);
  float r = (radius + max(x, 0.0) * slope) * hull + 0.5;
  vec3 p = vec3(x, position.y * r, position.z * r);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vLocal = p;
  vEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CONE_FRAGMENT = /* glsl */ `
${COLOUR_GLSL}
uniform float start;
uniform float end;
uniform float radius;
uniform float slope;
uniform float hull;
uniform float soft;
uniform float falloff;
uniform float fade;
uniform float haze;
uniform float hazeScale;
uniform vec3 hazeOffset;
varying vec3 vLocal;
varying vec3 vEye;
float hash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float rAt(float x) { return radius + max(x, 0.0) * slope; }
void main() {
  vec3 ro = vEye;
  vec3 seg = vLocal - vEye;
  float tFar = length(seg);
  vec3 rd = seg / max(tFar, 1e-6);
  float t0 = 0.0;
  float t1 = tFar;
  // Clip the ray to the slab between start and end, and to the cylinder
  // round the widest section.
  if (abs(rd.x) > 1e-6) {
    float a = (start - ro.x) / rd.x;
    float b = (end - ro.x) / rd.x;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
  }
  float R = rAt(end) * hull + 0.5;
  float A = dot(rd.yz, rd.yz);
  float B = dot(ro.yz, rd.yz);
  float C = dot(ro.yz, ro.yz) - R * R;
  if (A > 1e-9) {
    float disc = B * B - A * C;
    if (disc < 0.0) discard;
    float s = sqrt(disc);
    t0 = max(t0, (-B - s) / A);
    t1 = min(t1, (-B + s) / A);
  }
  if (t1 <= t0) discard;

  const int STEPS = 56;
  float dt = (t1 - t0) / float(STEPS);
  // Dither the steps per pixel and per lens sample, so the average is smooth.
  vec2 jit = gl_FragCoord.xy + fract(vEye.yz * 0.0137) * 113.0;
  float j = fract(sin(dot(jit, vec2(12.9898, 78.233))) * 43758.5453);
  float r0 = max(rAt(start), 0.1 * rAt(end) + 1e-3);
  float len = max(end - start, 1e-3);
  float edgeIn = 1.0 - soft * 0.5;
  vec3 sum = vec3(0.0);
  vec3 worldDir = normalize(vWorld - cameraPosition);
  float tWorld = length(vWorld - cameraPosition) / max(tFar, 1e-6);
  for (int i = 0; i < STEPS; i++) {
    float t = t0 + (float(i) + j) * dt;
    vec3 p = ro + rd * t;
    float r = max(rAt(p.x), 1e-3);
    float q = length(p.yz) / r;
    float across = soft > 0.0 ? 1.0 - smoothstep(edgeIn - soft * 0.25, 1.0 + soft * 0.15, q) : step(q, 1.0);
    if (across <= 0.0) continue;
    float x = (p.x - start) / len;
    float along = smoothstep(0.0, 0.015, x) * (1.0 - smoothstep(1.0 - fade, 1.0, x));
    float density = across * along / (2.0 * r) * pow(min(1.0, r0 / r), falloff);
    if (haze > 0.0) {
      vec3 h = (p + hazeOffset) / hazeScale;
      float n = 0.65 * noise(h) + 0.35 * noise(h * 2.13 + 7.1);
      density *= max(0.0, 1.0 + haze * (2.0 * n - 1.0) * 1.6);
    }
    sum += lightColour(cameraPosition + worldDir * t * tWorld) * density;
  }
  vec3 c = sum * dt * gain;
  if (any(isnan(c)) || any(isinf(c))) discard;
  gl_FragColor = vec4(c, 1.0);
}`;

let coneGeometry: CylinderGeometry | null = null;
const X = new Vector3(1, 0, 0);
const v = new Vector3();

/**
 * A cone of light through haze: a spotlight's beam, sunlight through a window,
 * the white light going into a prism. The light is a volume, marched per
 * pixel: brighter where the eye looks through more of it, dimming as it
 * spreads, with a soft or hard edge. It blurs with the lens and streaks with
 * the shutter like everything on the stage.
 */
export class Cone {
  readonly object: Mesh;
  private readonly material: ShaderMaterial;

  constructor(colour: LightColour = {}) {
    // A capped cylinder along x from 0 to 1, radius 1; the vertex shader shapes it.
    coneGeometry ??= (() => {
      const g = new CylinderGeometry(1, 1, 1, 48, 1, false);
      g.rotateZ(-Math.PI / 2);
      g.translate(0.5, 0, 0);
      return g;
    })();
    this.material = new ShaderMaterial({
      uniforms: {
        ...colourUniforms(colour),
        start: { value: 0 },
        end: { value: 1 },
        radius: { value: 0 },
        slope: { value: 0 },
        hull: { value: 1.3 },
        soft: { value: 0.5 },
        falloff: { value: 1 },
        fade: { value: 0.35 },
        haze: { value: 0 },
        hazeScale: { value: 220 },
        hazeOffset: { value: new Vector3() },
      },
      vertexShader: CONE_VERTEX,
      fragmentShader: CONE_FRAGMENT,
      ...ADDITIVE,
      side: BackSide,
    });
    this.object = new Mesh(coneGeometry, this.material);
    this.object.frustumCulled = false;
  }

  pose(p: ConePose) {
    const start = p.start ?? 0;
    const visible = (p.visible ?? true) && p.end > start && (p.gain ?? 1) > 0;
    this.object.visible = visible;
    if (!visible) return;
    this.object.position.set(...p.from);
    this.object.quaternion.setFromUnitVectors(X, v.set(...p.direction).normalize());
    const u = this.material.uniforms;
    const soft = Math.min(1, Math.max(0, p.soft ?? 0.5));
    u.start.value = start;
    u.end.value = p.end;
    u.radius.value = Math.max(0, p.radius ?? 0);
    u.slope.value = Math.tan((Math.min(170, Math.max(0, p.angle ?? 20)) * Math.PI) / 360);
    u.hull.value = 1 + soft * 0.2 + 0.02;
    u.soft.value = soft;
    u.falloff.value = p.falloff ?? 1;
    u.fade.value = Math.min(1, Math.max(0.001, p.fade ?? 0.35));
    u.haze.value = p.haze ?? 0;
    u.hazeScale.value = p.hazeScale ?? 220;
    u.hazeOffset.value.set(...(p.hazeOffset ?? [0, 0, 0]));
    u.gain.value = p.gain ?? 1;
    u.iris.value = p.iris ?? 0;
  }
}
