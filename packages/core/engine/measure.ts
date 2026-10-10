/**
 * What text is on screen at the current frame, as the viewer sees it: its
 * size after every transform, the parts of it inside the frame and its clips,
 * and how much of it is visible. `pnpm launch check <id>` samples this across
 * the video to check reading time, size, safe area and contrast.
 *
 * Text inside iframes (Snapshots) and canvases (3D panels) is product UI and
 * is not measured. Mark other UI, or decoration, with `data-launch-check="off"`.
 * Text a scene draws itself, in a canvas or WebGL, is measured when the scene
 * declares it with `declareText`.
 */

export type Box = { x: number; y: number; width: number; height: number };

/** Text a canvas (or any element) draws, in the element's own CSS pixels. */
export type DeclaredText = {
  text: string;
  /** Where the text's glyphs are, inside the element, in its CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Font size in the element's CSS pixels. */
  size: number;
  /** Font weight (default 400). */
  weight?: number;
  /** Opacity the text is drawn at (default 1), on top of the element's own. */
  opacity?: number;
  /** Keeps the text one block across frames while it changes (default: its place in the list). */
  key?: string;
};

const declared = new Map<Element, DeclaredText[]>();
const declaredIds = new WeakMap<Element, Map<string, number>>();
let textHidden = false;

/**
 * Tell `check` what text `element` (a canvas, a WebGL stage) shows on this
 * frame, so reading time, size, safe area, contrast and storyboard copy are
 * checked on it as on DOM text. Call it where the element paints, every
 * frame, with everything it shows (an empty list when it shows none):
 *
 * ```tsx
 * useLayoutEffect(() => {
 *   paint(ctx, frame);
 *   declareText(canvas.current, [{ text: "Five mistakes", x: 80, y: 300, width: 640, height: 90, size: 96 }]);
 * });
 * ```
 *
 * Positions are in the element's CSS pixels; the camera, scale, opacity and
 * clips around it are applied as for DOM text. For exact contrast, leave the
 * text out while `textHidden()` is true (check paints each frame once more
 * without text); otherwise contrast is estimated from the frame alone.
 */
export function declareText(element: Element | null | undefined, texts: DeclaredText[]) {
  if (element) declared.set(element, texts);
}

/** True while `check` measures what is behind the text: canvases that declare text may leave it out. */
export const isTextHidden = () => textHidden;

/**
 * A block's text as the viewer is meant to read it, whitespace collapsed:
 * innerText follows layout (lines and blocks separated, hidden elements left
 * out), and parts marked `data-launch-check="off"` inside the block (a word a
 * cut interrupts) are not counted.
 */
function textOf(el: Element) {
  const off = '[data-launch-check="off"]';
  let text: string;
  if (el.querySelector(off)) {
    const copy = el.cloneNode(true) as Element;
    for (const part of copy.querySelectorAll(off)) part.remove();
    text = copy.textContent ?? "";
  } else text = el instanceof HTMLElement ? el.innerText : (el.textContent ?? "");
  return text.replace(/\s+/g, " ").trim();
}

export type TextSample = {
  /** Stable for a text block across frames, while it stays mounted. */
  id: number;
  shot: string;
  /** The block's whole text, whitespace collapsed. */
  text: string;
  /** Fraction of its characters that are visible (opacity ≥ 0.7, at least half inside the frame and clips). */
  visible: number;
  /** Largest on-screen font size of its visible parts, in stage pixels. */
  size: number;
  /** Font weight of the part with that size (400 regular, 700 bold). */
  weight: number;
  /** Visible parts, in stage pixels. */
  boxes: Box[];
  /** Declared by a canvas (`declareText`) rather than found in the DOM. */
  declared?: boolean;
};

type State = { opacity: number; scale: number; clip: Box | null; off: boolean };

const ids = new WeakMap<Element, number>();
let nextId = 1;

const INLINE = new Set(["inline", "inline-block", "contents", "inline-flex", "inline-grid", "ruby"]);

function intersect(a: Box, b: Box | null): Box | null {
  if (!b) return a;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return r > x && bottom > y ? { x, y, width: r - x, height: bottom - y } : null;
}

/** The uniform scale a CSS transform, `scale` or `zoom` applies. */
function scaleOf(style: CSSStyleDeclaration) {
  let s = 1;
  if (style.transform && style.transform !== "none") {
    const m = new DOMMatrixReadOnly(style.transform);
    s *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  }
  if (style.scale && style.scale !== "none") {
    const [x, y = x] = style.scale.split(" ").map(Number);
    s *= Math.sqrt(Math.abs(x * y));
  }
  const zoom = Number.parseFloat(style.zoom);
  if (zoom && zoom !== 1) s *= zoom;
  return s;
}

export function measureText(stage: HTMLElement): TextSample[] {
  const origin = stage.getBoundingClientRect();
  const frame: Box = { x: origin.x, y: origin.y, width: origin.width, height: origin.height };
  const states = new Map<Element, State>();
  const blocks = new Map<
    Element,
    { shot: string; chars: number; shown: number; size: number; weight: number; boxes: Box[] }
  >();

  const stateOf = (el: Element): State => {
    const cached = states.get(el);
    if (cached) return cached;
    if (el === stage) return { opacity: 1, scale: 1, clip: frame, off: false };
    const parent = el.parentElement ? stateOf(el.parentElement) : { opacity: 1, scale: 1, clip: frame, off: true };
    const style = getComputedStyle(el);
    let clip = parent.clip;
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      const r = el.getBoundingClientRect();
      clip = clip && intersect({ x: r.x, y: r.y, width: r.width, height: r.height }, clip);
    }
    const state: State = {
      opacity: parent.opacity * Number(style.opacity) * (style.visibility === "hidden" ? 0 : 1),
      scale: parent.scale * scaleOf(style),
      clip,
      off:
        parent.off ||
        el.getAttribute("data-launch-check") === "off" ||
        el.tagName === "CANVAS" ||
        style.display === "none",
    };
    states.set(el, state);
    return state;
  };

  // A block is the nearest element laid out as a block (words split into
  // inline spans read as one). Items of a single-line flex row, like a pill's
  // icon label and value, read as one phrase too.
  const blockOf = (el: Element): Element => {
    let e: Element = el;
    while (e.parentElement && e !== stage && !e.hasAttribute("data-shot") && INLINE.has(getComputedStyle(e).display))
      e = e.parentElement;
    while (e.parentElement && e.parentElement !== stage && !e.hasAttribute("data-shot")) {
      const row = getComputedStyle(e.parentElement);
      if (!row.display.endsWith("flex") || !row.flexDirection.startsWith("row") || row.flexWrap !== "nowrap") break;
      e = e.parentElement;
    }
    return e;
  };

  const range = document.createRange();
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const chars = (node.textContent ?? "").replace(/\s+/g, "").length;
    const parent = node.parentElement;
    if (!chars || !parent) continue;
    const state = stateOf(parent);
    if (state.off) continue;
    const block = blockOf(parent);
    let entry = blocks.get(block);
    if (!entry) {
      const shot = block.closest("[data-shot]")?.getAttribute("data-shot") ?? "";
      entry = { shot, chars: 0, shown: 0, size: 0, weight: 400, boxes: [] };
      blocks.set(block, entry);
    }
    entry.chars += chars;
    if (state.opacity < 0.7 || !state.clip) continue;
    range.selectNodeContents(node);
    let inside = 0;
    let total = 0;
    const boxes: Box[] = [];
    for (const r of range.getClientRects()) {
      if (r.width === 0 || r.height === 0) continue;
      total += r.width * r.height;
      const part = intersect({ x: r.x, y: r.y, width: r.width, height: r.height }, state.clip);
      if (!part) continue;
      inside += part.width * part.height;
      boxes.push({ x: part.x - origin.x, y: part.y - origin.y, width: part.width, height: part.height });
    }
    if (total === 0 || inside / total < 0.5) continue;
    entry.shown += chars;
    entry.boxes.push(...boxes);
    // SVG text is scaled by its viewBox, which no CSS property reports: estimate from the glyph box.
    const size =
      parent instanceof SVGElement
        ? Math.max(...boxes.map((b) => b.height)) / 1.2
        : Number.parseFloat(getComputedStyle(parent).fontSize) * state.scale;
    if (size > entry.size) {
      entry.size = size;
      entry.weight = Number.parseFloat(getComputedStyle(parent).fontWeight) || 400;
    }
  }

  const out: TextSample[] = [];
  for (const [el, b] of blocks) {
    if (!b.shown) continue;
    let id = ids.get(el);
    if (!id) {
      id = nextId++;
      ids.set(el, id);
    }
    out.push({
      id,
      shot: b.shot,
      text: textOf(el),
      visible: b.shown / b.chars,
      size: b.size,
      weight: b.weight,
      boxes: b.boxes,
    });
  }

  // Text that canvases declared, mapped from the element's CSS pixels to the stage.
  for (const [el, texts] of declared) {
    if (!el.isConnected) {
      declared.delete(el);
      continue;
    }
    if (!stage.contains(el) || !texts.length) continue;
    const parent = el.parentElement ? stateOf(el.parentElement) : null;
    const own = getComputedStyle(el);
    if (!parent || parent.off || el.getAttribute("data-launch-check") === "off" || own.display === "none") continue;
    const r = el.getBoundingClientRect();
    const layout = el instanceof HTMLElement ? { w: el.offsetWidth, h: el.offsetHeight } : { w: r.width, h: r.height };
    if (!r.width || !r.height || !layout.w || !layout.h) continue;
    const sx = r.width / layout.w;
    const sy = r.height / layout.h;
    const opacity = parent.opacity * Number(own.opacity) * (own.visibility === "hidden" ? 0 : 1);
    const clip = parent.clip && intersect({ x: r.x, y: r.y, width: r.width, height: r.height }, parent.clip);
    const shot = el.closest("[data-shot]")?.getAttribute("data-shot") ?? "";
    let keys = declaredIds.get(el);
    if (!keys) {
      keys = new Map();
      declaredIds.set(el, keys);
    }
    texts.forEach((t, i) => {
      const text = t.text.replace(/\s+/g, " ").trim();
      if (!text) return;
      const box = { x: r.x + t.x * sx, y: r.y + t.y * sy, width: t.width * sx, height: t.height * sy };
      const part = clip && intersect(box, clip);
      const inside = part ? (part.width * part.height) / (box.width * box.height || 1) : 0;
      const shown = opacity * (t.opacity ?? 1) >= 0.7 && inside >= 0.5;
      const key = t.key ?? String(i);
      let id = keys.get(key);
      if (!id) {
        id = nextId++;
        keys.set(key, id);
      }
      if (!shown || !part) return;
      out.push({
        id,
        shot,
        text,
        visible: Math.min(1, inside),
        size: t.size * Math.sqrt(sx * sy),
        weight: t.weight ?? 400,
        boxes: [{ x: part.x - origin.x, y: part.y - origin.y, width: part.width, height: part.height }],
        declared: true,
      });
    });
  }
  return out;
}

/** Hide all text (for measuring what is behind it), or show it again. */
export function hideText(hidden: boolean) {
  textHidden = hidden;
  const id = "launch-hide-text";
  document.getElementById(id)?.remove();
  if (!hidden) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `.launch-stage, .launch-stage * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 transparent !important; text-decoration-color: transparent !important; caret-color: transparent !important; } .launch-stage text, .launch-stage tspan { fill: transparent !important; stroke: transparent !important; }`;
  document.head.append(style);
}

/** A layer whose own edge could cut what it draws: a canvas, image, video, SVG or clipping box. */
export type LayerBox = {
  id: number;
  shot: string;
  /** "canvas", "img", "video", "svg" or "clip" (an element that clips its children). */
  kind: string;
  /** A short name for messages: tag, id and first class. */
  name: string;
  /** Its box, in stage pixels. */
  box: Box;
  /** The part of it the clips around it leave in frame. */
  visible: Box;
};

const layerIds = new WeakMap<Element, number>();
const layerEls = new Map<number, Element>();

const transparent = (c: string) => c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);

/** Whether the element and everything around it is unrotated, so its box is its edge on screen. */
function axisAligned(el: Element, stage: Element) {
  for (let e: Element | null = el; e && e !== stage; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.rotate && s.rotate !== "none" && Number.parseFloat(s.rotate) !== 0) return false;
    if (s.transform && s.transform !== "none") {
      const m = new DOMMatrixReadOnly(s.transform);
      if (
        Math.abs(m.b) > 1e-3 ||
        Math.abs(m.c) > 1e-3 ||
        (!m.is2D && (Math.abs(m.m13) > 1e-3 || Math.abs(m.m23) > 1e-3))
      )
        return false;
    }
  }
  return true;
}

/**
 * Layers on screen whose edges `check` looks at for content cut off by the
 * layer's own box (a globe taller than its canvas). Replaced elements and
 * SVGs, and boxes that clip their children without painting a background or
 * border of their own (a card's edge is drawn on purpose; a bare clip's is
 * not). Snapshots (iframes), small icons, rotated layers and anything marked
 * `data-launch-crop="ok"` are left out.
 */
export function measureLayers(stage: HTMLElement): LayerBox[] {
  const origin = stage.getBoundingClientRect();
  const frame: Box = { x: origin.x, y: origin.y, width: origin.width, height: origin.height };
  layerEls.clear();
  const out: LayerBox[] = [];
  for (const el of stage.querySelectorAll("*")) {
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
    if (el instanceof SVGSVGElement && el.ownerSVGElement) continue;
    const tag = el.tagName.toLowerCase();
    const style = getComputedStyle(el);
    let kind: string | null = ["canvas", "img", "video", "svg"].includes(tag) ? tag : null;
    if (!kind) {
      const clips =
        style.overflowX !== "visible" || style.overflowY !== "visible" || style.clipPath.startsWith("inset");
      const paints =
        !transparent(style.backgroundColor) ||
        style.backgroundImage !== "none" ||
        Number.parseFloat(style.borderTopWidth) > 0 ||
        style.boxShadow !== "none";
      if (clips && !paints && el.childElementCount > 0) kind = "clip";
    }
    if (!kind) continue;
    // A clip cutting rows of UI (a list, a chat history) is a designed look; only graphics
    // reaching past the box (a canvas, an illustration, a photo) count as cut.
    if (kind === "clip") {
      const r = el.getBoundingClientRect();
      const crossing = [...el.querySelectorAll("canvas, svg, img, video")].some((g) => {
        if (g instanceof SVGElement && !(g instanceof SVGSVGElement)) return false;
        const b = g.getBoundingClientRect();
        if (b.width < 64 || b.height < 64) return false;
        return b.left < r.left - 2 || b.top < r.top - 2 || b.right > r.right + 2 || b.bottom > r.bottom + 2;
      });
      if (!crossing) continue;
    }
    if (el.closest('[data-launch-crop="ok"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 64 || r.height < 64) continue;
    // Opacity and clips from the element up to the stage.
    let opacity = 1;
    let visible: Box | null = { x: r.x, y: r.y, width: r.width, height: r.height };
    let hidden = false;
    for (let e: Element | null = el; e && e !== stage; e = e.parentElement) {
      const s = getComputedStyle(e);
      opacity *= Number(s.opacity);
      if (s.display === "none" || s.visibility === "hidden") hidden = true;
      if (e !== el && (s.overflowX !== "visible" || s.overflowY !== "visible")) {
        const c = e.getBoundingClientRect();
        visible = visible && intersect(visible, { x: c.x, y: c.y, width: c.width, height: c.height });
      }
    }
    visible = visible && intersect(visible, frame);
    if (hidden || opacity < 0.5 || !visible || !axisAligned(el, stage)) continue;
    let id = layerIds.get(el);
    if (!id) {
      id = nextId++;
      layerIds.set(el, id);
    }
    layerEls.set(id, el);
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean)[0] : undefined;
    out.push({
      id,
      shot: el.closest("[data-shot]")?.getAttribute("data-shot") ?? "",
      kind,
      name: `${tag}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}`,
      box: { x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height },
      visible: { x: visible.x - origin.x, y: visible.y - origin.y, width: visible.width, height: visible.height },
    });
  }
  return out;
}

/**
 * Let layer `id` (from the last `measureLayers`) draw outside its box, or
 * put it back (`null`): for an SVG or a clipping box, content that appears
 * past the edge proves the edge was cutting it.
 */
export function unclipLayer(id: number | null) {
  const styleId = "launch-unclip";
  document.getElementById(styleId)?.remove();
  for (const el of document.querySelectorAll("[data-launch-unclip]")) el.removeAttribute("data-launch-unclip");
  if (id === null) return;
  const el = layerEls.get(id);
  if (!el) return;
  el.setAttribute("data-launch-unclip", "");
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = "[data-launch-unclip] { overflow: visible !important; clip-path: none !important; }";
  document.head.append(style);
}
