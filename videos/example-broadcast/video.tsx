// Example: broadcast and analogue. Each shot is one pattern drawn with Canvas 2D (paths, fills and
// text, no shaders) and shown on core's `Tube`, a cathode-ray tube modelled part by part: phosphor
// that fades, a beam that widens on highlights, an aperture grille, curved glass, and events on
// frames (power on and off, a channel change, a degauss, worn tape). The pictures also stand
// alone: `bypass` on the Tube shows them without it. Copy a pattern's draw function and change its
// props; for a product, its own name, mark and lines.
// Run: pnpm launch still example-broadcast --at power-on:+150,ident:+120,teletext:+90,scope:+120,clock:+200,chrome:+400,surf:+60 --grid
// Expect:
// - power-on: black glass; a bright line opens into the raster through snow, the colours swim
//   (degauss) and settle on a test card: colour bars, a step wedge, gratings, a circle, and a
//   plate with the name and a running timecode.
// - ident: a wireframe globe in warm amber turning on the right with a ring and a satellite,
//   NORTH / WIND stacked on the left, a timecode and a blinking "On air" tally below.
// - teletext: a 40 × 25 page in pure teletext colours: a blue double-height header, a rainbow
//   bar that cycles, four changes with versions, a flashing NEW, a coloured link row.
// - scope: a green Lissajous figure on a graticule, the trace leaving a fading tail.
// - clock: a station clock ticking from 08:59:55 to 09:00; the seconds dots fill amber; at nine
//   the line under the time turns from "Next" to "Now".
// - chrome: an 80s home-video intro on tape: PLAY, a laser grid running to a pink horizon, the
//   mark flying in from the vanishing point, flashing, settling after the chrome wordmark, whose
//   letters rise in one by one; a light sweep, a typed tagline with a block caret.
// - surf: stars streaking out of the centre, a channel change into snow, and the set switching
//   off: the picture collapses to a line, then a dot that fades.

import { type DeclaredText, defineVideo, random, tempo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Tube, useFontsReady } from "@intentface-launch/core/kit";
import { look } from "../example-look";

const t = tempo(120, 60);

type Ctx = CanvasRenderingContext2D;
type Screen = { width: number; height: number; fps: number; textHidden: boolean };
type Fonts = { sans: string; mono: string };

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const s = clamp((x - a) / (b - a), 0, 1);
  return s * s * (3 - 2 * s);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const easeOut3 = (x: number) => 1 - (1 - x) ** 3;
const easeInOut3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeBack = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
const TAU = Math.PI * 2;

/** The fonts the pictures are set in, read while rendering (the look is themed). */
function useFonts(): Fonts {
  const fonts = { sans: look.font, mono: look.mono };
  useFontsReady([`800 40px ${fonts.sans}`, `500 20px ${fonts.sans}`, `500 20px ${fonts.mono}`]);
  return fonts;
}

/**
 * Draws a line of text and records it for `check`: its box from the font's own
 * ascent and descent, in the picture's units. Leaves the text out while
 * `check` measures what is behind it. Text not meant to be read (a timecode
 * that changes every frame) is drawn with plain `fillText` instead.
 */
function say(ctx: Ctx, out: DeclaredText[], s: Screen, text: string, x: number, y: number, size: number, weight = 400) {
  const m = ctx.measureText(text);
  const left = ctx.textAlign === "center" ? x - m.width / 2 : ctx.textAlign === "right" ? x - m.width : x;
  out.push({
    text,
    x: left,
    y: y - m.actualBoundingBoxAscent,
    width: m.width,
    height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    size,
    weight,
  });
  if (!s.textHidden) ctx.fillText(text, x, y);
}

/** Hours, minutes, seconds and frames at 25 a second, as a broadcast timecode reads. */
function timecode(seconds: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  const s = Math.max(0, seconds);
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(Math.floor(s) % 60)}:${p(Math.floor((s % 1) * 25))}`;
}

// --- Test card ---------------------------------------------------------------------------

/**
 * A test card: 75% colour bars over their castellations, a step wedge,
 * gratings at 12, 6, 4 and 2 picture pixels, one-lit-one-dark lines, a pluge,
 * a circle and a plate with `label` and a running timecode. On the Tube it
 * shows what the set does: gratings soften as the beam spreads, highlights
 * swell between lines. Use as a cold open (the set warms up on it), a "please
 * stand by", or a sting before the first shot.
 */
function testCard(ctx: Ctx, f: number, s: Screen, label: string, fonts: Fonts): DeclaredText[] {
  const out: DeclaredText[] = [];
  const { width: LW, height: LH } = s;
  const top = LH * 0.6;
  const castH = LH * 0.08;
  const bottomY = top + castH;
  const bars = ["#bfbfbf", "#bfbf00", "#00bfbf", "#00bf00", "#bf00bf", "#bf0000", "#0000bf"];
  const cast = ["#0000bf", "#101010", "#bf00bf", "#101010", "#00bfbf", "#101010", "#bfbfbf"];
  const bw = LW / 7;
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = bars[i];
    ctx.fillRect(Math.floor(i * bw), 0, Math.ceil(bw) + 1, top);
    ctx.fillStyle = cast[i];
    ctx.fillRect(Math.floor(i * bw), top, Math.ceil(bw) + 1, castH);
  }
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, bottomY, LW, LH - bottomY);
  const wedgeW = LW * 0.3;
  for (let i = 0; i < 6; i++) {
    const v = Math.round(16 + ((235 - 16) * i) / 5);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.floor((i * wedgeW) / 6), bottomY, Math.ceil(wedgeW / 6) + 1, LH - bottomY);
  }
  // Gratings in the picture's own pixels, not its square units.
  const sx = ctx.getTransform().a;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gx0 = Math.round(LW * 0.32 * sx);
  const gx1 = Math.round(LW * 0.8 * sx);
  const gy0 = Math.round(bottomY);
  const gy1 = Math.ceil(LH);
  const periods = [12, 6, 4, 2];
  const bwp = (gx1 - gx0) / (periods.length + 1);
  ctx.fillStyle = "#dcdcdc";
  periods.forEach((period, b) => {
    const x0 = Math.round(gx0 + b * bwp);
    const x1 = Math.round(gx0 + (b + 1) * bwp) - 2;
    for (let x = x0; x < x1; x += period) ctx.fillRect(x, gy0, Math.min(period / 2, x1 - x), gy1 - gy0);
  });
  const lx = Math.round(gx0 + periods.length * bwp);
  for (let y = gy0; y < gy1; y += 2) ctx.fillRect(lx, y, gx1 - lx, 1);
  ctx.restore();
  const px0 = LW * 0.82;
  const pw = (LW - px0) / 3;
  ["#0a0a0a", "#101010", "#181818"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(px0 + i * pw, bottomY, pw + 1, LH - bottomY);
  });

  const cx = LW / 2;
  const cy = LH * 0.42;
  const r = LH * 0.34;
  ctx.strokeStyle = "#ebebeb";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.moveTo(cx - r * 0.12, cy);
  ctx.lineTo(cx + r * 0.12, cy);
  ctx.moveTo(cx, cy - r * 0.12);
  ctx.lineTo(cx, cy + r * 0.12);
  ctx.stroke();
  const fs = LH * 0.07;
  ctx.font = `800 ${fs}px ${fonts.sans}`;
  ctx.letterSpacing = `${fs * 0.06}px`;
  const plateW = ctx.measureText(label).width + fs * 1.6;
  const plateH = fs * 2.6;
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(cx - plateW / 2, cy + r * 0.14, plateW, plateH);
  ctx.fillStyle = "#ebebeb";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  say(ctx, out, s, label, cx, cy + r * 0.14 + fs * 1.2, fs, 800);
  ctx.letterSpacing = "0px";
  ctx.font = `500 ${fs * 0.6}px ${fonts.mono}`;
  ctx.fillText(timecode(f / s.fps), cx, cy + r * 0.14 + fs * 2.1);
  ctx.textAlign = "left";
  return out;
}

/**
 * The set switching on: black glass, a line that opens into the raster
 * through snow, a degauss a quarter second later, the picture settling.
 * About 1.1 s from `on` to a clean picture.
 */
function PowerOn({ on = 6, label = "NORTHWIND" }: { on?: number; label?: string }) {
  const fonts = useFonts();
  return (
    <Tube
      power={{ on }}
      degauss={[on + 15]}
      draw={(ctx, f, s) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, s.width, s.height);
        return testCard(ctx, f, s, label, fonts);
      }}
    />
  );
}

// --- Station ident -----------------------------------------------------------------------

/**
 * A station ident: a wireframe globe (latitudes, meridians, a tilted ring and
 * a satellite) turning in warm amber, its back half dim, beside a stacked
 * wordmark; a timecode and a blinking "On air" tally as a lower third. Use for
 * a product's name over a "we are live" moment, or a section card.
 */
function Ident({
  lines = ["NORTH", "WIND"],
  sub = "Dashboards for teams",
}: {
  lines?: [string, string];
  sub?: string;
}) {
  const fonts = useFonts();
  return (
    <Tube
      tune={[0]}
      draw={(ctx, f, s) => {
        const out: DeclaredText[] = [];
        const { width: LW, height: LH } = s;
        const sec = f / s.fps;
        ctx.fillStyle = "#05070b";
        ctx.fillRect(0, 0, LW, LH);
        const R = LH * 0.34;
        const cx = LW * 0.72;
        const cy = LH * 0.5;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
        glow.addColorStop(0, "rgba(36,56,140,0.55)");
        glow.addColorStop(1, "rgba(36,56,140,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, LW, LH);

        const ry = sec * 0.32;
        const rx = -0.38;
        const [cry, sry, crx, srx] = [Math.cos(ry), Math.sin(ry), Math.cos(rx), Math.sin(rx)];
        const proj = (x: number, y: number, z: number) => {
          const x1 = x * cry + z * sry;
          const z1 = -x * sry + z * cry;
          return [cx + x1 * R, cy - (y * crx - z1 * srx) * R, y * srx + z1 * crx] as const;
        };
        const front = new Path2D();
        const back = new Path2D();
        const seg = (a: readonly number[], b: readonly number[]) => {
          const path = a[2] + b[2] > 0 ? front : back;
          path.moveTo(a[0], a[1]);
          path.lineTo(b[0], b[1]);
        };
        const curve = (n: number, at: (u: number) => readonly number[]) => {
          let prev = at(0);
          for (let i = 1; i <= n; i++) {
            const q = at(i / n);
            seg(prev, q);
            prev = q;
          }
        };
        for (let la = -75; la <= 75; la += 15) {
          const lat = (la * Math.PI) / 180;
          curve(48, (u) => proj(Math.cos(lat) * Math.sin(u * TAU), Math.sin(lat), Math.cos(lat) * Math.cos(u * TAU)));
        }
        for (let m = 0; m < 9; m++) {
          const lon = (m / 9) * Math.PI;
          curve(40, (u) =>
            proj(Math.cos(u * TAU) * Math.sin(lon), Math.sin(u * TAU), Math.cos(u * TAU) * Math.cos(lon)),
          );
        }
        const tilt = 0.45;
        const ring = (a: number) =>
          proj(Math.cos(a) * 1.42, -Math.sin(a) * 1.42 * Math.sin(tilt), Math.sin(a) * 1.42 * Math.cos(tilt));
        curve(64, (u) => ring(u * TAU));
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = "rgba(255,165,90,0.22)";
        ctx.stroke(back);
        ctx.strokeStyle = "#ffc484";
        ctx.stroke(front);
        const sat = ring(sec * 1.1);
        ctx.fillStyle = sat[2] > 0 ? "#fffff5" : "rgba(255,220,180,0.35)";
        ctx.beginPath();
        ctx.arc(sat[0], sat[1], 2.2, 0, TAU);
        ctx.fill();

        // The wordmark, sized to fit left of the globe.
        let fs = LH * 0.17;
        ctx.font = `800 ${fs}px ${fonts.sans}`;
        const maxW = LW * 0.72 - R * 1.45 - LW * 0.12;
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (widest > maxW) fs *= maxW / widest;
        ctx.font = `800 ${fs}px ${fonts.sans}`;
        ctx.letterSpacing = `${-fs * 0.02}px`;
        const x = LW * 0.08;
        const y1 = LH * 0.44;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f4efe4";
        say(ctx, out, s, lines[0], x, y1, fs, 800);
        say(ctx, out, s, lines[1], x, y1 + fs * 0.92, fs, 800);
        ctx.letterSpacing = "0px";
        const subSize = fs * 0.24;
        ctx.font = `500 ${subSize}px ${fonts.sans}`;
        ctx.fillStyle = "#98a8d0";
        say(ctx, out, s, sub, x + fs * 0.04, y1 + fs * 0.92 + fs * 0.52, subSize, 500);

        const small = LH * 0.042;
        ctx.font = `500 ${small}px ${fonts.mono}`;
        ctx.fillStyle = "#c4cad6";
        ctx.fillText(timecode(sec), LW * 0.08, LH * 0.9);
        ctx.textAlign = "right";
        say(ctx, out, s, "On air", LW * 0.92, LH * 0.9, small, 500);
        const w = ctx.measureText("On air").width;
        ctx.fillStyle = Math.sin(sec * 3.2) > -0.2 ? "#ff463c" : "#5a1816";
        ctx.beginPath();
        ctx.arc(LW * 0.92 - w - small * 0.6, LH * 0.9 - small * 0.35, small * 0.28, 0, TAU);
        ctx.fill();
        ctx.textAlign = "left";
        return out;
      }}
    />
  );
}

// --- Teletext ----------------------------------------------------------------------------

type TeletextItem = { tag: string; title: string; line: string };

const CHANGES: TeletextItem[] = [
  { tag: "2.0", title: "Live dashboards", line: "Numbers update as they happen" },
  { tag: "2.0", title: "Shared views", line: "One link for the whole team" },
  { tag: "1.9", title: "Alerts", line: "Know when a number moves" },
  { tag: "1.8", title: "CSV import", line: "Bring last year with you" },
];

/**
 * A teletext page, 40 × 25 cells in the seven teletext colours: header row
 * with page number and clock, a double-height title on blue, a rainbow bar
 * that cycles, four items, a flashing NEW and the coloured link row. A
 * changelog, a schedule or a feature list told as a page of text, readable
 * because every line is a cell row (34 px at 1080).
 */
function Teletext({
  title = "NORTHWIND",
  items = CHANGES,
  clock = 9 * 3600 + 41 * 60,
}: {
  title?: string;
  items?: TeletextItem[];
  /** The page clock at the shot's first frame, in seconds after midnight. */
  clock?: number;
}) {
  const fonts = useFonts();
  return (
    <Tube
      tune={[0]}
      draw={(ctx, f, s) => {
        const out: DeclaredText[] = [];
        const { width: LW, height: LH } = s;
        const sec = f / s.fps;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, LW, LH);
        const pw = Math.min(LW * 0.94, LH * 1.25);
        const ph = LH * 0.8;
        const ox = (LW - pw) / 2;
        const oy = LH * 0.13;
        const cw = pw / 40;
        const rh = ph / 25;
        ctx.font = `500 ${rh * 0.92}px ${fonts.mono}`;
        const sx = cw / ctx.measureText("M").width;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        const C = { w: "#fff", y: "#ff0", c: "#0ff", g: "#0f0", r: "#f00", m: "#f0f", b: "#00f" } as const;
        const put = (
          col: number,
          row: number,
          text: string,
          fg: keyof typeof C,
          bg?: keyof typeof C,
          tall = false,
          read = true,
        ) => {
          const x = ox + col * cw;
          const y = oy + row * rh;
          const h = rh * (tall ? 2 : 1);
          if (bg) {
            ctx.fillStyle = C[bg];
            ctx.fillRect(x, y, text.length * cw, h);
          }
          if (read && text.trim())
            out.push({
              text: text.trim(),
              x,
              y: y + h * 0.1,
              width: text.trimEnd().length * cw,
              height: h * 0.8,
              size: h * 0.92,
            });
          if (s.textHidden && read) return;
          ctx.save();
          ctx.translate(x, y + h * 0.8);
          ctx.scale(sx, tall ? 2 : 1);
          ctx.fillStyle = C[fg];
          ctx.fillText(text, 0, 0);
          ctx.restore();
        };
        const now = clock + Math.floor(sec);
        const p = (n: number) => String(n).padStart(2, "0");
        put(0, 0, " P100  NW TEXT  100  Tue 21 Oct", "w", undefined, false, false);
        put(
          32,
          0,
          `${p(Math.floor(now / 3600) % 24)}:${p(Math.floor(now / 60) % 60)}:${p(now % 60)}`,
          "y",
          undefined,
          false,
          false,
        );
        put(0, 1, ` ${title}`.padEnd(40), "y", "b", true);
        const hues = ["r", "y", "g", "c", "b", "m"] as const;
        const shift = Math.floor(sec * 6);
        for (let c = 0; c < 40; c++) {
          ctx.fillStyle = C[hues[(c + shift) % 6]];
          ctx.fillRect(ox + c * cw + cw * 0.1, oy + 3 * rh + rh * 0.25, cw * 0.8, rh * 0.5);
        }
        put(1, 5, "WHAT'S NEW", "c");
        items.slice(0, 4).forEach((it, i) => {
          const r = 7 + i * 3;
          put(1, r, it.tag, "y");
          put(7, r, it.title, "w");
          put(7, r + 1, it.line, "c");
        });
        const leader = (label: string, page: string) =>
          `${label} ${".".repeat(Math.max(1, 33 - label.length))} ${page}`;
        put(1, 19, leader("All changes", "200"), "w");
        put(1, 20, leader("Try it free", "300"), "w");
        if (Math.floor(sec * 1.5) % 2 === 0) put(1, 22, "NEW", "r", undefined, false, false);
        put(5, 22, "Version 2.0 out today", "w");
        put(0, 24, " News", "r", undefined, false, false);
        put(10, 24, " Docs", "g", undefined, false, false);
        put(20, 24, " Pricing", "y", undefined, false, false);
        put(30, 24, " Index", "c", undefined, false, false);
        return out;
      }}
    />
  );
}

// --- Scope -------------------------------------------------------------------------------

/**
 * A vector scope: a green Lissajous figure (3 : 2, its phase drifting) over a
 * graticule, on long-persistence phosphor. Each frame draws only the stretch
 * of trace the beam covered since the last one; the phosphor makes the tail.
 * For a signal, audio, a voice, a heartbeat of data.
 */
function Scope({ labels = ["X:Y  3:2", "0.5 V/div"] }: { labels?: [string, string] }) {
  const fonts = useFonts();
  return (
    <Tube
      tune={[0]}
      phosphor="long"
      draw={(ctx, f, s) => {
        const out: DeclaredText[] = [];
        const { width: LW, height: LH } = s;
        const sec = f / s.fps;
        ctx.fillStyle = "#030604";
        ctx.fillRect(0, 0, LW, LH);
        const gw = Math.min(LW * 0.86, LH * 1.2);
        // The graticule leaves room under it for the labels, inside the safe margin.
        const gh = Math.min(gw * 0.8, LH * 0.7);
        const gx = (LW - gw) / 2;
        const gy = LH * 0.09;
        ctx.strokeStyle = "rgba(70,150,110,0.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          ctx.moveTo(gx + (gw * i) / 10, gy);
          ctx.lineTo(gx + (gw * i) / 10, gy + gh);
        }
        for (let j = 0; j <= 8; j++) {
          ctx.moveTo(gx, gy + (gh * j) / 8);
          ctx.lineTo(gx + gw, gy + (gh * j) / 8);
        }
        for (let k = 0; k <= 50; k++) {
          ctx.moveTo(gx + (gw * k) / 50, gy + gh / 2 - 3);
          ctx.lineTo(gx + (gw * k) / 50, gy + gh / 2 + 3);
        }
        for (let k = 0; k <= 40; k++) {
          ctx.moveTo(gx + gw / 2 - 3, gy + (gh * k) / 40);
          ctx.lineTo(gx + gw / 2 + 3, gy + (gh * k) / 40);
        }
        ctx.stroke();

        const ph = sec * 0.23;
        const at = (u: number) =>
          [
            gx + gw / 2 + Math.sin(3 * u + ph) * gw * 0.4,
            gy + gh / 2 + Math.sin(2 * u) * gh * 0.4 * (0.9 + 0.1 * Math.sin(sec * 0.7)),
          ] as const;
        const speed = TAU * 0.95;
        const u1 = sec * speed;
        const u0 = u1 - speed / s.fps;
        const n = Math.max(2, Math.ceil((u1 - u0) / 0.012));
        ctx.strokeStyle = "#96ffb6";
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const q = at(u0 + ((u1 - u0) * i) / n);
          if (i) ctx.lineTo(q[0], q[1]);
          else ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();

        const size = LH * 0.042;
        ctx.font = `500 ${size}px ${fonts.mono}`;
        ctx.fillStyle = "rgba(120,220,150,0.85)";
        say(ctx, out, s, labels[0], gx, gy + gh + LH * 0.065, size, 500);
        ctx.textAlign = "right";
        say(ctx, out, s, labels[1], gx + gw, gy + gh + LH * 0.065, size, 500);
        ctx.textAlign = "left";
        return out;
      }}
    />
  );
}

// --- Station clock -----------------------------------------------------------------------

/**
 * A station clock counting down to a launch: sixty dots round the face, the
 * seconds filling them amber, three hands, the time large beside it and the
 * date; the line under it turns from "Next" to "Now" when the clock reaches
 * `live`. The clock is the shot's frame, never the machine's: `start` is the
 * time at its first frame.
 */
function StationClock({
  start = 8 * 3600 + 59 * 60 + 55,
  live = 9 * 3600,
  show = "Northwind 2.0",
  date = "Tuesday 21 October",
}: {
  /** Seconds after midnight at the shot's first frame. */
  start?: number;
  /** Seconds after midnight when the show goes live. */
  live?: number;
  show?: string;
  date?: string;
}) {
  const fonts = useFonts();
  return (
    <Tube
      tune={[0]}
      draw={(ctx, f, s) => {
        const out: DeclaredText[] = [];
        const { width: LW, height: LH } = s;
        const time = start + f / s.fps;
        const bg = ctx.createLinearGradient(0, 0, 0, LH);
        bg.addColorStop(0, "#060e28");
        bg.addColorStop(1, "#020510");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, LW, LH);
        const R = LH * 0.36;
        const cx = LW * 0.3;
        const cy = LH * 0.5;
        // The second hand steps once a second, as a station clock's does.
        const secs = Math.floor(time) % 60;
        const min = (Math.floor(time / 60) % 60) + secs / 60;
        const hr = (Math.floor(time / 3600) % 12) + min / 60;
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * TAU;
          const big = i % 5 === 0;
          ctx.fillStyle = !big && i <= secs ? "#ffb848" : "#eceef5";
          ctx.beginPath();
          ctx.arc(cx + Math.sin(a) * R * 0.9, cy - Math.cos(a) * R * 0.9, big ? R * 0.05 : R * 0.02, 0, TAU);
          ctx.fill();
        }
        const hand = (ang: number, len: number, w: number, col: string, tail: number) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx - Math.sin(ang) * tail, cy + Math.cos(ang) * tail);
          ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len);
          ctx.stroke();
        };
        hand((hr / 12) * TAU, R * 0.5, R * 0.07, "#eceef5", 0);
        hand((min / 60) * TAU, R * 0.74, R * 0.05, "#eceef5", 0);
        hand((secs / 60) * TAU, R * 0.8, Math.max(1.2, R * 0.016), "#ffb848", R * 0.16);
        ctx.fillStyle = "#ffb848";
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.04, 0, TAU);
        ctx.fill();

        const p = (n: number) => String(n).padStart(2, "0");
        const hhmm = `${p(Math.floor(time / 3600) % 24)}:${p(Math.floor(time / 60) % 60)}`;
        const fs = LH * 0.2;
        const tx = LW * 0.58;
        const ty = LH * 0.5;
        ctx.font = `800 ${fs}px ${fonts.sans}`;
        ctx.textAlign = "left";
        ctx.fillStyle = "#f4efe4";
        say(ctx, out, s, hhmm, tx, ty, fs, 800);
        const small = fs * 0.2;
        ctx.font = `500 ${small}px ${fonts.sans}`;
        ctx.fillStyle = "#98a8d0";
        say(ctx, out, s, date, tx, ty + fs * 0.42, small, 500);
        ctx.font = `700 ${small}px ${fonts.sans}`;
        ctx.fillStyle = "#ffb848";
        say(ctx, out, s, `${time >= live ? "Now" : "Next"}: ${show}`, tx, ty + fs * 0.74, small, 700);
        return out;
      }}
    />
  );
}

// --- 80s home-video intro ----------------------------------------------------------------

/** A made-up mark: a four-pointed compass star, the north point long, in a 137 × 137 box. */
const MARK = new Path2D("M68.5 0 L82 55 L137 68.5 L82 82 L68.5 137 L55 82 L0 68.5 L55 55 Z");

/**
 * A home-video intro from the 80s, on tape: PLAY in the corner, a laser grid
 * running to a glowing horizon, the mark flying in from the vanishing point
 * (spinning on its axis, with a short trail) to the middle, a white flash, then
 * it moves aside as the chrome wordmark's letters rise in one by one (each
 * 0.55 s on a back ease, 0.06 s apart). A light sweep runs over the word every
 * 4.5 s; the tagline types in mono with a block caret.
 * Times are in seconds, as the intro was cut; a logo reveal that should feel
 * like a VHS tape's opening.
 */
function ChromeIntro({
  word = "northwind",
  tagline = "Dashboards for the whole team",
  credit = "© 1987 Northwind Home Video",
}: {
  word?: string;
  tagline?: string;
  credit?: string;
}) {
  const fonts = useFonts();
  const sec = useFrame() / useVideoInfo().fps;
  // The tape's first frames are snow, clearing as the picture locks.
  const snow = sec < 0.8 ? 0.85 * (1 - smooth(0.2, 0.75, sec)) : 0;
  const stars = random("chrome-stars");
  const sky = Array.from({ length: 90 }, () => [stars(), stars(), stars() * TAU]);
  return (
    <Tube
      tape={1}
      phosphor="slow"
      snow={snow}
      draw={(ctx, f, s) => {
        const out: DeclaredText[] = [];
        const { width: LW, height: LH } = s;
        const ti = f / s.fps;
        const hz = LH * 0.66;
        const vpX = LW / 2;
        const depth = LH - hz;

        const skyFill = ctx.createLinearGradient(0, 0, 0, hz);
        skyFill.addColorStop(0, "#0a0a0e");
        skyFill.addColorStop(0.7, "#18181c");
        skyFill.addColorStop(1, "#341e3e");
        ctx.fillStyle = skyFill;
        ctx.fillRect(0, 0, LW, hz);
        ctx.fillStyle = "#08060c";
        ctx.fillRect(0, hz, LW, LH - hz);
        for (const [x, y, ph] of sky) {
          ctx.fillStyle = `rgba(250,250,250,${(0.45 + 0.35 * Math.sin(ti * 1.7 + ph)).toFixed(3)})`;
          ctx.fillRect(x * LW, y * hz * 0.85, 1, 1);
        }
        const glow = ctx.createLinearGradient(0, hz - LH * 0.22, 0, hz + LH * 0.03);
        glow.addColorStop(0, "rgba(247,174,248,0)");
        glow.addColorStop(0.8, "rgba(247,174,248,0.28)");
        glow.addColorStop(0.97, "rgba(255,244,197,0.55)");
        glow.addColorStop(1, "rgba(173,232,245,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, hz - LH * 0.22, LW, LH * 0.25);
        ctx.fillStyle = "#fff4c5";
        ctx.fillRect(0, hz - 0.5, LW, 1.2);

        // The laser grid: rays from the vanishing point, lines coming forward in perspective.
        const gridFill = ctx.createLinearGradient(0, hz, 0, LH);
        gridFill.addColorStop(0, "rgba(247,174,248,0)");
        gridFill.addColorStop(0.35, "rgba(247,174,248,0.55)");
        gridFill.addColorStop(1, "rgba(247,174,248,1)");
        const grid = new Path2D();
        for (let i = -26; i <= 26; i++) {
          grid.moveTo(vpX, hz);
          grid.lineTo(vpX + i * LH * 0.32, LH + 2);
        }
        const phase = (ti * 0.9) % 1;
        for (let k = 0; k < 40; k++) {
          const d = 1 + k - phase;
          if (d < 0.6) continue;
          const y = hz + depth / d;
          if (y > LH + 2) continue;
          grid.moveTo(0, y);
          grid.lineTo(LW, y);
        }
        ctx.strokeStyle = gridFill;
        ctx.lineWidth = 1.1;
        ctx.stroke(grid);

        // The wordmark and the mark after it, one lockup filling 62% of the width.
        const logoW = Math.min(LW * 0.62, LH * 2);
        ctx.font = `800 100px ${fonts.sans}`;
        ctx.letterSpacing = "-3px";
        const wordW100 = ctx.measureText(word).width;
        const markRel = 0.82;
        const fs = (logoW / (wordW100 / 100 + markRel * 0.95)) * 1;
        const markSize = fs * markRel;
        const wordW = (wordW100 / 100) * fs;
        const X0 = LW / 2 - logoW / 2;
        const baseY = LH * 0.42 + fs * 0.25;
        const slotX = X0 + wordW + markSize * 0.15 + markSize / 2;
        const slotY = baseY - fs * 0.62;
        const cX = LW / 2;
        const cY = LH * 0.42;
        const bigSize = LH * 0.46;
        const markAt = (tt: number) => {
          if (tt < 1.3) return null;
          if (tt < 3.2) {
            const u = easeOut3((tt - 1.3) / 1.9);
            return [
              lerp(vpX, cX, u),
              lerp(hz, cY, u),
              lerp(LH * 0.015, bigSize, u),
              Math.cos((1 - u) * Math.PI * 5),
              Math.min(1, (tt - 1.3) / 0.3),
            ];
          }
          if (tt < 3.45) return [cX, cY, bigSize, 1, 1];
          if (tt < 4.35) {
            const v = easeInOut3((tt - 3.45) / 0.9);
            return [lerp(cX, slotX, v), lerp(cY, slotY, v), lerp(bigSize, markSize, v), 1, 1];
          }
          return [slotX, slotY, markSize, 1, 1];
        };
        const markFill = ctx.createLinearGradient(0, 0, 137, 137);
        markFill.addColorStop(0, "#74e6ff");
        markFill.addColorStop(0.59, "#fe9eff");
        markFill.addColorStop(1, "#ffdc74");
        // x, y, size, spin (the mark's width as a cosine, for turning on its axis), opacity.
        const drawMark = (m: number[] | null, alpha: number) => {
          if (!m || alpha <= 0) return;
          const [x, y, size, spin] = m;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x, y);
          ctx.scale((size / 137) * (Math.abs(spin) < 0.02 ? 0.02 : spin), size / 137);
          ctx.translate(-68.5, -68.5);
          ctx.fillStyle = markFill;
          ctx.fill(MARK);
          ctx.restore();
        };
        if (ti < 3.3)
          for (let k = 4; k >= 1; k--) {
            const m = markAt(ti - k * 0.045);
            if (m) drawMark(m, m[4] * 0.16 * ((5 - k) / 4));
          }

        // Chrome letters, extruded: seven copies stepping down and right, then the face.
        ctx.font = `800 ${fs}px ${fonts.sans}`;
        ctx.letterSpacing = `${-fs * 0.03}px`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        const chrome = ctx.createLinearGradient(0, baseY - fs * 0.75, 0, baseY + fs * 0.05);
        chrome.addColorStop(0, "#ffffff");
        chrome.addColorStop(0.42, "#ade8f5");
        chrome.addColorStop(0.5, "#33244a");
        chrome.addColorStop(0.55, "#f7aef8");
        chrome.addColorStop(1, "#fff4c5");
        const letters = [...word];
        const lettersIn = clamp((ti - (3.85 + (letters.length - 1) * 0.06)) / 0.55, 0, 1) >= 1;
        letters.forEach((ch, i) => {
          const p = clamp((ti - (3.85 + i * 0.06)) / 0.55, 0, 1);
          if (p <= 0) return;
          const x = X0 + ctx.measureText(word.slice(0, i)).width;
          const y = baseY + (1 - easeBack(p)) * fs * 0.45;
          ctx.globalAlpha = clamp(p * 2.5, 0, 1);
          for (let d = 7; d >= 1; d--) {
            ctx.fillStyle = d > 3 ? "#28163a" : "#603874";
            ctx.fillText(ch, x + d * fs * 0.004, y + d * fs * 0.006);
          }
          ctx.fillStyle = chrome;
          ctx.fillText(ch, x, y);
          ctx.globalAlpha = 1;
        });
        if (lettersIn)
          out.push({ text: word, x: X0, y: baseY - fs * 0.74, width: wordW, height: fs * 0.76, size: fs, weight: 800 });
        drawMark(markAt(ti), markAt(ti)?.[4] ?? 0);

        // A light sweep across the finished word, every 4.5 s: the word drawn again, lit only in a band.
        if (ti > 5) {
          const sp = ((ti - 5) % 4.5) / 0.9;
          if (sp < 1) {
            const bx = X0 - fs * 0.6 + sp * (wordW + fs * 1.2);
            const band = ctx.createLinearGradient(bx - fs * 0.25, 0, bx + fs * 0.25, 0);
            band.addColorStop(0, "rgba(255,255,255,0)");
            band.addColorStop(0.5, "rgba(255,255,255,0.85)");
            band.addColorStop(1, "rgba(255,255,255,0)");
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = band;
            ctx.fillText(word, X0, baseY);
            ctx.restore();
          }
        }
        ctx.letterSpacing = "0px";

        // The flash as the mark arrives, and a glint on its long point.
        const glint = (x: number, y: number, r: number, a: number, rot: number) => {
          if (a <= 0 || r <= 0) return;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(1, a);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5);
          g.addColorStop(0, "rgba(255,255,255,0.9)");
          g.addColorStop(0.3, "rgba(254,158,255,0.35)");
          g.addColorStop(1, "rgba(116,230,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 0.5, y - r * 0.5, r, r);
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.lineTo(0, -r * 0.045);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r * 0.045);
          ctx.closePath();
          ctx.moveTo(0, -r * 0.7);
          ctx.lineTo(r * 0.04, 0);
          ctx.lineTo(0, r * 0.7);
          ctx.lineTo(-r * 0.04, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };
        if (ti > 3 && ti < 3.75) {
          const g = 1 - Math.abs(ti - 3.3) / 0.45;
          glint(cX, cY, bigSize * 1.1 * g, g, ti * 0.6);
        }
        if (ti > 6.2) {
          const gp = (ti - 6.2) % 4.5;
          if (gp < 0.7) {
            const g = Math.sin((gp / 0.7) * Math.PI);
            glint(slotX, slotY - markSize * 0.42, markSize * 0.9 * g, g, gp);
          }
        }
        if (ti > 3.2 && ti < 3.45) {
          ctx.fillStyle = `rgba(255,255,255,${(0.35 * (1 - (ti - 3.2) / 0.25)).toFixed(3)})`;
          ctx.fillRect(0, 0, LW, LH);
        }

        // The tagline types in at 26 characters a second, then the credit fades up.
        if (ti > 5) {
          const n = Math.min(tagline.length, Math.floor((ti - 5) * 26));
          const size = LH * 0.045;
          ctx.font = `500 ${size}px ${fonts.mono}`;
          const full = ctx.measureText(tagline).width;
          const shown = tagline.slice(0, n);
          const tx = LW / 2 - full / 2;
          const ty = baseY + LH * 0.13;
          ctx.fillStyle = "#ade8f5";
          if (n === tagline.length) say(ctx, out, s, tagline, tx, ty, size, 500);
          else ctx.fillText(shown, tx, ty);
          if (n < tagline.length || Math.floor(ti * 2) % 2 === 0)
            ctx.fillRect(tx + ctx.measureText(shown).width + size * 0.1, ty - size * 0.78, size * 0.55, size * 0.95);
        }
        if (ti > 6) {
          const size = LH * 0.03;
          ctx.font = `500 ${size}px ${fonts.mono}`;
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(250,250,250,${(smooth(6, 7, ti) * 0.6).toFixed(3)})`;
          ctx.fillText(credit, LW / 2, LH * 0.93);
          ctx.textAlign = "left";
        }

        const fadeIn = smooth(0.5, 1.6, ti);
        if (fadeIn < 1) {
          ctx.fillStyle = `rgba(0,0,0,${(1 - fadeIn).toFixed(3)})`;
          ctx.fillRect(0, 0, LW, LH);
        }
        // The VCR's on-screen display, white with a hard black shadow.
        if (ti > 0.15 && ti < 3.2) {
          const size = LH * 0.06;
          const ox = LW * 0.08;
          const oy = LH * 0.22;
          ctx.font = `500 ${size}px ${fonts.mono}`;
          const w = ctx.measureText("PLAY").width;
          const tri = (dx: number, dy: number) => {
            ctx.beginPath();
            ctx.moveTo(ox + w + size * 0.4 + dx, oy - size * 0.72 + dy);
            ctx.lineTo(ox + w + size * 1.05 + dx, oy - size * 0.38 + dy);
            ctx.lineTo(ox + w + size * 0.4 + dx, oy - size * 0.04 + dy);
            ctx.closePath();
            ctx.fill();
          };
          ctx.fillStyle = "#000";
          ctx.fillText("PLAY", ox + 1.5, oy + 1.5);
          tri(1.5, 1.5);
          ctx.fillStyle = "#f5f5f5";
          ctx.fillText("PLAY", ox, oy);
          tri(0, 0);
        }
        return out;
      }}
    />
  );
}

// --- Starfield, channel change, power off ------------------------------------------------

/**
 * Stars streaking out of the centre on `trails` phosphor; a channel change
 * into snow at `tune`; the set switched off at `off`: the raster collapses to
 * a line in 0.22 s, the line to a dot, and the dot fades by 0.8 s. Every star
 * is a function of the frame: its own seeded place, coming forward over a
 * cycle, a new place each time round. An ending, or a cut between chapters.
 */
function Surf({ tune = 120, off = 210 }: { tune?: number; off?: number }) {
  const count = 520;
  const frame = useFrame();
  return (
    <Tube
      phosphor="trails"
      tune={[0, tune]}
      power={{ off }}
      snow={frame >= tune ? 0.88 : 0}
      draw={(ctx, f, s) => {
        const { width: LW, height: LH } = s;
        ctx.fillStyle = f >= tune ? "#000" : "#020306";
        ctx.fillRect(0, 0, LW, LH);
        if (f >= tune) return [];
        const sec = f / s.fps;
        const cx = LW / 2;
        const cy = LH / 2;
        const focal = LH * 0.55;
        const speed = 0.32;
        const cols = ["rgba(150,160,200,0.35)", "rgba(190,200,230,0.6)", "#dce4ff", "#fffaf0"];
        const widths = [0.8, 1, 1.4, 2];
        const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const star = (i: number, cycle: number) => {
          const r = random(i * 7919 + cycle * 104729);
          return [(r() * 2 - 1) * 1.6, r() * 2 - 1] as const;
        };
        const z = (phase: number, time: number) => {
          const u = phase + (time * speed) / 0.98;
          return { cycle: Math.floor(u), z: 1 - (u - Math.floor(u)) * 0.98 };
        };
        for (let i = 0; i < count; i++) {
          const phase = random(i + 1)();
          const now = z(phase, sec);
          const then = z(phase, sec - 1 / s.fps);
          if (now.cycle !== then.cycle) continue;
          const [x, y] = star(i, now.cycle);
          const x1 = cx + (x / now.z) * focal;
          const y1 = cy + (y / now.z) * focal;
          if (x1 < -10 || x1 > LW + 10 || y1 < -10 || y1 > LH + 10) continue;
          const b = Math.min(3, Math.floor((1 - now.z) * 4));
          buckets[b].moveTo(cx + (x / then.z) * focal, cy + (y / then.z) * focal);
          buckets[b].lineTo(x1 + 0.01, y1);
        }
        ctx.lineCap = "round";
        buckets.forEach((path, i) => {
          ctx.strokeStyle = cols[i];
          ctx.lineWidth = widths[i];
          ctx.stroke(path);
        });
        return [];
      }}
    />
  );
}

export default defineVideo({
  id: "example-broadcast",
  title: "Broadcast and analogue patterns",
  logline:
    "Test cards, idents, teletext, a scope, a station clock and an 80s tape intro, drawn in Canvas 2D on a modelled tube.",
  bpm: t.bpm,
  background: "#000000",
  shots: [
    {
      id: "power-on",
      title: "Power on",
      duration: t.beats(8),
      component: () => <PowerOn />,
      moments: { on: 6 },
    },
    { id: "ident", title: "Station ident", duration: t.beats(10), component: () => <Ident /> },
    { id: "teletext", title: "Teletext page", duration: t.beats(12), component: () => <Teletext /> },
    { id: "scope", title: "Vector scope", duration: t.beats(8), component: () => <Scope /> },
    {
      id: "clock",
      title: "Station clock",
      duration: t.beats(14),
      component: () => <StationClock />,
      moments: { live: 300 },
    },
    {
      id: "chrome",
      title: "80s tape intro",
      duration: t.beats(18),
      component: () => <ChromeIntro />,
      moments: { flash: 198, letters: 231, tagline: 300 },
    },
    {
      id: "surf",
      title: "Starfield, snow, off",
      duration: t.beats(10),
      component: () => <Surf />,
      moments: { tune: 120, off: 210 },
    },
  ],
});
