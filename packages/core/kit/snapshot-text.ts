/**
 * Where text sits in a snapshot, measured with DOM Ranges in the snapshot's
 * own fonts and layout: the boxes of words and characters, and where a caret
 * goes at the end of a field's value. Everything is in snapshot (capture
 * viewport) pixels, the content space that marks and `Camera` use.
 */
import type { Rect } from "./camera.js";

/** One word or character of measured text. */
export type TextBox = Rect & { text: string; index: number };

export type TextRectsOptions = {
  /** `word` (default), `char` (every character but spaces), or `all` for the whole text as one box. */
  by?: "word" | "char" | "all";
  /** Which occurrence of `text` inside the element, from 0. */
  occurrence?: number;
};

type Field = HTMLInputElement | HTMLTextAreaElement;

export function isField(el: Element): el is Field {
  const win = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  return !!win && (el instanceof win.HTMLInputElement || el instanceof win.HTMLTextAreaElement);
}

const toRect = (r: DOMRect): Rect => ({ x: r.x, y: r.y, width: r.width, height: r.height });

/** Spans of `text` to measure, as [start, end) offsets. */
function units(text: string, by: TextRectsOptions["by"]): { start: number; end: number }[] {
  if (by === "all") return [{ start: 0, end: text.length }];
  const pattern = by === "char" ? /\S/gu : /\S+/g;
  return [...text.matchAll(pattern)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** The box a Range covers: its line boxes joined (a word that wraps gets its first line's box). */
function rangeRect(range: Range): Rect {
  const lines = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
  return lines.length > 0 ? toRect(lines[0]) : toRect(range.getBoundingClientRect());
}

/**
 * A copy of a field's text laid out exactly as the field lays it out (same
 * box, font, spacing and alignment), as real DOM text that a Range can
 * measure. Inputs keep their value in a shadow tree that Ranges cannot reach.
 */
function withMirror<T>(field: Field, value: string, measure: (text: Text, offsetX: number, offsetY: number) => T): T {
  const doc = field.ownerDocument;
  const win = doc.defaultView as Window & typeof globalThis;
  const cs = win.getComputedStyle(field);
  const box = field.getBoundingClientRect();
  const div = doc.createElement("div");
  const copy = [
    "box-sizing",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "font-variant",
    "font-feature-settings",
    "font-variation-settings",
    "font-kerning",
    "font-optical-sizing",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-indent",
    "line-height",
    "tab-size",
    "direction",
  ];
  for (const p of copy) div.style.setProperty(p, cs.getPropertyValue(p));
  const textarea = field instanceof win.HTMLTextAreaElement;
  Object.assign(div.style, {
    position: "fixed",
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    boxSizing: "border-box",
    borderColor: "transparent",
    visibility: "hidden",
    overflow: "hidden",
    pointerEvents: "none",
    margin: "0",
  });
  const span = doc.createElement("span");
  if (textarea) {
    Object.assign(div.style, { whiteSpace: "pre-wrap", overflowWrap: "break-word", textAlign: cs.textAlign });
  } else {
    // An input centres its one line vertically and aligns it as text-align says.
    const align = cs.textAlign;
    Object.assign(div.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: align === "center" ? "center" : align === "right" || align === "end" ? "flex-end" : "flex-start",
      whiteSpace: "pre",
    });
  }
  // A zero-width space keeps an empty value measurable (the caret's height).
  const node = doc.createTextNode(value || "​");
  span.append(node);
  div.append(span);
  doc.body.append(div);
  try {
    return measure(node, -field.scrollLeft, -field.scrollTop);
  } finally {
    div.remove();
  }
}

const shift = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: r.x + dx, y: r.y + dy });

/** The text nodes under `el` with their offsets in its whole text. */
function textOf(el: Element) {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: full.length });
    full += (n as Text).data;
  }
  const locate = (offset: number, end: boolean) => {
    for (const { node, start } of nodes) {
      const local = offset - start;
      if (end ? local <= node.data.length : local < node.data.length) return { node, offset: Math.max(0, local) };
    }
    const last = nodes[nodes.length - 1];
    return { node: last.node, offset: last.node.data.length };
  };
  return { full, nodes, locate };
}

/**
 * Boxes of the words (or characters) of `text` where they sit inside `el`.
 * For an input or textarea, `text` is laid out as the field's value would
 * be, whatever its value is now. Without `text`, the element's whole text.
 */
export function textRects(
  el: Element,
  text?: string,
  { by = "word", occurrence = 0 }: TextRectsOptions = {},
): TextBox[] {
  if (isField(el)) {
    const value = text ?? el.value;
    return withMirror(el, value, (node, dx, dy) =>
      units(value, by).map((u, index) => {
        const range = el.ownerDocument.createRange();
        range.setStart(node, u.start);
        range.setEnd(node, u.end);
        return { ...shift(rangeRect(range), dx, dy), text: value.slice(u.start, u.end), index };
      }),
    );
  }
  const { full, nodes, locate } = textOf(el);
  if (nodes.length === 0) throw new Error(`textRects: the element has no text to find "${text ?? ""}" in`);
  const needle = text ?? full;
  // Whitespace in the page's markup may differ from the text asked for: any run matches any run.
  const pattern = new RegExp(
    needle
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+"),
    "g",
  );
  const found = [...full.matchAll(pattern)][occurrence];
  if (!found) throw new Error(`textRects: "${needle}" is not in the element's text ("${full.trim().slice(0, 80)}")`);
  const base = found.index ?? 0;
  return units(found[0], by).map((u, index) => {
    const range = el.ownerDocument.createRange();
    const a = locate(base + u.start, false);
    const b = locate(base + u.end, true);
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return { ...rangeRect(range), text: found[0].slice(u.start, u.end), index };
  });
}

/** Where a caret goes after the last character of `el`'s text (or of `value` in a field): a zero-width box the height of the glyphs. */
export function caretRect(el: Element, value?: string): Rect {
  if (isField(el)) {
    const text = value ?? el.value;
    return withMirror(el, text, (node, dx, dy) => {
      const range = el.ownerDocument.createRange();
      range.selectNodeContents(node);
      const glyphs = rangeRect(range);
      const x = text ? glyphs.x + glyphs.width : glyphs.x;
      return { x: x + dx, y: glyphs.y + dy, width: 0, height: glyphs.height };
    });
  }
  const { nodes } = textOf(el);
  const range = el.ownerDocument.createRange();
  if (nodes.length === 0) {
    const r = el.getBoundingClientRect();
    const view = el.ownerDocument.defaultView as Window;
    const size = Number.parseFloat(view.getComputedStyle(el).fontSize) || 16;
    return { x: r.x, y: r.y + (r.height - size * 1.2) / 2, width: 0, height: size * 1.2 };
  }
  range.selectNodeContents(el);
  const lines = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
  const last = lines[lines.length - 1] ?? range.getBoundingClientRect();
  return { x: last.x + last.width, y: last.y, width: 0, height: last.height };
}
