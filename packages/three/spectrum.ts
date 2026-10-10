import type { Vec3 } from "./lens.js";

/**
 * Light by wavelength: the colour of a wavelength, white split into a
 * spectrum that adds back up to white, and glass that bends each wavelength
 * by its own amount (Cauchy's equation). Used by `Prism`, `Smear` and
 * `Caustic`, and exported for your own light.
 */

const lobe = (x: number, mu: number, below: number, above: number) => {
  const s = x < mu ? below : above;
  return Math.exp(-0.5 * ((x - mu) / s) ** 2);
};

/**
 * Linear sRGB of one wavelength (nm), unclamped: the CIE 1931 observer as
 * fitted by Wyman, Sloan and Shirley (2013), through XYZ to sRGB primaries.
 * Most of the spectrum lies outside sRGB, so some channels come out negative.
 */
export function wavelengthToLinear(nm: number): Vec3 {
  const x =
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2);
  const y = 0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1);
  const z = 1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8);
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ];
}

export type SpectrumBand = { nm: number; rgb: Vec3 };

/**
 * White light split into `count` bands from `from` to `to` nm. Each band's
 * colour is linear sRGB (clamped into gamut), balanced so that all bands add
 * up to exactly (1, 1, 1): recombined, the spectrum is white again. The ends
 * are dim, as they are in a real spectrum.
 *
 * `spacing` "wavelength" spaces the bands evenly in nm. "dispersion" spaces
 * them evenly in 1 / λ², which is how glass spreads them (Cauchy), so a
 * prism's fan has evenly spaced rays; each band is weighted by the stretch
 * of wavelengths it covers, so the light is the same.
 */
export function spectrumBands(
  count: number,
  from = 400,
  to = 700,
  spacing: "wavelength" | "dispersion" = "wavelength",
): SpectrumBand[] {
  const n = Math.max(1, Math.round(count));
  const bands = Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? 0.5 : i / (n - 1);
    let nm = from + (to - from) * f;
    let weight = 1;
    if (spacing === "dispersion") {
      const [a, b] = [1 / (from * from), 1 / (to * to)];
      nm = 1 / Math.sqrt(a + (b - a) * f);
      // dλ per step of 1/λ² is proportional to λ³.
      weight = nm ** 3;
    }
    const c = wavelengthToLinear(nm);
    return { nm, rgb: [Math.max(0, c[0]) * weight, Math.max(0, c[1]) * weight, Math.max(0, c[2]) * weight] as Vec3 };
  });
  const sum = [0, 1, 2].map((k) => bands.reduce((s, b) => s + b.rgb[k], 0) || 1);
  for (const b of bands) b.rgb = [b.rgb[0] / sum[0], b.rgb[1] / sum[1], b.rgb[2] / sum[2]];
  return bands;
}

/** Cauchy's equation, n(λ) = A + B / λ², λ in micrometres. */
export type Glass = { A: number; B: number };

/** Glasses fitted to their refractive index and Abbe number at the d line (587.6 nm). */
export const glasses = {
  /** Crown glass (n 1.517, Abbe 64): gentle dispersion, the usual lens glass. */
  bk7: { A: 1.5046, B: 0.0042 },
  /** Fused silica (n 1.458, Abbe 68). */
  silica: { A: 1.458, B: 0.00354 },
  /** Flint (n 1.620, Abbe 36): the classic prism glass. */
  flint: { A: 1.5942, B: 0.00892 },
  /** Dense flint (n 1.785, Abbe 26): a wide, vivid spectrum. */
  denseFlint: { A: 1.7384, B: 0.016 },
  /** Diamond (n 2.417, Abbe 55). */
  diamond: { A: 2.3782, B: 0.01341 },
  /** Water (n 1.333, Abbe 56). */
  water: { A: 1.3239, B: 0.00313 },
} satisfies Record<string, Glass>;

export type GlassName = keyof typeof glasses;

/** Refractive index of `glass` at `nm`. `dispersion` scales B: 1 is the real glass, more spreads the spectrum wider. */
export function refractiveIndex(glass: GlassName | Glass, nm: number, dispersion = 1) {
  const g = typeof glass === "string" ? glasses[glass] : glass;
  const um = nm / 1000;
  // Scaled about the d line, so a larger dispersion keeps the same mean bend.
  const d = 0.5876;
  return g.A + g.B / (d * d) + g.B * dispersion * (1 / (um * um) - 1 / (d * d));
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Snell's law in vector form. `d` is the unit direction of travel, `n` the
 * unit normal facing against it, `eta` = n₁ / n₂. Returns null on total
 * internal reflection.
 */
export function refract(d: Vec3, n: Vec3, eta: number): Vec3 | null {
  const cosi = -dot(d, n);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  return [eta * d[0] + f * n[0], eta * d[1] + f * n[1], eta * d[2] + f * n[2]];
}

/** Mirror `d` about the plane with unit normal `n`. */
export function reflect(d: Vec3, n: Vec3): Vec3 {
  const k = 2 * dot(d, n);
  return [d[0] - k * n[0], d[1] - k * n[1], d[2] - k * n[2]];
}

/** Fraction of unpolarised light reflected at an interface (Fresnel), from n₁ into n₂ at incidence cosine `cosi`. */
export function fresnel(cosi: number, n1: number, n2: number) {
  const sint = (n1 / n2) * Math.sqrt(Math.max(0, 1 - cosi * cosi));
  if (sint >= 1) return 1;
  const cost = Math.sqrt(1 - sint * sint);
  const rs = ((n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost)) ** 2;
  const rp = ((n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi)) ** 2;
  return (rs + rp) / 2;
}
