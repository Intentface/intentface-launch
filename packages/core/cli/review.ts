import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Browser } from "playwright";
import sharp from "sharp";
import { beatFrames } from "./beats.js";
import {
  formatSuffix,
  type Info,
  launchBrowser,
  openRenderer,
  type Region,
  type Renderer,
  startServer,
} from "./browser.js";
import { encodePng, grab } from "./frames.js";
import { outDir } from "./util.js";

type ShotInfo = Info["shots"][number];

function findShot(info: Info, id: string): ShotInfo {
  const shot = info.shots.find((s) => s.id === id);
  if (!shot) throw new Error(`No shot "${id}". Shots: ${info.shots.map((s) => s.id).join(", ")}`);
  return shot;
}

/** The shot's last frame before the next shot's transition starts over it. */
function lastFrame(info: Info, shot: ShotInfo) {
  const next = info.shots[info.shots.indexOf(shot) + 1];
  return (next ? Math.min(next.from, shot.from + shot.duration) : shot.from + shot.duration) - 1;
}

/**
 * A frame from how a person names it. Numbers count from the start of `shot`
 * (or the video); negative ones from its end, `-1` being its last frame
 * before the outgoing transition. `end`, `end-10`; a shot id; `id:+30`,
 * `id:end`, and `id:<moment>+6` for a moment the shot names in `moments`.
 */
export function resolveFrame(info: Info, token: string, shotId?: string): number {
  let rest = token.trim();
  let id = shotId;
  const colon = rest.indexOf(":");
  if (colon >= 0) {
    id = rest.slice(0, colon);
    rest = rest.slice(colon + 1) || "0";
  } else if (info.shots.some((s) => s.id === rest)) {
    id = rest;
    rest = "0";
  }
  const shot = id ? findShot(info, id) : undefined;
  const parts = rest.match(/^([A-Za-z_][\w-]*)?\s*([+-]?\s*\d+(?:\.\d+)?)?$/);
  if (!parts || (!parts[1] && !parts[2])) throw new Error(`Cannot read the frame "${token}"`);
  const [, name, number] = parts;
  const offset = number ? Number(number.replace(/\s/g, "")) : 0;
  const start = shot?.from ?? 0;
  const end = shot ? lastFrame(info, shot) : info.durationInFrames - 1;
  let frame: number;
  if (name === "end") frame = end + offset;
  else if (name) {
    const at = shot?.moments?.[name];
    if (at === undefined) {
      const known = Object.keys(shot?.moments ?? {});
      throw new Error(
        `No moment "${name}"${shot ? ` in shot "${shot.id}"` : " (name the shot: shot:moment)"}${known.length ? `. Moments: ${known.join(", ")}` : ""}`,
      );
    }
    frame = start + at + offset;
  } else frame = number?.trim().startsWith("-") ? end + 1 + offset : start + offset;
  if (frame < 0 || frame >= info.durationInFrames)
    throw new Error(`"${token}" is frame ${frame}, outside the video (0 to ${info.durationInFrames - 1})`);
  return frame;
}

/**
 * Where a frame sits, for labels: the shot (the one asked for, else the one
 * on top), the offset into it, and any transition it is in.
 */
export function describeFrame(info: Info, frame: number, shotId?: string) {
  const shot = shotId ? findShot(info, shotId) : [...info.shots].reverse().find((s) => frame >= s.from);
  if (!shot) return { shot: "", offset: frame, label: `f${frame}`, note: "" };
  const i = info.shots.indexOf(shot);
  const next = info.shots[i + 1];
  const prev = info.shots[i - 1];
  const offset = frame - shot.from;
  let note = "";
  if (next && frame >= next.from && frame < shot.from + shot.duration) note = `in transition to ${next.id}`;
  else if (prev && shot.transition && offset < shot.transition.frames) note = `in transition from ${prev.id}`;
  else if (frame >= shot.from + shot.duration || offset < 0) note = `outside ${shot.id}`;
  return { shot: shot.id, offset, label: `${shot.id} +${offset}`, note };
}

const describeLine = (d: ReturnType<typeof describeFrame>, frame: number) =>
  `f${frame} · ${d.label}${d.note ? ` · ${d.note}` : ""}`;

/** Tiles as one labelled image, through a page so captions need no font setup. */
export async function tileImage(
  browser: Browser,
  tiles: { src: string; caption: string }[],
  { columns, width, height }: { columns: number; width: number; height: number },
) {
  const cols = Math.min(columns, tiles.length);
  const page = await browser.newPage({ viewport: { width: cols * (width + 8) + 8, height: 200 } });
  const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await page.setContent(`<!doctype html><body style="margin:0;background:#0d0d10;font:12px ui-monospace,monospace;color:#bbb">
    <div style="display:grid;grid-template-columns:repeat(${cols},${width}px);gap:8px;padding:8px">
    ${tiles
      .map(
        (t) => `<figure style="margin:0"><img src="${t.src}" style="display:block;width:${width}px;height:${height}px">
        <figcaption style="padding:3px 0">${html(t.caption)}</figcaption></figure>`,
      )
      .join("")}
    </div></body>`);
  const png = await page.screenshot({ fullPage: true });
  await page.close();
  return png;
}

export type StillOptions = {
  /** Frames count from this shot's start. */
  shot?: string;
  /** Output pixels per video pixel (2 for 4K). */
  scale?: number;
  /** One tiled, labelled image instead of a file per frame. */
  grid?: boolean;
  columns?: number;
  /** Tile width in the grid (default 480). */
  size?: number;
  /** Only this region, in video pixels: x, y, width, height. */
  crop?: Region;
  /** Magnification of the crop (default: about 960 px wide). */
  zoom?: number;
  /** Samples per frame for every `Stage3D` (8 is a quick draft), over the stage's own. */
  samples?: number;
  /** One image per frame of the 3D stage's passes beside the finished frame. */
  stageDebug?: boolean;
};

/**
 * Render frames to PNG, exactly as the final render has them (motion blur
 * included). Each comes back with the shot it is in and whether it is
 * inside a transition, so a still is never mistaken for another shot.
 */
export async function stills(videoId: string, specs: string[], o: StillOptions = {}) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const crop = o.crop && {
    x: Math.round(o.crop.x),
    y: Math.round(o.crop.y),
    width: Math.round(o.crop.width),
    height: Math.round(o.crop.height),
  };
  const scale = crop ? (o.zoom ?? Math.min(4, Math.max(1, Math.round(960 / crop.width)))) : (o.scale ?? 1);
  const r = await openRenderer(browser, url, videoId, scale, { samples: o.samples, debug: o.stageDebug });
  const frames = specs.map((t) => resolveFrame(r.info, t, o.shot));
  if (o.stageDebug) {
    const out = await stageDebug(browser, r, videoId, frames, { shot: o.shot, size: o.size });
    await browser.close();
    return out;
  }
  const area = crop ?? { x: 0, y: 0, width: r.info.width, height: r.info.height };
  const w = Math.round(area.width * scale);
  const h = Math.round(area.height * scale);
  const out: { file: string; line: string }[] = [];
  const tiles: { src: string; caption: string }[] = [];
  const tile = o.size ?? 480;
  for (const frame of frames) {
    const { raw } = await grab(r, frame, { region: crop });
    const d = describeFrame(r.info, frame, o.shot);
    const line = describeLine(d, frame);
    if (o.grid) {
      const jpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
        .resize(tile)
        .jpeg({ quality: 88 })
        .toBuffer();
      tiles.push({ src: `data:image/jpeg;base64,${jpg.toString("base64")}`, caption: line });
      continue;
    }
    const name = `${d.shot ? `${d.shot}+${d.offset}-` : ""}f${frame}${crop ? `-crop${crop.x}_${crop.y}_${crop.width}x${crop.height}` : ""}${formatSuffix(r.info)}.png`;
    const file = join(outDir(videoId, "stills"), name);
    writeFileSync(file, await encodePng(raw, w, h));
    out.push({ file, line });
  }
  if (o.grid) {
    const png = await tileImage(browser, tiles, {
      columns: o.columns ?? Math.min(4, Math.ceil(Math.sqrt(tiles.length))),
      width: tile,
      height: Math.round((tile * h) / w),
    });
    const file = join(
      outDir(videoId, "stills"),
      `grid-f${frames.slice(0, 6).join("_")}${frames.length > 6 ? `-${frames.length}` : ""}${formatSuffix(r.info)}.png`,
    );
    writeFileSync(file, png);
    out.push({ file, line: frames.map((f) => describeLine(describeFrame(r.info, f, o.shot), f)).join("\n      ") });
  }
  await browser.close();
  return out.map((x) => ({ ...x, file: relative(process.cwd(), x.file) || x.file }));
}

/**
 * Each frame beside the passes its 3D stages drew it from (one sample without
 * post, what glass sees, the floor's reflection, alpha, the backdrop), as one
 * labelled image per frame: for finding why glass reads grey or a layer is
 * missing without guessing.
 */
async function stageDebug(
  browser: Browser,
  r: Renderer,
  videoId: string,
  frames: number[],
  o: { shot?: string; size?: number },
) {
  const out: { file: string; line: string }[] = [];
  const tile = o.size ?? 480;
  const height = Math.round((tile * r.info.height) / r.info.width);
  for (const frame of frames) {
    const { raw } = await grab(r, frame);
    const w = Math.round(r.info.width * r.scale);
    const h = Math.round(r.info.height * r.scale);
    const jpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
      .resize(tile)
      .jpeg({ quality: 88 })
      .toBuffer();
    const views = await r.page.evaluate(() => window.__launch?.debugViews() ?? []);
    if (!views.length) throw new Error(`Frame ${frame} has no 3D stage to debug`);
    const d = describeFrame(r.info, frame, o.shot);
    const line = describeLine(d, frame);
    const png = await tileImage(
      browser,
      [
        { src: `data:image/jpeg;base64,${jpg.toString("base64")}`, caption: `final · ${line}` },
        ...views.map((v) => ({ src: v.src, caption: v.label })),
      ],
      { columns: 3, width: tile, height },
    );
    const file = join(outDir(videoId, "stills"), `stage-debug-${d.shot ? `${d.shot}+${d.offset}-` : ""}f${frame}.png`);
    writeFileSync(file, png);
    out.push({ file: relative(process.cwd(), file) || file, line });
  }
  return out;
}

/**
 * A contact sheet: every Nth frame of a shot or range as a labelled grid, so
 * motion can be judged from one image. Spacing, easing and timing problems
 * show up as uneven steps between neighbouring tiles. With `beats`, one tile
 * per beat instead (`offset` frames after it), to see that something happens
 * on every beat and lands on it. `from` and `to` take the same frame names as
 * stills (relative to `shot` if given).
 */
export async function sheet(
  videoId: string,
  {
    shot,
    every = 6,
    from,
    to,
    columns = 6,
    tile = 320,
    beats = false,
    offset = 0,
    samples,
  }: {
    shot?: string;
    every?: number;
    from?: string;
    to?: string;
    columns?: number;
    tile?: number;
    beats?: boolean;
    offset?: number;
    /** Samples per frame for every `Stage3D`, over the stage's own (8 for a quick draft). */
    samples?: number;
  },
) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  // Open once at 1× to learn the video's size, then again at tile size.
  const probe = await openRenderer(browser, url, videoId, 1, { samples });
  const { info } = probe;
  await probe.close();
  const small = await openRenderer(browser, url, videoId, tile / info.width, { samples });
  const s = shot ? findShot(info, shot) : undefined;
  const range = {
    from: from !== undefined ? resolveFrame(info, from, shot) : (s?.from ?? 0),
    to: to !== undefined ? resolveFrame(info, to, shot) + 1 : s ? s.from + s.duration : info.durationInFrames,
  };
  let frames: { frame: number; label?: string }[] = [];
  if (beats) {
    const grid = beatFrames(info, videoId);
    if (!grid) throw new Error("--beats needs audio/beats.json or a bpm on the video");
    frames = grid
      .map((b) => ({ frame: b.frame + offset, label: `${b.bar}.${b.beat}` }))
      .filter((b) => b.frame >= range.from && b.frame < range.to);
  } else {
    for (let f = range.from; f < range.to; f += every) frames.push({ frame: f });
  }
  const tiles: { src: string; caption: string }[] = [];
  for (const { frame: f, label } of frames) {
    await small.seek(f);
    const jpg = await small.shoot("jpeg", 85);
    const d = describeFrame(info, f, shot);
    tiles.push({
      src: `data:image/jpeg;base64,${jpg.toString("base64")}`,
      caption: `${label ? `beat ${label} · ` : ""}${describeLine(d, f)}`,
    });
  }
  const png = await tileImage(browser, tiles, {
    columns,
    width: tile,
    height: Math.round((tile * info.height) / info.width),
  });
  const file = join(
    outDir(videoId, "sheets"),
    `${shot ?? "all"}-${range.from}-${range.to}-${beats ? `beats${offset ? `+${offset}` : ""}` : `e${every}`}-${tile}${formatSuffix(info)}.png`,
  );
  writeFileSync(file, png);
  await browser.close();
  return relative(process.cwd(), file) || file;
}
