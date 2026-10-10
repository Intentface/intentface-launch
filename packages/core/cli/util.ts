import { mkdirSync } from "node:fs";
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

export function timer() {
  const start = performance.now();
  return () => {
    const s = (performance.now() - start) / 1000;
    return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
  };
}

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
