import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { CheckRules } from "./config.js";
import type { Rules } from "./inspect.js";
import { launchPackages, project } from "./project.js";
import { root } from "./util.js";

const DEFAULTS: Rules = {
  reading: {},
  safe: 96,
  platforms: ["tiktok", "reels", "shorts"],
  minText: 28,
  uiText: 20,
  clearance: 0.5,
  contrast: 4.5,
  contrastLarge: 3,
  largeText: 32,
  still: 2,
  loudness: { lufs: -14, tolerance: 1, peak: -1 },
  match: { tolerance: 0.001 },
  rules: [
    {
      pattern: /\bwill-change\s*:|\bwillChange\s*:/,
      message:
        "will-change: Chrome rasterises the layer once and scales the bitmap, so text under a Camera zoom goes soft",
      in: ["source"],
    },
  ],
};

/** Core's defaults, then each installed add-on's checks, then launch.config.ts. */
export async function loadRules(): Promise<Rules> {
  const layers: CheckRules[] = [];
  for (const p of launchPackages(root())) {
    if (typeof p.meta.checks !== "string") continue;
    // A path in the package ("./checks.ts"), or a specifier through its exports ("@acme/brand/checks").
    const file = p.meta.checks.startsWith(".")
      ? join(p.dir, p.meta.checks)
      : createRequire(join(p.dir, "package.json")).resolve(p.meta.checks);
    layers.push((await import(pathToFileURL(file).href)).default);
  }
  layers.push(project().config.checks ?? {});
  let rules = DEFAULTS;
  for (const layer of layers) {
    const set = Object.fromEntries(Object.entries(layer).filter(([, v]) => v !== undefined));
    rules = {
      ...rules,
      ...set,
      reading: { ...rules.reading, ...layer.reading },
      loudness: { ...rules.loudness, ...layer.loudness },
      rules: [...rules.rules, ...(layer.rules ?? [])],
    };
  }
  return rules;
}
