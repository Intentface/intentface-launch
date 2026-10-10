import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { Plugin } from "vite";
import { run } from "./ffmpeg.js";

type Extracted = { dir: string; fps: number; frames: number; width: number; height: number };

/** Where extracted frames live: the nearest node_modules/.cache, as other tools do. */
function cacheDir(root: string) {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules"))) return join(dir, "node_modules", ".cache", "intentface-launch", "clips");
    if (dirname(dir) === dir) return join(root, ".cache", "clips");
  }
}

function probe(file: string) {
  const out = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,width,height", "-of", "json", file],
    { encoding: "utf8" },
  );
  const stream = JSON.parse(out.stdout || "{}").streams?.[0];
  if (!stream) throw new Error(`${file}: no video stream (is ffmpeg installed?)`);
  const [n, d] = String(stream.r_frame_rate).split("/").map(Number);
  return { fps: n / (d || 1), width: stream.width as number, height: stream.height as number };
}

const working = new Map<string, Promise<Extracted>>();

/**
 * Every frame of `file` as a JPEG, extracted once per version of the file (its
 * size and modification time are in the key), so a re-rendered sting is picked
 * up and a stale copy never plays.
 */
export function extract(root: string, file: string): Promise<Extracted> {
  const stat = statSync(file);
  const key = createHash("sha1").update(`${file}:${stat.size}:${stat.mtimeMs}`).digest("hex").slice(0, 16);
  const dir = join(cacheDir(root), key);
  const known = working.get(dir);
  if (known) return known;
  const job = (async () => {
    const meta = join(dir, "clip.json");
    if (existsSync(meta)) return { dir, ...JSON.parse(readFileSync(meta, "utf8")) } as Extracted;
    const info = probe(file);
    const temp = `${dir}.part-${process.pid}`;
    rmSync(temp, { recursive: true, force: true });
    mkdirSync(temp, { recursive: true });
    console.log(`  clip: extracting frames from ${relative(root, file)}`);
    // Every decoded frame, numbered from 0; colour tags on the source decide the matrix.
    await run(["-i", file, "-fps_mode", "passthrough", "-q:v", "2", "-start_number", "0", join(temp, "%06d.jpg")]);
    const frames = readdirSync(temp).filter((f) => f.endsWith(".jpg")).length;
    writeFileSync(join(temp, "clip.json"), JSON.stringify({ ...info, frames }));
    rmSync(dir, { recursive: true, force: true });
    renameSync(temp, dir);
    return { dir, ...info, frames };
  })();
  working.set(dir, job);
  job.catch(() => working.delete(dir));
  return job;
}

/**
 * `/__launch/clip?src=/videos/x/out/x.mp4&t=1.25`: the frame of a video file
 * shown at `t` seconds, held on its last frame after the end. <Clip> asks by
 * time, so it needs neither the clip's frame rate nor its length.
 */
export function clipFrames(root: string): Plugin {
  return {
    name: "launch-clip-frames",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://x");
        if (url.pathname !== "/__launch/clip") return next();
        const src = url.searchParams.get("src") ?? "";
        const file = join(root, decodeURIComponent(src));
        if (!file.startsWith(root) || !existsSync(file)) {
          res.statusCode = 404;
          res.end(`No ${src} in the launch folder`);
          return;
        }
        try {
          const clip = await extract(root, file);
          const t = Number(url.searchParams.get("t") ?? 0);
          const index = Math.max(0, Math.min(clip.frames - 1, Math.round(t * clip.fps + 1e-6)));
          // Same URL after a re-render of the clip: revalidate by the extracted version.
          const etag = `"${clip.dir.slice(-16)}-${index}"`;
          res.setHeader("ETag", etag);
          res.setHeader("Cache-Control", "no-cache");
          if (req.headers["if-none-match"] === etag) {
            res.statusCode = 304;
            res.end();
            return;
          }
          res.setHeader("Content-Type", "image/jpeg");
          res.end(readFileSync(join(clip.dir, `${String(index).padStart(6, "0")}.jpg`)));
        } catch (error) {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : String(error));
        }
      });
    },
  };
}
