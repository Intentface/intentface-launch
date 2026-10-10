import { useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { waitFor } from "../engine/index.js";

/**
 * Fonts for scenes that measure text. A web font loads after the first
 * render, so anything laid out from a measurement (a highlight behind a word,
 * a caret after it, a box sized to a line) is measured in the fallback font
 * on the first frame a worker renders, and a render worker starts in the
 * middle of the video. These wait for the font inside `waitFor` and
 * re-render synchronously before the frame is let go, so the measurement in
 * the screenshot is the real one.
 */

const loaded = new Set<string>();

const fontsApi = () => (typeof document === "undefined" ? undefined : document.fonts);

/** Whether every font is usable now (or there is nothing to load, such as a system font). */
function ready(fonts: string[]) {
  const api = fontsApi();
  if (!api) return true;
  return fonts.every((font) => {
    if (loaded.has(font)) return true;
    // check() is true when nothing in the shorthand still needs loading.
    try {
      if (api.check(font)) {
        loaded.add(font);
        return true;
      }
    } catch {
      return true;
    }
    return false;
  });
}

/**
 * True once `font` (a CSS font shorthand, `"500 120px Inter"`, or several)
 * has loaded. Until then the frame waits: the load is registered with
 * `waitFor`, and the component re-renders with `true` before it resolves.
 * `text` narrows the load to the faces those characters need (unicode-range).
 */
export function useFontsReady(font: string | string[], text?: string): boolean {
  const fonts = Array.isArray(font) ? font : [font];
  const key = fonts.join("|");
  const [, setLoaded] = useState(0);
  const now = ready(fonts);

  useLayoutEffect(() => {
    const api = fontsApi();
    if (!api || ready(key.split("|"))) return;
    const list = key.split("|");
    waitFor(
      Promise.all(list.map((f) => api.load(f, text).catch(() => []))).then(() => {
        for (const f of list) loaded.add(f);
        flushSync(() => setLoaded((n) => n + 1));
      }),
      `Font ${list.join(", ")}`,
    );
  }, [key, text]);

  return now;
}

export type TextMeasure = {
  /** Advance width of the whole text, in CSS pixels. */
  width: number;
  /** Above and below the baseline, from the font's ascent and descent. */
  ascent: number;
  descent: number;
  /** Each word's left edge and width from the start of the text (spaces between them excluded). */
  words: { text: string; x: number; width: number }[];
};

export type MeasureOptions = {
  /** As the page sets it: px as a number, or a CSS length in px or em (`"-0.03em"`). */
  letterSpacing?: number | string;
  /**
   * The scale the text is laid out at, when that is not 1 (a 3D panel's
   * `resolution`, anything that re-lays text out instead of scaling its
   * pixels): measured at that size and given back in unscaled CSS pixels, so
   * rounding and hinting match what is drawn.
   */
  zoom?: number;
};

let context: CanvasRenderingContext2D | null = null;

/** The font size in a shorthand, in px. */
const sizeOf = (font: string) => Number(/(\d*\.?\d+)px/.exec(font)?.[1] ?? 16);

/**
 * Measure one line of text in a CSS font shorthand, with canvas metrics
 * (the same shaping the page uses, kerning included). Measures whatever is
 * loaded now: call it after `useFontsReady(font)` is true, or use
 * `useMeasureText`, which waits. For text inside a `Snapshot`, measure the
 * page's own layout with `api.textRects` instead.
 */
export function measureTextNow(
  text: string,
  font: string,
  { letterSpacing = 0, zoom = 1 }: MeasureOptions = {},
): TextMeasure {
  context ??= document.createElement("canvas").getContext("2d");
  const ctx = context;
  if (!ctx) return { width: 0, ascent: 0, descent: 0, words: [] };
  const size = sizeOf(font);
  ctx.font = zoom === 1 ? font : font.replace(/(\d*\.?\d+)px/, `${size * zoom}px`);
  const spacing =
    typeof letterSpacing === "number"
      ? letterSpacing
      : letterSpacing.endsWith("em")
        ? Number.parseFloat(letterSpacing) * size
        : Number.parseFloat(letterSpacing) || 0;
  ctx.letterSpacing = `${spacing * zoom}px`;
  const all = ctx.measureText(text);
  const words: TextMeasure["words"] = [];
  const pattern = /\S+/g;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    // From prefixes, so kerning across the run is the same as in the full line.
    const x = ctx.measureText(text.slice(0, m.index)).width;
    words.push({
      text: m[0],
      x: x / zoom,
      width: (ctx.measureText(text.slice(0, m.index + m[0].length)).width - x) / zoom,
    });
  }
  return {
    width: all.width / zoom,
    ascent: all.fontBoundingBoxAscent / zoom,
    descent: all.fontBoundingBoxDescent / zoom,
    words,
  };
}

/**
 * `measureTextNow` once the font has loaded; the frame waits for it, so the
 * measure a render sees is the real one. `ready` is false only on a render
 * the captured frame never shows.
 *
 *   const m = useMeasureText(query, '500 32px "Inter"');
 *   m.words.map((w) => <Pill left={x + w.x} width={w.width} />)
 */
export function useMeasureText(text: string, font: string, options?: MeasureOptions) {
  const ok = useFontsReady(font, text);
  return { ...measureTextNow(text, font, options), ready: ok };
}

/** @deprecated The first name of `measureTextNow`, kept for scenes that import it from this file. */
export const measureText = measureTextNow;
