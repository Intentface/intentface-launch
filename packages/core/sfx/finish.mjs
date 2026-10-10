// Finishes the raw generations from generate.sh into this folder:
//
//   node finish.mjs <raw dir>
//
// Each sound is cut to its main event (generations often carry a stray second
// hit or a long silent pad), faded so neither end clicks, high-passed against
// rumble and DC, and levelled to the same peak, so `peak` and `gain` on an
// `sfx` entry mean the same thing for every file. Sounds made of several hits
// (typing, ticks) keep all of them and are only trimmed at the ends: use them
// with `hit`.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 48000;
/** Every file's true peak lands here, in dBTP: headroom for the mp3 encoder's overshoot. */
const PEAK = -3;
/** Several hits: keep them all. */
const MULTI = new Set(["typing", "ticks"]);
/** Extra files cut from another generation: name → source. */
const FROM = { ticks: "tick" };
/**
 * Per sound: how far under the peak the cut ends are ([before, after] in dB,
 * default [40, 50]; lower cuts tighter, past a noise bed), and fades in seconds.
 */
const OPTIONS = {
  click: { floor: [22, 26] },
  swell: { fadeIn: 0.35, fadeOut: 0.5 },
};

const here = dirname(fileURLToPath(import.meta.url));
const raw = process.argv[2];
if (!raw) throw new Error("usage: node finish.mjs <raw dir>");

function mono(file) {
  const out = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(RATE), "-"], {
    maxBuffer: 1 << 28,
  });
  return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4);
}

/** Level in dB per millisecond. */
function envelope(pcm) {
  const hop = RATE / 1000;
  const db = [];
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + hop; j++) sum += pcm[j] ** 2;
    db.push(10 * Math.log10(sum / hop + 1e-12));
  }
  return db;
}

/**
 * The main event in ms: back from the loudest millisecond until 20 ms stay
 * 40 dB under it, forward until 80 ms stay 50 dB under it. With `whole`, from
 * the first to the last sound above that floor.
 */
function bounds(db, whole, [before, after] = [40, 50]) {
  const top = Math.max(...db);
  const loud = db.indexOf(top);
  const quiet = (from, to, floor) => db.slice(from, to).every((v) => v < top - floor);
  if (whole) {
    const first = db.findIndex((v) => v > top - before);
    const last = db.length - 1 - [...db].reverse().findIndex((v) => v > top - after);
    return [first, last];
  }
  let start = loud;
  while (start > 0 && !quiet(start - 20, start, before)) start--;
  let end = loud;
  while (end < db.length && !quiet(end, end + 80, after)) end++;
  return [start, Math.min(db.length, end + 20)];
}

const names = readdirSync(raw)
  .filter((f) => f.endsWith(".mp3") && !f.includes(".rejected"))
  .map((f) => basename(f, ".mp3"));
for (const [name, source] of Object.entries(FROM)) if (names.includes(source)) names.push(name);

for (const name of names.sort()) {
  const file = join(raw, `${FROM[name] ?? name}.mp3`);
  const pcm = mono(file);
  const db = envelope(pcm);
  const options = OPTIONS[name] ?? {};
  let [start, end] = bounds(db, MULTI.has(name), options.floor);
  if (Object.values(FROM).includes(name)) {
    // One hit out of a recording of several (tick, of ticks): the first, up to where the next rises.
    const top = Math.max(...db);
    start = db.findIndex((v) => v > top - 30);
    end = start + 10;
    while (end < db.length && !(db[end] > top - 30 && db[end - 1] <= top - 30)) end++;
    end = Math.min(end, start + 300);
  }
  const from = Math.max(0, start - 4) / 1000;
  const to = end / 1000;
  const length = to - from;
  const fadeIn = options.fadeIn ?? 0.002;
  const fadeOut = options.fadeOut ?? Math.min(0.03, length * 0.2);
  const filters = [
    `atrim=start=${from}:end=${to}`,
    "asetpts=PTS-STARTPTS",
    "highpass=f=20",
    `afade=t=in:d=${fadeIn}`,
    `afade=t=out:st=${(length - fadeOut).toFixed(4)}:d=${fadeOut.toFixed(4)}`,
  ];
  // Level to PEAK as a true peak, on both channels: a mono sum hides peaks that are out of phase.
  const meter = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", `${filters.join(",")},ebur128=peak=true`, "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr;
  const truePeak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(meter.slice(meter.lastIndexOf("True peak")))?.[1]);
  const gain = PEAK - (Number.isFinite(truePeak) ? truePeak : 0);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    file,
    "-af",
    [...filters, `volume=${gain.toFixed(2)}dB`].join(","),
    "-ar",
    String(RATE),
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    join(here, `${name}.mp3`),
  ]);
  console.log(`${name.padEnd(14)} ${from.toFixed(3)}–${to.toFixed(3)} s  ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB`);
}
