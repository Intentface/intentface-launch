import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { declareText, useFrame, useVideoInfo, waitFor } from "../engine/index.js";
import { colourOf } from "./shader.js";

/*
 * A logo seen through a moving lens of oil, as in Apple Music's 2026 sting
 * (filmed in a tray of mineral oil). One camera looks straight down through
 * the oil's surface at a bright logo on a dark floor; a rig pushes the oil up
 * into a dome, and each pixel's view ray refracts through it by Snell's law,
 * once per wavelength, onto the logo: the dome magnifies, its steep rim splits
 * white edges into spectral fringes, the surface reflects a dark studio's
 * softboxes, waves leave its edge, and the logo shows only where the dome has
 * reached. The surface is closed-form in time, so every frame is a pure
 * function of its frame number.
 *
 * Ported from Travis Fischer's study (github.com/transitive-bullshit/apple-music-effect,
 * MIT): the surface, the optics, the studio and the finish follow it; the
 * timing curves of `oilDomes` are its fits to Apple's film. Lengths here are
 * CSS pixels of the layer, not the study's units (half the frame's height).
 *
 * Added here: an ASCII pass that draws the picture as glyphs, cell by cell,
 * at the reveal's front and while a mark builds in, with an optional calm
 * glitch (row slips, glyphs that change on a stepped clock).
 *
 * The study's surface, optics, finish and dome fits carry its licence:
 *
 *   Copyright (c) 2026 Travis Fischer
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 */

/** A value, or a function of the (fractional) frame: the lens calls it once per subframe. */
export type OilAnimated<T> = T | ((frame: number) => T);

/** The dome of oil at one moment. Lengths in CSS pixels of the layer; x and y from its centre, y down. */
export type OilDome = {
  x?: number;
  y?: number;
  /** The footprint's half-height: where the dome meets flat oil (and how far the reveal has reached). */
  radius: number;
  /** The crown's height over flat oil; 0 is flat (the logo undistorted). */
  height: number;
  /** The footprint's superellipse exponent: 2 is a circle or an ellipse, 3 to 5 a rounded square (an app icon). */
  exponent?: number;
  /** The footprint's width over its height (1). */
  aspect?: number;
  /** The round crown, which magnifies radially (0). */
  crown?: number;
  /** A quartic term after it: the dome steepens toward its rim (0). */
  shoulder?: number;
  /** How flat the inside stays before the rim falls: 2 not at all, 45 a flat top (2). */
  flat?: number;
  /** The rim's falloff: under 1 is steep at the edge, where colours split (1). */
  edge?: number;
  /** A wave on the dome's edge: its height (0), the crest's width (27), the wavelength of a train (0: one crest), how far outside the rim it runs (0), and how far its crests have travelled, in radians. */
  ring?: number;
  ringWidth?: number;
  ringWavelength?: number;
  ringReach?: number;
  ringPhase?: number;
  /** The rod's ripples: rings running out from the centre, fading toward the rim. Height (0), wavelength (30), phase in radians, reach as a fraction of the radius (0.9). */
  ripple?: number;
  rippleWavelength?: number;
  ripplePhase?: number;
  rippleReach?: number;
  /** The rig's chrome tip standing in the crown: its radius, and its centre's height over the crown (negative: sunk). */
  tip?: { radius: number; lift: number };
};

/** The oil and the studio. */
export type OilOptics = {
  /** How far under the oil's rest level the logo lies, in px (default half the layer's height). */
  depth: number;
  /** Mineral oil, at 589 nm (1.47). */
  ior: number;
  /** Multiplies the oil's dispersion (Cauchy B); 1 is real oil (16: exaggerated so it reads). */
  dispersion: number;
  /** The slope at which dispersion is half as strong: colour gathers on steep rims and the magnified inside stays clean (0: the same everywhere). */
  dispersionKnee: number;
  /** The steepest the surface gets, where oil meets glass (0: no limit). */
  maxSlope: number;
  /** Wavelength samples per pixel per subframe (16). */
  wavelengths: number;
  /** Blur where the surface curves (0.05). */
  defocus: number;
  /** Constant blur of the logo, in mip levels (0). */
  blur: number;
  /** Strength of the surface's reflection of the studio (1). */
  reflect: number;
  /** The logo shows only within the dome's footprint (true). */
  reveal: boolean;
  /** Softness of the reveal's edge, as a fraction of the radius (0.06). */
  revealSoft: number;
  /** The key softbox left of camera and its fill, in reflections (20). */
  softbox: number;
  /** The studio's walls, which steep rims catch at grazing angles (6). */
  horizon: number;
  /** A ring light around the lens: slopes of about 0.35 catch it whichever way they face (0), and its spread (0.45). */
  ringLight: number;
  ringLightWidth: number;
  /** Colours dispersion splits light into, from short wavelengths to long (2 to 4 CSS colours), in place of the spectrum: a brand's two colours for its fringes. White still recombines to white. Empty: the real spectrum. */
  palette: readonly string[];
};

/** The grade and the camera's finish. */
export type OilLook = {
  exposure: number;
  /** Glow around bright things (0.03), its radius (1) and colour (a cool blue). */
  bloom: number;
  bloomRadius: number;
  glowTint: string | readonly [number, number, number];
  vignette: number;
  /** 1 leaves colour as rendered (1.5: the film's richer grade). */
  saturation: number;
  /** Display level crushed to black (0.012). */
  black: number;
  /** White balance, a gain per channel. */
  balance: readonly [number, number, number];
  /** The floor, a CSS colour (very nearly black). */
  floor: string;
};

/** Glyphs over the picture: the picture drawn as text, cell by cell. */
export type OilAscii = {
  /** The share of lit cells drawn as glyphs, 0 to 1. Cells flip one by one as it changes, each at its own threshold. */
  amount?: number;
  /** Glyphs in a band at the reveal's front (the dome's rim), 0 to 1. */
  front?: number;
  /** The band's width, as a fraction of the radius (0.25). */
  frontWidth?: number;
  /** Dim glyphs in dark cells of the band: the footprint drawn in text ahead of the light (0.35). */
  ghost?: number;
  /** Rows slipping sideways by whole cells and glyphs changing, 0 to 1, on a clock that steps every `step` frames (3). */
  glitch?: number;
  step?: number;
  /** Cell height in CSS px (14); cells are 0.6 as wide. */
  cell?: number;
  /** Glyphs from dark to bright. */
  glyphs?: string;
  /** The glyphs' font family (monospace). */
  font?: string;
  /** How much of the picture stays under a glyph (0.25): 0 is pure text, cell by cell. */
  under?: number;
  /** Glyph brightness against the cell's light (1.8: a glyph covers a third of its cell). */
  level?: number;
  /** The ghost glyphs' colour. */
  ghostColor?: string;
  /** Seed: same seed, same cells. */
  seed?: number;
};

/** The picture torn apart: a hard glitch, for a mark leaving (or arriving). Everything on a clock that steps every `step` frames (2). */
export type OilTear = {
  /** How far bands are torn sideways, in CSS px. */
  shift: number;
  /** About how many bands across the frame's height (24); their edges move each step. */
  bands?: number;
  /** Red and blue pulled apart, in CSS px (a share of `shift` when absent: 0.25). */
  split?: number;
  /** The colours the split pulls apart into, in place of red, green and blue: the copy pushed one way, the other, and (optionally) the one left in the middle; together they make about white. */
  tint?: readonly [string, string] | readonly [string, string, string];
  /** The share of bands gone black, 0 to 1 (0). */
  drop?: number;
  step?: number;
  seed?: number;
};

export type OilLensProps = {
  /** The logo on the floor: an image URL (SVG, PNG or a data: URI). */
  src: string;
  /** "alpha": its shape in `color` (default); "color": its own colours (a gradient mark); "luminance": a light-on-dark picture. */
  mode?: "alpha" | "color" | "luminance";
  /** The logo's colour in "alpha" and "luminance" modes (a cool white). */
  color?: string;
  /** The logo's width in CSS px of the layer, and its centre from the layer's centre (y down). */
  width: number;
  x?: number;
  y?: number;
  /** The dome; null for flat oil. */
  dome: OilAnimated<OilDome | null>;
  /** The logo's size about its centre (1): under 1 it recedes from the camera. */
  scale?: OilAnimated<number>;
  /** Camera zoom about the layer's centre (1). */
  zoom?: OilAnimated<number>;
  /** Brightness, 0 to 1 (1). */
  fade?: OilAnimated<number>;
  /** Multiplies `optics.dispersion` (1): a small early dome splits colour thinly. */
  colour?: OilAnimated<number>;
  /** Multiplies `optics.reflect` (1). */
  gloss?: OilAnimated<number>;
  optics?: Partial<OilOptics>;
  look?: Partial<OilLook>;
  /** Glyphs over the picture, per frame; off when absent or all zero. */
  ascii?: OilAnimated<OilAscii | null>;
  /** The picture torn into bands, split and dropped, per frame; off when absent or `shift` 0. Under the glyphs, which follow it. */
  tear?: OilAnimated<OilTear | null>;
  /** The shutter, as a fraction of a frame (0.5: 180°), and the subframes taken across it (6). Motion blur is built in: do not wrap the lens in `MotionBlur`. */
  shutter?: number;
  subframes?: number;
  /** The layer's size in CSS px (default the video's), and drawing-buffer pixels per CSS pixel (1). */
  layerWidth?: number;
  layerHeight?: number;
  resolution?: number;
  style?: CSSProperties;
  className?: string;
};

export const oilOptics: OilOptics = {
  depth: 0,
  ior: 1.47,
  dispersion: 16,
  dispersionKnee: 0,
  maxSlope: 0,
  wavelengths: 16,
  defocus: 0.05,
  blur: 0,
  reflect: 1,
  reveal: true,
  revealSoft: 0.06,
  softbox: 20,
  horizon: 6,
  ringLight: 0,
  ringLightWidth: 0.45,
  palette: [],
};

export const oilLook: OilLook = {
  exposure: 1,
  bloom: 0.03,
  bloomRadius: 1,
  glowTint: [0.55, 0.75, 1.35],
  vignette: 0.25,
  saturation: 1.5,
  black: 0.012,
  balance: [0.97, 1, 1.03],
  floor: "#040507",
};

// --- Curves ---------------------------------------------------------------------

/** [frame, value] */
export type CurveKey = readonly [number, number];

/**
 * A smooth curve through keys (monotone cubic, Fritsch–Carlson): no overshoot
 * between keys, flat before the first and after the last, and continuous in
 * value and slope, so it eases out of the first key and into the last.
 */
export function monotoneCurve(keys: readonly CurveKey[]): (t: number) => number {
  const n = keys.length;
  if (n === 0) return () => 0;
  const d = keys.slice(1).map(([t1, y1], i) => (y1 - keys[i][1]) / (t1 - keys[i][0]));
  const m = keys.map((_, i) => (i === 0 || i === n - 1 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    if (a < 0) m[i] = 0;
    if (b < 0) m[i + 1] = 0;
    const r = Math.hypot(a, b);
    if (r > 3) {
      m[i] = (3 * a * d[i]) / r;
      m[i + 1] = (3 * b * d[i]) / r;
    }
  }
  return (t) => {
    if (n === 1 || t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const [t0, y0] = keys[i];
    const [t1, y1] = keys[i + 1];
    const h = t1 - t0;
    const s = (t - t0) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m[i + 1]
    );
  };
}

type Profile = { crown: number; shoulder: number; flat: number; edge: number };

const between = (a: Profile, b: Profile, u: number): Profile => ({
  crown: a.crown + (b.crown - a.crown) * u,
  shoulder: a.shoulder + (b.shoulder - a.shoulder) * u,
  flat: a.flat + (b.flat - a.flat) * u,
  edge: a.edge + (b.edge - a.edge) * u,
});

/** Keys in seconds of the film and the study's units, as frames and pixels. */
const scaled = (keys: readonly CurveKey[], at: number, frames: number, unit: number) =>
  monotoneCurve(keys.map(([s, v]) => [at + s * frames, v * unit] as const));

export type OilDomeTiming = {
  /** The frame the dome rises (0). */
  at?: number;
  /** Frames per second of the film's timing (60); `pace` stretches it (1; 1.4 is 40% slower). */
  fps?: number;
  pace?: number;
  /** Multiplies the dome's height: lower is gentler (1). */
  strength?: number;
};

/**
 * Domes fitted to Apple Music's film (by the study above), as functions of the
 * frame to pass to `OilLens`'s `dome`. Each pairs with the optics in `look`
 * that the film's shot used.
 */
export const oilDomes = {
  /**
   * The icon shot: a bubble that rises, grows into a rounded square, holds as
   * a flat top whose steep rim smears the logo into the corners, then falls to
   * a thin layer. `size` is the tile's final height in px (the logo about half
   * of it). Rises over 0.2 s, rounds into the tile by 0.45 s, settles by 1 s,
   * falls from 1.15 to 1.3 s (at pace 1).
   */
  tile({
    size,
    at = 0,
    fps = 60,
    pace = 1,
    strength = 1,
    exponent = 3.3,
    x = 0,
    y = 0,
  }: OilDomeTiming & {
    size: number;
    exponent?: number;
    x?: number;
    y?: number;
  }) {
    const unit = size / 1.08;
    const f = fps * pace;
    const radius = scaled(
      [
        [0.05, 0.1],
        [0.12, 0.29],
        [0.21, 0.415],
        [0.42, 0.478],
        [0.75, 0.526],
        [1.17, 0.54],
      ],
      at,
      f,
      unit,
    );
    const height = scaled(
      [
        [0.05, 0],
        [0.12, 0.1],
        [0.21, 0.1507],
        [0.45, 0.1796],
        [0.75, 0.2432],
        [1.0, 0.245],
        [1.15, 0.22],
        [1.3, 0.022],
        [1.6, 0],
      ],
      at,
      f,
      unit * strength,
    );
    const morph = scaled(
      [
        [0.28, 0],
        [0.45, 1],
      ],
      at,
      f,
      1,
    );
    const settle = scaled(
      [
        [0.21, 0],
        [0.6, 0.7379],
        [1.0, 1],
      ],
      at,
      f,
      1,
    );
    // A ripple runs just ahead of the bubble's rim while it grows; then a wave
    // of displaced oil leaves the tile's edge, travelling out and fading.
    const ring = scaled(
      [
        [0.1, 0],
        [0.2, 0.012],
        [0.3, 0.008],
        [0.42, 0],
        [0.5, 0],
        [0.62, 0.012],
        [0.85, 0.008],
        [1.0, 0],
      ],
      at,
      f,
      unit,
    );
    const reach = scaled(
      [
        [0.1, 0.05],
        [0.42, 0.05],
        [0.55, 0.03],
        [0.63, 0.07],
        [0.8, 0.16],
        [1.0, 0.26],
      ],
      at,
      f,
      unit,
    );
    const from = { crown: 0.4597, shoulder: 0.7245, flat: 45, edge: 0.2 };
    const to = { crown: 0.1004, shoulder: 0.4008, flat: 45, edge: 0.2 };
    return (t: number): OilDome | null => {
      if (t < at + 0.05 * f) return null;
      const m = morph(t);
      return {
        x,
        y,
        radius: radius(t),
        height: Math.max(0, height(t)),
        exponent: 2 + (exponent - 2) * m,
        ...between(from, to, settle(t)),
        ring: ring(t),
        ringWidth: 0.02 * unit,
        ringReach: reach(t),
      };
    };
  },

  /**
   * The wordmark shot: an orb around the rig's chrome tip, rippling, that
   * widens and settles into a wide, low dome whose soft rim lies on the
   * mark's ends and smears them outward, with echoes running off its edge,
   * then falls flat. `size` is the orb's final width in px; `aspect` > 1
   * stretches it into an oval for a long mark. Flat by 1.6 s (at pace 1).
   */
  orb({
    size,
    at = 0,
    fps = 60,
    pace = 1,
    strength = 1,
    aspect = 1,
    x = 0,
    y = 0,
    tip = true,
  }: OilDomeTiming & {
    size: number;
    aspect?: number;
    x?: OilAnimated<number>;
    y?: OilAnimated<number>;
    /** The rig's chrome tip in the orb's crown at first (true). */
    tip?: boolean;
  }) {
    const unit = size / 1.32 / aspect;
    const f = fps * pace;
    const radius = scaled(
      [
        [0, 0.15],
        [0.135, 0.24],
        [0.295, 0.35],
        [0.375, 0.4],
        [0.6, 0.5],
        [0.94, 0.66],
        [1.2, 0.65],
        [1.5, 0.62],
        [1.8, 0.6],
      ],
      at,
      f,
      unit,
    );
    const height = scaled(
      [
        [0, 0.0136],
        [0.135, 0.041],
        [0.295, 0.0682],
        [0.375, 0.0864],
        [0.6, 0.0385],
        [0.94, 0.0409],
        [1.2, 0.012],
        [1.6, 0],
      ],
      at,
      f,
      unit * strength,
    );
    const settle = scaled(
      [
        [0.375, 0],
        [0.58, 1],
      ],
      at,
      f,
      1,
    );
    const stretch = scaled(
      [
        [0.2, 0],
        [0.94, 1],
      ],
      at,
      f,
      1,
    );
    const ring = scaled(
      [
        [0.7, 0],
        [0.9, 0.003],
        [1.0, 0.003],
        [1.2, 0.0035],
        [1.45, 0.0025],
        [1.62, 0],
      ],
      at,
      f,
      unit,
    );
    const lift = scaled(
      [
        [0.25, 0],
        [0.4, -0.2],
      ],
      at,
      f,
      unit,
    );
    const from = { crown: 0, shoulder: 0, flat: 2, edge: 0.8 };
    const to = { crown: 0, shoulder: 0, flat: 11.67, edge: 2.84 };
    const value = (v: OilAnimated<number>, t: number) => (typeof v === "function" ? v(t) : v);
    return (t: number): OilDome | null => {
      if (t < at) return null;
      const s = settle(t);
      const local = (t - at) / f;
      return {
        x: value(x, t),
        y: value(y, t),
        radius: radius(t),
        height: Math.max(0, height(t)),
        aspect: 1 + (aspect - 1) * stretch(t),
        ...between(from, to, s),
        ring: ring(t),
        ringWidth: 0.06 * unit,
        ringWavelength: 0.06 * unit,
        ringPhase: (2 * Math.PI * 0.08 * local) / 0.06,
        // The orb's rings, strongest as it appears, gone once it settles.
        ripple: 0.005 * unit * Math.exp(-local / 0.5) * (1 - s),
        rippleWavelength: 0.08 * unit,
        ripplePhase: (2 * Math.PI * 0.4 * local) / 0.08,
        tip: tip ? { radius: 0.065 * unit, lift: lift(t) } : undefined,
      };
    };
  },
};

/** The optics and look of each of the film's shots, to spread into `optics` and `look`. */
export const oilShots = {
  tile: {
    optics: { dispersion: 100, dispersionKnee: 0.9, maxSlope: 1.4, softbox: 4 } satisfies Partial<OilOptics>,
    look: {} satisfies Partial<OilLook>,
  },
  orb: {
    optics: {
      dispersion: 60,
      dispersionKnee: 0.3,
      softbox: 2,
      horizon: 0.25,
      ringLight: 1.3,
    } satisfies Partial<OilOptics>,
    look: { bloom: 0.012 } satisfies Partial<OilLook>,
  },
};

// --- GLSL -------------------------------------------------------------------------

const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 vUv;
void main() { vUv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const OPTICS = /* glsl */ `${HEADER}
in vec2 vUv;
uniform vec2 uHalf;        // half the view in px (after zoom)
uniform float uUnit;       // half the layer's height in px
uniform sampler2D uLogo;   // premultiplied sRGB
uniform vec4 uLogoRect;    // min.xy, size.xy, px (y up)
uniform vec2 uLogoTexels;
uniform int uMode;         // 0 alpha, 1 colour, 2 luminance
uniform vec3 uLogoColor;   // linear
uniform vec3 uFloorColor;  // linear
uniform float uDepth;
uniform float uIor;
uniform float uDispersion;
uniform float uDispersionKnee;
uniform vec3 uPalette[4];  // linear, short wavelengths first
uniform int uPaletteCount;
uniform float uMaxSlope;
uniform int uWavelengths;
uniform float uDefocus;
uniform float uBlur;
uniform float uReflect;
uniform float uSoftbox;
uniform float uHorizon;
uniform float uRingLight;
uniform float uRingWidth;
uniform vec4 uBall;        // xy centre, z height of centre, w radius (0: none)
uniform vec2 uLensCenter;
uniform vec3 uLens;        // radius, height, exponent
uniform float uLensAspect;
uniform vec3 uLensProfile; // crown, flat, shoulder
uniform float uLensEdge;
uniform vec4 uLensRing;    // amplitude, width, wavelength, reach
uniform float uLensRingPhase;
uniform vec4 uRipple;      // amplitude, wavelength, phase, reach
uniform float uReveal;
uniform float uRevealSoft;
uniform float uSeed;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float footprint(vec2 o) {
  vec2 d = abs(o) / (uLens.x * vec2(uLensAspect, 1.0));
  return pow(pow(d.x, uLens.z) + pow(d.y, uLens.z), 1.0 / uLens.z);
}

// H exp(-crown r² - shoulder r⁴) (1 - rho^flat)^edge, plus a wave riding outside the rim.
float lensZ(vec2 p) {
  if (uLens.x <= 0.0) return 0.0;
  vec2 o = p - uLensCenter;
  vec2 d = abs(o) / (uLens.x * vec2(uLensAspect, 1.0));
  float rho = footprint(o);
  float dist = length(o) * (1.0 - 1.0 / max(rho, 1e-4));
  float e = (dist - uLensRing.w) / max(uLensRing.y, 1e-4);
  float train = uLensRing.z > 0.0 ? cos(6.2831853 * (dist - uLensRing.w) / uLensRing.z - uLensRingPhase) : 1.0;
  float ring = uLensRing.x * exp(-e * e) * train;
  if (rho >= 1.0 || uLens.y <= 0.0) return ring;
  float r2 = dot(d, d);
  float crown = exp(-uLensProfile.x * r2 - uLensProfile.z * r2 * r2);
  return ring + uLens.y * crown * pow(1.0 - pow(rho, uLensProfile.y), uLensEdge);
}

float ripples(vec2 p) {
  if (uRipple.x <= 0.0 || uLens.x <= 0.0) return 0.0;
  float r = length(p - uLensCenter);
  float fade = 1.0 - smoothstep(0.0, uRipple.w * uLens.x, r);
  return uRipple.x * fade * sin(6.2831853 * r / uRipple.y - uRipple.z);
}

float surface(vec2 p) { return lensZ(p) + ripples(p); }

float dispersionHere = 0.0;

// Cauchy: n(lambda) = A + B / lambda², B scaled about n at 589 nm.
float ior(float n589, float lambda) {
  float B = 0.0044 * dispersionHere;
  return n589 + B * (1.0 / (lambda * lambda) - 1.0 / (0.5893 * 0.5893));
}

float lobe(float x, float mu, float s1, float s2) {
  float t = (x - mu) / (x < mu ? s1 : s2);
  return exp(-0.5 * t * t);
}

// A wavelength's weight from the palette instead: its colours spread evenly from 380 to 720 nm.
vec3 paletteAt(float lambda) {
  float x = clamp((lambda - 0.38) / 0.34, 0.0, 1.0) * float(uPaletteCount - 1);
  int i = min(int(floor(x)), uPaletteCount - 2);
  vec3 a = uPalette[0];
  vec3 b = uPalette[1];
  for (int k = 1; k < 3; k++) {
    if (k == i) { a = uPalette[k]; b = uPalette[k + 1]; }
  }
  return mix(a, b, x - float(i));
}

// Linear sRGB of light of one wavelength (µm): the CIE 1931 functions (Wyman, Sloan and Shirley's fit).
vec3 spectrum(float lambda) {
  float l = lambda * 1000.0;
  float x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
  float y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
  float z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
  return mat3(3.2406, -0.9689, 0.0557, -1.5372, 1.8758, -0.2040, -0.4986, 0.0415, 1.0570) * vec3(x, y, z);
}

// A dark studio: a key softbox left of camera, a dim fill right, walls at grazing angles, an optional ring light.
vec3 env(vec3 r) {
  if (r.z <= 0.0) return vec3(0.0);
  vec2 s = r.xy / max(r.z, 0.05);
  float key = 1.0 - smoothstep(0.0, 0.3, length(max(abs(s - vec2(-1.5, 0.1)) - vec2(0.25, 0.55), 0.0)));
  float fill = 1.0 - smoothstep(0.0, 0.4, length(max(abs(s - vec2(1.8, -0.2)) - vec2(0.2, 0.7), 0.0)));
  float horizon = uHorizon * smoothstep(1.2, 4.0, length(s));
  float ring = exp(-pow((length(s) - 0.8) / uRingWidth, 2.0)) * smoothstep(0.15, 0.4, length(s));
  return vec3(0.95, 0.97, 1.0) * (uSoftbox * (key + 0.25 * fill) + uRingLight * ring + horizon);
}

float revealAt(vec2 q) {
  if (uReveal < 0.5 || uLens.x <= 0.0) return uReveal < 0.5 ? 1.0 : 0.0;
  return 1.0 - smoothstep(1.0 - uRevealSoft, 1.0, footprint(q - uLensCenter));
}

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

// The floor at q: the logo over it, as light (linear), and how much of it is logo.
vec3 floorAt(vec2 q, float lod) {
  vec2 uv = (q - uLogoRect.xy) / uLogoRect.zw;
  vec4 L = vec4(0.0);
  if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) L = textureLod(uLogo, vec2(uv.x, 1.0 - uv.y), lod);
  float shown = revealAt(q);
  if (uMode == 1) {
    vec3 c = L.a > 0.0 ? toLinear(L.rgb / L.a) : vec3(0.0);
    return mix(uFloorColor, c, L.a * shown);
  }
  float a = uMode == 2 ? dot(toLinear(L.rgb), vec3(0.2126, 0.7152, 0.0722)) : L.a;
  return mix(uFloorColor, uLogoColor, a * shown);
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uHalf;
  vec3 V = vec3(0.0, 0.0, -1.0);

  if (uBall.w > 0.0) {
    vec2 d = p - uBall.xy;
    float r2 = uBall.w * uBall.w - dot(d, d);
    if (r2 > 0.0) {
      float zHit = uBall.z + sqrt(r2);
      if (zHit > surface(p)) {
        vec3 N = normalize(vec3(d, zHit - uBall.z));
        vec3 R = reflect(V, N);
        vec2 s = R.xy / max(R.z, 0.05);
        float walls = 0.12 * smoothstep(0.4, 3.0, length(s));
        vec3 col = 0.5 * (env(R) - vec3(uHorizon * smoothstep(1.2, 4.0, length(s)))) + walls + 0.015;
        col *= mix(1.0, 0.35, smoothstep(0.9, 0.995, R.z));
        outColor = vec4(col, 1.0);
        return;
      }
    }
  }

  // Slope by central differences, a fixed step in units of the frame so every resolution agrees.
  float h = 0.0015 * uUnit;
  float z = surface(p);
  float zx1 = surface(p + vec2(h, 0.0)), zx0 = surface(p - vec2(h, 0.0));
  float zy1 = surface(p + vec2(0.0, h)), zy0 = surface(p - vec2(0.0, h));
  vec2 grad = vec2(zx1 - zx0, zy1 - zy0) / (2.0 * h);
  if (uMaxSlope > 0.0) grad *= min(1.0, uMaxSlope / max(length(grad), 1e-6));
  float curv = (zx1 + zx0 + zy1 + zy0 - 4.0 * z) / (h * h);
  vec3 N = normalize(vec3(-grad, 1.0));

  float g2 = dot(grad, grad);
  float k2 = uDispersionKnee * uDispersionKnee;
  dispersionHere = uDispersion * (k2 > 0.0 ? g2 / (g2 + k2) : 1.0);

  float texelsPerPx = uLogoTexels.x / uLogoRect.z;
  float spread = uDefocus * uDepth * abs(curv) * 0.02 * texelsPerPx * uUnit;
  float lod = uBlur + log2(1.0 + spread);

  float jitter = hash(gl_FragCoord.xy + uSeed * 17.0);
  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  // With a palette: the light splits evenly, and where only part of it lands on the
  // logo, the light there takes the palette's colour at that part (where it lands
  // whole, it stays the logo's own colour).
  bool tinted = uPaletteCount > 1;
  const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
  float lit = 0.0;
  float at = 0.0;
  int count = max(uWavelengths, 1);
  for (int i = 0; i < 64; i++) {
    if (i >= count) break;
    float u = (float(i) + jitter) / float(count);
    float lambda = mix(0.38, 0.72, u);
    vec3 w = tinted ? vec3(1.0) : spectrum(lambda);
    vec3 T = refract(V, N, 1.0 / ior(uIor, lambda));
    vec2 q = p + T.xy * (z + uDepth) / max(-T.z, 1e-3);
    vec3 f = floorAt(q, lod);
    acc += w * f;
    wsum += w;
    float L = max(dot(f - uFloorColor, LUM), 0.0);
    lit += L;
    at += L * u;
  }
  vec3 col = acc / wsum;
  if (tinted && lit > 1e-5) {
    float m = at / lit;
    float spread = clamp(abs(m - 0.5) * 2.8, 0.0, 1.0);
    vec3 pc = paletteAt(mix(0.38, 0.72, clamp(0.5 + (m - 0.5) * 2.0, 0.0, 1.0)));
    pc /= max(dot(pc, LUM), 1e-4);
    col = mix(col, dot(col, LUM) * pc, spread);
  }
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float lowest = min(col.r, min(col.g, col.b));
  if (lowest < 0.0) col = lum > 0.0 ? mix(vec3(lum), col, lum / (lum - lowest)) : vec3(0.0);

  float cosI = clamp(N.z, 0.0, 1.0);
  float r0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float F = r0 + (1.0 - r0) * pow(1.0 - cosI, 5.0);
  col = col * (1.0 - F) + uReflect * F * env(reflect(V, N));
  outColor = vec4(col, 1.0);
}
`;

const COPY = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform float uScale;
out vec4 outColor;
void main() { outColor = texture(uSrc, vUv) * uScale; }
`;

// Glyphs over the picture. Cells are in device pixels; a cell is a glyph when
// its own threshold is under the amount, or it lies in the band at the
// reveal's front. Its glyph follows the cell's brightness, its colour the
// cell's light, so the spectral fringes carry into the text.
const ASCII = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uGlyphs;
uniform float uGlyphCount;
uniform vec2 uRes;          // device px
uniform vec2 uCell;         // device px
uniform float uAmount;
uniform float uFront;
uniform float uFrontWidth;
uniform float uGhost;
uniform vec3 uGhostColor;   // linear
uniform float uGlitch;
uniform float uStep;
uniform float uSeed;
uniform float uLevel;
uniform float uUnder;
uniform vec2 uHalf;         // view half size, px
uniform vec2 uLensCenter;
uniform vec3 uLens;         // radius, height, exponent
uniform float uLensAspect;
uniform vec4 uTear;         // shift, bands, split (device px), drop
uniform float uTearStep;
uniform vec3 uTearA;        // linear: the copy pushed right, the copy pushed left (sum ≤ 1 per channel)
uniform vec3 uTearB;
uniform vec3 uTearM;        // the middle copy's colour
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// The picture at uv, torn: bands of uneven height pushed sideways, red and blue pulled apart, some gone.
vec3 pic(vec2 uv) {
  if (uTear.x <= 0.0) return texture(uSrc, uv).rgb;
  float y = uv.y * uRes.y;
  float h = uRes.y / max(uTear.y, 1.0);
  float band = floor(y / h + (hash(vec2(floor(y / h), uTearStep)) - 0.5) * 0.8);
  float r = hash(vec2(band * 1.37, uTearStep + 5.0));
  if (r < uTear.w) return vec3(0.0);
  float shift = (hash(vec2(band, uTearStep * 1.9 + 2.0)) - 0.5) * 2.0 * uTear.x;
  shift *= step(0.35, hash(vec2(band, uTearStep + 9.0)));
  vec2 t = uv + vec2(shift / uRes.x, 0.0);
  vec2 sp = vec2(uTear.z / uRes.x, 0.0);
  return uTearA * texture(uSrc, t - sp).rgb + uTearM * texture(uSrc, t).rgb + uTearB * texture(uSrc, t + sp).rgb;
}

void main() {
  vec3 base = pic(vUv);
  if (uAmount <= 0.0 && uFront <= 0.0) { outColor = vec4(base, 1.0); return; }
  vec2 px = vUv * uRes;
  // Rows slip sideways by whole cells for a step or two, in bands.
  float row = floor(px.y / uCell.y);
  float band = floor(row / 3.0);
  float slip = 0.0;
  float hb = hash(vec2(band * 1.7 + uSeed, uStep * 0.37));
  if (hb < uGlitch * 0.35) slip = floor((hash(vec2(band, uStep + 11.0)) - 0.5) * 12.0);
  vec2 g = px + vec2(slip * uCell.x, 0.0);
  vec2 cell = floor(g / uCell);
  vec2 centre = (cell + 0.5) * uCell;
  vec2 cuv = centre / uRes;
  vec2 o = uCell / uRes * 0.25;
  vec3 c = (pic(cuv) * 2.0 + pic(cuv + o) + pic(cuv - o) + pic(cuv + vec2(o.x, -o.y)) + pic(cuv + vec2(-o.x, o.y))) / 6.0;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));

  float threshold = hash(cell + uSeed * 13.1);
  float on = step(threshold, uAmount) * step(0.02, lum);
  // The band at the reveal's front, in the view's px.
  float ghost = 0.0;
  if (uFront > 0.0 && uLens.x > 0.0) {
    vec2 p = (cuv * 2.0 - 1.0) * uHalf;
    vec2 d = abs(p - uLensCenter) / (uLens.x * vec2(uLensAspect, 1.0));
    float rho = pow(pow(d.x, uLens.z) + pow(d.y, uLens.z), 1.0 / uLens.z);
    float off = abs(rho - 1.0 + uFrontWidth * 0.35);
    float inBand = off < uFrontWidth * 0.5 ? 1.0 - smoothstep(0.0, uFrontWidth * 0.5, off) : 0.0;
    float pick = hash(cell * 1.31 + uSeed + 5.0) < uFront * inBand ? 1.0 : 0.0;
    on = max(on, pick);
    ghost = pick * uGhost;
  }
  if (on <= 0.0) { outColor = vec4(base, 1.0); return; }

  // Brightness picks the glyph; the glitch nudges it on the stepped clock.
  float v = clamp(pow(lum, 0.45), 0.0, 1.0);
  float jitterGlyph = (hash(cell + vec2(uStep * 0.71, 3.0)) - 0.5) * uGlitch * 6.0;
  float index = clamp(floor(v * (uGlyphCount - 1.0) + 0.5 + jitterGlyph), 0.0, uGlyphCount - 1.0);
  if (ghost > 0.0 && lum < 0.02) index = 1.0 + floor(hash(cell + vec2(uStep, 7.0)) * (uGlyphCount - 2.0));
  vec2 inCell = (g - cell * uCell) / uCell;
  vec2 guv = vec2((index + inCell.x) / uGlyphCount, 1.0 - inCell.y);
  vec2 dx = vec2(1.0 / (uCell.x * uGlyphCount), 0.0);
  vec2 dy = vec2(0.0, 1.0 / uCell.y);
  float mask = textureGrad(uGlyphs, guv, dx, dy).r;
  vec3 light = max(c * uLevel, uGhostColor * ghost);
  outColor = vec4(base * uUnder + light * mask, 1.0);
}
`;

const DOWNSAMPLE = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec4 c = texture(uSrc, vUv) * 4.0;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0));
  c += texture(uSrc, vUv + uTexel * vec2(1.0, -1.0));
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0));
  c += texture(uSrc, vUv + uTexel * vec2(1.0, 1.0));
  outColor = c / 8.0;
}
`;

const UPSAMPLE = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uBase;
uniform vec2 uTexel;
uniform float uRadius;
out vec4 outColor;
void main() {
  vec2 o = uTexel * uRadius;
  vec4 c = texture(uSrc, vUv + vec2(-o.x * 2.0, 0.0)) + texture(uSrc, vUv + vec2(o.x * 2.0, 0.0));
  c += texture(uSrc, vUv + vec2(0.0, -o.y * 2.0)) + texture(uSrc, vUv + vec2(0.0, o.y * 2.0));
  c += (texture(uSrc, vUv + vec2(-o.x, -o.y)) + texture(uSrc, vUv + vec2(o.x, -o.y)) + texture(uSrc, vUv + vec2(-o.x, o.y)) + texture(uSrc, vUv + vec2(o.x, o.y))) * 2.0;
  outColor = texture(uBase, vUv) + c / 12.0;
}
`;

const FINISH = /* glsl */ `${HEADER}
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform float uBloomAmount;
uniform float uExposure;
uniform float uFade;
uniform float uVignette;
uniform float uAspect;
uniform float uSaturation;
uniform vec3 uGlowTint;
uniform vec3 uBalance;
uniform float uBlack;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  c += uBloomAmount * uGlowTint * texture(uBloom, vUv).rgb;
  c *= uBalance;
  vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - uVignette * dot(v, v);
  c *= uExposure * uFade;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(vec3(lum) + (c - vec3(lum)) * uSaturation, 0.0);
  // A soft shoulder above 0.8: blooming highlights roll off instead of clipping.
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + over / (1.0 + over / 0.2);
  vec3 s = toSrgb(clamp(c, 0.0, 1.0));
  s = max(s - uBlack, 0.0) / (1.0 - uBlack);
  // Half a step of 8-bit, so the dark glow does not band.
  s += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(s, 1.0);
}
`;

// --- WebGL2 -------------------------------------------------------------------------

type Uniforms = Record<string, WebGLUniformLocation | null>;
type Pass = { program: WebGLProgram; uniforms: Uniforms };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; width: number; height: number };
type UniformValue = number | readonly number[] | { tex: WebGLTexture };

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("OilLens: could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`OilLens: a shader does not compile:\n${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function createPass(gl: WebGL2RenderingContext, frag: string): Pass {
  const program = gl.createProgram();
  if (!program) throw new Error("OilLens: could not create a program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`OilLens: a program does not link:\n${gl.getProgramInfoLog(program)}`);
  }
  const uniforms: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  if (!tex || !fb) throw new Error("OilLens: could not create a target");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, width, height };
}

function deleteTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

function imageTexture(gl: WebGL2RenderingContext, source: TexImageSource, premultiply: boolean, mono = false) {
  const tex = gl.createTexture();
  if (!tex) throw new Error("OilLens: could not create a texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  gl.texImage2D(gl.TEXTURE_2D, 0, mono ? gl.R8 : gl.RGBA, mono ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function draw(gl: WebGL2RenderingContext, pass: Pass, target: Target | null, values: Record<string, UniformValue>) {
  gl.useProgram(pass.program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
  gl.viewport(0, 0, target ? target.width : gl.drawingBufferWidth, target ? target.height : gl.drawingBufferHeight);
  let unit = 0;
  for (const [name, value] of Object.entries(values)) {
    const loc = pass.uniforms[name];
    if (loc === undefined || loc === null) continue;
    if (typeof value === "number") {
      if (name === "uMode" || name === "uWavelengths" || name === "uPaletteCount") gl.uniform1i(loc, value);
      else gl.uniform1f(loc, value);
    } else if ("tex" in value) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, value.tex);
      gl.uniform1i(loc, unit++);
    } else if (name.endsWith("[0]")) gl.uniform3fv(loc, value as number[]);
    else if (value.length === 2) gl.uniform2fv(loc, value as number[]);
    else if (value.length === 3) gl.uniform3fv(loc, value as number[]);
    else gl.uniform4fv(loc, value as number[]);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// --- Assets -------------------------------------------------------------------------

const images = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let job = loading.get(src);
  if (!job) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    job = img.decode().then(() => {
      images.set(src, img);
      return img;
    });
    loading.set(src, job);
  }
  return job;
}

const atlases = new Map<string, HTMLCanvasElement>();

/** The glyphs in one row, white on black, each in a cell 0.6 as wide as it is tall. */
function glyphAtlas(glyphs: string, font: string): HTMLCanvasElement {
  const key = `${glyphs}\n${font}`;
  const known = atlases.get(key);
  if (known) return known;
  const ch = 64;
  const cw = Math.round(ch * 0.6);
  const canvas = document.createElement("canvas");
  canvas.width = cw * glyphs.length;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OilLens: no 2D canvas for the glyphs");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(ch * 0.78)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [...glyphs].forEach((g, i) => {
    ctx.fillText(g, cw * i + cw / 2, ch * 0.54);
  });
  atlases.set(key, canvas);
  return canvas;
}

const DEFAULT_GLYPHS = " .:-=+*#%@";

// --- The component -------------------------------------------------------------------

type State = {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  passes: Record<"optics" | "copy" | "ascii" | "down" | "up" | "finish", Pass>;
  size?: { W: number; H: number; color: Target; accum: Target; glyphed: Target; bloom: Target[]; up: Target[] };
  logo?: { key: string; tex: WebGLTexture; texels: [number, number]; aspect: number };
  glyphs?: { key: string; tex: WebGLTexture; count: number };
};

const value = <T,>(v: OilAnimated<T> | undefined, t: number, fallback: T): T =>
  v === undefined ? fallback : typeof v === "function" ? (v as (t: number) => T)(t) : v;

const linear = (css: string) =>
  colourOf(css)
    .slice(0, 3)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

const BLOOM_LEVELS = 6;

/** The split's three copies' colours: red, green and blue, or a tint's, scaled so together they make no more than white. */
function tearColours(tint?: readonly string[]) {
  if (!tint) return { uTearA: [1, 0, 0], uTearB: [0, 0, 1], uTearM: [0, 1, 0] };
  const [a, b] = [linear(tint[0]), linear(tint[1])];
  const m = tint[2] ? linear(tint[2]) : a.map((_, i) => Math.max(0, 2 - a[i] - b[i]));
  const peak = Math.max(...a.map((_, i) => a[i] + b[i] + m[i]));
  const k = (c: number[]) => c.map((x) => x / peak);
  return { uTearA: k(a), uTearB: k(b), uTearM: k(m) };
}

/**
 * A logo seen through a moving lens of oil: magnified by a dome, split into
 * spectral fringes at its steep rim, revealed only where the dome has reached
 * (see `oilDomes` for the film's domes, `oilShots` for its optics). Optional
 * glyphs (`ascii`) draw the picture as text while it builds in. An opaque
 * layer on a dark floor that fills its parent; it draws its own motion blur
 * across `shutter`.
 */
export function OilLens({
  src,
  mode = "alpha",
  color = "#eef2ff",
  width,
  x = 0,
  y = 0,
  dome,
  scale,
  zoom,
  fade,
  colour,
  gloss,
  optics,
  look,
  ascii,
  tear,
  shutter = 0.5,
  subframes = 6,
  layerWidth,
  layerHeight,
  resolution = 1,
  style,
  className,
}: OilLensProps) {
  const frame = useFrame();
  const video = useVideoInfo();
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<State | null>(null);
  const [, bump] = useState(0);

  // The glyph set and font as this frame asks for them (a glyph atlas is drawn once per set).
  const asciiNow = value(ascii, frame, null);
  const glyphs = asciiNow?.glyphs;
  const font = asciiNow?.font || "ui-monospace, Menlo, monospace";
  const wantsGlyphs = asciiNow !== null;

  useLayoutEffect(() => {
    if (images.has(src)) return;
    waitFor(
      loadImage(src).then(() => flushSync(() => bump((n) => n + 1))),
      `OilLens ${src.slice(0, 60)}`,
    );
  }, [src]);

  useLayoutEffect(() => {
    if (!wantsGlyphs) return;
    waitFor(
      document.fonts.load(`500 48px ${font}`).then(() => flushSync(() => bump((n) => n + 1))),
      "OilLens glyph font",
    );
  }, [wantsGlyphs, font]);

  // A fresh canvas per mount: a context once lost cannot be had again from the same canvas.
  useLayoutEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    parent.appendChild(canvas);
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
    });
    if (!gl) throw new Error("OilLens: WebGL2 is not available");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("OilLens: float render targets are not available");
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    state.current = {
      gl,
      canvas,
      passes: {
        optics: createPass(gl, OPTICS),
        copy: createPass(gl, COPY),
        ascii: createPass(gl, ASCII),
        down: createPass(gl, DOWNSAMPLE),
        up: createPass(gl, UPSAMPLE),
        finish: createPass(gl, FINISH),
      },
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
    const img = images.get(src);
    declareText(s.canvas, []);
    if (!img) return;
    const { gl, canvas, passes } = s;
    const cssW = layerWidth ?? video.width;
    const cssH = layerHeight ?? video.height;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(2, Math.round(cssW * resolution * dpr));
    const H = Math.max(2, Math.round(cssH * resolution * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    if (!s.size || s.size.W !== W || s.size.H !== H) {
      if (s.size)
        for (const t of [s.size.color, s.size.accum, s.size.glyphed, ...s.size.bloom, ...s.size.up])
          deleteTarget(gl, t);
      const bloom: Target[] = [];
      const up: Target[] = [];
      let w = W;
      let h = H;
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        w = Math.max(1, w >> 1);
        h = Math.max(1, h >> 1);
        bloom.push(createTarget(gl, w, h));
        if (i < BLOOM_LEVELS - 1) up.push(createTarget(gl, w, h));
      }
      s.size = {
        W,
        H,
        color: createTarget(gl, W, H),
        accum: createTarget(gl, W, H),
        glyphed: createTarget(gl, W, H),
        bloom,
        up,
      };
    }

    // The logo, drawn at about the pixels it covers on screen (twice, for the dome's magnification).
    const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const texW = Math.min(4096, Math.round(width * resolution * dpr * 2));
    const logoKey = `${src}\n${texW}\n${mode}`;
    if (s.logo?.key !== logoKey) {
      if (s.logo) gl.deleteTexture(s.logo.tex);
      const raster = document.createElement("canvas");
      raster.width = texW;
      raster.height = Math.max(1, Math.round(texW / aspect));
      const ctx = raster.getContext("2d");
      if (!ctx) throw new Error("OilLens: no 2D canvas for the logo");
      ctx.drawImage(img, 0, 0, raster.width, raster.height);
      s.logo = { key: logoKey, tex: imageTexture(gl, raster, true), texels: [raster.width, raster.height], aspect };
    }
    const glyphSet = glyphs ?? DEFAULT_GLYPHS;
    if (wantsGlyphs && s.glyphs?.key !== `${glyphSet}\n${font}`) {
      if (s.glyphs) gl.deleteTexture(s.glyphs.tex);
      s.glyphs = {
        key: `${glyphSet}\n${font}`,
        tex: imageTexture(gl, glyphAtlas(glyphSet, font), false, true),
        count: glyphSet.length,
      };
    }

    const o = { ...oilOptics, ...optics };
    const l = { ...oilLook, ...look };
    const unit = cssH / 2;
    const depth = o.depth || unit;
    const logoColor = linear(color);
    const floor = linear(l.floor);
    if (o.palette.length > 4) throw new Error("OilLens: a palette has at most 4 colours");
    const palette = [0, 1, 2, 3].flatMap((i) => (o.palette[i] ? linear(o.palette[i]) : [0, 0, 0]));
    const modeIndex = mode === "color" ? 1 : mode === "luminance" ? 2 : 0;
    const K = Math.max(1, Math.round(subframes));
    const { color: colorT, accum, glyphed, bloom, up } = s.size;

    const lensAt = (t: number) => {
      const d = value(dome, t, null);
      const z = value(zoom, t, 1);
      const half = [cssW / 2 / z, cssH / 2 / z] as const;
      return { d, half };
    };

    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (let k = 0; k < K; k++) {
      const t = frame + shutter * ((k + 0.5) / K - 0.5);
      const { d, half } = lensAt(t);
      const k2 = value(scale, t, 1);
      const lw = width * k2;
      const lh = lw / s.logo.aspect;
      const cx = x;
      const cy = -y;
      const dx = d?.x ?? 0;
      const dy = -(d?.y ?? 0);
      const height = d?.height ?? 0;
      const tip = d?.tip;
      draw(gl, passes.optics, colorT, {
        uHalf: half,
        uUnit: unit,
        uLogo: { tex: s.logo.tex },
        uLogoRect: [cx - lw / 2, cy - lh / 2, lw, lh],
        uLogoTexels: s.logo.texels,
        uMode: modeIndex,
        uLogoColor: logoColor,
        uFloorColor: floor,
        uDepth: depth,
        uIor: o.ior,
        uDispersion: o.dispersion * value(colour, t, 1),
        uDispersionKnee: o.dispersionKnee,
        "uPalette[0]": palette,
        uPaletteCount: o.palette.length < 2 ? 0 : o.palette.length,
        uMaxSlope: o.maxSlope,
        uWavelengths: Math.round(o.wavelengths),
        uDefocus: o.defocus,
        uBlur: o.blur,
        uReflect: o.reflect * value(gloss, t, 1),
        uSoftbox: o.softbox,
        uHorizon: o.horizon,
        uRingLight: o.ringLight,
        uRingWidth: o.ringLightWidth,
        uBall: tip && d ? [dx, dy, height + tip.lift, tip.radius] : [0, 0, 0, 0],
        uLensCenter: [dx, dy],
        uLens: d ? [d.radius, height, d.exponent ?? 2] : [0, 0, 2],
        uLensAspect: d?.aspect ?? 1,
        uLensProfile: [d?.crown ?? 0, d?.flat ?? 2, d?.shoulder ?? 0],
        uLensEdge: d?.edge ?? 1,
        uLensRing: [d?.ring ?? 0, d?.ringWidth ?? 0.05 * unit, d?.ringWavelength ?? 0, d?.ringReach ?? 0],
        uLensRingPhase: d?.ringPhase ?? 0,
        uRipple: [d?.ripple ?? 0, d?.rippleWavelength ?? 0.055 * unit, d?.ripplePhase ?? 0, d?.rippleReach ?? 0.9],
        uReveal: o.reveal ? 1 : 0,
        uRevealSoft: o.revealSoft,
        uSeed: k,
      });
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      draw(gl, passes.copy, accum, { uSrc: { tex: colorT.tex }, uScale: 1 / K });
      gl.disable(gl.BLEND);
    }

    // Glyphs, once per frame on the accumulated picture.
    let picture = accum;
    const a = asciiNow;
    const torn = value(tear, frame, null);
    const glyphsOn = !!(a && s.glyphs && ((a.amount ?? 0) > 0 || (a.front ?? 0) > 0));
    if (glyphsOn || (torn && torn.shift > 0)) {
      const px = resolution * dpr;
      const { d, half } = lensAt(frame);
      const cellH = (a?.cell ?? 14) * px;
      const stepFrames = Math.max(1, a?.step ?? 3);
      draw(gl, passes.ascii, glyphed, {
        uSrc: { tex: accum.tex },
        uGlyphs: { tex: s.glyphs?.tex ?? accum.tex },
        uGlyphCount: s.glyphs?.count ?? 1,
        uRes: [W, H],
        uCell: [Math.max(2, Math.round(cellH * 0.6)), Math.max(2, Math.round(cellH))],
        uAmount: glyphsOn ? (a?.amount ?? 0) : 0,
        uFront: glyphsOn ? (a?.front ?? 0) : 0,
        uFrontWidth: a?.frontWidth ?? 0.25,
        uGhost: a?.ghost ?? 0.35,
        uGhostColor: linear(a?.ghostColor ?? "#9fc4ff"),
        uGlitch: a?.glitch ?? 0,
        uStep: Math.floor(frame / stepFrames),
        uSeed: a?.seed ?? 0,
        uLevel: a?.level ?? 1.8,
        uUnder: a?.under ?? 0.25,
        uTear: torn
          ? [torn.shift * px, torn.bands ?? 24, (torn.split ?? torn.shift * 0.25) * px, torn.drop ?? 0]
          : [0, 1, 0, 0],
        ...tearColours(torn?.tint),
        uTearStep: torn ? Math.floor(frame / Math.max(1, torn.step ?? 2)) + (torn.seed ?? 0) * 101 : 0,
        uHalf: half,
        uLensCenter: [d?.x ?? 0, -(d?.y ?? 0)],
        uLens: d ? [d.radius, d.height, d.exponent ?? 2] : [0, 0, 2],
        uLensAspect: d?.aspect ?? 1,
      });
      picture = glyphed;
    }

    // Bloom: a mip chain down, then tent-filtered back up, each level adding the one below.
    let srcT = picture;
    for (const level of bloom) {
      draw(gl, passes.down, level, { uSrc: { tex: srcT.tex }, uTexel: [1 / srcT.width, 1 / srcT.height] });
      srcT = level;
    }
    let lo = bloom[bloom.length - 1];
    for (let i = bloom.length - 2; i >= 0; i--) {
      draw(gl, passes.up, up[i], {
        uSrc: { tex: lo.tex },
        uBase: { tex: bloom[i].tex },
        uTexel: [1 / lo.width, 1 / lo.height],
        uRadius: l.bloomRadius,
      });
      lo = up[i];
    }
    const tint = typeof l.glowTint === "string" ? linear(l.glowTint) : l.glowTint;
    draw(gl, passes.finish, null, {
      uSrc: { tex: picture.tex },
      uBloom: { tex: up[0].tex },
      uBloomAmount: l.bloom,
      uExposure: l.exposure,
      uFade: value(fade, frame, 1),
      uVignette: l.vignette,
      uAspect: cssW / cssH,
      uSaturation: l.saturation,
      uGlowTint: tint,
      uBalance: l.balance,
      uBlack: l.black,
    });
  });

  return (
    <div
      ref={host}
      className={className}
      data-launch-check="decor"
      style={{ position: "absolute", inset: 0, background: "#000", ...style }}
    />
  );
}
