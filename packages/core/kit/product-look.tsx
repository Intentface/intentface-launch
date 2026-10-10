import { useLayoutEffect } from "react";
import { waitFor } from "../engine/index.js";
import type { CaptureManifest } from "./capture.js";
import type { ProductLook } from "./look.js";
import { load, snapshotUrl } from "./snapshot.js";

const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, "");

// One <style> per snapshot, shared by every shot that asks for its fonts.
const registered = new Map<string, Promise<void>>();

function registerFonts(url: string): Promise<void> {
  const known = registered.get(url);
  if (known) return known;
  const ready = (async () => {
    const data = await load(url);
    // The snapshot's CSS has every font file inlined, so its @font-face rules work anywhere.
    const rules = data.css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    if (rules.length === 0) return;
    const families = new Set(
      rules.flatMap((rule) => {
        const m = rule.match(/font-family:\s*([^;}]+)/);
        return m ? [unquote(m[1])] : [];
      }),
    );
    const style = document.createElement("style");
    style.dataset.productFonts = url;
    style.textContent = rules.join("\n");
    document.head.append(style);
    // Faces nothing has used yet stay unloaded (and `fonts.ready` does not wait for them): load them now.
    await Promise.allSettled([...document.fonts].filter((f) => families.has(unquote(f.family))).map((f) => f.load()));
  })();
  registered.set(url, ready);
  return ready;
}

/**
 * The product's look as a snapshot recorded it: its font stacks (body,
 * heading, mono) and colours (background, surface, text, muted, accent,
 * border) and corner radii. Text set outside the `Snapshot` (a headline,
 * a label) can then use the product's own faces: they are registered on
 * the video's page from the snapshot, and the frame waits until they load.
 *
 * `snapshot` names one of the capture's snapshots (default: its first).
 *
 * ```tsx
 * const look = useProductLook(capture);
 * <h1 style={{ fontFamily: look.fonts.heading, color: look.colors.text }}>…</h1>
 * ```
 */
export function useProductLook(capture: CaptureManifest, snapshot?: string): ProductLook {
  const name = snapshot ?? capture.snapshots?.[0];
  if (!name) throw new Error(`Capture "${capture.name}" has no snapshot: take one with c.snapshot() for its look`);
  const url = snapshotUrl(capture, name);
  useLayoutEffect(() => {
    waitFor(registerFonts(url), `Product fonts ${name}`);
  }, [url, name]);
  const look = capture.looks?.[name];
  if (!look)
    throw new Error(
      `Capture "${capture.name}" has no look for snapshot "${name}": run \`pnpm launch capture\` again (looks are recorded with each snapshot)`,
    );
  return look;
}
