import { type Browser, type CDPSession, chromium, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import type { LaunchBridge } from "../engine/runtime.js";
import type { BlurRequest } from "../engine/timeline.js";
import { ensureProject } from "./project.js";
import { viteConfig } from "./vite.js";

export type Info = LaunchBridge["info"];
export type Region = { x: number; y: number; width: number; height: number };

let server: ViteDevServer | null = null;

export async function startServer(port = 0): Promise<{ url: string; server: ViteDevServer }> {
  if (server) return { url: serverUrl(server), server };
  server = await createServer({ ...viteConfig(await ensureProject(), port), logLevel: port ? "info" : "warn" });
  await server.listen();
  return { url: serverUrl(server), server };
}

function serverUrl(s: ViteDevServer) {
  const address = s.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not start");
  return `http://localhost:${address.port}`;
}

export async function stopServer() {
  await server?.close();
  server = null;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    args: [
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--force-color-profile=srgb",
      // Headless falls back to SwiftShader unless ANGLE is pointed at Metal.
      ...(process.platform === "darwin" ? ["--use-angle=metal"] : []),
      // HTML-in-Canvas: live DOM as WebGL textures (kit/three <Panel>).
      "--enable-features=CanvasDrawElement",
    ],
  });
}

export type Renderer = {
  page: Page;
  info: Info;
  /** Output pixels per CSS pixel. */
  scale: number;
  /** Render a frame; resolves with the motion blur its layers ask for, if any. */
  seek(frame: number): Promise<BlurRequest | null>;
  /** Capture the stage, or `region` of it (CSS pixels). JPEG for previews, PNG for masters. `size` overrides the output scale. */
  shoot(format?: "png" | "jpeg", quality?: number, size?: number, region?: Region): Promise<Buffer>;
  close(): Promise<void>;
};

/** A frame that stopped making progress. Its page cannot be trusted afterwards: open a new one. */
export class StalledFrame extends Error {}

/** How long one seek or screenshot may take. A 3D frame at full samples takes ~12 s. */
const FRAME_TIMEOUT = 90_000;

/** `work`, or the error `onTimeout` builds if it takes longer than `ms`. */
export async function within<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => Promise<Error | null> = async () => null,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(async () => reject((await onTimeout()) ?? new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

let format: string | undefined;

/** Every page opened from now on shows its video in this format (`--format vertical`); undefined for its own. */
export function setFormat(name: string | undefined) {
  format = name;
}

let variant: string | undefined;

/** Every page opened from now on shows this variant of its video (`--variant ep02`); undefined for the video itself. */
export function setVariant(name: string | undefined) {
  variant = name;
}

/**
 * For output file names: "-ep02" for a variant, "-vertical" for a format
 * other than the video's own, both as "-ep02-vertical"; "" for the video itself.
 */
export function formatSuffix(info: Info) {
  return `${info.variant ? `-${info.variant}` : ""}${info.format === Object.keys(info.formats)[0] ? "" : `-${info.format}`}`;
}

/**
 * Draft and debug settings for a render page: `samples` overrides every
 * `Stage3D`'s sample count, `debug` makes stages keep their passes for
 * `debugViews()`.
 */
export type PageQuality = { samples?: number; debug?: boolean };

const qualityQuery = (q: PageQuality = {}) =>
  `${q.samples ? `&samples=${Math.round(q.samples)}` : ""}${q.debug ? "&debug" : ""}`;

/** One headless page showing `videoId` at native size × `scale`. */
export async function openRenderer(
  browser: Browser,
  baseUrl: string,
  videoId: string,
  scale = 1,
  quality?: PageQuality,
): Promise<Renderer> {
  // Size the viewport from the video's own config: load once to read it.
  const context = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    `${baseUrl}/?v=${encodeURIComponent(videoId)}&render${format ? `&format=${encodeURIComponent(format)}` : ""}${variant ? `&variant=${encodeURIComponent(variant)}` : ""}${qualityQuery(quality)}`,
  );
  try {
    // An error while loading (an unknown --format, a throw in video.tsx) fails at once, not after the timeout.
    const failed = new Promise<never>((_, reject) => page.once("pageerror", reject));
    failed.catch(() => {});
    await Promise.race([page.waitForFunction(() => window.__launch, null, { timeout: 60_000 }), failed]);
  } catch {
    throw new Error(`Video "${videoId}" did not load:\n${errors.join("\n") || "(no errors reported)"}`);
  }
  const info = (await page.evaluate(() => window.__launch?.info)) as Info;
  await page.setViewportSize({ width: info.width, height: info.height });
  const cdp: CDPSession = await context.newCDPSession(page);
  return {
    page,
    info,
    scale,
    async seek(frame) {
      const blur = await within(
        page.evaluate((f) => window.__launch?.seek(f) ?? null, frame),
        FRAME_TIMEOUT,
        async () => {
          // The page may be what is stuck, so the status query gets its own limit.
          const status = await within(
            page.evaluate(() => window.__launch?.status() ?? null),
            5_000,
            async () => null,
          ).catch(() => null);
          const where = status
            ? `stuck in ${status.step}; waiting on: ${status.pending.join(", ") || "nothing registered"}`
            : "page not responding";
          return new StalledFrame(`Frame ${frame} did not render in ${FRAME_TIMEOUT / 1000} s: ${where}`);
        },
      );
      if (errors.length) throw new Error(`Frame ${frame}: ${errors.splice(0).join("\n")}`);
      return blur;
    },
    async shoot(format = "png", quality = 92, size = scale, region) {
      const { data } = await within(
        cdp.send("Page.captureScreenshot", {
          format,
          ...(format === "jpeg" ? { quality } : {}),
          // Clip is in CSS pixels and ignores the device scale; `scale` sets the output size.
          clip: { ...(region ?? { x: 0, y: 0, width: info.width, height: info.height }), scale: size },
          captureBeyondViewport: false,
          optimizeForSpeed: true,
        }),
        FRAME_TIMEOUT,
        async () => new StalledFrame(`Screenshot did not complete in ${FRAME_TIMEOUT / 1000} s`),
      );
      return Buffer.from(data, "base64");
    },
    close: () => context.close(),
  };
}
