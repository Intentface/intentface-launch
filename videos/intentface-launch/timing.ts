// Every cut and hit in the film, in frames at 60 fps, from the track
// (audio/the-launch.wav): beats and downbeats from beats.json, the rest from
// `pnpm launch sound` (seconds, as heard). Shots and sound share these.
import beats from "./audio/beats.json";

export const FPS = 60;
const f = (seconds: number) => Math.round(seconds * FPS);
/** The nth detected downbeat (beats.json finds them from 19.31 s on). */
const bar = (n: number) => f(beats.downbeats[n]);
/** One beat at the track's 126 BPM, in seconds. */
const BEAT = 60 / 126;
/** The nth detected beat: beat 0 is 17.87 s, the first found after the drop. */
const beat = (n: number) => f(beats.beats[n]);

/** The boom the Launch mark lands on, in seconds as heard. */
const HIT = 55.71;

export const T = {
  click: f(3.76), // the first riser peaks (3.76 s in the track alone; the click itself pulls the mix's reading earlier): Launch is clicked
  code: f(9.62), // the second riser: the card is carried into the code
  written: f(14.8),
  drop: f(17.03), // cut to boom: the launch video plays
  /** The reel on the drop: a whip to the next part of the app every two beats. */
  reel: [f(17.03), beat(1), beat(3), beat(5), beat(7), beat(9)],
  /** "Any style.": five styles, the first held to read, then two beats each. */
  montage: [beat(11), beat(14), beat(16), beat(18), beat(20)],
  /** "Create ___ video", accelerating: the first word held a bar, then a word every two beats, then every beat, landing on "launch" with a bar left to read it. */
  /** "Create ___ video": the first word held a bar, then a word every two beats, then every beat, landing on "launch" with a bar left to read it. */
  create: [23, 27, 29, 31, 33, 35, 36, 37, 38, 39, 40].map(beat),
  fromUI: bar(10), // 38.48 s
  install: bar(11), // 40.39 s
  fork: bar(12), // 42.31 s
  open: bar(13), // 44.23 s: the pulse has stopped
  /** Every size: the film in 16:9, then on the lift (47.82 s) all three shapes side by side, playing. */
  sizes: [bar(14), bar(15)],
  breakdown: bar(17), // 51.65 s: the hit, then the sub drops out
  countdown: [f(HIT - 6 * BEAT), f(HIT - 4 * BEAT), f(HIT - 2 * BEAT)], // every second beat into the hit
  hit: f(HIT), // cut to boom: the Launch mark flies in
  end: f(63.12), // the tail decays to silence
};
