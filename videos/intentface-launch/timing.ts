// Every cut, key and hit in the film, in frames at 60 fps. The film opens on
// silent typing; the track (audio/clean-ringing-chord.wav) starts on the frame
// `claude` is entered, so a time in the track is MUSIC + its frames. Times in
// the track are beats from beats.json or events from `pnpm launch sound`
// (seconds as heard). Shots and sound share these.
import { typingCadence } from "@intentface-launch/core/kit";

export const FPS = 60;
const f = (seconds: number) => Math.round(seconds * FPS);

// The silent open: two chat messages, then the terminal: the install, then `claude`.
export const ASK = "The task feature is done! Can we take a screenshot for our socials?";
export const REPLY = "I think we can do something cooler.";
/** The chat: each message after a few frames of typing dots. */
export const CHAT = { dots: [6, 150], ask: 30, reply: 176, again: 262 };
/** The terminal's first frame. */
export const TERM = 356;
export const INIT_CMD = "npx @intentface-launch/core init";
export const CLAUDE_CMD = "claude";
const INIT_AT = TERM + 36;
const CLAUDE_AT = TERM + 214;
/** Keystrokes, as film frames. */
export const INIT_KEYS = typingCadence(INIT_CMD, FPS, { cps: 15 }).map((k) => INIT_AT + k);
export const CLAUDE_KEYS = typingCadence(CLAUDE_CMD, FPS, { cps: 14 }).map((k) => CLAUDE_AT + k);

/** The frame `claude` is entered: the music starts here. */
export const MUSIC = TERM + 250;
/** A time in the track (seconds) as a film frame. */
export const track = (seconds: number) => MUSIC + f(seconds);

export const PROMPT = "Create a 30 second video about our task feature";
export const PROMPT_KEYS = typingCadence(PROMPT, FPS, { cps: 20.4 }).map((k) => track(1.0) + k);
export const NOTE = "Make this a closeup";

export const T = {
  // 1. install: silent
  initEnter: INIT_KEYS[INIT_KEYS.length - 1] + 12,
  /** The init's output lines. */
  output: [TERM + 184, TERM + 192, TERM + 200],
  claudeEnter: MUSIC,

  // 2. prompt
  welcome: MUSIC + 4,
  submit: track(3.5), // the first big hit

  // 3. Claude reads the app and asks
  thinking: track(3.6),
  tools: [track(4.48), track(4.97), track(5.45)], // on the beats
  ask: track(5.94),
  q1: track(6.41), // downbeat
  a1: track(7.87), // the big impact
  q2: track(7.87) + 6,
  q2Down: track(8.35),
  a2: track(9.32),
  ready: track(9.8), // impact: the board link
  linkClick: track(10.52), // impact

  // 4. board: opens on the boom, the note, the panels become closeups
  board: track(10.52) + 3,
  boardOpen: track(11.74), // the boom: the window lands
  noteClick: track(12.74), // the boom after the window lands
  noteKeys: typingCadence(NOTE, FPS, { cps: 18 }).map((k) => track(12.74) + 9 + k),
  addNote: track(14.15), // downbeat
  closeups: track(15.11),

  // 5. render, back in the terminal
  render: track(17.52), // the board holds on the changed panels and the reply first
  rendered: track(18.72), // impact before the drop

  // 6. the video: the to-do app in 3D, then the file
  drop: track(19.04), // cut to boom
  check: track(19.92), // the closeup's checkbox clicked, on the downbeat
  file: track(23.77), // downbeat

  // 7. create ___ video: a bar for the first word, a word every two beats (one on the boom at
  // 27.18), then every beat, landing on "launch" with a moment to read it.
  create: [25.7, 27.18, 28.1, 29.06, 30.02, 30.5, 30.98, 31.46, 31.94, 32.42, 32.9, 33.38, 33.86, 34.34].map(track),

  // 8. end: the mark flies in through the breakdown and parks on the final hit
  end: track(36.02),
  hit: track(37.92),
  hit2: track(38.39),
  last: track(39.92) + 90, // the tail, then a beat of the parked lockup
};
