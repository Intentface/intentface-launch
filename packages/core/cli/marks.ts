import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureManifest } from "../kit/capture.js";
import type { SnapshotData } from "../kit/snapshot.js";
import { launchBrowser } from "./browser.js";
import { root } from "./util.js";

const attrs = (a: Record<string, string>) =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, "&quot;")}"`)
    .join("");

/**
 * Measure elements in a saved snapshot and add them to the capture's marks,
 * without recapturing: a snapshot holds the page's whole DOM and CSS (fonts
 * inlined), so it lays out exactly as it did live. Each element matching
 * `selector` becomes `<snapshot>:<name>-<n>` (from 1), or `<snapshot>:<name>`
 * when only one matches. Marks with those names are replaced.
 */
export async function marks(
  videoId: string,
  captureName: string,
  snapshotName: string,
  { selector, name }: { selector: string; name: string },
) {
  const folder = join(root(), "videos", videoId, "captures");
  const manifestPath = join(folder, `${captureName}.json`);
  if (!existsSync(manifestPath)) throw new Error(`No capture manifest at ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CaptureManifest;
  const snapPath = join(folder, captureName, "snapshots", `${snapshotName}.json`);
  if (!existsSync(snapPath)) throw new Error(`No snapshot "${snapshotName}" in capture "${captureName}"`);
  const data = JSON.parse(readFileSync(snapPath, "utf8")) as SnapshotData;

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: data.width, height: data.height } });
  // Same document the <Snapshot> component builds, with the page's own motion frozen.
  await page.setContent(
    `<!doctype html><html${attrs(data.htmlAttrs)}><head><meta charset="utf-8"><style>${data.css}</style><style>*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}</style></head><body${attrs(data.bodyAttrs)}>${data.body}</body></html>`,
  );
  const rects = await page.evaluate(
    async ({ selector, scrolls }) => {
      await Promise.allSettled([...document.fonts].map((f) => f.load()));
      await document.fonts.ready;
      const all = document.body.querySelectorAll("*");
      for (const s of scrolls) {
        const el = all[s.index] as HTMLElement | undefined;
        if (el) {
          el.scrollTop = s.top;
          el.scrollLeft = s.left;
        }
      }
      return [...document.querySelectorAll(selector)].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    },
    { selector, scrolls: data.scrolls },
  );
  await browser.close();
  if (rects.length === 0) throw new Error(`Nothing in snapshot "${snapshotName}" matches ${selector}`);

  const names = rects.map((_, i) => `${snapshotName}:${rects.length === 1 ? name : `${name}-${i + 1}`}`);
  const kept = manifest.marks.filter((m) => !names.includes(m.name));
  const added = rects.map((rect, i) => ({ name: names[i], frame: data.frame, kind: "mark" as const, rect }));
  manifest.marks = [...kept, ...added];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const m of added) {
    const r = m.rect;
    console.log(`  ${m.name}  ${Math.round(r.x)},${Math.round(r.y)}  ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
}
