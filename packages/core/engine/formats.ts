/**
 * Formats: one video, several frame shapes (16:9, 9:16, 1:1, 4:5). Scenes
 * reflow by reading the current one from `useVideoInfo().format`; nothing is
 * cropped. The CLI picks one with `--format <name>`, which reaches the page as
 * `?format=<name>` and is applied before the video mounts.
 */
import type { Video } from "./video.js";

export type FormatSize = { width: number; height: number };

export type Format = FormatSize & {
  /** "landscape" for the video's own size unless it is another shape, or the key in `formats`. */
  name: string;
  /** width / height. */
  aspect: number;
};

/** A name for a size: landscape, vertical (9:16), portrait (4:5), square. */
export function shapeName({ width, height }: FormatSize): string {
  const r = width / height;
  if (r > 1.2) return "landscape";
  if (r < 0.66) return "vertical";
  if (r < 0.9) return "portrait";
  return "square";
}

/** Is this frame 9:16 (or near it), where phone apps lay their UI over the video? */
export const isVertical = ({ width, height }: FormatSize) => Math.abs(width / height - 9 / 16) < 0.03;

/**
 * The video in format `name` (its own size when `name` is missing or names
 * its own format). Throws on a name the video does not declare.
 */
export function withFormat(video: Video, name?: string | null): Video {
  if (!name || name === video.format) return video;
  const size = video.formats[name];
  if (!size) {
    throw new Error(`Video "${video.id}" has no format "${name}". Formats: ${Object.keys(video.formats).join(", ")}`);
  }
  return { ...video, width: size.width, height: size.height, format: name };
}

export type Zone = { platform: Platform; name: string; x: number; y: number; width: number; height: number };
export type Platform = "tiktok" | "reels" | "shorts";
export const PLATFORMS: Platform[] = ["tiktok", "reels", "shorts"];

/**
 * Where each app draws its own UI over a 9:16 video, at 1080×1920. None of
 * the three publishes an official map for organic posts, so these are the
 * most cited figures; the side margins are left to core's title-safe margin.
 *
 * - TikTok: profile bar 160 px at the top, caption, sound and CTA 480 px at
 *   the bottom, the like/comment/share rail about 11% of the width on the
 *   right (Poster.ly TikTok safe zone checker; reap.video "Short-form video safe zones").
 * - Reels: 14% of the top and 35% of the bottom kept clear (Meta's Reels ad
 *   specs, as quoted by hopperhq.com/blog/instagram-reel-size and adnova.ai's
 *   Meta ad safe zones guide); the 6% side margin is inside core's margin.
 * - Shorts: 380 px top and bottom, 120 px on the right for the action rail
 *   (Poster.ly YouTube Shorts safe zone checker).
 */
const ZONES: { platform: Platform; name: string; rect: [number, number, number, number] }[] = [
  { platform: "tiktok", name: "top bar", rect: [0, 0, 1080, 160] },
  { platform: "tiktok", name: "caption and buttons", rect: [0, 1440, 1080, 480] },
  { platform: "tiktok", name: "action rail", rect: [960, 160, 120, 1280] },
  { platform: "reels", name: "top bar", rect: [0, 0, 1080, 269] },
  { platform: "reels", name: "caption and buttons", rect: [0, 1248, 1080, 672] },
  { platform: "shorts", name: "top bar", rect: [0, 0, 1080, 380] },
  { platform: "shorts", name: "title and subscribe", rect: [0, 1540, 1080, 380] },
  { platform: "shorts", name: "action rail", rect: [960, 380, 120, 1160] },
];

/** Platform UI over a 9:16 frame of this size, in its pixels (none for other shapes). */
export function platformZones(size: FormatSize, platforms: Platform[] = PLATFORMS): Zone[] {
  if (!isVertical(size)) return [];
  const sx = size.width / 1080;
  const sy = size.height / 1920;
  return ZONES.filter((z) => platforms.includes(z.platform)).map(({ platform, name, rect: [x, y, w, h] }) => ({
    platform,
    name,
    x: x * sx,
    y: y * sy,
    width: w * sx,
    height: h * sy,
  }));
}

/**
 * The largest rectangle clear of every platform's UI (the zones above) and of
 * the title-safe margin (`safe` px at 1080p). For other shapes, the frame
 * inside the margin. `check` holds 9:16 text to these zones; for laying out a
 * vertical cut, `safeZone` is one rectangle that suits every app at once.
 */
export function clearArea(size: FormatSize, safe = 96, platforms: Platform[] = PLATFORMS) {
  const unit = Math.min(size.width, size.height) / 1080;
  let left = safe * unit;
  let top = safe * unit;
  let right = size.width - safe * unit;
  let bottom = size.height - safe * unit;
  for (const z of platformZones(size, platforms)) {
    if (z.width >= size.width * 0.9) {
      if (z.y === 0) top = Math.max(top, z.height);
      else bottom = Math.min(bottom, z.y);
    } else if (z.x > size.width / 2) right = Math.min(right, z.x);
    else left = Math.max(left, z.x + z.width);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Margins kept clear on a 1080×1920 frame, so one vertical cut works on
 * TikTok, Instagram Reels and Stories, Facebook Reels and YouTube Shorts.
 * As of October 2026; apps move their UI, so check again before a big release
 * (the social-formats skill has the sources and the per-platform figures).
 * Not official: no platform publishes one map for organic posts.
 */
export const SAFE_ZONES = {
  /** Organic posts: the safe content area is 790 × 1200 (x 90 to 880, y 270 to 1470). */
  organic: { top: 270, bottom: 450, left: 90, right: 200 },
  /** One asset that must also run as a paid ad (TikTok's ad overlays, Meta's Reels ad guidance): 660 × 980. */
  ads: { top: 270, bottom: 670, left: 120, right: 300 },
} as const;
export type SafeZoneKind = keyof typeof SAFE_ZONES;

/**
 * The rectangle where everything that matters goes in a vertical cut
 * (headlines, the product's key UI, captions, logos, calls to action), in the
 * frame's pixels; footage and backgrounds still fill the whole frame. For a
 * frame that is not 9:16, the frame inside the 96 px title-safe margin.
 */
export function safeZone(size: FormatSize, kind: SafeZoneKind = "organic") {
  if (!isVertical(size)) return clearArea(size);
  const m = SAFE_ZONES[kind];
  const sx = size.width / 1080;
  const sy = size.height / 1920;
  return {
    x: m.left * sx,
    y: m.top * sy,
    width: size.width - (m.left + m.right) * sx,
    height: size.height - (m.top + m.bottom) * sy,
  };
}
