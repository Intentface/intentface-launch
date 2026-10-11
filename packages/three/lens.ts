import { type PerspectiveCamera, Vector3 } from "three";

export type Vec3 = [number, number, number];

/**
 * A physical camera: where it stands, what it looks at, and its lens.
 * World units are content pixels, so a 1440-wide panel is 1440 units wide.
 */
export type Lens = {
  position: Vec3;
  target?: Vec3;
  /** Vertical field of view in degrees. Long lenses (20 to 35) flatten UI nicely. */
  fov?: number;
  /** Distance to the plane in focus. Default: the distance to `target`. */
  focus?: number;
  /**
   * Lens opening in world units. 0 is a pinhole (everything sharp). Blur on
   * screen grows with it and with distance from the focus plane; see `cocPx`.
   */
  aperture?: number;
  /** Degrees around the view axis. */
  roll?: number;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Point i of n on the unit disk, evenly spread (a sunflower spiral). Fixed, so bokeh does not flicker. */
export function diskSample(i: number, n: number): [number, number] {
  if (n <= 1) return [0, 0];
  const r = Math.sqrt((i + 0.5) / n);
  const a = i * GOLDEN;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function halton(i: number, base: number) {
  let f = 1;
  let r = 0;
  for (let k = i + 1; k > 0; k = Math.floor(k / base)) {
    f /= base;
    r += f * (k % base);
  }
  return r;
}

/** Sub-pixel offset for sample i, in pixels (−0.5 to 0.5). Accumulating these is the anti-aliasing. */
export const pixelJitter = (i: number, n: number): [number, number] =>
  n <= 1 ? [0, 0] : [halton(i, 2) - 0.5, halton(i, 3) - 0.5];

/**
 * Which slice of the shutter sample i takes. A fixed permutation, so time and
 * lens position are not correlated (that would smear bokeh along the motion).
 */
export function shutterSlot(i: number, n: number) {
  let step = 7919 % n || 1;
  while (gcd(step, n) !== 1) step++;
  return (i * step) % n;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const eye = new Vector3();
const target = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const up = new Vector3();

/**
 * Point `camera` through one spot on the lens. The eye moves across the
 * aperture while the frustum is skewed so the focus plane stays put: points on
 * that plane land on the same pixel from every spot, points off it spread into
 * a disk. Averaging many spots is a real thin-lens image, with correct
 * occlusion and no halos, which a depth-buffer blur cannot give.
 */
export function aimThroughLens(
  camera: PerspectiveCamera,
  lens: Lens,
  spot: [number, number],
  jitter: [number, number],
  width: number,
  height: number,
) {
  eye.set(...lens.position);
  target.set(...(lens.target ?? [0, 0, 0]));
  fwd.subVectors(target, eye);
  const distance = fwd.length();
  fwd.normalize();
  up.set(0, 1, 0);
  if (Math.abs(fwd.dot(up)) > 0.999) up.set(0, 0, -1);
  right.crossVectors(fwd, up).normalize();
  up.crossVectors(right, fwd).normalize();
  if (lens.roll) {
    const r = (lens.roll * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const rx = right.clone();
    right.multiplyScalar(c).addScaledVector(up, s);
    up.multiplyScalar(c).addScaledVector(rx, -s);
  }

  const focus = lens.focus ?? distance;
  const halfH = focus * Math.tan(((lens.fov ?? 30) * Math.PI) / 360);
  const halfW = (halfH * width) / height;
  const radius = (lens.aperture ?? 0) / 2;
  const ox = spot[0] * radius;
  const oy = spot[1] * radius;
  const px = ((2 * halfW) / width) * jitter[0];
  const py = ((2 * halfH) / height) * jitter[1];

  camera.position.copy(eye).addScaledVector(right, ox).addScaledVector(up, oy);
  camera.up.copy(up);
  camera.lookAt(camera.position.clone().add(fwd));
  camera.updateMatrixWorld();

  const near = Math.max(1, distance * 0.02);
  const far = distance * 50;
  const k = near / focus;
  camera.projectionMatrix.makePerspective(
    (-halfW - ox + px) * k,
    (halfW - ox + px) * k,
    (halfH - oy + py) * k,
    (-halfH - oy + py) * k,
    near,
    far,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.near = near;
  camera.far = far;
}

/**
 * Blur-disk diameter in output pixels for a point `depth` units in front of
 * the camera. For picking an aperture: `aperture: apertureFor(24, …)`.
 */
export function cocPx(lens: Lens, depth: number, height: number) {
  const focus = lens.focus ?? distanceTo(lens);
  const halfH = focus * Math.tan(((lens.fov ?? 30) * Math.PI) / 360);
  const worldAtFocus = ((lens.aperture ?? 0) * Math.abs(depth - focus)) / depth;
  return (worldAtFocus / (2 * halfH)) * height;
}

/** The aperture that blurs a point at `depth` into a disk `px` pixels wide. */
export function apertureFor(px: number, lens: Omit<Lens, "aperture">, depth: number, height: number) {
  const unit = cocPx({ ...lens, aperture: 1 }, depth, height);
  return unit === 0 ? 0 : px / unit;
}

export const distanceTo = (lens: Lens) => {
  const [x, y, z] = lens.position;
  const [tx, ty, tz] = lens.target ?? [0, 0, 0];
  return Math.hypot(x - tx, y - ty, z - tz);
};

/**
 * Camera position looking at `target` on the UI plane (z = 0, facing +z):
 * `elevation` degrees up from the plane (90 = straight on), `azimuth` degrees
 * around it (0 = from below the UI, looking up its length, as in a tabletop shot).
 */
export function orbit(
  target: Vec3,
  { distance, elevation, azimuth = 0 }: { distance: number; elevation: number; azimuth?: number },
): Vec3 {
  const e = (elevation * Math.PI) / 180;
  const a = (azimuth * Math.PI) / 180;
  const flat = distance * Math.cos(e);
  return [target[0] + flat * Math.sin(a), target[1] - flat * Math.cos(a), target[2] + distance * Math.sin(e)];
}

/** Where a world point lands on screen, through the centre of the lens. */
export type Projected = {
  /** Output pixels from the frame's top left. */
  x: number;
  y: number;
  /** Distance along the view axis; at or below 0 the point is behind the camera. */
  depth: number;
  /** Screen pixels per world unit at the point's depth: the scale of a flat layer standing there. */
  scale: number;
  /** In front of the camera and inside the frame. */
  visible: boolean;
};

/** The lens's view axes: forward, right and up (with roll), as Stage3D aims it. */
function axes(lens: Lens) {
  const [ex, ey, ez] = lens.position;
  const [tx, ty, tz] = lens.target ?? [0, 0, 0];
  const f = new Vector3(tx - ex, ty - ey, tz - ez).normalize();
  const u = new Vector3(0, 1, 0);
  if (Math.abs(f.dot(u)) > 0.999) u.set(0, 0, -1);
  const r = new Vector3().crossVectors(f, u).normalize();
  u.crossVectors(r, f).normalize();
  if (lens.roll) {
    const a = (lens.roll * Math.PI) / 180;
    const rx = r.clone();
    r.multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a));
    u.multiplyScalar(Math.cos(a)).addScaledVector(rx, -Math.sin(a));
  }
  return { f, r, u };
}

/**
 * Screen position of the world point `point` for `lens`, in a frame of
 * `size` [width, height] output pixels (default 1920 × 1080). The same maths
 * as the stage's camera, without the aperture and anti-aliasing jitter, so
 * DOM placed here sits on the in-focus image: labels over 3D, or a flat layer
 * taking over from a 3D shot pixel for pixel.
 */
export function project(lens: Lens, point: Vec3, size: [number, number] = [1920, 1080]): Projected {
  const [width, height] = size;
  const { f, r, u } = axes(lens);
  const v = new Vector3(point[0] - lens.position[0], point[1] - lens.position[1], point[2] - lens.position[2]);
  const depth = v.dot(f);
  const tan = Math.tan(((lens.fov ?? 30) * Math.PI) / 360);
  const scale = depth > 0 ? height / (2 * depth * tan) : 0;
  const x = width / 2 + v.dot(r) * scale;
  const y = height / 2 - v.dot(u) * scale;
  const visible = depth > 0 && x >= 0 && x <= width && y >= 0 && y <= height;
  return { x, y, depth, scale, visible };
}

/**
 * Screen pixels per world unit on the plane in focus (or at `depth` from the
 * camera), for a frame `height` pixels tall. 1 means a panel shows at its CSS
 * size: from `fillDistance(1080, fov) / zoom` straight on, it is `zoom`.
 */
export function pixelsPerUnit(lens: Lens, height = 1080, depth = lens.focus ?? distanceTo(lens)) {
  return height / (2 * depth * Math.tan(((lens.fov ?? 30) * Math.PI) / 360));
}

/**
 * Samples a `Stage3D` needs for blur of `px` (the largest bokeh disk on screen at 1080p) to read
 * smooth: about (px / 5)², clamped. 80 px needs 256; 40 px, 64; sharp frames the minimum, which
 * still anti-aliases. Measured on a film: 96 samples for 120 px left grain and streaks.
 */
export function samplesForBlur(px: number, { min = 24, max = 256 }: { min?: number; max?: number } = {}) {
  return Math.round(Math.min(max, Math.max(min, (px / 5) ** 2)));
}
