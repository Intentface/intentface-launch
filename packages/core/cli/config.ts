import type { Platform } from "../engine/formats.js";
import type { ReadingOptions } from "../engine/reading.js";

/** A product repo that videos import from as `@product/<name>/…`, and whose public folder is served. */
export type ProductLink = {
  /** Path to the repo, relative to the launch folder. Override with LAUNCH_PRODUCT_<NAME>=/path. */
  path: string;
  /** Its static folder (served at /), so the product's code finds its assets at the usual URLs. */
  public?: string;
};

/**
 * What `pnpm launch check` holds videos to. Core sets the defaults, installed
 * add-ons (a brand) add theirs through "intentface-launch".checks in their
 * package.json, and `checks` in launch.config.ts has the last word.
 */
export type CheckRules = {
  /** How long text must stay readable (engine `readingTime` options). */
  reading?: ReadingOptions;
  /** Title-safe margin from every edge, in pixels at 1080p (default 96). */
  safe?: number;
  /**
   * Apps whose UI covers a 9:16 frame, where text must not go: "tiktok",
   * "reels", "shorts" (default all three; [] for none). See engine/formats.ts.
   */
  platforms?: Platform[];
  /** Smallest on-screen text, in pixels at 1080p (default 28). */
  minText?: number;
  /**
   * Size most of the product's UI text must reach on screen, in pixels at 1080p (default 20): the
   * UI in `Snapshot`s and text marked `data-launch-check="off"`. Under it for more than a second,
   * the UI is shown too far away to read. A warning.
   */
  uiText?: number;
  /**
   * Smallest gap between overlay text (40 px and up at 1080p) and a surface beside it (a panel,
   * card, window or Snapshot covering at least 5% of the frame), in ems of the text's on-screen
   * size (default 0.5). Closer than that, or touching, for half a second is an error. A surface
   * the text sits on is not beside it.
   */
  clearance?: number;
  /** WCAG contrast ratio text needs against what is behind it (default 4.5). Under two thirds of it is an error. */
  contrast?: number;
  /** The ratio large text needs (default 3, as WCAG): text from `largeText` px, or from three quarters of that at bold weight. */
  contrastLarge?: number;
  /** Size from which text counts as large for contrast, in pixels at 1080p (default 32; 24 at weight 700 and up). */
  largeText?: number;
  /** Longest stretch, in seconds, with nothing on screen moving (default 2). */
  still?: number;
  /** Integrated loudness target, allowed deviation, and true-peak ceiling (default -14 LUFS ± 1, -1 dBTP). */
  loudness?: { lufs: number; tolerance: number; peak: number };
  /**
   * Held frames against their references (a shot's `matches`, such as the end
   * card against the brand's static logo): the fraction of pixels allowed to
   * differ by more than 16 levels (default 0.001). A brand can tighten it.
   */
  match?: { tolerance: number };
  /**
   * Patterns that must not appear: in `source` (files under videos/<id>/) or in
   * `text` (what is rendered on screen). Rules from every source are combined.
   */
  rules?: { pattern: RegExp; message: string; in: ("source" | "text")[] }[];
};

/** `launch.config.ts`: marks the folder that holds `videos/`. */
export type LaunchConfig = {
  /**
   * The product this launch folder lives in (usually ".."). Its tsconfig paths
   * (like "@/…") resolve in videos, and its public folder is served, so videos
   * can import the product's real components and data.
   */
  product?: ProductLink;
  /** Other product repos, imported as `@product/<name>/…`. */
  products?: Record<string, ProductLink>;
  /** Studio port. */
  port?: number;
  /** Overrides for `pnpm launch check`. */
  checks?: CheckRules;
  /**
   * Secrets capture scripts read with `secret(name)`: each name maps to the
   * env file that holds it, relative to this folder (`{ API_KEY: "../.env.local" }`).
   * An environment variable of the same name wins. Keep the files out of git.
   */
  secrets?: Record<string, string>;
};

export const defineConfig = (config: LaunchConfig) => config;
