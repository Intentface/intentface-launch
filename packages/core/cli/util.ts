import { mkdirSync } from "node:fs";
import { setPriority } from "node:os";
import { join } from "node:path";
import { project } from "./project.js";

/** The launch folder (holds launch.config.ts and videos/). Read it inside functions, after loadProject(). */
export const root = () => project().root;

export function outDir(videoId: string, ...sub: string[]) {
  const dir = join(root(), "videos", videoId, "out", ...sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A URL the page used ("http://localhost:4400/videos/x/audio/a.mp3") → file in the launch folder. */
export function assetPath(src: string) {
  const path = decodeURIComponent(new URL(src, "http://x").pathname);
  return join(root(), path);
}

/**
 * Long batch work (render, check) at a lower CPU priority, which the browsers and encoders it
 * starts inherit: on an idle machine it runs as fast, and the desktop and the person's own
 * browser are served first when they need the cores.
 */
export function yieldToDesktop() {
  try {
    setPriority(10);
  } catch {
    // Not allowed here (a container): run at normal priority.
  }
}

export function timer() {
  const start = performance.now();
  return () => {
    const s = (performance.now() - start) / 1000;
    return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
  };
}

// The Launch mark's burner gradient, tail to nozzle: yellow, pink, cyan.
const FLAME: [number, number, number][] = [
  [0xff, 0xef, 0xa9],
  [0xfe, 0x9e, 0xff],
  [0x7c, 0xe7, 0xff],
];
const FLAME_256 = [229, 219, 117];

function flameColor(t: number, text: string) {
  if (process.env.NO_COLOR || !process.stdout.hasColors?.()) return text;
  if (!process.stdout.hasColors(2 ** 24))
    return `\x1b[38;5;${FLAME_256[Math.min(2, Math.floor(t * 3))]}m${text}\x1b[39m`;
  const s = Math.min(1, t) * (FLAME.length - 1);
  const i = Math.min(FLAME.length - 2, Math.floor(s));
  const [r, g, b] = FLAME[i].map((c, k) => Math.round(c + (FLAME[i + 1][k] - c) * (s - i)));
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

/**
 * A progress bar for the terminal: a rocket whose exhaust is the bar, in the
 * mark's colours, the flame flickering at the nozzle from `tick` to `tick`.
 *   ████████████▓▒░═▷ ·  ·  ·  ·  ·   42%
 */
export function rocketBar(fraction: number, tick: number, width = 32) {
  const cells = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  const nozzle = ["▓▒░", "█▓▒", "▓▓░", "█▒░"][tick % 4];
  let bar = "";
  for (let i = 0; i < cells; i++) {
    const fromNozzle = cells - 1 - i;
    const glyph = fromNozzle < 3 ? nozzle[2 - fromNozzle] : "█";
    bar += flameColor(i / Math.max(1, width - 1), glyph);
  }
  const sky = Array.from({ length: width - cells }, (_, i) => ((i + cells + tick) % 3 === 0 ? "·" : " ")).join("");
  return `${bar}═╪▶${dim(sky)} ${String(Math.floor(fraction * 100)).padStart(3)}%`;
}

const dim = (s: string) => (process.env.NO_COLOR || !process.stdout.hasColors?.() ? s : `\x1b[2m${s}\x1b[22m`);

/** Minimal flag parser: --key value, --flag, --no-flag, positionals. */
export function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--no-")) flags[arg.slice(5)] = false;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      const next = argv[i + 1];
      if (inline !== undefined) flags[key] = inline;
      else if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(arg);
  }
  const num = (key: string) => (flags[key] === undefined ? undefined : Number(flags[key]));
  const str = (key: string) => (typeof flags[key] === "string" ? (flags[key] as string) : undefined);
  return { positional, flags, num, str };
}
