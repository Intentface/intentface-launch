import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Info, launchBrowser, openRenderer, startServer } from "./browser.js";
import { encodeJpeg, grab } from "./frames.js";
import { copyChecks, type Item, type Problem, sampleText, textChecks } from "./inspect.js";
import { launchCommand } from "./project.js";
import { render } from "./render.js";
import { loadRules } from "./rules.js";
import { outDir, root } from "./util.js";

type Panel = { frame: number; src: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const clock = (frames: number, fps: number) => {
  const s = frames / fps;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

/** What the studio's board view reads: out/board/board.json. */
export type BoardFile = {
  generated: string;
  animatic: boolean;
  panels: Record<string, { frame: number; file: string }[]>;
  /**
   * What check's text pass finds, per shot: reading time, size, safe area,
   * platform UI, copy rules and storyboard copy (no contrast, motion or
   * loudness). Missing when the board was built with `--no-reading`.
   */
  text?: Record<string, Problem[]>;
};

/** Checks the board runs: the ones a timing or layout decision fixes, before anything is built. */
const BOARD_CHECKS = new Set(["reading", "size", "safe", "platform", "copy"]);

/**
 * Check's text pass over the whole video: text sampled every 0.1 s, held
 * against the reading, size and safe-area rules, by shot. Fast on a flat
 * sketch; a 3D stage renders every sample at full quality.
 */
async function textPass(r: Awaited<ReturnType<typeof openRenderer>>) {
  const { info } = r;
  const base = await loadRules();
  const rules = { ...base, reading: { ...base.reading, ...info.checks?.reading } };
  const step = Math.max(1, Math.round(info.fps / 10));
  const items = new Map<number, Item>();
  for (let f = 0; f < info.durationInFrames; f += step) {
    await r.seek(f);
    await sampleText(r, f, items);
  }
  const problems = [...textChecks(items, info, rules, step).problems, ...copyChecks(items, info)].filter((p) =>
    BOARD_CHECKS.has(p.check),
  );
  const byShot: Record<string, Problem[]> = Object.fromEntries(info.shots.map((s) => [s.id, []]));
  for (const p of problems) {
    const key = p.shot ?? "";
    byShot[key] = [...(byShot[key] ?? []), p];
  }
  return byShot;
}

/**
 * The visual storyboard: every shot as real 16:9 panels rendered from the
 * shot's code, plus the animatic. The studio's board view shows them with
 * per-shot comments; `html` also writes a standalone page to share.
 */
export async function board(videoId: string, { animatic = true, html = false, reading = true } = {}) {
  const { url } = await startServer();
  const browser = await launchBrowser();
  const r = await openRenderer(browser, url, videoId, 2 / 3);
  const info = r.info;
  const dir = outDir(videoId, "board");
  rmSync(join(dir, "panels"), { recursive: true, force: true });
  mkdirSync(join(dir, "panels"), { recursive: true });
  const panels = new Map<string, Panel[]>();
  const files: BoardFile["panels"] = {};
  for (const shot of info.shots) {
    const list: Panel[] = [];
    files[shot.id] = [];
    for (const at of shot.board) {
      const frame = shot.from + Math.round(Math.min(Math.max(at, 0), 1) * (shot.duration - 1));
      const { raw } = await grab(r, frame);
      const jpg = await encodeJpeg(raw, Math.round(info.width * (2 / 3)), Math.round(info.height * (2 / 3)));
      const file = `panels/${shot.id}-f${frame}.jpg`;
      writeFileSync(join(dir, file), jpg);
      files[shot.id].push({ frame, file });
      list.push({ frame, src: `data:image/jpeg;base64,${jpg.toString("base64")}` });
    }
    panels.set(shot.id, list);
  }
  const text = reading ? await textPass(r) : undefined;
  await browser.close();
  if (text) {
    const found = Object.entries(text).filter(([, list]) => list.length);
    if (!found.length) console.log("  text: holds, sizes and margins ok");
    for (const [shot, list] of found) {
      console.log(`  ${shot}`);
      for (const p of list)
        console.log(
          `    ${p.severity === "error" ? "error" : "warn "}  ${p.check.padEnd(8)} f${p.frame ?? ""}  ${p.message}${p.text ? ` "${p.text.length > 40 ? `${p.text.slice(0, 39)}…` : p.text}"` : ""}`,
        );
    }
  }

  let hasAnimatic = false;
  if (animatic) {
    // Preview quality: the animatic is for timing, and it has to stay small enough to publish.
    const file = await render(videoId, { scale: 0.5, fps: 30, quick: true, name: "animatic", crf: 28 });
    copyFileSync(file, join(dir, "animatic.mp4"));
    hasAnimatic = true;
  }
  const manifest: BoardFile = { generated: new Date().toISOString(), animatic: hasAnimatic, panels: files, text };
  writeFileSync(join(dir, "board.json"), JSON.stringify(manifest, null, 2));
  console.log(`  board: http://localhost:4400/?v=${videoId}&board (pnpm dev)`);
  if (html) {
    const target = join(dir, "index.html");
    writeFileSync(target, page(info, panels, hasAnimatic, text));
    console.log(`  ${target}${hasAnimatic ? ` + animatic.mp4` : ""}`);
  }
}

/** The studio's faces, embedded so the page works offline and stays one file. */
function studioFonts() {
  const face = (family: string, file: string, weight: string) => {
    const data = readFileSync(new URL(`../studio/fonts/${file}`, import.meta.url)).toString("base64");
    return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:${weight};font-display:block}`;
  };
  return (
    face("Studio Sans", "Inter-Variable.woff2", "100 900") + face("Studio Mono", "IoskeleyMono-Regular.woff2", "400")
  );
}

/** check's text findings under a shot's panels: what to retime or move before the cut is built. */
function textNotes(list: Problem[] | undefined, fps: number) {
  if (!list?.length) return "";
  const items = list
    .map(
      (p) =>
        `<li class="${p.severity}"><span class="what">${esc(p.check)} · ${p.frame === undefined ? "" : clock(p.frame, fps)}</span> ${esc(p.message)}${p.text ? ` <q>${esc(p.text)}</q>` : ""}</li>`,
    )
    .join("");
  return `<ul class="text-checks">${items}</ul>`;
}

function page(info: Info, panels: Map<string, Panel[]>, animatic: boolean, text?: BoardFile["text"]) {
  const { fps } = info;
  const total = info.durationInFrames;
  const beat = info.bpm ? (60 / info.bpm) * fps : null;
  const firstShot = info.shots[0] ? panels.get(info.shots[0].id) : undefined;
  const poster = firstShot?.[firstShot.length - 1]?.src ?? "";
  const specs = [
    `${info.width}×${info.height}`,
    `${fps} fps`,
    clock(total, fps),
    info.bpm ? `${info.bpm} BPM` : null,
    `${info.shots.length} shots`,
  ]
    .filter(Boolean)
    .join(" · ");

  const strip = info.shots
    .map((s, i) => {
      const thumb = panels.get(s.id)?.[0]?.src ?? "";
      return `<a class="seg" href="#${esc(s.id)}" data-from="${s.from}" style="flex:${s.duration} 1 0" title="${esc(s.title)}">
        <img src="${thumb}" alt="">
        <span>${i + 1}</span>
      </a>`;
    })
    .join("");

  const rows = info.shots
    .map((s, i) => {
      const list = panels.get(s.id) ?? [];
      const beats = beat ? ` · ${+(s.duration / beat).toFixed(1)} beats` : "";
      const figures = list
        .map(
          (p) => `<figure>
            <button type="button" class="still" data-from="${p.frame}" aria-label="Play from frame ${p.frame}">
              <img src="${p.src}" alt="${esc(s.title)} at ${clock(p.frame, fps)}">
            </button>
            <figcaption>${clock(p.frame, fps)} · f${p.frame}</figcaption>
          </figure>`,
        )
        .join("");
      const field = (label: string, value?: string) =>
        value ? `<div class="field"><dt>${label}</dt><dd>${esc(value)}</dd></div>` : "";
      const copy = s.copy?.length ? `<div class="copy">${s.copy.map((c) => `<p>${esc(c)}</p>`).join("")}</div>` : "";
      return `<section class="shot" id="${esc(s.id)}">
        <header>
          <span class="num">${String(i + 1).padStart(2, "0")}</span>
          <h2>${esc(s.title)}</h2>
          <span class="time">${clock(s.from, fps)}–${clock(s.from + s.duration, fps)} · ${(s.duration / fps).toFixed(1)}s${beats}</span>
        </header>
        <div class="body">
          <div class="stills"><div class="panels n${list.length}">${figures}</div>${textNotes(text?.[s.id], fps)}</div>
          <div class="direction">
            ${s.says ? `<p class="says">${esc(s.says)}</p>` : ""}
            ${copy}
            <dl>
              ${field("Camera", s.camera)}
              ${field("Sound", s.sound)}
              ${field("In", s.transition ? `${s.transition.name}, ${(s.transition.frames / fps).toFixed(2)}s` : i === 0 ? undefined : "Cut")}
              ${field("Notes", s.notes)}
            </dl>
          </div>
        </div>
      </section>`;
    })
    .join("");

  return `<title>${esc(info.title)} Storyboard</title>
<style>
${studioFonts()}
:root{
  color-scheme:light;
  --bg:#fff; --fg:#18181b; --acc:#0169cc; --con:.3;
  --primary:oklch(from var(--bg) calc(l + .05 * var(--con)) c h);
  --base:oklch(from var(--bg) calc(l - .1 * var(--con)) c h);
  --body:oklch(from var(--fg) calc(l + .16) c h); --muted:oklch(from var(--fg) calc(l + .34) c h); --faint:oklch(from var(--fg) calc(l + .5) c h);
  --hairline:color-mix(in oklab,var(--fg) 7%,transparent);
  --card:0 0 0 1px rgb(0 0 0/.075),0 1px 2px rgb(0 0 0/.06),0 4px 8px -2px rgb(0 0 0/.05);
  --sans:"Studio Sans",ui-sans-serif,system-ui,sans-serif; --mono:"Studio Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root{
  color-scheme:dark;
  --bg:#18181b; --fg:#f4f4f5; --acc:#4c9bea;
  --primary:oklch(from var(--bg) max(calc(.09 + .106 * var(--con)),calc(l + .1 * var(--con))) c h);
  --base:oklch(from var(--bg) max(0,calc(l - .075 * var(--con))) c h);
  --body:oklch(from var(--fg) calc(l - .1) c h); --muted:oklch(from var(--fg) calc(l - .26) c h); --faint:oklch(from var(--fg) calc(l - .42) c h);
  --card:inset 0 1px 0 rgb(255 255 255/.05),inset 0 0 0 1px rgb(255 255 255/.06),0 0 0 1px rgb(0 0 0/.16),0 1px 2px rgb(0 0 0/.1);
}}
*{box-sizing:border-box}
body{margin:0;padding:8px;min-height:100vh;background:var(--base);color:var(--fg);font:450 15px/1.5 var(--sans);font-synthesis:none;-webkit-font-smoothing:antialiased}
.card{min-height:calc(100vh - 16px);border-radius:12px;background:var(--bg);box-shadow:var(--card)}
.wrap{max-width:1240px;margin:0 auto;padding-inline:32px;padding-block:48px 96px;display:grid;gap:48px}
@media (max-width:600px){body{padding:0}.card{border-radius:0;box-shadow:none}.wrap{padding-inline:16px;padding-block:32px 64px;gap:32px}}
.time,figcaption,.specs,.num,.seg span{font-family:var(--mono);font-size:12px;font-weight:400;font-variant-ligatures:none;font-variant-numeric:tabular-nums}
.label,dt{font-size:12px;font-weight:500;color:var(--muted)}
.intro{display:grid;gap:10px;max-width:64ch}
h1{font-weight:600;font-size:clamp(32px,4vw,44px);line-height:1.1;letter-spacing:-.02em;margin:0;text-wrap:balance}
.logline{font-size:17px;line-height:1.55;color:var(--body);margin:0}
.specs{color:var(--faint);margin:0}
.player{display:grid;gap:12px}
video{width:100%;max-width:100%;aspect-ratio:16/9;border-radius:12px;background:#000;display:block;box-shadow:var(--card)}
.strip{display:flex;gap:3px;border-radius:10px;overflow:hidden;box-shadow:var(--card)}
.seg{position:relative;display:block;height:56px;min-width:0;background:#000}
.seg img{width:100%;height:100%;object-fit:cover;display:block;opacity:.75;transition:opacity .15s}
.seg:hover img,.seg:focus-visible img{opacity:1}
.seg span{position:absolute;left:6px;top:4px;color:#fff;text-shadow:0 0 6px #000}
:is(a,button):focus-visible{outline:2px solid color-mix(in oklab,var(--acc) 60%,transparent);outline-offset:2px}
.shots{display:grid;gap:48px}
.shot{display:grid;gap:16px;scroll-margin-top:24px}
.shot header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;border-top:1px solid var(--hairline);padding-top:24px}
.num{color:var(--acc);font-weight:500}
h2{font-weight:600;font-size:20px;line-height:1.4;letter-spacing:-.01em;margin:0;text-wrap:balance}
.time{color:var(--faint);margin-left:auto}
.body{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:28px;align-items:start}
@media (max-width:900px){.body{grid-template-columns:minmax(0,1fr)}}
.panels{display:grid;gap:12px}
.stills{display:grid;gap:10px;align-content:start}
.text-checks{margin:0;padding:0;list-style:none;display:grid;gap:4px;font-size:13px;color:var(--body)}
.text-checks li{padding-left:14px;position:relative}
.text-checks li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:oklch(.72 .15 75)}
.text-checks li.error::before{background:oklch(.63 .2 25)}
.text-checks .what{font-family:var(--mono);font-size:12px;color:var(--muted)}
.text-checks q{color:var(--muted)}
.panels.n2{grid-template-columns:1fr 1fr}
.panels.n3{grid-template-columns:1fr 1fr 1fr}
@media (max-width:600px){.panels.n2,.panels.n3{grid-template-columns:1fr}}
figure{margin:0;display:grid;gap:6px}
.still{all:unset;display:block;cursor:pointer;border-radius:8px;overflow:hidden;box-shadow:var(--card);aspect-ratio:16/9;max-width:100%}
.still img{width:100%;height:100%;object-fit:cover;display:block}
figcaption{color:var(--faint)}
.direction{display:grid;gap:14px}
.says{font-size:15px;line-height:1.6;color:var(--body);margin:0}
.copy{display:grid;padding:0 5px 5px;border-radius:12px;background:var(--base);box-shadow:var(--card)}
.copy::before{content:"On screen";font-size:12px;font-weight:500;color:var(--muted);padding:7px 10px 6px}
.copy p{margin:0;padding:10px 14px;font-size:17px;font-weight:600;letter-spacing:-.01em;line-height:1.3;background:var(--primary);box-shadow:inset 0 0 0 1px var(--hairline)}
.copy p:first-of-type{border-radius:6px 6px 0 0}.copy p:last-of-type{border-radius:0 0 6px 6px}.copy p:only-of-type{border-radius:6px}
dl{margin:0;display:grid;gap:10px}
.field{display:grid;grid-template-columns:64px 1fr;gap:12px}
dt{padding-top:2px}
dd{margin:0;font-size:14px;color:var(--body)}
footer{color:var(--faint);font-size:12px}
@media (prefers-reduced-motion:reduce){.seg img{transition:none}}
</style>
<div class="card"><main class="wrap">
  <div class="intro">
    <p class="label">Storyboard</p>
    <h1>${esc(info.title)}</h1>
    ${info.logline ? `<p class="logline">${esc(info.logline)}</p>` : ""}
    <p class="specs">${specs}</p>
  </div>
  ${
    animatic
      ? `<div class="player">
    <video id="animatic" src="animatic.mp4" poster="${poster}" controls playsinline preload="metadata"></video>
    <p class="label">Animatic · click any panel to play from there</p>
  </div>`
      : ""
  }
  <nav class="strip" aria-label="Shots">${strip}</nav>
  <div class="shots">${rows}</div>
  <footer>Panels are rendered from the shot code at the frames shown. Regenerate with ${esc(launchCommand(root()))} board ${esc(info.id)}.</footer>
</main></div>
<script>
(() => {
  const video = document.getElementById("animatic");
  const fps = ${fps};
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-from]");
    if (!el || !video) return;
    if (el.classList.contains("seg")) return; // strip links jump to the shot
    video.currentTime = Number(el.dataset.from) / fps;
    video.play().catch(() => {});
    video.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
</script>
`;
}
