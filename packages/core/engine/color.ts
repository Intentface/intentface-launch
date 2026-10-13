/**
 * Colours as numbers, for moving them: CSS colours parsed into OKLCH
 * (lightness, chroma, hue), where equal steps look equal and a move between
 * two hues keeps its chroma instead of passing through grey.
 */
import { type SpringConfig, springTo } from "./motion.js";

/** `[l, c, h, alpha]`: lightness 0 to 1, chroma 0 to about 0.4, hue in degrees, alpha 0 to 1. */
export type Oklch = [number, number, number, number];

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", transparent: "#00000000" };

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function rgbToOklch(r: number, g: number, b: number, alpha: number): Oklch {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return labToLch(L, A, B, alpha);
}

function labToLch(L: number, a: number, b: number, alpha: number): Oklch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h, alpha];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** A number, a percentage of `full`, or `none` (0). */
const num = (part: string, full = 1) => {
  if (part === "none") return 0;
  return part.endsWith("%") ? (Number.parseFloat(part) / 100) * full : Number.parseFloat(part);
};

const hue = (part: string) => {
  if (part.endsWith("turn")) return Number.parseFloat(part) * 360;
  if (part.endsWith("rad")) return (Number.parseFloat(part) * 180) / Math.PI;
  return num(part.replace("deg", ""));
};

/**
 * A CSS colour in OKLCH: hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`),
 * `rgb()`, `hsl()`, `oklch()`, `oklab()`, `white`, `black` and `transparent`.
 * Throws on anything else (other named colours, `var()`), so a typo does not
 * quietly animate to black.
 */
export function toOklch(color: string): Oklch {
  const css = (NAMED[color.trim().toLowerCase()] ?? color).trim().toLowerCase();
  if (css.startsWith("#")) {
    let hex = css.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
      const byte = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return rgbToOklch(byte(0), byte(2), byte(4), hex.length === 8 ? byte(6) : 1);
    }
  }
  const fn = /^(rgba?|hsla?|oklch|oklab)\((.*)\)$/.exec(css);
  if (fn) {
    const [body, alphaPart] = fn[2].includes("/") ? fn[2].split("/") : [fn[2], undefined];
    const parts = body.split(/[\s,]+/).filter(Boolean);
    const legacyAlpha = parts.length === 4 ? parts.pop() : undefined;
    const alphaText = (alphaPart ?? legacyAlpha)?.trim();
    const alpha = alphaText === undefined ? 1 : num(alphaText);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (fn[1].startsWith("rgb")) return rgbToOklch(num(a, 255) / 255, num(b, 255) / 255, num(c, 255) / 255, alpha);
      if (fn[1].startsWith("hsl")) return rgbToOklch(...hslToRgb(hue(a), num(b, 100) / 100, num(c, 100) / 100), alpha);
      if (fn[1] === "oklch") return [num(a), num(b, 0.4), hue(c), alpha];
      return labToLch(num(a), num(b, 0.4), num(c, 0.4), alpha);
    }
  }
  throw new Error(`Cannot read the colour "${color}": use hex, rgb(), hsl(), oklch() or oklab()`);
}

/** OKLCH as a CSS colour, clamped to valid lightness, chroma and alpha. */
export function formatOklch([l, c, h, alpha]: Oklch): string {
  const L = Math.max(0, Math.min(1, l));
  const C = Math.max(0, c);
  const H = ((h % 360) + 360) % 360;
  const A = Math.max(0, Math.min(1, alpha));
  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)}${A < 1 ? ` / ${A.toFixed(4)}` : ""})`;
}

/** Below this chroma a colour is grey and its hue means nothing. */
const GREY = 0.0005;

/**
 * Colours as OKLCH with hues unwrapped along the list: each hue moves the
 * short way round from the one before, and a grey takes the hue of its
 * nearest coloured neighbour, so grey to red changes lightness and chroma
 * only instead of sweeping through every hue.
 */
function unwrapped(colors: string[]): Oklch[] {
  const list = colors.map(toOklch);
  const coloured = list.map((c, i) => (c[1] > GREY ? i : -1)).filter((i) => i >= 0);
  if (coloured.length === 0) return list;
  for (let i = 0; i < list.length; i++) {
    if (list[i][1] > GREY) continue;
    const nearest = coloured.reduce((best, j) => (Math.abs(j - i) < Math.abs(best - i) ? j : best));
    list[i][2] = list[nearest][2];
  }
  for (let i = 1; i < list.length; i++) {
    const delta = ((((list[i][2] - list[i - 1][2]) % 360) + 540) % 360) - 180;
    list[i][2] = list[i - 1][2] + delta;
  }
  return list;
}

/**
 * Chroma at which a move between two colours goes fully round the hue wheel. Below it the move
 * blends towards a straight line in OKLab: a warm UI neutral (chroma about 0.006) has a hue, but
 * going round from it to a blue sweeps through orange and pink on the way.
 */
const VIVID = 0.06;

/** How much a move between chromas `a` and `b` follows the hue (1) rather than a straight line in OKLab (0). */
const hueWeight = (a: number, b: number) => Math.min(1, Math.min(a, b) / VIVID);

const toLab = ([l, c, h, alpha]: Oklch): Oklch => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
  alpha,
];

/** A colour moved round the hue (`lch`) and one moved in a straight line (`lab`, as OKLab), weighted. */
function blend(lch: Oklch, lab: Oklch, weight: number): Oklch {
  if (weight >= 1) return lch;
  const round = toLab(lch);
  const mixed = round.map((v, i) => lab[i] + (v - lab[i]) * weight);
  return labToLch(mixed[0], mixed[1], mixed[2], mixed[3]);
}

/**
 * Between two colours in OKLCH, the short way round the hue: `mixColor("#4f46e5", "#f59e0b", 0.5)`.
 * From or to a neutral or nearly neutral colour it goes straight in OKLab instead, so it never
 * passes through other hues.
 */
export function mixColor(from: string, to: string, t: number): string {
  const [a, b] = unwrapped([from, to]);
  const lch = a.map((v, i) => v + (b[i] - v) * t) as Oklch;
  const [la, lb] = [a, b].map(toLab);
  const lab = la.map((v, i) => v + (lb[i] - v) * t) as Oklch;
  return formatOklch(blend(lch, lab, hueWeight(a[1], b[1])));
}

export type ColorTarget = {
  /** Frame the colour sets off for `to`. The first target is where it starts. */
  at: number;
  /** Any colour `toOklch` reads. */
  to: string;
  /** This change's spring, instead of the shared one. */
  spring?: SpringConfig;
};

/**
 * `springTo` for a colour: one spring per change, summed in OKLCH, so a
 * colour that changes again mid-flight carries on from where it was. Hue
 * takes the short way round, greys take their neighbour's hue, and a change from or to a near
 * neutral goes straight in OKLab. A
 * bouncy spring overshoots in lightness and chroma, so keep `bounce` low for
 * colour (0 to 0.1). Returns an `oklch()` CSS colour.
 *
 *   background: springColor(frame, fps, [{ at: 0, to: "#2a2a2e" }, { at: click, to: "#4f46e5" }], { duration: 18 })
 */
export function springColor(frame: number, fps: number, targets: ColorTarget[], config: SpringConfig = {}): string {
  if (targets.length === 0) throw new Error("springColor: needs at least one target");
  const values = unwrapped(targets.map((t) => t.to));
  const springs = (list: Oklch[]) =>
    springTo(
      frame,
      fps,
      targets.map((t, i) => ({ at: t.at, to: list[i], spring: t.spring })),
      config,
    ) as Oklch;
  // The change under way decides how much it follows the hue: from or to a near neutral, straight
  // in OKLab. Both paths meet at each target, so switching between changes does not jump.
  let k = 0;
  while (k + 1 < targets.length && targets[k + 1].at <= frame) k++;
  const weight = k === 0 ? 1 : hueWeight(values[k - 1][1], values[k][1]);
  return formatOklch(weight >= 1 ? springs(values) : blend(springs(values), springs(values.map(toLab)), weight));
}
