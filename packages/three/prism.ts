import { Euler, Group, Quaternion, Vector3 } from "three";
import type { Vec3 } from "./lens.js";
import { Beam, Glow } from "./light.js";
import {
  fresnel,
  type Glass,
  type GlassName,
  reflect,
  refract,
  refractiveIndex,
  type SpectrumBand,
  spectrumBands,
} from "./spectrum.js";
import { Smear, type SmearSpot } from "./surface-light.js";

export type PrismPose = {
  /** Centre of the prism: its triangle's centroid, halfway along its length. */
  center: Vec3;
  /**
   * Degrees about x, y, z, as a Panel's pose. At [0, 0, 0] the triangle lies
   * in the xy plane with its apex up (+y) and the prism's length runs along z.
   */
  rotation?: Vec3;
  /** Length of the two faces that meet at the apex. */
  size: number;
  /** Angle at the apex, degrees. Default 60 (equilateral). */
  apex?: number;
  /** Length along its axis; light that passes beyond an end misses. Default 2 × size. */
  length?: number;
  /** A named glass or Cauchy coefficients. Default "flint". */
  glass?: GlassName | Glass;
  /** Scales the glass's dispersion: 1 is the real glass, 3 to 6 a spectrum wide enough to read on screen. Default 1. */
  dispersion?: number;
  /** The light going in. */
  beam: {
    from: Vec3;
    direction: Vec3;
    width: number;
    /** Brightness of the white beam. The spectrum carries what the glass lets through. */
    gain?: number;
    /** Where the incoming beam ends if it misses the prism. Default 4 × size. */
    end?: number;
  };
  /** How far the spectrum travels after the prism. Default 4 × size. */
  reach?: number;
  /** A surface the spectrum lands on: the rays stop there and light it as a `Smear`. */
  wall?: { point: Vec3; normal: Vec3; gain?: number; soft?: number };
  /** Brightness of the light inside the glass, relative to outside (glass scatters little). Default 0.3. */
  inside?: number;
  /** Brightness of the glints where the light enters and leaves the glass. Default 0.25. */
  glints?: number;
  /** The faint beam the first face reflects (its real Fresnel share), relative. Default 1. */
  reflection?: number;
  /** Soft (0) or crisp (1) streams. Default 0. */
  hard?: number;
  /** Fall-off of the spectrum along its length, as Beam's `taper`. Default 0.5. */
  taper?: number;
  /** Light along the prism's edges, so the glass reads against black. Default 0. */
  edges?: number;
  visible?: boolean;
};

/** Where the light went, in world space, so other things can be placed on it. */
export type PrismTrace = {
  /** Where the beam enters the glass, or null if it misses. */
  entry: Vec3 | null;
  bands: {
    nm: number;
    rgb: Vec3;
    /** Where this wavelength leaves the glass, and its direction out. */
    exit: Vec3;
    direction: Vec3;
    /** Where it lands on the wall, if there is one and it reaches it. */
    hit: Vec3 | null;
    /** Share of the light that got through both faces (Fresnel). */
    transmission: number;
  }[];
};

type Face = { n: Vector3; d: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const toVec = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const EDGE_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 0],
  [3, 4],
  [4, 5],
  [5, 3],
  [0, 3],
  [1, 4],
  [2, 5],
];

/**
 * A glass prism that splits one beam into a spectrum by real refraction:
 * Snell's law at each face, for each wavelength its own index from Cauchy's
 * equation, Fresnel losses, total internal reflection, and the beam's width
 * changing as it bends. What comes out is a fan of `Beam`s in spectral
 * colours that adds back up to white; with a `wall`, they land on it as a
 * rainbow smear. The prism itself is invisible on black, as clear glass is,
 * apart from the glints where light crosses its faces and optional `edges`.
 */
export class Prism {
  readonly object = new Group();
  private readonly incoming = new Beam({ color: "#ffffff" });
  private readonly reflected = new Beam({ color: "#ffffff" });
  private readonly glintIn = new Glow();
  private readonly glintOut = new Glow();
  private readonly minBands: number;
  private readonly bandSets = new Map<number, SpectrumBand[]>();
  private readonly inner: Beam[] = [];
  private readonly outer: Beam[] = [];
  private readonly edgeBeams = EDGE_PAIRS.map(() => new Beam({ color: "#ffffff" }));
  private readonly smear = new Smear({ bands: 24 });

  /**
   * `bands`: the fewest wavelengths traced from 400 to 700 nm, evenly spread
   * in angle. The prism traces more when the fan spreads wider than its rays
   * are wide, so neighbouring rays always overlap (up to 256). Default 32.
   */
  constructor(options: { bands?: number } = {}) {
    this.minBands = Math.max(2, Math.min(256, Math.round(options.bands ?? 32)));
    for (const x of [this.incoming, this.reflected, this.glintIn, this.glintOut, ...this.edgeBeams, this.smear])
      this.object.add(x.object);
  }

  private bandsFor(count: number) {
    let bands = this.bandSets.get(count);
    if (!bands) {
      bands = spectrumBands(count, 400, 700, "dispersion");
      this.bandSets.set(count, bands);
    }
    while (this.outer.length < count) {
      const inner = new Beam({ color: "#ffffff" });
      const outer = new Beam({ color: "#ffffff" });
      this.inner.push(inner);
      this.outer.push(outer);
      this.object.add(inner.object, outer.object);
    }
    return bands;
  }

  pose(p: PrismPose): PrismTrace {
    const visible = p.visible ?? true;
    this.object.visible = visible;
    const none: PrismTrace = { entry: null, bands: [] };
    if (!visible) return none;

    const q = new Quaternion().setFromEuler(new Euler(...((p.rotation ?? [0, 0, 0]).map(rad) as Vec3)));
    const qi = q.clone().invert();
    const c = new Vector3(...p.center);
    const toLocal = (v: Vec3, point: boolean) => {
      const w = new Vector3(...v);
      if (point) w.sub(c);
      return w.applyQuaternion(qi);
    };
    const toWorld = (v: Vector3, point: boolean) => {
      const w = v.clone().applyQuaternion(q);
      if (point) w.add(c);
      return w;
    };

    // The triangle, centroid at the origin, apex up.
    const apex = rad(p.apex ?? 60);
    const H = p.size * Math.cos(apex / 2);
    const b = p.size * Math.sin(apex / 2);
    const corners = [new Vector3(0, (2 * H) / 3, 0), new Vector3(-b, -H / 3, 0), new Vector3(b, -H / 3, 0)];
    const faces: Face[] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ].map(([i, j]) => {
      const e = corners[j].clone().sub(corners[i]);
      const n = new Vector3(e.y, -e.x, 0).normalize();
      if (n.dot(corners[i]) < 0) n.negate();
      return { n, d: n.dot(corners[i]) };
    });
    const half = (p.length ?? p.size * 2) / 2;

    // Edges: the two triangles and the three long edges.
    const edgeGain = p.edges ?? 0;
    const ends = [...corners.map((v) => v.clone().setZ(-half)), ...corners.map((v) => v.clone().setZ(half))].map((v) =>
      toWorld(v, true),
    );
    EDGE_PAIRS.forEach(([i, j], k) => {
      const a = ends[i];
      const dir = ends[j].clone().sub(a);
      this.edgeBeams[k].pose({
        visible: edgeGain > 0,
        from: toVec(a),
        direction: toVec(dir),
        end: dir.length(),
        width: p.size * 0.006,
        hard: 1,
        taper: 0,
        gain: edgeGain,
      });
    });

    const gain = p.beam.gain ?? 1;
    const o = toLocal(p.beam.from, true);
    const d = toLocal(p.beam.direction, false).normalize();
    const reach = p.reach ?? p.size * 4;

    // Where the beam enters: the last entering face before the first leaving one.
    let tIn = Number.NEGATIVE_INFINITY;
    let tOut = Number.POSITIVE_INFINITY;
    let face = -1;
    let miss = false;
    faces.forEach((f, i) => {
      const denom = f.n.dot(d);
      const dist = f.d - f.n.dot(o);
      if (Math.abs(denom) < 1e-9) {
        if (dist < 0) miss = true;
        return;
      }
      const t = dist / denom;
      if (denom < 0) {
        if (t > tIn) {
          tIn = t;
          face = i;
        }
      } else tOut = Math.min(tOut, t);
    });
    const entryLocal = o.clone().addScaledVector(d, tIn);
    miss = miss || face < 0 || tIn > tOut || tIn <= 0 || Math.abs(entryLocal.z) > half;

    const beamOpts = { width: p.beam.width, hard: p.hard ?? 0 };
    this.incoming.pose({
      ...beamOpts,
      from: p.beam.from,
      direction: p.beam.direction,
      end: miss ? (p.beam.end ?? reach) : tIn,
      taper: 0,
      gain,
    });
    const glints = p.glints ?? 0.25;
    if (miss) {
      for (const x of [this.reflected, ...this.inner, ...this.outer]) x.object.visible = false;
      this.glintIn.object.visible = false;
      this.glintOut.object.visible = false;
      this.smear.object.visible = false;
      return none;
    }

    const n1 = faces[face].n;
    const cosIn = -d.dot(n1);
    const entry = toWorld(entryLocal, true);
    const d0: Vec3 = [d.x, d.y, d.z];
    const nIn: Vec3 = [n1.x, n1.y, n1.z];
    // The meanest index decides the reflection; it barely changes with wavelength.
    const nMid = refractiveIndex(p.glass ?? "flint", 550, p.dispersion ?? 1);
    const R1 = fresnel(cosIn, 1, nMid);
    const reflectedDir = toWorld(new Vector3(...reflect(d0, nIn)), false);
    this.reflected.pose({
      ...beamOpts,
      from: toVec(entry),
      direction: toVec(reflectedDir),
      end: reach * 0.6,
      taper: 1,
      gain: gain * R1 * (p.reflection ?? 1),
    });
    this.glintIn.pose({ at: toVec(entry), size: p.beam.width * 6, gain: gain * glints, visible: glints > 0 });

    const trace: PrismTrace = { entry: toVec(entry), bands: [] };
    const wall = p.wall;
    const wallN = wall ? new Vector3(...wall.normal).normalize() : null;
    const wallP = wall ? new Vector3(...wall.point) : null;
    const spots: SmearSpot[] = [];
    let exitMid: Vector3 | null = null;
    let widthOut = p.beam.width;
    let transmissionSum = 0;
    let slant: Vector3 | null = null;

    const glass = p.glass ?? "flint";
    const traceBand = (nm: number) => {
      const n = refractiveIndex(glass, nm, p.dispersion ?? 1);
      const inside = refract(d0, nIn, 1 / n);
      if (!inside) return null;
      let dir = new Vector3(...inside).normalize();
      let at = entryLocal.clone();
      let T = 1 - fresnel(cosIn, 1, n);
      // Width changes by cos(refracted) / cos(incident) at each face.
      let widthScale = Math.abs(dir.dot(n1)) / Math.max(1e-4, cosIn);
      let out: Vector3 | null = null;
      // The light inside is drawn along its first leg (after a total internal reflection it turns).
      let firstLeg = 0;
      for (let bounce = 0; bounce < 4 && !out; bounce++) {
        let tMin = Number.POSITIVE_INFINITY;
        let exitFace = -1;
        faces.forEach((f, k) => {
          const denom = f.n.dot(dir);
          if (denom <= 1e-9) return;
          const t = (f.d - f.n.dot(at)) / denom;
          if (t > 1e-6 && t < tMin) {
            tMin = t;
            exitFace = k;
          }
        });
        if (exitFace < 0) break;
        at = at.clone().addScaledVector(dir, tMin);
        if (bounce === 0) firstLeg = tMin;
        if (Math.abs(at.z) > half) break;
        const fn = faces[exitFace].n;
        const cosi = dir.dot(fn);
        const refracted = refract([dir.x, dir.y, dir.z], [-fn.x, -fn.y, -fn.z], n);
        if (refracted) {
          T *= 1 - fresnel(cosi, n, 1);
          out = new Vector3(...refracted).normalize();
          widthScale *= Math.abs(out.dot(fn)) / Math.max(1e-4, cosi);
        } else dir = new Vector3(...reflect([dir.x, dir.y, dir.z], [fn.x, fn.y, fn.z])).normalize();
      }
      return { inside, out, at, T, widthScale, firstLeg };
    };

    // Enough rays that neighbours overlap where the fan is widest.
    const [violet, red] = [traceBand(400), traceBand(700)];
    let count = this.minBands;
    if (violet?.out && red?.out) {
      const exit = toWorld(red.at, true);
      const dir = toWorld(red.out, false);
      let far = reach;
      if (wallN && wallP && Math.abs(dir.dot(wallN)) > 1e-9) {
        const t = wallP.clone().sub(exit).dot(wallN) / dir.dot(wallN);
        if (t > 0) far = t;
      }
      const spread = violet.out.angleTo(red.out) * far + violet.at.distanceTo(red.at);
      const ray = p.beam.width * Math.min(violet.widthScale, red.widthScale);
      count = Math.max(this.minBands, Math.min(256, Math.ceil(spread / Math.max(1e-3, 0.35 * ray)) + 1));
    }
    const bands = this.bandsFor(count);
    for (let k = count; k < this.outer.length; k++) {
      this.inner[k].object.visible = false;
      this.outer[k].object.visible = false;
    }

    bands.forEach((band, i) => {
      const traced = traceBand(band.nm);
      const innerBeam = this.inner[i];
      const outerBeam = this.outer[i];
      if (!traced) {
        innerBeam.object.visible = false;
        outerBeam.object.visible = false;
        return;
      }
      const { inside, out, at, T, widthScale, firstLeg } = traced;
      innerBeam.setLinearColor(band.rgb);
      outerBeam.setLinearColor(band.rgb);
      const insideGain = p.inside ?? 0.3;
      innerBeam.pose({
        ...beamOpts,
        from: toVec(entry),
        direction: toVec(toWorld(new Vector3(...inside), false)),
        end: out ? firstLeg : 0,
        taper: 0,
        gain: gain * T * insideGain,
        visible: !!out && insideGain > 0,
      });
      if (!out) {
        outerBeam.object.visible = false;
        return;
      }
      const exit = toWorld(at, true);
      const outDir = toWorld(out, false);
      let end = reach;
      let hit: Vector3 | null = null;
      if (wallN && wallP) {
        const denom = outDir.dot(wallN);
        const t = Math.abs(denom) > 1e-9 ? wallP.clone().sub(exit).dot(wallN) / denom : -1;
        if (t > 0) {
          end = t;
          hit = exit.clone().addScaledVector(outDir, t);
          spots.push({ at: toVec(hit), rgb: band.rgb });
          slant ??= outDir.clone();
        }
      }
      outerBeam.pose({
        ...beamOpts,
        width: p.beam.width * widthScale,
        from: toVec(exit),
        direction: toVec(outDir),
        end,
        taper: hit ? 0 : (p.taper ?? 0.5),
        gain: gain * T,
      });
      if (i === Math.floor(bands.length / 2)) {
        exitMid = exit;
        widthOut = p.beam.width * widthScale;
      }
      transmissionSum += T;
      trace.bands.push({
        nm: band.nm,
        rgb: band.rgb,
        exit: toVec(exit),
        direction: toVec(outDir),
        hit: hit ? toVec(hit) : null,
        transmission: T,
      });
    });

    const exitAt = exitMid as Vector3 | null;
    this.glintOut.pose({
      at: exitAt ? toVec(exitAt) : [0, 0, 0],
      size: p.beam.width * 6,
      gain: gain * glints * 0.7,
      visible: !!exitAt && glints > 0,
    });

    if (wall && wallN && spots.length > 1) {
      const dir = slant as Vector3 | null;
      const cos = dir ? Math.abs(dir.dot(wallN)) : 1;
      const along = dir ? dir.clone().addScaledVector(wallN, -dir.dot(wallN)) : null;
      this.smear.poseSpots({
        center: spots[Math.floor(spots.length / 2)].at,
        normal: toVec(wallN),
        // At most 24 spots, picked evenly along the spectrum.
        spots:
          spots.length > 24
            ? Array.from({ length: 24 }, (_, k) => spots[Math.round((k * (spots.length - 1)) / 23)])
            : spots,
        width: widthOut,
        stretchAlong: along && along.lengthSq() > 1e-8 ? toVec(along) : undefined,
        stretch: 1 / Math.max(0.05, cos),
        soft: wall.soft ?? 0.5,
        gain: gain * (wall.gain ?? 1) * (transmissionSum / Math.max(1, trace.bands.length)),
      });
    } else this.smear.object.visible = false;
    return trace;
  }
}
