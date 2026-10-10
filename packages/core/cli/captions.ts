import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { CaptionCue } from "../engine/captions.js";
import { type Info, launchBrowser, openRenderer, startServer } from "./browser.js";
import { outDir } from "./util.js";

/** 00:00:01,250 (SRT) or 00:00:01.250 (VTT). */
function stamp(frame: number, fps: number, separator: "," | ".") {
  const ms = Math.round((frame / fps) * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms % 1000, 3)}`;
}

export function toSrt(cues: CaptionCue[], fps: number) {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.from, fps, ",")} --> ${stamp(c.to, fps, ",")}\n${c.lines.join("\n")}\n`)
    .join("\n");
}

export function toVtt(cues: CaptionCue[], fps: number) {
  const body = cues
    .map((c) => `${stamp(c.from, fps, ".")} --> ${stamp(c.to, fps, ".")}\n${c.lines.join("\n")}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** `<base>.srt` and `<base>.vtt` in `dir` from the page's captions; none when the video has no captions. */
export function writeCaptions(info: Info, dir: string, base: string): string[] {
  if (!info.captions.length) return [];
  const srt = join(dir, `${base}.srt`);
  const vtt = join(dir, `${base}.vtt`);
  writeFileSync(srt, toSrt(info.captions, info.fps));
  writeFileSync(vtt, toVtt(info.captions, info.fps));
  return [srt, vtt];
}

/** `pnpm launch captions <id>`: out/<id>.srt and out/<id>.vtt. */
export async function captions(videoId: string) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const { info } = await openRenderer(browser, url, videoId, 1);
  await browser.close();
  const files = writeCaptions(info, outDir(videoId), videoId);
  if (!files.length) {
    console.log(`  "${videoId}" has no captions: add \`captions: [{ text, at }]\` to its defineVideo.`);
    return;
  }
  for (const c of info.captions) {
    console.log(`  ${stamp(c.from, info.fps, ".")}  ${c.lines.join(" / ")}`);
  }
  console.log(`\n  ${info.captions.length} cues → ${files.map((f) => relative(process.cwd(), f)).join(", ")}`);
}
