import { type ChildProcess, spawn } from "node:child_process";

/** `ignore`: lines of ffmpeg's log known to be harmless, left out of the output. */
export function ffmpeg(
  args: string[],
  { quiet = true, ignore }: { quiet?: boolean; ignore?: RegExp } = {},
): ChildProcess {
  const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", quiet ? "error" : "info", "-y", ...args], {
    stdio: ["pipe", "inherit", ignore ? "pipe" : "inherit"],
  });
  if (ignore)
    child.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n"))
        if (line.trim() && !ignore.test(line.trim())) process.stderr.write(`${line}\n`);
    });
  return child;
}

export function finished(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}

export async function run(args: string[]) {
  const child = ffmpeg(args);
  child.stdin?.end();
  await finished(child);
}

/** Write to ffmpeg's stdin, respecting backpressure. */
export function write(child: ChildProcess, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const stdin = child.stdin;
    if (!stdin) return reject(new Error("ffmpeg has no stdin"));
    if (stdin.write(data)) resolve();
    else stdin.once("drain", resolve);
  });
}

/**
 * sRGB frames → Rec.709 video. Without an explicit matrix, swscale uses
 * BT.601 and the brand colours shift; without the tags, players guess.
 */
export const REC709_FILTER =
  "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p," +
  "setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv";
export const REC709_TAGS = [
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-color_range",
  "tv",
];
