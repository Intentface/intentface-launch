import type { JSHandle, Locator, Page } from "playwright";

export type Target = string | Locator;

/** An IndexedDB key. */
export type StoredKey = string | number | (string | number)[];

/** Where `read` finds a value the app stored. */
export type StoredValue =
  | { indexedDB: [database: string, store: string, key: StoredKey] }
  | { localStorage: string }
  | { sessionStorage: string };

/** The app's own code and storage, in the page. Works in `setup` and while recording. */
export type AppAccess = {
  /**
   * The app's module at `path` (as its dev server serves it: "/src/lib/store.ts"),
   * the same instance the app runs. Call into it with `evaluate`:
   * `(await c.module<typeof import("@/lib/store")>("/src/lib/store.ts")).evaluate((m) => m.useStore.getState().addRow())`.
   */
  module<T = Record<string, unknown>>(path: string): Promise<JSHandle<T>>;
  /** A value the app stored, returned to the script: an IndexedDB record (structured clone), or a storage string. */
  read<T = unknown>(where: { indexedDB: [database: string, store: string, key: StoredKey] }): Promise<T | undefined>;
  read(where: { localStorage: string } | { sessionStorage: string }): Promise<string | null>;
};

export type CaptureContext = AppAccess & {
  page: Page;
  /** Current capture frame. */
  readonly frame: number;
  /** Record `frames` frames with nothing happening (animations keep playing). */
  hold(frames: number): Promise<void>;
  /** Save an element's box under `name` for the camera to frame later. */
  mark(name: string, target: Target): Promise<void>;
  /** Glide the pointer to the element over `travel` frames (hover states fire), then click. */
  click(target: Target, options?: { travel?: number; name?: string; settle?: number }): Promise<void>;
  /** Move without clicking. */
  hover(target: Target, options?: { travel?: number; name?: string }): Promise<void>;
  /** Type into the focused element, `cps` characters per second, one keystroke per frame boundary. */
  type(text: string, options?: { cps?: number; name?: string; target?: Target }): Promise<void>;
  /** Wheel-scroll by dy CSS pixels spread over `frames` frames. */
  scroll(dy: number, options?: { frames?: number; dx?: number }): Promise<void>;
  /**
   * Save the page as live HTML/CSS for a vector <Snapshot>: sharp at any zoom,
   * with parts that can be animated. `marks` records element boxes to frame.
   */
  snapshot(
    name: string,
    options?: {
      marks?: Record<string, Target>;
      /**
       * Device pixels per CSS pixel for the pictures of <canvas> elements (default: the
       * capture's `scale`). 4 keeps a canvas grid or chart sharp through a 2× push-in.
       * The page is redrawn at that pixel ratio for a moment (the frames before and after are unchanged).
       */
      canvasScale?: number;
    },
  ): Promise<void>;
  /**
   * Save JSON next to the capture's snapshots (`<capture>/data/<name>.json`): what
   * `fn` returns, run in the page (a data grid's rows and columns, the app's state),
   * or a value the script already has. Returns it. A video imports the file:
   * `import grid from "./captures/<capture>/data/<name>.json"`.
   */
  data<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  data<T>(name: string, value: T): Promise<T>;
  /** Run page code between frames (set state, trigger things). Takes no time. */
  act(fn: (page: Page) => Promise<unknown>): Promise<void>;
  /** A secret from the environment or the env file launch.config.ts names (see `secret`). */
  secret(name: string): string;
};

export type CaptureScript = {
  url: string;
  /** CSS pixel viewport. */
  viewport?: { width: number; height: number };
  /** Device scale: 2 keeps text sharp through a 2× push-in. */
  scale?: number;
  fps?: number;
  format?: "jpg" | "png";
  colorScheme?: "dark" | "light";
  /** Before the first page load: init scripts (`page.addInitScript`), cookies, storage. */
  init?(page: Page): Promise<void>;
  /** Before recording, on a real clock: log in, wait for data, dismiss banners, seed state with `app.module`. */
  setup?(page: Page, app: AppAccess): Promise<void>;
  run(capture: CaptureContext): Promise<void>;
};

export const defineCapture = (script: CaptureScript) => script;

/**
 * A secret for a capture (an API key, a demo login): the environment variable
 * `name`, else its line in the env file `secrets.<name>` in launch.config.ts
 * names. Never print it; snapshots and the manifest have it replaced. It can
 * still appear in frames if the page shows it on screen.
 */
export const secret = (name: string): string => {
  // Installed by the capture command, so this entry point stays free of Node code a product would type-check.
  const read = (globalThis as { __launchSecret?: (name: string) => string }).__launchSecret;
  if (!read) throw new Error("secret() works inside `intentface-launch capture`");
  return read(name);
};
