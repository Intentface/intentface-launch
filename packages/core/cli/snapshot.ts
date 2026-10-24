import type { CDPSession, Page } from "playwright";
import type { SnapshotData } from "../kit/snapshot.js";

export type CanvasScale = {
  /** Device pixels per CSS pixel for the canvas pictures. */
  scale: number;
  /** The capture's own device scale, restored afterwards. */
  base: number;
  cdp: CDPSession;
  /** Advance the page's clock a little, for apps that draw in requestAnimationFrame. */
  tick: () => Promise<void>;
};

/** Canvases whose backing store is not `scale` × their CSS size (the app has not redrawn for that pixel ratio). */
const stale = (scale: number) =>
  [...document.querySelectorAll("canvas")].flatMap((c, i) => {
    const r = c.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return [];
    const ratio = c.width / r.width;
    return Math.abs(ratio - scale) > 0.01 ? [{ i, ratio }] : [];
  });

/** A transparent PNG of `clip` at the page's current device pixel ratio. */
async function shootAt(cdp: CDPSession, clip: { x: number; y: number; width: number; height: number }) {
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  try {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } });
    return Buffer.from(data, "base64");
  } finally {
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {});
  }
}

/**
 * Redraw the page at `scale` device pixels per CSS pixel. Apps size their
 * canvases from devicePixelRatio when they draw, so tell them it changed
 * (a resize event, then a 1 px viewport nudge for ResizeObservers) and let
 * them draw: React renders on real time, so the page's paused clock only
 * moves if a canvas still waits for an animation frame. Returns the
 * canvases still at another ratio.
 */
async function pixelRatio(page: Page, { cdp, tick }: CanvasScale, scale: number) {
  const { width, height } = page.viewportSize() ?? { width: 1440, height: 900 };
  const metrics = (w: number) =>
    cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height, deviceScaleFactor: scale, mobile: false });
  const drawn = async () => {
    await page.waitForTimeout(60);
    return (await page.evaluate(stale, scale)).length === 0;
  };
  await metrics(width);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  if (await drawn()) return [];
  await metrics(width + 1);
  await drawn();
  await metrics(width);
  if (await drawn()) return [];
  await tick();
  return page.evaluate(stale, scale);
}

/**
 * Serialise the live page into self-contained HTML: the page's own CSS
 * (fonts and images inlined as data URLs), the body's DOM with form values
 * and scroll offsets, and each <canvas> as a picture of what it showed.
 * Rebuilt in an iframe, it renders like the page did, but as vectors: text
 * stays sharp at any zoom and every element can be animated on its own.
 */
export async function snapshotPage(
  page: Page,
  name: string,
  frame: number,
  canvasScale?: CanvasScale,
): Promise<SnapshotData> {
  // Picturing canvases hides the page for a moment, which drops focus: put it back after.
  await page.evaluate(() => {
    const el = document.activeElement as (HTMLElement & { __launchFocus?: boolean }) | null;
    if (el && el !== document.body) el.setAttribute("data-launch-focus", "");
  });
  // Canvases (WebGL globes, maps) cannot be serialised: picture each one alone.
  const canvases = await page.evaluate(() =>
    [...document.querySelectorAll("canvas")].map((c, i) => {
      c.setAttribute("data-launch-canvas", String(i));
      const r = c.getBoundingClientRect();
      return { i, x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  const pictures: Record<string, string> = {};
  const sharper = canvasScale && canvases.length > 0 && canvasScale.scale !== canvasScale.base;
  if (sharper) {
    for (const { i, ratio } of await pixelRatio(page, canvasScale, canvasScale.scale))
      if (ratio < canvasScale.scale)
        console.log(
          `  snapshot ${name}: canvas ${i} stayed at ${ratio.toFixed(1)}× (the app did not redraw it for the new pixel ratio)`,
        );
  }
  for (const c of canvases) {
    if (c.width < 2 || c.height < 2) continue;
    const style = await page.addStyleTag({
      content: `*{visibility:hidden!important}[data-launch-canvas="${c.i}"]{visibility:visible!important}`,
    });
    const clip = { x: c.x, y: c.y, width: c.width, height: c.height };
    // Playwright's screenshot puts its own pixel ratio back first: go through CDP to keep ours.
    const png = sharper
      ? await shootAt(canvasScale.cdp, clip)
      : await page.screenshot({ clip, omitBackground: true, animations: "allow" });
    await style.evaluate((el) => (el as Element).remove());
    pictures[String(c.i)] = `data:image/png;base64,${png.toString("base64")}`;
  }
  if (sharper) await pixelRatio(page, canvasScale, canvasScale.base);

  const data = await page.evaluate(
    async ({ pictures }) => {
      const dataUrl = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      const cache = new Map<string, Promise<string | null>>();
      const inline = (url: string) => {
        const abs = new URL(url, location.href).href;
        if (!cache.has(abs))
          cache.set(
            abs,
            dataUrl(abs).catch(() => null),
          );
        return cache.get(abs) as Promise<string | null>;
      };

      // url() in a stylesheet is relative to that sheet, not the page: absolutise per sheet.
      let css = "";
      for (const sheet of [...document.styleSheets]) {
        const base = sheet.href ?? location.href;
        try {
          for (const rule of [...sheet.cssRules]) {
            css += `${rule.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, (m, q, u: string) =>
              u.startsWith("data:") || u.startsWith("#") ? m : `url(${q}${new URL(u, base).href}${q})`,
            )}\n`;
          }
        } catch {
          // Cross-origin sheet without CORS: skipped.
        }
      }
      const urls = [...new Set([...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)].map((m) => m[2]))].filter(
        (u) => !u.startsWith("data:") && !u.startsWith("#"),
      );
      for (const url of urls) {
        const inlined = await inline(url);
        if (inlined) css = css.split(url).join(inlined);
      }

      const originals = [...document.body.querySelectorAll("*")];
      const clone = document.body.cloneNode(true) as HTMLElement;
      const copies = [...clone.querySelectorAll("*")];
      const scrolls: { index: number; top: number; left: number }[] = [];
      for (let i = 0; i < originals.length; i++) {
        const o = originals[i] as HTMLElement;
        const c = copies[i] as HTMLElement;
        if (o.scrollTop || o.scrollLeft) scrolls.push({ index: i, top: o.scrollTop, left: o.scrollLeft });
        if (o instanceof HTMLInputElement) {
          c.setAttribute("value", o.value);
          if (o.checked) c.setAttribute("checked", "");
        } else if (o instanceof HTMLTextAreaElement) c.textContent = o.value;
        else if (o instanceof HTMLImageElement && o.currentSrc) {
          const inlined = await inline(o.currentSrc);
          if (inlined) c.setAttribute("src", inlined);
          c.removeAttribute("srcset");
          c.removeAttribute("loading");
        } else if (o instanceof HTMLCanvasElement) {
          const picture = pictures[o.getAttribute("data-launch-canvas") ?? ""];
          const img = document.createElement("img");
          for (const attr of [...o.attributes])
            if (attr.name !== "width" && attr.name !== "height") img.setAttribute(attr.name, attr.value);
          img.style.width = `${o.getBoundingClientRect().width}px`;
          img.style.height = `${o.getBoundingClientRect().height}px`;
          if (picture) img.src = picture;
          c.replaceWith(img);
        }
      }
      // Keep element indices stable for `scrolls` by blanking scripts rather than removing them.
      for (const s of [...clone.querySelectorAll("script, noscript, nextjs-portal")])
        s.replaceWith(document.createElement("template"));
      const attrs = (el: Element) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
      return {
        css,
        body: clone.innerHTML,
        htmlAttrs: attrs(document.documentElement),
        bodyAttrs: attrs(document.body),
        scrolls,
      };
    },
    { pictures },
  );
  await page.evaluate(() => {
    for (const c of document.querySelectorAll("[data-launch-canvas]")) c.removeAttribute("data-launch-canvas");
    const focused = document.querySelector<HTMLElement>("[data-launch-focus]");
    if (focused) {
      focused.removeAttribute("data-launch-focus");
      focused.focus({ preventScroll: true });
      // Number, range and other inputs without a caret have a null selectionStart and throw on setSelectionRange.
      if (focused instanceof HTMLInputElement && focused.selectionStart !== null)
        focused.setSelectionRange(focused.value.length, focused.value.length);
    }
  });
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  return { name, frame, width: viewport.width, height: viewport.height, ...data };
}
