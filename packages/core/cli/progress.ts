// A render's progress as a file beside its output, so `watch` can draw it in
// another terminal. A render that Claude starts prints a line every tenth (its
// output is not a terminal); the person follows it live with `pnpm launch watch`.
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { outDir, rocketBar, root } from "./util.js";

export type Progress = {
  video: string;
  /** The output's name ("launch-shaders-portrait", "preview"). */
  name: string;
  state: "frames" | "encoding" | "done" | "failed";
  done: number;
  total: number;
  workers: number;
  startedAt: number;
  updatedAt: number;
  /** The mp4, once done; why, once failed. */
  file?: string;
  error?: string;
};

/** How long a render may go without a heartbeat before `watch` calls it stopped. */
const STALE = 10_000;

const fileFor = (videoId: string, name: string) => join(outDir(videoId), `.progress-${name}.json`);

/**
 * Keeps `videoId`'s progress file up to date: `update` changes it, and a
 * heartbeat rewrites it every second (so a crashed render reads as stopped).
 * `stop` writes the last state and ends the heartbeat.
 */
export function trackProgress(
  videoId: string,
  name: string,
  { total, done, workers }: { total: number; done: number; workers: number },
) {
  const file = fileFor(videoId, name);
  const p: Progress = {
    video: videoId,
    name,
    state: "frames",
    done,
    total,
    workers,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const write = () => {
    p.updatedAt = Date.now();
    // Whole, then renamed: a reader never sees half a file.
    writeFileSync(`${file}.tmp`, JSON.stringify(p));
    renameSync(`${file}.tmp`, file);
  };
  write();
  const beat = setInterval(write, 1000);
  beat.unref();
  return {
    update(change: Partial<Progress>) {
      Object.assign(p, change);
    },
    stop(change: Partial<Progress>) {
      clearInterval(beat);
      Object.assign(p, change);
      write();
    },
  };
}

function latest(videoId?: string): Progress | null {
  const videos = join(root(), "videos");
  const ids = videoId ? [videoId] : existsSync(videos) ? readdirSync(videos) : [];
  let best: Progress | null = null;
  for (const id of ids) {
    const out = join(videos, id, "out");
    if (!existsSync(out)) continue;
    for (const f of readdirSync(out)) {
      if (!/^\.progress-.+\.json$/.test(f)) continue;
      try {
        const p = JSON.parse(readFileSync(join(out, f), "utf8")) as Progress;
        if (!best || p.updatedAt > best.updatedAt) best = p;
      } catch {
        // Being replaced as we read it: the next poll gets it.
      }
    }
  }
  return best;
}

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

/**
 * Draws the render running in this launch folder (or `videoId`'s) as a live
 * bar, prints each one's result as it finishes, and waits for the next, until
 * Ctrl-C: a terminal pane that shows the renders Claude starts.
 */
export async function watch(videoId?: string) {
  const tty = process.stdout.isTTY;
  const finished = new Set<string>();
  let shown: string | null = null;
  let waiting = false;
  let rate = null as { key: string; at: number; done: number } | null;
  let lastLine = 0;
  for (let tick = 0; ; tick++) {
    const p = latest(videoId);
    const key = p && `${p.video}|${p.name}|${p.startedAt}`;
    const live = p && (p.state === "frames" || p.state === "encoding") && Date.now() - p.updatedAt < STALE;
    if (p && key && !finished.has(key) && (live || shown === key)) {
      if (shown !== key) {
        if (waiting && tty) process.stdout.write("\r\x1b[K");
        waiting = false;
        shown = key;
        console.log(`  ${p.name} · ${p.total} frames · ${p.workers} worker${p.workers === 1 ? "" : "s"}`);
      }
      if (!live) {
        // Done, failed, or no heartbeat: say how it ended, then wait for the next.
        const how =
          p.state === "done"
            ? `done in ${clock(p.updatedAt - p.startedAt)}: ${p.file ? relative(process.cwd(), p.file) : p.name}`
            : p.state === "failed"
              ? `failed: ${p.error ?? "see the render's own output"}`
              : `stopped at ${p.done}/${p.total} frames (no word from it for ${STALE / 1000} s)`;
        if (tty) process.stdout.write("\r\x1b[K");
        console.log(`  ${how}`);
        finished.add(key);
        shown = null;
        rate = null;
      } else {
        if (rate?.key !== key || p.done < rate.done) rate = { key, at: Date.now(), done: p.done };
        const elapsed = clock(Date.now() - p.startedAt);
        const perMs = (p.done - rate.done) / Math.max(1, Date.now() - rate.at);
        const left = p.total - p.done;
        const eta =
          p.state === "frames" && perMs > 0 && Date.now() - rate.at > 3000
            ? ` · about ${clock(left / perMs)} left`
            : "";
        const line =
          p.state === "encoding"
            ? `  encoding the mp4 · ${elapsed}`
            : `  ${rocketBar(p.done / p.total, tick)}  ${p.done}/${p.total} · ${elapsed}${eta}`;
        if (tty) process.stdout.write(`\r\x1b[K${line}`);
        else if (Date.now() - lastLine > 5000) {
          console.log(line);
          lastLine = Date.now();
        }
      }
    } else if (!waiting && shown === null) {
      waiting = true;
      const line = `  Waiting for a render${videoId ? ` of ${videoId}` : ""} (Ctrl-C to stop)`;
      if (tty) process.stdout.write(line);
      else console.log(line);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}
