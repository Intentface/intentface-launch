import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { JSHandle, Locator, Page } from "playwright";
import type { CaptureManifest, CaptureMark, PointerMove } from "../kit/capture.js";
import { type ProductLook, readLook } from "../kit/look.js";
import { launchBrowser } from "./browser.js";
import type { AppAccess, CaptureContext, CaptureScript, StoredValue, Target } from "./capture-api.js";
import { readSecret, redact } from "./secrets.js";
import { snapshotPage } from "./snapshot.js";
import { root, timer } from "./util.js";

/**
 * Pause every CSS and Web Animation and set it to how long it has existed on
 * the virtual clock. Runs in the page between frames, so compositor-driven
 * animations step exactly with the fake clock instead of real time.
 */
function stepAnimations(now: number) {
  const w = window as unknown as { __launchBorn?: WeakMap<Animation, { at: number; t0: number }> };
  w.__launchBorn ??= new WeakMap();
  for (const animation of document.getAnimations()) {
    // Scroll-driven animations follow scroll position, not time.
    if (animation.timeline !== document.timeline) continue;
    let born = w.__launchBorn.get(animation);
    if (!born) {
      const t0 = Number(animation.currentTime ?? 0);
      born = { at: now, t0: Number.isFinite(t0) ? t0 : 0 };
      w.__launchBorn.set(animation, born);
    }
    animation.pause();
    animation.currentTime = born.t0 + (now - born.at);
  }
}

/** The app's own modules and storage, in `page`. */
export function appAccess(page: Page): AppAccess {
  return {
    async module<T>(path: string) {
      // Same URL the app's own imports resolve to, so the same instance (and state).
      const handle = await page.evaluateHandle(
        (p) => import(/* @vite-ignore */ new URL(p, location.origin).href),
        path,
      );
      return handle as unknown as JSHandle<T>;
    },
    read: ((where: StoredValue) =>
      page.evaluate<unknown, StoredValue>(async (where) => {
        if ("localStorage" in where) return localStorage.getItem(where.localStorage);
        if ("sessionStorage" in where) return sessionStorage.getItem(where.sessionStorage);
        const [name, storeName, key] = where.indexedDB;
        if (!(await indexedDB.databases()).some((d) => d.name === name)) return undefined;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const open = indexedDB.open(name);
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        try {
          if (!db.objectStoreNames.contains(storeName)) return undefined;
          return await new Promise((resolve, reject) => {
            const get = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
            get.onsuccess = () => resolve(get.result);
            get.onerror = () => reject(get.error);
          });
        } finally {
          db.close();
        }
      }, where)) as AppAccess["read"],
  };
}

/** Marks of the same name whose box moved more than `px` on any edge since `before`. */
export function movedMarks(before: CaptureMark[], after: CaptureMark[], px = 16) {
  const old = new Map(before.map((m) => [m.name, m.rect]));
  return after.flatMap((m) => {
    const a = old.get(m.name);
    if (!a) return [];
    const b = m.rect;
    const edges = [b.x - a.x, b.y - a.y, b.x + b.width - (a.x + a.width), b.y + b.height - (a.y + a.height)];
    return Math.max(...edges.map(Math.abs)) > px ? [{ name: m.name, from: a, to: b }] : [];
  });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export async function capture(videoId: string, name?: string) {
  const folder = join(root(), "videos", videoId, "captures");
  const scripts = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith(".capture.ts")) : [];
  const chosen = name ? scripts.filter((f) => f === `${name}.capture.ts`) : scripts;
  if (chosen.length === 0) {
    throw new Error(`No capture scripts${name ? ` named ${name}` : ""} in ${relative(root(), folder)}/`);
  }
  for (const file of chosen) await captureOne(videoId, folder, file);
}

async function captureOne(videoId: string, folder: string, file: string) {
  (globalThis as { __launchSecret?: (name: string) => string }).__launchSecret = readSecret;
  const name = file.replace(/\.capture\.ts$/, "");
  const script: CaptureScript = (await import(pathToFileURL(join(folder, file)).href)).default;
  const { width, height } = script.viewport ?? { width: 1440, height: 900 };
  const scale = script.scale ?? 2;
  const fps = script.fps ?? 60;
  const format = script.format ?? "jpg";
  const frameMs = 1000 / fps;
  const dir = join(folder, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const elapsed = timer();
  console.log(`  capture ${name}: ${script.url} at ${width}×${height} @${scale}x`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: script.colorScheme ?? "dark",
    reducedMotion: "no-preference",
  });
  // tsx compiles with keepNames, so functions passed to page.evaluate call __name().
  await context.addInitScript("globalThis.__name = (f) => f");
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.clock.install();
  await script.init?.(page);
  await page.goto(script.url, { waitUntil: "networkidle" });
  const app = appAccess(page);
  await script.setup?.(page, app);
  // From here on, time only moves when a frame is recorded.
  // The page clock keeps running while this call is in flight: leave a margin.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);

  let frame = 0;
  let virtual = 0;
  const marks: CaptureMark[] = [];
  const pointer: PointerMove[] = [];
  let mouse = { x: width / 2, y: height / 2 };
  const writes: Promise<void>[] = [];
  const snapshots: string[] = [];
  const looks: Record<string, ProductLook> = {};

  const shoot = async () => {
    await page.clock.runFor(frameMs);
    virtual += frameMs;
    await page.evaluate(stepAnimations, virtual);
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: format === "jpg" ? "jpeg" : "png",
      ...(format === "jpg" ? { quality: 92 } : {}),
      optimizeForSpeed: true,
    });
    writes.push(writeFile(join(dir, `${String(frame).padStart(6, "0")}.${format}`), Buffer.from(data, "base64")));
    frame++;
  };
  const locate = (t: Target): Locator => (typeof t === "string" ? page.locator(t).first() : t);
  const box = async (t: Target) => {
    const b = await locate(t).boundingBox();
    if (!b) throw new Error(`Capture ${name}: ${String(t)} is not visible at frame ${frame}`);
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  };
  const glide = async (t: Target, travel: number, click: boolean, markName?: string) => {
    const rect = await box(t);
    const to = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const from = mouse;
    const start = frame;
    for (let i = 1; i <= travel; i++) {
      const k = ease(i / travel);
      await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      await shoot();
    }
    mouse = to;
    pointer.push({ start, end: frame, from, to, click });
    if (markName) marks.push({ name: markName, frame, kind: click ? "click" : "mark", rect });
  };

  const c: CaptureContext = {
    page,
    get frame() {
      return frame;
    },
    async hold(frames) {
      for (let i = 0; i < frames; i++) await shoot();
    },
    async mark(markName, target) {
      marks.push({ name: markName, frame, kind: "mark", rect: await box(target) });
    },
    async click(target, { travel = 30, name: markName, settle = 0 } = {}) {
      await glide(target, travel, true, markName);
      await page.mouse.down();
      await shoot();
      await page.mouse.up();
      for (let i = 0; i < settle; i++) await shoot();
    },
    async hover(target, { travel = 30, name: markName } = {}) {
      await glide(target, travel, false, markName);
    },
    async type(text, { cps = 16, name: markName, target } = {}) {
      if (target) await locate(target).focus();
      const start = frame;
      const chars = Array.from(text);
      const perChar = fps / cps;
      let owed = 0;
      for (const ch of chars) {
        await page.keyboard.type(ch);
        owed += perChar;
        while (owed >= 1) {
          await shoot();
          owed -= 1;
        }
      }
      if (markName && target) marks.push({ name: markName, frame: start, kind: "type", rect: await box(target) });
    },
    async scroll(dy, { frames = 45, dx = 0 } = {}) {
      let sent = 0;
      for (let i = 1; i <= frames; i++) {
        const target = dy * ease(i / frames);
        await page.mouse.wheel(dx / frames, target - sent);
        sent = target;
        await shoot();
      }
    },
    async snapshot(snapName, { marks: wanted = {}, canvasScale } = {}) {
      const data = await snapshotPage(
        page,
        snapName,
        frame,
        canvasScale === undefined
          ? undefined
          : {
              scale: canvasScale,
              base: scale,
              cdp,
              // Only for canvases that draw in requestAnimationFrame: one frame of the page's time.
              tick: async () => {
                await page.clock.runFor(frameMs);
                virtual += frameMs;
              },
            },
      );
      looks[snapName] = await page.evaluate(readLook, {});
      mkdirSync(join(dir, "snapshots"), { recursive: true });
      writes.push(writeFile(join(dir, "snapshots", `${snapName}.json`), redact(JSON.stringify(data))));
      snapshots.push(snapName);
      for (const [key, target] of Object.entries(wanted)) {
        marks.push({ name: `${snapName}:${key}`, frame, kind: "mark", rect: await box(target) });
      }
      console.log(`  snapshot ${snapName} at frame ${frame} · ${(JSON.stringify(data).length / 1e6).toFixed(1)} MB`);
    },
    async act(fn) {
      await fn(page);
    },
    async data(dataName: string, value: unknown) {
      const result = typeof value === "function" ? await page.evaluate(value as () => unknown) : value;
      mkdirSync(join(dir, "data"), { recursive: true });
      const json = redact(JSON.stringify(result ?? null));
      writes.push(writeFile(join(dir, "data", `${dataName}.json`), json));
      console.log(`  data ${dataName} at frame ${frame} · ${(json.length / 1e3).toFixed(0)} kB`);
      return result;
    },
    ...app,
    secret: readSecret,
  } as CaptureContext;

  await script.run(c);
  await Promise.all(writes);
  await browser.close();

  const manifest: CaptureManifest = {
    name,
    dir: `/videos/${videoId}/captures/${name}/`,
    url: script.url,
    fps,
    width,
    height,
    scale,
    frames: frame,
    format,
    marks,
    pointer,
    snapshots,
    ...(snapshots.length ? { looks } : {}),
  };
  const manifestPath = join(folder, `${name}.json`);
  const previous = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as CaptureManifest).marks
    : [];
  writeFileSync(manifestPath, `${redact(JSON.stringify(manifest, null, 2))}\n`);
  console.log(`  ${frame} frames (${(frame / fps).toFixed(1)}s) · ${marks.length} marks · ${elapsed()}`);
  reportMoved(previous, marks);
}

/** After a recapture: marks that moved or went, so framings written as numbers (or on marks) get a look. */
function reportMoved(previous: CaptureMark[], marks: CaptureMark[]) {
  const moved = movedMarks(previous, marks);
  const names = new Set(marks.map((m) => m.name));
  const gone = previous.filter((m) => !names.has(m.name)).map((m) => m.name);
  if (moved.length === 0 && gone.length === 0) return;
  const r = (v: number) => Math.round(v);
  const box = (b: CaptureMark["rect"]) => `${r(b.x)},${r(b.y)} ${r(b.width)}×${r(b.height)}`;
  if (moved.length > 0) {
    console.log(`  ${moved.length} mark${moved.length > 1 ? "s" : ""} moved since the last capture (> 16 px):`);
    const width = Math.max(...moved.map((m) => m.name.length));
    for (const m of moved) {
      const signed = (v: number) => `${v >= 0 ? "+" : ""}${r(v)}`;
      const change = [
        r(m.to.x - m.from.x) || r(m.to.y - m.from.y)
          ? `moved ${signed(m.to.x - m.from.x)}, ${signed(m.to.y - m.from.y)}`
          : "",
        r(m.to.width - m.from.width) || r(m.to.height - m.from.height)
          ? `resized ${signed(m.to.width - m.from.width)} × ${signed(m.to.height - m.from.height)}`
          : "",
      ].filter(Boolean);
      console.log(`    ${m.name.padEnd(width)}  ${box(m.from)} → ${box(m.to)}  (${change.join(", ")})`);
    }
  }
  if (gone.length > 0)
    console.log(`  no longer recorded: ${gone.join(", ")} (marks added by \`marks\` need adding again)`);
}
