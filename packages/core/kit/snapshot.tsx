import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useFrame, useVideoInfo, waitFor } from "../engine/index.js";
import type { Rect } from "./camera.js";
import type { CaptureManifest } from "./capture.js";
import { caretRect, isField, type TextBox, type TextRectsOptions, textRects } from "./snapshot-text.js";

/** Written by `c.snapshot(name)` in a capture script. */
export type SnapshotData = {
  name: string;
  /** Capture frame it was taken on. */
  frame: number;
  width: number;
  height: number;
  css: string;
  body: string;
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
  scrolls: { index: number; top: number; left: number }[];
};

export type SnapshotApi = {
  doc: Document;
  /** All elements matching `selector`. */
  all(selector: string): HTMLElement[];
  /** First element matching `selector`; throws if there is none. */
  one(selector: string): HTMLElement;
  /** Inline styles for this frame only; reset before the next frame is animated. */
  style(el: Element | Element[], styles: Partial<CSSStyleDeclaration> & Record<string, string>): void;
  /** Text (or an input's or textarea's value) for this frame only. */
  text(el: Element, text: string): void;
  /** An attribute for this frame only (placeholder, data-open, aria-selected…). */
  attr(el: Element, name: string, value: string | null): void;
  /** Box of an element in snapshot (capture viewport) pixels. */
  rect(el: Element | string): Rect;
  /**
   * Draw only `el` and what is inside it, on a transparent page: a layer cut
   * out of the UI (for kit/three panels that assemble in space). Uses opacity,
   * because pages often force `visibility: visible` on their own layers.
   */
  isolate(el: Element | string): void;
  /** Leave `el` out of this frame (the layer that `isolate` cut out elsewhere). */
  hide(el: Element | string): void;
  /**
   * Boxes of the words (`by: "word"`, the default) or characters of `text`
   * where they sit inside `el`, measured with a DOM Range in the snapshot's
   * own font and layout, in snapshot pixels (the content space of marks and
   * `Camera`). For an input or textarea, `text` is laid out as its value
   * would be. Without `text`, the element's whole text.
   */
  textRects(el: Element | string, text?: string, options?: TextRectsOptions): TextBox[];
  /** Where the caret goes after `el`'s last character (or after `value`, in a field): zero wide, glyph high. */
  caret(el: Element | string, value?: string): Rect;
  /**
   * A partly typed value in the product's own field, for this frame: sets the
   * input's (or element's) text to `text`, scrolls an input to show its end,
   * and draws a caret after it in the field's text colour. `caret: false`
   * for none; `blinkFrom` is the frame typing stops, after which it blinks
   * once a second. Returns the caret's box.
   *
   *   api.type("input[type=search]", query.slice(0, typed), { blinkFrom: AT + typingFrames(query, fps) })
   */
  type(
    el: Element | string,
    text: string,
    options?: { caret?: boolean; blinkFrom?: number; color?: string; width?: number },
  ): Rect;
};

type Saved = {
  style: string | null;
  text?: string;
  value?: string;
  scroll?: [number, number];
  attrs?: Record<string, string | null>;
};

const attrs = (a: Record<string, string>) =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join("");

// Snapshots are fetched once per page and shared between shots (and useProductLook).
const loaded = new Map<string, Promise<SnapshotData>>();
export function load(url: string) {
  if (!loaded.has(url))
    loaded.set(
      url,
      fetch(url).then((r) => r.json()),
    );
  return loaded.get(url) as Promise<SnapshotData>;
}

// Freeze the page's own motion at its end state (entrances finished): the video decides what moves.
const FREEZE =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}";

const build = (data: SnapshotData) =>
  `<!doctype html><html${attrs(data.htmlAttrs)}><head><meta charset="utf-8"><style>${data.css}</style><style>${FREEZE}</style></head><body${attrs(data.bodyAttrs)}>${data.body}</body></html>`;

export const snapshotUrl = (capture: CaptureManifest, name: string) => `${capture.dir}snapshots/${name}.json`;

/**
 * A page snapshot rebuilt from its own HTML and CSS: the product's real UI as
 * vectors. Put it where a <Capture> would go; it has the same size and
 * coordinates, so marks line up and you can cut between pixels and vectors.
 *
 * `animate` runs every frame with a small API for moving individual parts.
 * Styles and text it sets last one frame, so it stays a pure function of `frame`.
 *
 * `onLoad` runs once the snapshot is built and its fonts are loaded, before
 * the frame is let go: measure it there (`api.textRects`, `api.rect`) and set
 * state, and the measurements are on screen in the same frame. Use it for
 * overlays and Camera keys outside the snapshot that follow its text.
 */
export function Snapshot({
  capture,
  name,
  animate,
  onLoad,
  style,
}: {
  capture: CaptureManifest;
  name: string;
  animate?: (api: SnapshotApi, frame: number) => void;
  onLoad?: (api: SnapshotApi) => void;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const iframe = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const touched = useRef(new Map<HTMLElement, Saved>());
  // Elements this frame added to the page (carets), removed before the next one.
  const added = useRef<Element[]>([]);
  const url = snapshotUrl(capture, name);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  // One tracked step from fetch to fonts, so no frame is captured half-built.
  useLayoutEffect(() => {
    const el = iframe.current;
    if (!el) return;
    let live = true;
    // Unmounted mid-load (a seek past this shot), the iframe never fires `load`: let the wait go.
    let abort = () => {};
    const gone = new Promise<void>((resolve) => {
      abort = resolve;
    });
    waitFor(
      (async () => {
        const data = await load(url);
        if (!live) return;
        setSize({ width: data.width, height: data.height });
        const built = new Promise<void>((resolve) => {
          const onLoad = () => {
            // The empty about:blank document can fire first; wait for ours.
            if (el.contentDocument?.URL !== "about:srcdoc") return;
            el.removeEventListener("load", onLoad);
            resolve();
          };
          el.addEventListener("load", onLoad);
          el.srcdoc = build(data);
        });
        await Promise.race([built, gone]);
        const d = el.contentDocument;
        if (!d || !live) return;
        // `fonts.ready` does not wait for faces nothing has asked for yet: load them all.
        await Promise.race([Promise.allSettled([...d.fonts].map((face) => face.load())), gone]);
        await Promise.race([d.fonts.ready, gone]);
        if (!live) return;
        const all = d.body.querySelectorAll("*");
        for (const s of data.scrolls) {
          const target = all[s.index] as HTMLElement | undefined;
          if (target) {
            target.scrollTop = s.top;
            target.scrollLeft = s.left;
          }
        }
        // Synchronous, so state that onLoad sets is rendered before the frame is captured.
        flushSync(() => {
          setDoc(d);
          try {
            onLoadRef.current?.(createApi(d));
          } catch (error) {
            console.error(`Snapshot "${name}" onLoad:`, error);
          }
        });
      })(),
      `Snapshot ${name}`,
    );
    return () => {
      live = false;
      abort();
    };
  }, [url]);

  function createApi(doc: Document): SnapshotApi {
    const remember = (el: HTMLElement) => {
      if (!touched.current.has(el)) touched.current.set(el, { style: el.getAttribute("style") });
      return touched.current.get(el) as Saved;
    };
    const api: SnapshotApi = {
      doc,
      all: (selector) => [...doc.querySelectorAll<HTMLElement>(selector)],
      one: (selector) => {
        const el = doc.querySelector<HTMLElement>(selector);
        if (!el) throw new Error(`Snapshot "${name}" has no ${selector}`);
        return el;
      },
      style: (els, styles) => {
        for (const el of Array.isArray(els) ? els : [els]) {
          const h = el as HTMLElement;
          remember(h);
          for (const [k, v] of Object.entries(styles))
            h.style.setProperty(
              k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
              String(v),
            );
        }
      },
      text: (el, text) => {
        const h = el as HTMLElement;
        const saved = remember(h);
        const win = doc.defaultView as Window & typeof globalThis;
        if (h instanceof win.HTMLInputElement || h instanceof win.HTMLTextAreaElement) {
          saved.value ??= h.value;
          h.value = text;
        } else {
          saved.text ??= h.textContent ?? "";
          h.textContent = text;
        }
      },
      attr: (el, attrName, value) => {
        const h = el as HTMLElement;
        const saved = remember(h);
        saved.attrs ??= {};
        if (!(attrName in saved.attrs)) saved.attrs[attrName] = h.getAttribute(attrName);
        if (value === null) h.removeAttribute(attrName);
        else h.setAttribute(attrName, value);
      },
      rect: (target) => {
        const el = typeof target === "string" ? api.one(target) : target;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      },
      isolate: (target) => {
        const el = typeof target === "string" ? api.one(target) : target;
        // A dark color-scheme inside a "normal" iframe gets an opaque backdrop: match them.
        api.style([doc.documentElement, doc.body], { background: "transparent", colorScheme: "normal" });
        for (let node: Element = el; node.parentElement; node = node.parentElement) {
          const parent = node.parentElement;
          for (const sibling of parent.children) if (sibling !== node) api.style(sibling, { opacity: "0" });
          if (parent === doc.body) break;
          api.style(parent, {
            background: "transparent",
            borderColor: "transparent",
            boxShadow: "none",
            backdropFilter: "none",
            outline: "none",
          });
        }
      },
      hide: (target) => api.style(typeof target === "string" ? api.one(target) : target, { opacity: "0" }),
      textRects: (target, text, options) =>
        textRects(typeof target === "string" ? api.one(target) : target, text, options),
      caret: (target, value) => caretRect(typeof target === "string" ? api.one(target) : target, value),
      type: (target, text, { caret = true, blinkFrom, color, width = 2 } = {}) => {
        const el = typeof target === "string" ? api.one(target) : target;
        api.text(el, text);
        if (isField(el)) {
          // Typing keeps the end of the value in view.
          const saved = remember(el);
          saved.scroll ??= [el.scrollLeft, el.scrollTop];
          el.scrollLeft = el.scrollWidth;
          el.scrollTop = el.scrollHeight;
        }
        const box = caretRect(el);
        const on =
          blinkFrom === undefined || frame < blinkFrom || Math.floor((frame - blinkFrom) / (fps / 2)) % 2 === 0;
        if (caret && on) {
          const view = doc.defaultView as Window;
          const bar = doc.createElement("div");
          Object.assign(bar.style, {
            position: "fixed",
            left: `${box.x - width / 2}px`,
            top: `${box.y}px`,
            width: `${width}px`,
            height: `${box.height}px`,
            background: color ?? view.getComputedStyle(el).color,
            pointerEvents: "none",
            zIndex: "2147483647",
          });
          doc.body.append(bar);
          added.current.push(bar);
        }
        return box;
      },
    };
    return api;
  }

  useLayoutEffect(() => {
    if (!doc) return;
    // Undo last frame's changes, then apply this frame's.
    for (const el of added.current) el.remove();
    added.current = [];
    for (const [el, saved] of touched.current) {
      if (saved.style === null) el.removeAttribute("style");
      else el.setAttribute("style", saved.style);
      if (saved.text !== undefined) el.textContent = saved.text;
      if (saved.value !== undefined) (el as HTMLInputElement | HTMLTextAreaElement).value = saved.value;
      if (saved.scroll) [el.scrollLeft, el.scrollTop] = saved.scroll;
      for (const [name, value] of Object.entries(saved.attrs ?? {})) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
    }
    touched.current.clear();
    if (!animate) return;
    animate(createApi(doc), frame);
  });

  return (
    <iframe
      ref={iframe}
      title={name}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size?.width ?? capture.width,
        height: size?.height ?? capture.height,
        border: 0,
        pointerEvents: "none",
        colorScheme: "normal",
        ...style,
      }}
    />
  );
}

// Snapshots built off screen, once per page, for measuring (see measureSnapshot).
const measuring = new Map<string, Promise<Document>>();
function offscreen(url: string) {
  let doc = measuring.get(url);
  if (!doc) {
    doc = (async () => {
      const data = await load(url);
      const el = document.createElement("iframe");
      el.setAttribute("aria-hidden", "true");
      Object.assign(el.style, {
        position: "fixed",
        left: "-100000px",
        top: "0",
        width: `${data.width}px`,
        height: `${data.height}px`,
        border: "0",
        visibility: "hidden",
        colorScheme: "normal",
      });
      await new Promise<void>((resolve) => {
        const onLoad = () => {
          if (el.contentDocument?.URL !== "about:srcdoc") return;
          el.removeEventListener("load", onLoad);
          resolve();
        };
        el.addEventListener("load", onLoad);
        el.srcdoc = build(data);
        document.body.appendChild(el);
      });
      const d = el.contentDocument as Document;
      await Promise.allSettled([...d.fonts].map((face) => face.load()));
      await d.fonts.ready;
      const all = d.body.querySelectorAll("*");
      for (const s of data.scrolls) {
        const target = all[s.index] as HTMLElement | undefined;
        if (target) {
          target.scrollTop = s.top;
          target.scrollLeft = s.left;
        }
      }
      return d;
    })();
    measuring.set(url, doc);
  }
  return doc;
}

/**
 * Box of the first element matching `selector` in a saved snapshot, in
 * snapshot (capture viewport) pixels, as `api.rect` gives it: a mark measured
 * when the video loads instead of by `pnpm launch marks`, so it follows a
 * recapture. Register it with `waitFor` (kit/three `<Panel select>` does).
 */
export async function measureSnapshot(capture: CaptureManifest, name: string, selector: string): Promise<Rect> {
  const doc = await offscreen(snapshotUrl(capture, name));
  const el = doc.querySelector(selector);
  if (!el) throw new Error(`Snapshot "${name}" has no ${selector}`);
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}
