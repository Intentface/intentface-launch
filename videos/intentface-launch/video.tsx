import "@intentface/brand/brand.css";
import { defineVideo, ease, interpolate, landed, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { MotionBlur, measureTextNow, Reveal, useFontsReady } from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";
import { Board } from "./board-view";
import { Chat } from "./chat";
import { VideoFile } from "./file";
import { VIDEO_CUES, VideoScene3D } from "./hero3d";
import { LaunchIntro } from "./launch-intro";
import { Terminal } from "./terminal";
import { CHAT, CLAUDE_KEYS, INIT_KEYS, MUSIC, PROMPT_KEYS, T, TERM } from "./timing";

// The film: a teammate asks for a screenshot of the new task feature; instead,
// in the product's own folder, Intentface Launch is installed and Claude is
// asked for a video. Claude reads the app and asks two questions, the board
// opens, a note turns a shot into a closeup, the video renders; it plays (the
// to-do app in 3D), becomes a file; any kind of
// video; the Launch mark. The product in the video is a made-up to-do app
// (todo-app.tsx). The open is silent; the track starts as `claude` is entered.
// The shots up to the file continue the first one, so they run on film frames
// (timing.ts); the line and the end count from their own start.

const GROUND = "#000";
const INK = "#fafafa";
const MUTED = "rgb(255 255 255 / 0.55)";
const SANS = '"Intent Sans", "Helvetica Neue", Arial, sans-serif';
const LINE = 120; // the film's one size for words on screen
const WEIGHT = 400; // and its one weight
const LINE_FONT = `${WEIGHT} ${LINE}px "Intent Sans"`;

const fill: CSSProperties = { position: "absolute", inset: 0 };

/** Every shot: the black ground and the fonts loaded. */
function Stage({ children, ground = GROUND }: { children: ReactNode; ground?: string }) {
  useFontsReady([
    LINE_FONT,
    `400 60px "Intent Sans"`,
    `500 34px "Intent Sans"`,
    `600 64px "Intent Sans"`,
    `400 30px "IBM Plex Mono"`,
    `600 30px "IBM Plex Mono"`,
  ]);
  return (
    <div style={{ ...fill, background: ground, color: INK, fontFamily: SANS, overflow: "hidden" }}>{children}</div>
  );
}

const staged = (Scene: () => ReactNode) =>
  function Staged() {
    return (
      <Stage>
        <Scene />
      </Stage>
    );
  };

// 7. create: "Create ___ video." The middle word changes in a slot; the line closes around it.
const KINDS = [
  "product",
  "feature",
  "release",
  "update",
  "demo",
  "tutorial",
  "onboarding",
  "teaser",
  "ad",
  "intro",
  "recap",
  "changelog",
  "social",
  "launch",
];
/** In 4:5 the line stacks: "Create" / word / "video.", each centred, larger. */
const STACK = 150;
const STACK_FONT = `${WEIGHT} ${STACK}px "Intent Sans"`;
function CreateLine() {
  const frame = useFrame();
  const { fps, width: W, height: H, format } = useVideoInfo();
  const narrow = format.aspect < 1;
  useFontsReady([LINE_FONT, STACK_FONT], `Create video. ${KINDS.join(" ")}`);
  const abs = frame + T.create[0];
  const i = Math.max(0, T.create.filter((c) => abs >= c).length - 1);
  const since = abs - T.create[i];
  // A change: the old word leaves fast, rising, blurring and fading out in 6 frames; the new one
  // arrives 4 frames in, rising from a little below out of 0 opacity and a slight blur. They never
  // share the slot at half opacity. No mask: nothing is cropped.
  const k = i === 0 ? 1 : interpolate(since, [4, 18], [0, 1], { easing: ease.out });
  const gone = i === 0 ? 1 : interpolate(since, [0, 6], [0, 1], { easing: ease.in });
  const measure = (t: string) => measureTextNow(t, LINE_FONT, { letterSpacing: "-0.03em" }).width;
  const space = measure("a a") - 2 * measure("a");
  // The slot's width springs to each new word, so "video." glides with it: it grows at once for a
  // longer word, and shrinks for a shorter one only once the old word has gone.
  const slot = springTo(
    frame,
    fps,
    T.create.map((c, n) => ({
      at: c - T.create[0] + (n > 0 && measure(KINDS[n]) < measure(KINDS[n - 1]) ? 6 : 0),
      to: measure(KINDS[n]),
    })),
    { duration: 12, bounce: 0 },
  );
  // The slot lands exactly on the word's width: a spring's slow tail would step the line a pixel at a time.
  const settled = landed(slot, measure(KINDS[i]), 0.5);
  const before = measure("Create");
  // Whole pixels: text left on a fraction of a pixel by a settling spring steps as it moves.
  const left = Math.round((W - (before + space + settled + space + measure("video."))) / 2);
  const wordLeft = Math.round(left + before + space);
  const stacked = (t: string) =>
    Math.round((W - measureTextNow(t, STACK_FONT, { letterSpacing: "-0.03em" }).width) / 2);
  const rows = [H / 2 - STACK * 1.6, H / 2 - STACK * 0.5, H / 2 + STACK * 0.6].map(Math.round);
  const enter = interpolate(frame, [0, 22], [0, 1], { easing: ease.out });
  const length = T.end - T.create[0];
  const out = interpolate(frame, [length - 12, length], [1, 0], { easing: ease.in });
  const travel = (narrow ? STACK : LINE) * 0.35;
  const text: CSSProperties = {
    position: "absolute",
    top: narrow ? rows[1] : 480,
    font: `${WEIGHT} ${narrow ? STACK : LINE}px/1 ${SANS}`,
    letterSpacing: "-0.03em",
    whiteSpace: "nowrap",
  };
  const word = (n: number, y: number, opacity: number, blur: number) => (
    <div
      key={n}
      // The options flash past inside a line that stays ("Create … video."), which is what is read;
      // the line and the word it lands on are checked, the passing options are not timed one by one.
      data-launch-check={n === KINDS.length - 1 && n === i ? undefined : "off"}
      style={{
        ...text,
        left: narrow ? stacked(KINDS[n]) : wordLeft,
        opacity,
        transform: `translateY(${Math.round(y)}px)`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {KINDS[n]}
    </div>
  );
  // Real motion blur on every change.
  const changes = T.create.slice(1).map((c): [number, number] => [c - T.create[0] - 1, c - T.create[0] + 16]);
  return (
    <Stage>
      <div
        style={{
          ...fill,
          opacity: enter * out,
          filter: enter < 1 ? `blur(${((1 - enter) * 6).toFixed(2)}px)` : undefined,
        }}
      >
        <div style={{ ...text, ...(narrow ? { top: rows[0], left: stacked("Create") } : { left }) }}>Create</div>
        <MotionBlur when={changes}>
          <div style={fill}>
            {i > 0 && gone < 1 && word(i - 1, -gone * travel, 1 - gone, gone * 6)}
            {word(i, (1 - k) * travel, k, (1 - k) * 6)}
          </div>
        </MotionBlur>
        <div
          style={{
            ...text,
            ...(narrow
              ? { top: rows[2], left: stacked("video.") }
              : { left: Math.round(left + before + space + settled + space) }),
          }}
        >
          video.
        </div>
      </div>
    </Stage>
  );
}

// 8. end: the Launch mark's own intro through the breakdown, parking on the final hit; then it rises
// and the name and URL arrive below it, the group optically centred.
const PARK = T.hit - T.end; // the intro's flight is 1.9 s
function End() {
  const frame = useFrame();
  const { fps, width: W, height: H } = useVideoInfo();
  // The group sits a little below the frame's centre (it read high); in 4:5, centred in the taller frame.
  const dy = (H - 1080) / 2 + 50;
  const rise = springTo(
    frame,
    fps,
    [
      { at: -1, to: 0 },
      { at: PARK, to: 1 },
    ],
    { duration: 36 },
  );
  const url = "launch.intentface.com";
  const typed = url.slice(0, Math.max(0, Math.floor((frame - (T.hit2 - T.end)) / 2.5)));
  // The mark's drawn shape sits about at the centre of its 460 px box; centred, then 150 px up.
  const markTop = landed(dy + 540 - 230 - 30 - 150 * rise, dy + 540 - 230 - 30 - 150);
  const length = T.last - T.end;
  // The film ends as the track's tail decays: the lockup fades to black.
  const fade = interpolate(frame, [length - 70, length - 4], [1, 0], { easing: ease.inOut });
  return (
    <Stage>
      <div style={{ ...fill, opacity: fade }}>
        <div style={{ position: "absolute", left: W / 2 - 230, top: markTop }}>
          <LaunchIntro size={460} glint={PARK + 70} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: dy + 590,
            textAlign: "center",
            font: `${WEIGHT} 96px/1 ${SANS}`,
            letterSpacing: "-0.03em",
          }}
        >
          <Reveal at={PARK + 4} mask stagger={0.06}>
            Intentface Launch
          </Reveal>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: dy + 720,
            textAlign: "center",
            font: `300 48px/1 ${SANS}`,
            color: MUTED,
          }}
        >
          {typed}
        </div>
      </div>
    </Stage>
  );
}

const len = (from: number, to: number) => to - from;
/** A keystroke per frame, each a different hit of the typing recording. */
const keys = (frames: number[], peak: number) =>
  frames.map((at, i) => ({ src: "sfx:typing", at, hit: i * 7 + 3, peak: i % 3 === 1 ? peak - 3 : peak }));
const TICKS = VIDEO_CUES.ticks ?? 0;

export default defineVideo({
  id: "intentface-launch",
  title: "Intentface Launch",
  logline:
    "For developers and product teams: ask Claude for a launch video in your product's repo, and get one made from your real UI.",
  // The track starts on the frame `claude` is entered: the open before it is silent.
  audio: { src: new URL("./audio/clean-ringing-chord.wav", import.meta.url).href, offset: -MUSIC / 60 },
  // 16:9 for YouTube and the site; 4:5 for the social feeds (social-formats skill). Every scene reflows.
  formats: { portrait: { width: 1080, height: 1350 } },
  sfx: [
    // The chat: each message lands with a soft pop.
    { src: "sfx:pop", at: CHAT.ask, peak: -14 },
    { src: "sfx:pop", at: CHAT.reply, peak: -14 },
    // The silent open: only the keys.
    ...keys(INIT_KEYS, -10),
    { src: "sfx:click-button", at: T.initEnter, peak: -10 },
    ...T.output.map((at) => ({ src: "sfx:tick", at, peak: -18 })),
    ...keys(CLAUDE_KEYS, -10),
    { src: "sfx:click-button", at: T.claudeEnter, peak: -9 },
    // Under the music: the prompt, the questions, the link.
    ...keys(PROMPT_KEYS, -12),
    { src: "sfx:click-button", at: T.submit, peak: -8 },
    ...T.tools.map((at) => ({ src: "sfx:tick", at, peak: -12 })),
    { src: "sfx:click", at: T.q2Down, peak: -10 },
    { src: "sfx:tap-glass", at: T.a1, peak: -12 },
    { src: "sfx:tap-glass", at: T.a2, peak: -12 },
    { src: "sfx:click-button", at: T.linkClick, peak: -8 },
    // The board: it opens on the boom; the note; the panels turning over.
    { src: "sfx:whoosh-deep", at: T.boardOpen - 4, align: "peak", peak: -11 },
    { src: "sfx:click", at: T.noteClick, peak: -10 },
    ...keys(T.noteKeys, -12),
    { src: "sfx:click-button", at: T.addNote, peak: -8 },
    { src: "sfx:blip", at: T.closeups, peak: -12 },
    { src: "sfx:blip", at: T.closeups + 5, peak: -15 },
    // The render: ticks while the bar fills, a chime as it is done.
    { src: "sfx:ticks", at: T.render + 30, peak: -18 },
    { src: "sfx:ticks", at: T.render + 50, peak: -18 },
    { src: "sfx:success", at: T.rendered, peak: -10 },
    // The video: the closeup's checkbox, the others ticking, the pull back.
    { src: "sfx:click-button", at: T.check, peak: -6 },
    ...[0, 1, 2, 3].map((n) => ({ src: "sfx:tick", at: TICKS + n * 6, peak: -11 })),
    { src: "sfx:whoosh-deep", at: T.check + 120, align: "peak", peak: -12 },
    // The file.
    { src: "sfx:whoosh-deep", at: T.file + 34, align: "peak", peak: -12 },
    // A tick on every word, landing on "launch".
    ...T.create.slice(1).map((at, n, all) => ({ src: "sfx:tick", at, peak: n === all.length - 1 ? -6 : -9 })),
    { src: "sfx:shimmer", at: T.hit + 4, peak: -9 },
  ],
  shots: [
    {
      id: "chat",
      offBeat: true,
      title: "Chat",
      duration: TERM,
      component: staged(Chat),
      says: "A teammate asks for a screenshot of the new task feature for social media. The reply: something cooler.",
      copy: [
        "The task feature is done! Can we take a screenshot for our socials?",
        "I think we can do something cooler.",
      ],
      notes: "Silent. A generic dark chat; the people are made up.",
      board: [0.3, 0.92],
    },
    {
      id: "install",
      offBeat: true,
      title: "Install",
      duration: len(TERM, T.board),
      continues: "chat",
      component: staged(Terminal),
      says: "In the product's folder, Intentface Launch is installed; Claude Code is opened and asked for a 30 second video. It reads the app and asks two questions.",
      camera: "Close on the terminal, riding the caret while the install is typed, then down the lines as they come.",
      sound: "Silent until `claude` is entered; then the track. Keys, ticks on the tool calls, taps on the answers.",
      notes:
        "Terminal on a subtle CRT with a glow (`Crt` from the three add-on). The answers land on the track's hits; the link is clicked on the hit at 10.52 s.",
      board: [0.08, 0.2, 0.36, 0.55, 0.75, 0.96],
    },
    {
      id: "board",
      offBeat: true,
      hits: [{ at: T.boardOpen - T.board, sound: "boom" }],
      title: "Board",
      duration: len(T.board, T.render),
      continues: "chat",
      component: staged(Board),
      says: 'The link opens the storyboard. A note on the first shot, "Make this a closeup"; its panels turn into closeups and Claude answers under the note.',
      camera:
        "The window grows out of the link and lands on the boom; in to the note as it is typed, across to the panels as they change, back to the reply.",
      notes: "The studio's own board view (dark), rebuilt in the film with its tokens and fonts, for the to-do video.",
      board: [0.12, 0.3, 0.55, 0.75, 0.95],
    },
    {
      id: "render",
      offBeat: true,
      title: "Render",
      duration: len(T.render, T.drop),
      continues: "chat",
      component: staged(Terminal),
      says: "Back in the terminal, the video renders, and is done.",
      notes: "The bar fills over the build into the drop; Done on the hit before it.",
      board: [0.3, 0.95],
    },
    {
      id: "video",
      offBeat: true,
      hits: [{ at: 0, sound: "cut" }],
      title: "The video",
      duration: len(T.drop, T.file),
      continues: "chat",
      component: VideoScene3D,
      says: "On the drop, the video Claude made: the to-do app, opening on the closeup the note asked for. A task is checked; the week fills in as the camera pulls back.",
      camera:
        "Stage3D: low across the app's window on the first task's checkbox, the rest in bokeh; the click on the downbeat, then one pull back to straight on, landing 16 frames before the cut.",
      notes:
        "The flat app dissolves in over the slab while the camera is still, so the cut to the file is pixel-identical.",
      board: [0.08, 0.3, 0.6, 0.97],
    },
    {
      id: "file",
      title: "The file",
      duration: len(T.file, T.create[0]),
      continues: "chat",
      component: staged(VideoFile),
      says: "It is a video file: task-feature.mp4 (in the 4:5 cut, task-feature-portrait.mp4, as render names that shape).",
      board: [0.06, 0.4, 0.95],
    },
    {
      id: "create",
      hits: [{ at: T.create[1] - T.create[0], sound: "boom" }],
      title: "Create any video",
      duration: len(T.create[0], T.end),
      component: CreateLine,
      says: `Any kind of video: ${KINDS.join(", ")}.`,
      copy: ["Create launch video."],
      notes:
        'The first word holds a bar, then the word changes every two beats (one on the boom), then every beat, landing on "launch" with a moment to read it. In 4:5 the line stacks on three lines.',
      board: [0.1, 0.4, 0.7, 0.95],
    },
    {
      id: "end",
      offBeat: true,
      hits: [{ at: PARK, sound: "impact" }],
      title: "Launch",
      duration: len(T.end, T.last),
      component: End,
      says: "Intentface Launch, and where to find it.",
      copy: ["Intentface Launch", "launch.intentface.com"],
      notes:
        "The Launch mark's own intro through the breakdown, parking on the final hit; the name lands with it, the URL on the second hit.",
      board: [0.2, 0.55, 0.9],
    },
  ],
});
