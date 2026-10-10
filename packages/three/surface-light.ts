import { Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from "three";
import type { Vec3 } from "./lens.js";
import { ADDITIVE } from "./light.js";
import { spectrumBands } from "./spectrum.js";

/**
 * Light that has landed on a surface: a rainbow smear where a prism's
 * spectrum meets a wall. It lies in a plane and adds into the stage's float
 * sum like the other lights.
 */

// --- Smear --------------------------------------------------------------

export type SmearPose = {
  /** Middle of the band, on the surface. */
  center: Vec3;
  /** The surface's normal. Default +z (a wall facing a camera on +z). */
  normal?: Vec3;
  /** Direction in the surface from the violet end to the red end. Default +x. */
  along?: Vec3;
  /** Distance from the violet end to the red end. 0 lands every colour in one white spot. */
  length: number;
  /** Diameter of each wavelength's image: the width of the light that made it. */
  width: number;
  /** Each image stretched along `along` (a beam landing at a slant). Default 1. */
  stretch?: number;
  /** 0: crisp edges. 1: each image fades over its outer half. Default 0.5. */
  soft?: number;
  /** Brightness of white where every colour overlaps. */
  gain?: number;
  visible?: boolean;
};

/** One wavelength's landing point, for `Smear.poseSpots`. */
export type SmearSpot = { at: Vec3; rgb: Vec3 };

const MAX_SPOTS = 24;
const SUB = 4;

const SMEAR_VERTEX = /* glsl */ `
varying vec2 vPlane;
varying vec3 vWorld;
void main() {
  vPlane = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// A row of soft disks, one per wavelength, sub-sampled between the given
// spots so a long smear has smooth edges and colours.
const SMEAR_FRAGMENT = /* glsl */ `
uniform vec2 spots[${MAX_SPOTS}];
uniform vec3 colours[${MAX_SPOTS}];
uniform int count;
uniform float radius;
uniform vec2 stretchDir;
uniform float stretch;
uniform float soft;
uniform vec3 norm;
uniform float gain;
varying vec2 vPlane;
float disk(vec2 at) {
  vec2 q = vPlane - at;
  float s = dot(q, stretchDir);
  vec2 o = q - s * stretchDir;
  float r = length(o + stretchDir * s / stretch) / radius;
  return soft > 0.0 ? 1.0 - smoothstep(1.0 - soft * 0.6, 1.0 + soft * 0.15, r) : step(r, 1.0);
}
void main() {
  vec3 c = vec3(0.0);
  if (count == 1) c = colours[0] * disk(spots[0]);
  for (int i = 0; i < ${MAX_SPOTS - 1}; i++) {
    if (i + 1 >= count) break;
    for (int k = 0; k < ${SUB}; k++) {
      float s = (float(k) + 0.5) / ${SUB}.0;
      c += mix(colours[i], colours[i + 1], s) * disk(mix(spots[i], spots[i + 1], s)) / ${SUB}.0;
    }
  }
  c *= norm * gain;
  if (any(isnan(c))) discard;
  gl_FragColor = vec4(c, 1.0);
}`;

const ex = new Vector3();
const ey = new Vector3();
const ez = new Vector3();
const tmp = new Vector3();
const basis = new Matrix4();

/** An orthonormal frame on a plane: z the normal, x along `along` (or any direction in the plane). */
function planeFrame(normal: Vec3, along: Vec3 | undefined) {
  ez.set(...normal).normalize();
  ex.set(...(along ?? [1, 0, 0]));
  ex.addScaledVector(ez, -ex.dot(ez));
  if (ex.lengthSq() < 1e-8) ex.set(0, 1, 0).addScaledVector(ez, -ez.y);
  ex.normalize();
  ey.crossVectors(ez, ex);
}

/**
 * A spectrum on a surface: white light split by wavelength, each colour a
 * soft image of the light that made it, from violet at one end to red at the
 * other. Short and the middle overlaps into white with coloured edges, as in
 * a prism photograph; long and it is a pure rainbow. `Prism` poses one from
 * where its rays really land.
 */
export class Smear {
  readonly object: Mesh;
  private readonly material: ShaderMaterial;
  private readonly bands: Vec3[];

  /** `bands` wavelengths from `from` to `to` nm (at most 24). */
  constructor(options: { bands?: number; from?: number; to?: number } = {}) {
    this.bands = spectrumBands(Math.min(MAX_SPOTS, options.bands ?? 16), options.from, options.to).map((b) => b.rgb);
    this.material = new ShaderMaterial({
      uniforms: {
        spots: { value: Array.from({ length: MAX_SPOTS }, () => new Vector2()) },
        colours: { value: Array.from({ length: MAX_SPOTS }, () => new Vector3()) },
        count: { value: 0 },
        radius: { value: 1 },
        stretchDir: { value: [1, 0] },
        stretch: { value: 1 },
        soft: { value: 0.5 },
        norm: { value: new Vector3(1, 1, 1) },
        gain: { value: 1 },
      },
      vertexShader: SMEAR_VERTEX,
      fragmentShader: SMEAR_FRAGMENT,
      ...ADDITIVE,
    });
    this.object = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.object.frustumCulled = false;
  }

  pose(p: SmearPose) {
    planeFrame(p.normal ?? [0, 0, 1], p.along);
    const n = this.bands.length;
    const spots = this.bands.map((rgb, i) => {
      const s = n === 1 ? 0 : (i / (n - 1) - 0.5) * p.length;
      return { at: [p.center[0] + ex.x * s, p.center[1] + ex.y * s, p.center[2] + ex.z * s] as Vec3, rgb };
    });
    this.place(p.center, spots, p.width, p.along, p.stretch ?? 1, p.soft ?? 0.5, p.gain ?? 1, p.visible ?? true);
  }

  /**
   * Light the surface at the given landing points (projected onto the plane
   * through `center` with `normal`), in order along the spectrum. Colours are
   * linear; the smear is balanced so all of them together make `gain` white.
   */
  poseSpots(p: {
    center: Vec3;
    normal: Vec3;
    spots: SmearSpot[];
    width: number;
    /** Direction in the plane the images are stretched along. Default: from the first spot to the last. */
    stretchAlong?: Vec3;
    stretch?: number;
    soft?: number;
    gain?: number;
    visible?: boolean;
  }) {
    planeFrame(p.normal, undefined);
    this.place(
      p.center,
      p.spots,
      p.width,
      p.stretchAlong,
      p.stretch ?? 1,
      p.soft ?? 0.5,
      p.gain ?? 1,
      p.visible ?? true,
      true,
    );
  }

  private place(
    center: Vec3,
    spots: SmearSpot[],
    width: number,
    stretchAlong: Vec3 | undefined,
    stretch: number,
    soft: number,
    gain: number,
    visible: boolean,
    reframe = false,
  ) {
    const show = visible && gain > 0 && width > 0 && spots.length > 0;
    this.object.visible = show;
    if (!show) return;
    const list = spots.slice(0, MAX_SPOTS);
    if (reframe) {
      // x along the spectrum, so the quad hugs it.
      const a = list[0].at;
      const b = list[list.length - 1].at;
      const along: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      planeFrame([ez.x, ez.y, ez.z], Math.hypot(...along) > 1e-6 ? along : undefined);
    }
    const u = this.material.uniforms;
    const local = list.map((s) => {
      tmp.set(s.at[0] - center[0], s.at[1] - center[1], s.at[2] - center[2]);
      return [tmp.dot(ex), tmp.dot(ey)];
    });
    local.forEach((q, i) => {
      u.spots.value[i].set(q[0], q[1]);
      u.colours.value[i].set(...list[i].rgb);
    });
    u.count.value = list.length;
    // Trapezoid weights of the sub-sampled row: balance it to white.
    const total = [0, 0, 0];
    list.forEach((s, i) => {
      const w = list.length === 1 ? 1 : i === 0 || i === list.length - 1 ? 0.5 : 1;
      for (let k = 0; k < 3; k++) total[k] += s.rgb[k] * w;
    });
    u.norm.value.set(1 / (total[0] || 1), 1 / (total[1] || 1), 1 / (total[2] || 1));
    let sx = 1;
    let sy = 0;
    if (stretchAlong) {
      tmp.set(...stretchAlong);
      sx = tmp.dot(ex);
      sy = tmp.dot(ey);
      const l = Math.hypot(sx, sy) || 1;
      sx /= l;
      sy /= l;
      if (!Number.isFinite(sx)) [sx, sy] = [1, 0];
    }
    u.stretchDir.value = [sx, sy];
    u.stretch.value = Math.max(0.01, stretch);
    u.radius.value = width / 2;
    u.soft.value = Math.min(1, Math.max(0, soft));
    u.gain.value = gain;
    // The quad: the spots' bounds plus a stretched radius all round.
    const pad = (width / 2) * Math.max(1, stretch) * 1.2;
    const xs = local.map((q) => q[0]);
    const ys = local.map((q) => q[1]);
    const [x0, x1, y0, y1] = [
      Math.min(...xs) - pad,
      Math.max(...xs) + pad,
      Math.min(...ys) - pad,
      Math.max(...ys) + pad,
    ];
    const geometry = this.object.geometry as PlaneGeometry;
    const pos = geometry.attributes.position;
    // PlaneGeometry(1, 1) vertex order: top-left, top-right, bottom-left, bottom-right.
    const corners = [
      [x0, y1],
      [x1, y1],
      [x0, y0],
      [x1, y0],
    ];
    for (const [i, [x, y]] of corners.entries()) pos.setXYZ(i, x, y, 0);
    pos.needsUpdate = true;
    basis.makeBasis(ex, ey, ez);
    this.object.quaternion.setFromRotationMatrix(basis);
    this.object.position.set(...center);
  }
}
