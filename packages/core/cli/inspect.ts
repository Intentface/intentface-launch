import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { clearArea, platformZones } from "../engine/formats.js";
import type { Box, Clearance, LayerBox } from "../engine/measure.js";
import { beatGrid, tempo } from "../engine/motion.js";
import { lintText, readingTime } from "../engine/reading.js";
import type { Beats } from "./beats.js";
import { type Info, launchBrowser, openRenderer, type Renderer, startServer } from "./browser.js";
import type { CheckRules } from "./config.js";
import { compareImages, describeDifference } from "./diff.js";
import { grab } from "./frames.js";
import { loudnessName, loudnessTarget, measureLoudness } from "./loudness.js";
import { type Mix, mixAudio } from "./mix.js";
import { launchCommand } from "./project.js";
import { resolveFrame, tileImage } from "./review.js";
import { analyseSound, findSound, heardAudio } from "./sound.js";
import { assetPath, outDir, root } from "./util.js";

export type Rules = Required<Omit<CheckRules, "reading">> & { reading: NonNullable<CheckRules["reading"]> };

export type Problem = {
  check: string;
  severity: "error" | "warn";
  shot?: string;
  frame?: number;
  text?: string;
  message: string;
};

type Sample = { frame: number; visible: number; size: number; weight: number; boxes: Box[]; clearance?: Clearance };
export type Item = { id: number; shot: string; text: string; declared?: boolean; samples: Sample[] };

/**
 * Mean edge change (0 to 255) a second apart under which the picture counts as
 * frozen. Measured: a frozen layout over the moving gradient 0.5 to 0.7, the
 * same layout with a 3% drift over 4 s 1.2 and up.
 */
const STILL = 0.9;
const THUMB = 240;
/** Smallest text, in pixels at 1080p, held to `clearance`: overlay type, not UI labels. */
const CLEARANCE_FROM = 40;
/** Samples per frame for 3D stages while checking (`check --samples N` to change). */
export const DRAFT_SAMPLES = 8;

/** Edge strength of a greyscale image: smooth gradients vanish, type and UI remain. */
function edges(grey: Buffer, width: number) {
  const height = grey.length / width;
  const out = Buffer.alloc(grey.length);
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      out[i] = Math.min(255, Math.abs(grey[i + 1] - grey[i]) + Math.abs(grey[i + width] - grey[i]));
    }
  }
  return out;
}

const sec = (frames: number, fps: number) => `${(frames / fps).toFixed(1)} s`;
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Consecutive runs of samples, `step` frames apart. */
function runs<T extends { frame: number }>(list: T[], step: number): T[][] {
  const out: T[][] = [];
  for (const s of list) {
    const last = out[out.length - 1];
    if (last && s.frame - last[last.length - 1].frame <= step) last.push(s);
    else out.push([s]);
  }
  return out;
}

const span = (run: { frame: number }[], step: number) => run[run.length - 1].frame - run[0].frame + step;

/**
 * Text that drifts: readable, and moving or resizing by more than nothing but less than a pixel a
 * frame for half a second or more (a slow push on a held line). Chrome snaps glyphs to whole
 * pixels, so it visibly steps. Entrances and exits move faster; held text does not move at all.
 */
function creeping(readable: Sample[], step: number, fps: number) {
  const union = (b: Box[]) => {
    const x = Math.min(...b.map((r) => r.x));
    const y = Math.min(...b.map((r) => r.y));
    return { x, y, r: Math.max(...b.map((r) => r.x + r.width)), b: Math.max(...b.map((r) => r.y + r.height)) };
  };
  let best: { frame: number; frames: number; rate: number } | null = null;
  for (const run of runs(readable, step)) {
    let start = -1;
    let total = 0;
    for (let i = 1; i <= run.length; i++) {
      const rate = (() => {
        if (i === run.length) return 0;
        const a = union(run[i - 1].boxes);
        const b = union(run[i].boxes);
        const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.r - a.r), Math.abs(b.b - a.b));
        return d / (run[i].frame - run[i - 1].frame);
      })();
      if (rate > 0.02 && rate < 1) {
        if (start < 0) {
          start = i - 1;
          total = 0;
        }
        total += rate * (run[i].frame - run[i - 1].frame);
        continue;
      }
      // The stretch ends here: keep the longest one.
      if (start >= 0) {
        const frames = run[i - 1].frame - run[start].frame;
        if (frames >= fps * 0.5 && (!best || frames > best.frames))
          best = { frame: run[start].frame, frames, rate: total / frames };
      }
      start = -1;
    }
  }
  return best;
}

/** UI text on screen at one sampled frame: characters at each on-screen size. */
type UiSample = { frame: number; chars: number; sizes: [number, number][] };

/** Characters of UI text a frame needs before its size is judged: a label or two is not "the UI". */
const UI_CHARS = 40;

/**
 * The product's UI shown too far away: for a second or more, most of its text (by characters) is
 * under `rules.uiText` on screen. Text in Snapshots and text marked `off` is never read by the
 * reading checks, so this is the only check that sees it.
 */
export function uiChecks(samples: UiSample[], info: Info, rules: Rules, step: number): Problem[] {
  const unit = Math.min(info.width, info.height) / 1080;
  const limit = rules.uiText * unit;
  const small: { frame: number; median: number }[] = [];
  for (const s of samples) {
    if (s.chars < UI_CHARS) continue;
    const sorted = [...s.sizes].sort((a, b) => a[0] - b[0]);
    let seen = 0;
    let median = 0;
    for (const [size, n] of sorted) {
      seen += n;
      median = size;
      if (seen >= s.chars / 2) break;
    }
    if (median < limit) small.push({ frame: s.frame, median });
  }
  const problems: Problem[] = [];
  for (const run of runs(small, step)) {
    const length = span(run, step);
    if (length < info.fps) continue;
    const start = run[0].frame;
    const shot = [...info.shots].reverse().find((s) => start >= s.from);
    const median = Math.round(Math.max(...run.map((r) => r.median)) / unit);
    problems.push({
      check: "ui",
      severity: "warn",
      shot: shot?.id,
      frame: start,
      message: `the UI is shown far away for ${sec(length, info.fps)}: most of its text is ${median} px or less on screen (at 1080p; ${rules.uiText} wanted). Push in until the part the story is about reads at ${rules.minText} px or more, or keep a wide view under a second. Decoration that is not UI: data-launch-check="decor"`,
    });
  }
  return problems;
}

/** WCAG relative luminance of an sRGB pixel. */
function luminance(r: number, g: number, b: number) {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

async function rgb(r: Renderer) {
  const { data, info } = await sharp(await r.shoot("png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Contrast of text against what is behind it, from two captures of the same
 * frame: as rendered, and with all text hidden. Glyph pixels are where the two
 * differ most; the background is the hidden capture under the text's boxes,
 * taken at its worst (the side closest to the text's own luminance).
 */
function contrast(
  a: { data: Buffer; width: number; height: number },
  b: { data: Buffer; width: number; height: number },
  boxes: Box[],
): number | null {
  const pixels: { diff: number; fg: number; bg: number }[] = [];
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(a.width, Math.ceil(box.x + box.width));
    const y1 = Math.min(a.height, Math.ceil(box.y + box.height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * a.width + x) * 3;
        const fg = luminance(a.data[i], a.data[i + 1], a.data[i + 2]);
        const bg = luminance(b.data[i], b.data[i + 1], b.data[i + 2]);
        pixels.push({ diff: Math.abs(fg - bg), fg, bg });
      }
    }
  }
  if (pixels.length < 20) return null;
  const glyphs = [...pixels].sort((p, q) => q.diff - p.diff).slice(0, Math.max(5, Math.floor(pixels.length * 0.1)));
  if (glyphs[glyphs.length - 1].diff < 0.01) return null;
  const fg = quantile(
    glyphs.map((p) => p.fg).sort((x, y) => x - y),
    0.5,
  );
  const bgs = pixels.map((p) => p.bg).sort((x, y) => x - y);
  const bg = fg > quantile(bgs, 0.5) ? quantile(bgs, 0.9) : quantile(bgs, 0.1);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

function loudness(info: Info, rules: Rules, problems: Problem[], mixed: Mix | null) {
  if (!info.audio && !mixed) return null;
  const file = mixed ? mixed.file : assetPath(info.audio?.src ?? "");
  if (!existsSync(file)) {
    problems.push({ check: "loudness", severity: "error", message: `audio not found: ${info.audio?.src}` });
    return null;
  }
  // The mix starts at frame 0, at its final level.
  const measured = measureLoudness({
    file,
    from: mixed ? 0 : (info.audio?.offset ?? 0),
    duration: info.durationInFrames / info.fps,
    volume: mixed ? 1 : (info.audio?.volume ?? 1),
  });
  const { lufs, peak, shortTerm } = measured;
  const own = info.audio?.loudness;
  const target = loudnessTarget(rules.loudness, own);
  if (!target) {
    if (Number.isFinite(peak) && peak > 0)
      problems.push({
        check: "loudness",
        severity: "warn",
        message: `true peak ${peak} dBTP: the delivered audio clips when encoded`,
      });
    return { ...measured, asDelivered: true };
  }
  const { lufs: goal, tolerance, peak: ceiling, shortTerm: cap } = target;
  const spec = typeof own === "string" ? ` (${own})` : "";
  // Under a short-term cap (R128 s1), a short loud sound may keep the whole below the target: the cap wins.
  const capped = cap !== undefined && Number.isFinite(shortTerm) && shortTerm >= cap - 0.6 && lufs < goal;
  if (Number.isFinite(lufs) && Math.abs(lufs - goal) > tolerance) {
    const gain = goal - lufs;
    const volume = ((info.audio?.volume ?? 1) * 10 ** (gain / 20)).toFixed(2);
    const reach = peak + gain;
    problems.push({
      check: "loudness",
      severity: capped ? "warn" : "error",
      message: capped
        ? `integrated loudness ${lufs} LUFS, target ${goal} ± ${tolerance}${spec}, held down by the short-term maximum (${shortTerm}, cap ${cap}): compress the loudest moment to get both`
        : gain > 0 && Number.isFinite(reach) && reach > ceiling
          ? `integrated loudness ${lufs} LUFS, target ${goal} ± ${tolerance}${spec}; raising it would put the true peak at ${reach.toFixed(1)} dBTP (ceiling ${ceiling}): the track needs limiting, not more volume`
          : `integrated loudness ${lufs} LUFS, target ${goal} ± ${tolerance}${spec}: set audio.volume to ${volume}`,
    });
  }
  if (cap !== undefined && Number.isFinite(shortTerm) && shortTerm > cap + 0.1) {
    problems.push({
      check: "loudness",
      severity: "error",
      message: `short-term maximum ${shortTerm} LUFS, cap ${cap}${spec}: lower the loudest 3 s (\`${launchCommand(root())} sound\` shows where)`,
    });
  }
  if (Number.isFinite(peak) && peak > ceiling) {
    problems.push({
      check: "loudness",
      severity: "error",
      message: `true peak ${peak} dBTP, ceiling ${ceiling}${spec}: lower the volume or limit the track`,
    });
  }
  return { ...measured, target: { ...target, name: loudnessName(own) } };
}

/**
 * Picture locks declared on shots (`hits`) against the audio: each named sound
 * is found by `sound`'s analysis, nearest the lock, and must be within the
 * hit's tolerance (2 frames). The sounds are found in the music and voice
 * without the sound effects: an effect placed on a hit (a click on a riser's
 * peak) would otherwise move the event it is meant to land on.
 */
async function hitsCheck(videoId: string, info: Info, problems: Problem[]) {
  const declared = info.shots.flatMap((shot) => (shot.hits ?? []).map((hit) => ({ shot, hit })));
  if (!declared.length) return [];
  const heard = await heardAudio(videoId, info, { music: true });
  if (!heard) {
    problems.push({ check: "hits", severity: "error", message: "shots declare hits, but the video has no audio" });
    return [];
  }
  const report = analyseSound(heard.samples, { fps: info.fps, loudness: heard.loudness });
  return declared.map(({ shot, hit }) => {
    const local = typeof hit.at === "number" ? hit.at : shot.moments?.[hit.at];
    const at = { check: "hits", severity: "error" as const, shot: shot.id };
    if (local === undefined) {
      problems.push({ ...at, message: `hit at "${hit.at}": no such moment on the shot` });
      return { shot: shot.id, frame: null, sound: hit.sound, soundFrame: null, off: null };
    }
    const frame = shot.from + local;
    const t = findSound(report, hit.sound, frame / info.fps);
    if (t === null) {
      problems.push({
        ...at,
        frame,
        message: `hit on "${hit.sound}" at f${frame}: no ${hit.sound} in the audio (${launchCommand(root())} sound ${videoId} lists what is there)`,
      });
      return { shot: shot.id, frame, sound: hit.sound, soundFrame: null, off: null };
    }
    const soundFrame = Math.round(t * info.fps * 10) / 10;
    const off = Math.round((frame - soundFrame) * 10) / 10;
    const tolerance = hit.tolerance ?? 2;
    const what =
      typeof hit.sound === "number" ? `the sound at ${hit.sound} s` : `the ${hit.sound} at ${t.toFixed(3)} s`;
    if (Math.abs(off) > tolerance)
      problems.push({
        ...at,
        frame,
        message: `lock at f${frame} is ${Math.abs(off)} frames ${off > 0 ? "after" : "before"} ${what} (f${soundFrame}), allowed ${tolerance}: move the lock${typeof hit.sound === "number" ? "" : " or the sound"}`,
      });
    return { shot: shot.id, frame, sound: hit.sound, soundFrame, off };
  });
}

function cuts(info: Info, videoId: string, problems: Problem[]) {
  const file = join(root(), "videos", videoId, "audio", "beats.json");
  const detected = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Beats) : null;
  // A video without cuts has nothing to check against the grid.
  if (info.shots.length > 1 && detected && detected.confidence !== undefined && detected.confidence < 0.5) {
    problems.push({
      check: "cuts",
      severity: "warn",
      message: `beat detection confidence ${detected.confidence}: cut positions are checked against an unreliable grid`,
    });
  }
  const grid = detected
    ? beatGrid(detected, info.fps, info.audio?.offset ?? 0, info.audio?.edit)
    : info.bpm
      ? tempo(info.bpm, info.fps)
      : null;
  const list = info.shots.slice(1).map((s) => {
    if (!grid) return { shot: s.id, frame: s.from, beat: null, off: null };
    // A transition is on the beat if it starts, peaks or ends on one.
    const frames = s.transition?.frames ?? 0;
    const marks = frames ? [s.from, s.from + frames / 2, s.from + frames] : [s.from];
    const [mark, beat] = marks
      .map((m) => [m, grid.snap(m)] as const)
      .sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]))[0];
    const off = Math.round(mark - beat);
    if (Math.abs(off) > 1 && !s.offBeat) {
      const half = grid.snap(mark, { subdivision: 2 });
      const what = frames ? `${s.transition?.name.toLowerCase()} (${frames} frames)` : "cut";
      problems.push({
        check: "cuts",
        severity: "warn",
        shot: s.id,
        frame: s.from,
        message: `${what} ${Math.abs(off)} frames ${off > 0 ? "after" : "before"} the beat at f${beat}${
          Math.abs(mark - half) <= 1 ? " (on the half beat)" : ""
        }; if deliberate, set offBeat: true on the shot`,
      });
    }
    return { shot: s.id, frame: s.from, beat, off };
  });
  if (!grid && info.shots.length > 1) {
    problems.push({
      check: "cuts",
      severity: "warn",
      message: "no bpm on the video and no audio/beats.json: cuts not checked against the beat",
    });
  }
  for (let i = 0; i + 2 < info.shots.length; i++) {
    const [a, b, c] = info.shots.slice(i, i + 3);
    if (
      a.duration === b.duration &&
      b.duration === c.duration &&
      (i === 0 || info.shots[i - 1].duration !== a.duration)
    ) {
      problems.push({
        check: "cuts",
        severity: "warn",
        shot: a.id,
        frame: a.from,
        message: `"${a.id}", "${b.id}" and "${c.id}" are all ${sec(a.duration, info.fps)}: vary the rhythm`,
      });
    }
  }
  return list;
}

/** Adds the text on screen at the frame `r` was just seeked to into `items`. */
export async function sampleText(r: Renderer, frame: number, items: Map<number, Item>) {
  for (const s of await r.page.evaluate(() => window.__launch?.inspect() ?? [])) {
    let item = items.get(s.id);
    if (!item) {
      item = { id: s.id, shot: s.shot, text: s.text, declared: s.declared, samples: [] };
      items.set(s.id, item);
    }
    if (s.text.length >= item.text.length) item.text = s.text;
    item.samples.push({
      frame,
      visible: s.visible,
      size: s.size,
      weight: s.weight,
      boxes: s.boxes,
      clearance: s.clearance,
    });
  }
}

export type TextEntry = {
  shot: string;
  text: string;
  from: number;
  readable: number;
  needs: number;
  size: number;
  contrastNeeded: number;
  contrast?: number | null;
};

/**
 * What the text samples break: reading time, size, safe area, platform UI,
 * clearance from the surfaces beside it, copy rules and lint, one entry per text block, and the frames where each
 * block's contrast should be measured. Pure: `board` runs it too.
 */
export function textChecks(items: Map<number, Item>, info: Info, rules: Rules, step: number) {
  const { fps, width, height } = info;
  const unit = Math.min(width, height) / 1080;
  const problems: Problem[] = [];
  const margin = rules.safe * unit;
  const zones = platformZones({ width, height }, rules.platforms);
  const clear = clearArea({ width, height }, rules.safe, rules.platforms);
  const textRules = rules.rules.filter((x) => x.in.includes("text"));
  const report: TextEntry[] = [];
  const contrastAt: ContrastAt = new Map();
  const tooLong = (list: Sample[]) => list.length && runs(list, step).some((run) => span(run, step) >= fps * 0.5);

  for (const item of items.values()) {
    const readable = item.samples.filter((s) => s.visible >= 0.9);
    if (!readable.length) continue;
    const longest = runs(readable, step).sort((a, b) => span(b, step) - span(a, step))[0];
    const held = span(longest, step);
    const needs = readingTime(item.text, fps, rules.reading).frames;
    const size = Math.min(...longest.map((s) => s.size)) / unit;
    const at = { shot: item.shot, frame: longest[0].frame, text: item.text };
    const weight = Math.max(...longest.map((s) => s.weight));
    const large = size >= rules.largeText || (weight >= 700 && size >= rules.largeText * 0.75);
    const entry = {
      shot: item.shot,
      text: item.text,
      from: longest[0].frame,
      readable: held,
      needs,
      size,
      contrastNeeded: large ? rules.contrastLarge : rules.contrast,
    };
    report.push(entry);

    const creep = creeping(readable, step, fps);
    if (creep)
      problems.push({
        ...at,
        frame: creep.frame,
        check: "creep",
        severity: "warn",
        message: `moves about ${creep.rate.toFixed(2)} px a frame for ${sec(creep.frames, fps)}: DOM text slower than a pixel a frame steps a pixel at a time (glyphs snap to whole pixels). Hold it still, or move it faster`,
      });

    if (held + step < needs && words(item.text).length > 0) {
      problems.push({
        ...at,
        check: "reading",
        severity: "error",
        message: `readable for ${sec(held, fps)}, needs ${sec(needs, fps)}`,
      });
    }
    const small = readable.filter((s) => s.size / unit < rules.minText);
    if (tooLong(small)) {
      const least = Math.min(...small.map((s) => s.size)) / unit;
      problems.push({
        ...at,
        frame: small[0].frame,
        check: "size",
        severity: "error",
        message: `${least.toFixed(0)} px at 1080p, minimum ${rules.minText}`,
      });
    }
    const outside = readable.filter((s) =>
      s.boxes.some(
        (b) =>
          b.x < margin - 1 ||
          b.y < margin - 1 ||
          b.x + b.width > width - margin + 1 ||
          b.y + b.height > height - margin + 1,
      ),
    );
    if (tooLong(outside)) {
      problems.push({
        ...at,
        frame: outside[0].frame,
        check: "safe",
        severity: "error",
        message: `inside the ${rules.safe} px safe margin for ${sec(outside.length * step, fps)}`,
      });
    }
    // Clearance: a line of overlay type (40 px and up: smaller labels belong to UI, like a name
    // above its chat bubble) crowding a panel, card or window beside it, touching it or nearly.
    const crowded = readable.filter(
      (s) => s.size / unit >= CLEARANCE_FROM && s.clearance && s.clearance.gap < rules.clearance * s.size,
    );
    if (tooLong(crowded)) {
      const worst = crowded.reduce((a, b) => ((b.clearance?.gap ?? 0) < (a.clearance?.gap ?? 0) ? b : a));
      const gap = worst.clearance?.gap ?? 0;
      const wanted = Math.round((rules.clearance * worst.size) / unit);
      problems.push({
        ...at,
        frame: worst.frame,
        check: "clearance",
        severity: "error",
        message: `${gap < 1 ? "touches or overlaps" : `${Math.round(gap / unit)} px from`} ${worst.clearance?.name} (at 1080p; at least ${rules.clearance} em, ${wanted} px, wanted): give the line room, or place it by what it names. A surface it is meant to touch: data-launch-clearance="ok"`,
      });
    }
    // Platform UI over a 9:16 frame: TikTok, Reels and Shorts draw their bars and buttons there.
    const covered = (b: Box) =>
      zones.filter(
        (z) =>
          b.x < z.x + z.width - 1 && b.x + b.width > z.x + 1 && b.y < z.y + z.height - 1 && b.y + b.height > z.y + 1,
      );
    const underUi = readable.filter((s) => s.boxes.some((b) => covered(b).length));
    if (tooLong(underUi)) {
      const hit = underUi.flatMap((s) => s.boxes.flatMap(covered));
      const names = [...new Set(hit.map((z) => `${z.platform} ${z.name}`))];
      problems.push({
        ...at,
        frame: underUi[0].frame,
        check: "platform",
        severity: "error",
        message: `under the ${names.join(", ")} for ${sec(underUi.length * step, fps)}: keep text inside x ${Math.round(clear.x)}–${Math.round(clear.x + clear.width)}, y ${Math.round(clear.y)}–${Math.round(clear.y + clear.height)}`,
      });
    }
    for (const rule of textRules) {
      if (rule.pattern.test(item.text))
        problems.push({ ...at, check: "copy", severity: "error", message: rule.message });
    }
    for (const w of lintText(item.text, size >= 64 ? "headline" : "line")) {
      problems.push({ ...at, check: "lint", severity: "warn", message: w });
    }
    const mid = longest[Math.floor(longest.length / 2)];
    const list = contrastAt.get(mid.frame) ?? [];
    list.push({ item, boxes: mid.boxes, entry });
    contrastAt.set(mid.frame, list);
  }
  return { problems, report, contrastAt };
}

type ContrastAt = Map<number, { item: Item; boxes: Box[]; entry: TextEntry }[]>;

/**
 * Contrast of text against what is behind it, when only the frame itself is
 * known (text a canvas declared and painted anyway while hidden): glyphs are
 * the minority, so the median is the background and the extreme farthest
 * from it the ink.
 */
function contrastAlone(a: { data: Buffer; width: number; height: number }, boxes: Box[]): number | null {
  const values: number[] = [];
  for (const box of boxes) {
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(a.height, Math.ceil(box.y + box.height)); y++) {
      for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(a.width, Math.ceil(box.x + box.width)); x++) {
        const i = (y * a.width + x) * 3;
        values.push(luminance(a.data[i], a.data[i + 1], a.data[i + 2]));
      }
    }
  }
  if (values.length < 20) return null;
  values.sort((x, y) => x - y);
  const bg = quantile(values, 0.5);
  const lo = quantile(values, 0.02);
  const hi = quantile(values, 0.98);
  const fg = hi - bg > bg - lo ? hi : lo;
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

/** Contrast, measured on the rendered pixels at the frames `textChecks` chose. */
export async function contrastChecks(r: Renderer, contrastAt: ContrastAt) {
  const problems: Problem[] = [];
  for (const [frame, list] of contrastAt) {
    await r.seek(frame);
    const a = await rgb(r);
    await r.page.evaluate(() => window.__launch?.hideText(true));
    const b = await rgb(r);
    await r.page.evaluate(() => window.__launch?.hideText(false));
    for (const { item, boxes, entry } of list) {
      const ratio = contrast(a, b, boxes) ?? (item.declared ? contrastAlone(a, boxes) : null);
      entry.contrast = ratio === null ? null : Math.round(ratio * 100) / 100;
      const needed = entry.contrastNeeded;
      if (ratio !== null && ratio < needed) {
        problems.push({
          check: "contrast",
          severity: ratio < (needed * 2) / 3 ? "error" : "warn",
          shot: item.shot,
          frame,
          text: item.text,
          message: `contrast ${ratio.toFixed(2)}:1 against what is behind it, needs ${needed}:1 at ${entry.size.toFixed(0)} px`,
        });
      }
    }
  }
  return problems;
}

/** Storyboard copy whose words never become readable in their shot. */
export function copyChecks(items: Map<number, Item>, info: Info) {
  const problems: Problem[] = [];
  for (const shot of info.shots) {
    const seen = new Set(
      [...items.values()]
        .filter((i) => i.shot === shot.id && i.samples.some((s) => s.visible >= 0.9))
        .flatMap((i) => words(i.text)),
    );
    for (const line of shot.copy ?? []) {
      const missing = words(line).filter((w) => !seen.has(w));
      if (missing.length) {
        problems.push({
          check: "copy",
          severity: "warn",
          shot: shot.id,
          frame: shot.from,
          text: line,
          message: `storyboard copy not readable on screen (missing: ${missing.join(", ")})`,
        });
      }
    }
  }
  return problems;
}

/**
 * Each shot's `matches`: the frame as rendered, against its reference
 * rendered alone at the same frame. A difference picture of each is written
 * to out/check/ so the mismatch can be seen.
 */
export async function matchChecks(r: Renderer, videoId: string, rules: Rules) {
  const problems: Problem[] = [];
  const report: { shot: string; label: string; frame: number; changed: number; max: number; file?: string }[] = [];
  const { info } = r;
  const browser = r.page.context().browser();
  for (const shot of info.shots) {
    for (const [index, m] of (shot.matches ?? []).entries()) {
      const label = m.label ?? (index ? `match-${index + 1}` : "match");
      let frame: number;
      try {
        frame = resolveFrame(info, `${shot.id}:${m.at}`);
      } catch (error) {
        problems.push({ check: "match", severity: "error", shot: shot.id, message: String((error as Error).message) });
        continue;
      }
      const { raw: held } = await grab(r, frame);
      await r.page.evaluate(([s, i]) => window.__launch?.reference(s as string, i as number), [shot.id, index]);
      let reference: Buffer;
      try {
        reference = (await grab(r, frame)).raw;
      } finally {
        await r.page.evaluate(() => window.__launch?.reference(null));
      }
      const { diff, image } = compareImages(held, reference, info.width, info.height);
      const tolerance = m.tolerance ?? rules.match.tolerance;
      const entry: (typeof report)[number] = { shot: shot.id, label, frame, changed: diff.changed, max: diff.max };
      report.push(entry);
      if (diff.changed <= tolerance) continue;
      if (browser) {
        const tile = 640;
        const src = async (raw: Buffer) =>
          `data:image/png;base64,${(
            await sharp(raw, { raw: { width: info.width, height: info.height, channels: 3 } })
              .resize(tile)
              .png()
              .toBuffer()
          ).toString("base64")}`;
        const png = await tileImage(
          browser,
          [
            { src: await src(held), caption: `f${frame} · ${shot.id} as rendered` },
            { src: await src(reference), caption: `${label}: the reference alone` },
            { src: await src(image), caption: `difference: ${describeDifference(diff)}` },
          ],
          { columns: 3, width: tile, height: Math.round((tile * info.height) / info.width) },
        );
        const file = join(outDir(videoId, "check"), `${shot.id}-${label}-f${frame}.png`);
        writeFileSync(file, png);
        entry.file = relative(root(), file);
      }
      problems.push({
        check: "match",
        severity: "error",
        shot: shot.id,
        frame,
        message: `${label}: differs from its reference in ${describeDifference(diff)}; allowed ${(tolerance * 100).toFixed(2)}%${entry.file ? ` (${entry.file})` : ""}`,
      });
    }
  }
  return { problems, report };
}

/** A straight edge of a layer where its content stops abruptly, on one sampled frame. */
type LayerCut = {
  frame: number;
  shot: string;
  layer: number;
  name: string;
  edge: "top" | "bottom" | "left" | "right";
  /** The edge's position (y for top and bottom, x for left and right) and the cut stretch along it, in video pixels. */
  at: number;
  from: number;
  to: number;
};

type Picture = { data: Buffer; width: number; height: number };

/** Largest channel difference between two pixels. */
const delta = (p: Picture, x1: number, y1: number, x2: number, y2: number) => {
  const i = (y1 * p.width + x1) * 3;
  const j = (y2 * p.width + x2) * 3;
  return Math.max(
    Math.abs(p.data[i] - p.data[j]),
    Math.abs(p.data[i + 1] - p.data[j + 1]),
    Math.abs(p.data[i + 2] - p.data[j + 2]),
  );
};

/**
 * Along one edge: where the picture steps hard exactly at the edge while
 * staying smooth on both sides of it, the signature of content sliced by a
 * box. Returns the stepped positions' coverage of the edge and its longest run.
 */
function edgeSteps(p: Picture, layer: LayerBox, edge: LayerCut["edge"]) {
  const { box, visible } = layer;
  const horizontal = edge === "top" || edge === "bottom";
  const pos =
    edge === "top" ? box.y : edge === "bottom" ? box.y + box.height : edge === "left" ? box.x : box.x + box.width;
  const limit = horizontal ? p.height : p.width;
  // Edges on the frame's border are the frame's, not the layer's.
  if (pos < 8 || pos > limit - 8) return null;
  // The edge has to be on screen: not clipped away by a box around the layer.
  const [vFrom, vTo] = horizontal ? [visible.y, visible.y + visible.height] : [visible.x, visible.x + visible.width];
  if (pos < vFrom - 1 || pos > vTo + 1) return null;
  const sign = edge === "top" || edge === "left" ? -1 : 1;
  const inner = (d: number) => Math.round(pos - sign * d - (sign > 0 ? 1 : 0));
  const outer = (d: number) => Math.round(pos + sign * d - (sign > 0 ? 0 : 1));
  const [a, b] = horizontal
    ? [Math.max(0, Math.ceil(visible.x)), Math.min(p.width, Math.floor(visible.x + visible.width))]
    : [Math.max(0, Math.ceil(visible.y)), Math.min(p.height, Math.floor(visible.y + visible.height))];
  const length = b - a;
  if (length < 64) return null;
  const [i1, i2, o1, o2] = [inner(2), inner(5), outer(2), outer(5)];
  if ([i1, i2, o1, o2].some((v) => v < 0 || v >= limit)) return null;
  let stepped = 0;
  let run = 0;
  let gap = 0;
  let best = { from: a, to: a };
  let start = a;
  for (let t = a; t < b; t++) {
    const at = (v: number): [number, number] => (horizontal ? [t, v] : [v, t]);
    const d = delta(p, ...at(i1), ...at(o1));
    const smooth = delta(p, ...at(i1), ...at(i2)) <= d / 3 && delta(p, ...at(o1), ...at(o2)) <= d / 3;
    if (d >= 48 && smooth) {
      stepped++;
      if (run === 0) start = t;
      run = t - start + 1;
      gap = 0;
      if (run > best.to - best.from) best = { from: start, to: t + 1 };
    } else if (run && ++gap > 3) run = 0;
  }
  return { pos, length, coverage: stepped / length, run: best };
}

/** Is there new content just outside the edge once the layer stops clipping? */
function spillsOver(
  before: Picture,
  after: Picture,
  edge: LayerCut["edge"],
  pos: number,
  run: { from: number; to: number },
) {
  const horizontal = edge === "top" || edge === "bottom";
  const sign = edge === "top" || edge === "left" ? -1 : 1;
  let changed = 0;
  for (let t = run.from; t < run.to; t++) {
    let most = 0;
    for (let d = 1; d <= 6; d++) {
      const v = Math.round(pos + sign * d - (sign > 0 ? 0 : 1));
      if (v < 0 || v >= (horizontal ? before.height : before.width)) continue;
      const i = ((horizontal ? v * before.width + t : t * before.width + v) * 3) as number;
      most = Math.max(
        most,
        Math.abs(before.data[i] - after.data[i]),
        Math.abs(before.data[i + 1] - after.data[i + 1]),
        Math.abs(before.data[i + 2] - after.data[i + 2]),
      );
    }
    if (most > 24) changed++;
  }
  return changed >= (run.to - run.from) * 0.3;
}

/**
 * Layers cutting their own content at the frame `r` was just seeked to. A
 * card, a screenshot or a video is a rectangle on purpose, and shows it on
 * most of its visible edges; a globe sliced by its canvas steps on one edge
 * only. SVGs and clipping boxes are confirmed by letting them draw past the
 * edge: a tight logo SVG has nothing past it, a cut one does.
 */
async function layerCuts(r: Renderer, frame: number): Promise<LayerCut[]> {
  const layers = (await r.page.evaluate(() => window.__launch?.layers?.() ?? [])).filter(
    (l) => l.kind === "canvas" || l.kind === "svg" || l.kind === "clip",
  );
  if (!layers.length) return [];
  const unit = Math.min(r.info.width, r.info.height) / 1080;
  const picture = await rgb(r);
  const cuts: LayerCut[] = [];
  for (const layer of layers) {
    const found = (["top", "bottom", "left", "right"] as const)
      .map((edge) => ({ edge, steps: edgeSteps(picture, layer, edge) }))
      .filter((e): e is { edge: LayerCut["edge"]; steps: NonNullable<ReturnType<typeof edgeSteps>> } => !!e.steps);
    const straight = found.filter((e) => e.steps.coverage >= 0.6).length;
    if (straight >= 3 || (straight >= 2 && straight === found.length)) continue;
    for (const { edge, steps } of found) {
      const long = steps.run.to - steps.run.from;
      if (long < 48 * unit) continue;
      if (layer.kind !== "canvas") {
        await r.page.evaluate((id) => window.__launch?.unclip(id), layer.id);
        const after = await rgb(r);
        await r.page.evaluate(() => window.__launch?.unclip(null));
        if (!spillsOver(picture, after, edge, steps.pos, steps.run)) continue;
      }
      cuts.push({
        frame,
        shot: layer.shot,
        layer: layer.id,
        name: layer.name,
        edge,
        at: Math.round(steps.pos),
        ...steps.run,
      });
    }
  }
  return cuts;
}

/** One warning per layer edge that cut its content on at least two samples in a row. */
function layerProblems(cuts: LayerCut[], info: Info, step: number) {
  const problems: Problem[] = [];
  const groups = new Map<string, LayerCut[]>();
  for (const c of cuts) {
    const key = `${c.shot} ${c.layer} ${c.edge}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  for (const list of groups.values()) {
    const run = runs(list, step).sort((a, b) => b.length - a.length)[0];
    if (run.length < 2) continue;
    const c = run[0];
    const along = c.edge === "top" || c.edge === "bottom" ? `x ${c.from}–${c.to}` : `y ${c.from}–${c.to}`;
    problems.push({
      check: "crop",
      severity: "warn",
      shot: c.shot,
      frame: c.frame,
      message: `${c.name} cuts its content at its ${c.edge} edge (${c.edge === "top" || c.edge === "bottom" ? "y" : "x"} ${c.at}, ${along}) for ${sec(span(run, step), info.fps)}: make the layer larger or move what it draws; if meant, data-launch-crop="ok"`,
    });
  }
  return problems;
}

/**
 * Samples the video every `every` frames and checks what the viewer gets:
 * text that is readable for long enough, big enough, inside the safe area and
 * in contrast; the picture never frozen for long; cuts on the beat; loudness.
 */
export async function inspect(
  videoId: string,
  rules: Rules,
  { every, samples = DRAFT_SAMPLES }: { every?: number; samples?: number } = {},
) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  // 3D stages at draft samples: text in panels is never checked, and depth of
  // field barely moves the contrast or the motion measured here.
  const r = await openRenderer(browser, url, videoId, 1, { samples });
  const { info } = r;
  // The video's own reading rules come last, over the project's.
  rules = { ...rules, reading: { ...rules.reading, ...info.checks?.reading } };
  const { fps, width } = info;
  const step = every ?? Math.max(1, Math.round(fps / 10));
  const problems: Problem[] = [];

  // 1. Sample: text on screen, a thumbnail for motion, and (four times a second) layer edges.
  const items = new Map<number, Item>();
  const ui: UiSample[] = [];
  const thumbs: { frame: number; pixels: Buffer }[] = [];
  const thumb = THUMB / width;
  const layerStep = Math.max(step, Math.round(fps / 4 / step) * step);
  const crops: LayerCut[] = [];
  for (let f = 0; f < info.durationInFrames; f += step) {
    await r.seek(f);
    await sampleText(r, f, items);
    ui.push({ frame: f, ...(await r.page.evaluate(() => window.__launch?.uiText() ?? { chars: 0, sizes: [] })) });
    if (f % layerStep === 0) crops.push(...(await layerCuts(r, f)));
    const grey = await sharp(await r.shoot("jpeg", 80, thumb))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    thumbs.push({ frame: f, pixels: edges(grey.data, grey.info.width) });
    if (process.stdout.isTTY && f % (step * 50) === 0)
      process.stdout.write(`\r  sampling f${f} / ${info.durationInFrames}`);
  }
  if (process.stdout.isTTY) process.stdout.write("\r\x1b[K");

  // 2. Text: hold, size, safe area, platform UI, copy rules, lint.
  const text = textChecks(items, info, rules, step);
  problems.push(...text.problems);
  problems.push(...uiChecks(ui, info, rules, step));
  // 3. Contrast, measured on the rendered pixels.
  problems.push(...(await contrastChecks(r, text.contrastAt)));
  // 4. Held frames against their references (`matches`), and layers cutting their content.
  const matches = await matchChecks(r, videoId, rules);
  problems.push(...matches.problems);
  problems.push(...layerProblems(crops, info, layerStep));
  await browser.close();
  problems.push(...copyChecks(items, info));
  const report = text.report;

  // 5. Stillness: edges now against edges a second ago. Edges, so a
  // background gradient drifting behind a frozen layout still counts as still.
  const gap = Math.max(1, Math.round(fps / step));
  const still: { frame: number }[] = [];
  const motion: number[] = [];
  for (let i = gap; i < thumbs.length; i++) {
    const [p, q] = [thumbs[i - gap].pixels, thumbs[i].pixels];
    let sum = 0;
    for (let k = 0; k < p.length; k++) sum += Math.abs(p[k] - q[k]);
    const change = sum / p.length;
    motion.push(Math.round(change * 100) / 100);
    if (change < STILL) still.push({ frame: thumbs[i].frame });
  }
  for (const run of runs(still, step)) {
    const start = run[0].frame - gap * step;
    const length = span(run, step) + gap * step;
    if (length >= rules.still * fps) {
      const shot = [...info.shots].reverse().find((s) => start >= s.from);
      problems.push({
        check: "still",
        severity: "warn",
        shot: shot?.id,
        frame: start,
        message: `nothing moves for ${sec(length, fps)} (f${start} to f${start + length}): give it something that happens, or move the picture (not the text: a slow drift on type steps a pixel at a time)`,
      });
    }
  }

  const cutList = cuts(info, videoId, problems);
  const loud = loudness(info, rules, problems, await mixAudio(videoId, info));
  const hitList = await hitsCheck(videoId, info, problems);
  return {
    video: videoId,
    info,
    every: step,
    problems,
    text: report,
    matches: matches.report,
    cuts: cutList,
    hits: hitList,
    loudness: loud,
    motion,
  };
}
