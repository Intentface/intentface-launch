import "@intentface/brand/brand.css";
import { defineVideo, ease, interpolate, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { MotionBlur, measureTextNow, Reveal, useFontsReady } from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";
import { AppScene3D, Reel3D } from "./hero3d";
import { LaunchIntro } from "./launch-intro";
import { AREAS, DONE, LaunchCard, Orbit } from "./sample-app";
import { SizesFamily } from "./sizes3d";
import { T } from "./timing";

// The film: every shot at its length on the track, in the film's type and
// motion. The app, its pull-back and the reel are a real 3D stage (hero3d.tsx).
// The product on screen is Orbit, a made-up app (sample-app.tsx).

const GROUND = "#000";
const INK = "#fafafa";
const MUTED = "rgb(255 255 255 / 0.55)";
const SANS = '"Intent Sans", "Helvetica Neue", Arial, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const LINE = 120; // the film's one size for words on screen
const WEIGHT = 400; // and its one weight
const LINE_FONT = `${WEIGHT} ${LINE}px "Intent Sans"`;

const fill: CSSProperties = { position: "absolute", inset: 0 };

/** Every shot: the black ground and the fonts loaded. */
function Stage({ children, ground = GROUND }: { children: ReactNode; ground?: string }) {
  useFontsReady([LINE_FONT, `500 72px "Intent Sans"`, `400 36px "IBM Plex Mono"`]);
  return (
    <div style={{ ...fill, background: ground, color: INK, fontFamily: SANS, overflow: "hidden" }}>{children}</div>
  );
}

/**
 * A line of the film: one size, one weight, one line, centred; masked in by word, a quiet fade out
 * before the cut. Still while it is read: a slow push on DOM text steps a pixel at a time, because
 * Chrome snaps glyphs to whole pixels.
 */
function Line({
  children,
  at = 4,
  out,
  roll,
  top = 480,
}: {
  children: string;
  at?: number;
  /** A quiet fade out from this frame. */
  out?: number;
  /** Or lift out from this frame: the line rises a little, blurs and fades in 12 frames as the next comes in. */
  roll?: number;
  top?: number;
}) {
  const frame = useFrame();
  const lift = roll === undefined ? 0 : interpolate(frame, [roll, roll + 10], [0, 1], { easing: ease.in });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        font: `${WEIGHT} ${LINE}px/1 ${SANS}`,
        letterSpacing: "-0.03em",
        whiteSpace: "nowrap",
        opacity: 1 - lift,
        transform: lift ? `translateY(${Math.round(-lift * LINE * 0.3)}px)` : undefined,
        filter: lift ? `blur(${(lift * 8).toFixed(2)}px)` : undefined,
      }}
    >
      {/* Words come in from nothing: rising a little, sharpening out of a blur and fading up; no mask. */}
      <Reveal at={at} stagger={0.04} duration={0.45} rise={0.25} blur={0.08} exit={out} exitDuration={0.2}>
        {children}
      </Reveal>
    </div>
  );
}

/** A line alone on black, `length` frames long. */
const card = (text: string, length: number, at = 4) =>
  function LineCard() {
    return (
      <Stage>
        <Line at={at} out={length - 14}>
          {text}
        </Line>
      </Stage>
    );
  };

/**
 * A line in a run of lines: it rises in on the cut and rolls up and out as the next rises in, so the
 * eye is carried from one to the next instead of through an empty frame.
 */
const rolling = (text: string, length: number) =>
  function RollingLine() {
    return (
      <Stage>
        <Line at={0} roll={length - 9}>
          {text}
        </Line>
      </Stage>
    );
  };

// 3. code: the launch card is carried out of the app to the right; the code comes in on the left;
// "Spring" is deleted and "Summer" typed, and the card's title follows.
const CODE = [
  "{",
  '  id: "launch",',
  "  component: () => (",
  "    <ExampleApp",
  '      title="★"',
  "    />",
  "  ),",
  "}",
];
// Keystrokes: "Spring" deleted, then "Summer" typed, uneven like a person typing.
const DELETES = [70, 74, 78, 81, 85, 88];
const TYPES = [100, 105, 109, 116, 120, 126];
const CARD_TO = { x: 978, y: 162, scale: 0.9 };

function Code() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const [x, y, scale] = springTo(
    frame,
    fps,
    [
      // Where the card sits in the app: inside the window's border (1.5 px, drawn as 1 at 1080p).
      { at: -1, to: [AREAS.card.x + 1, AREAS.card.y + 1, 1] },
      { at: 2, to: [CARD_TO.x, CARD_TO.y, CARD_TO.scale] },
    ],
    { duration: 40 },
  );
  const rest = interpolate(frame, [0, 16], [1, 0], { easing: ease.soft });
  const codeIn = interpolate(frame, [20, 44], [0, 1], { easing: ease.out });
  const word =
    frame < 100
      ? "Spring".slice(0, 6 - DELETES.filter((d) => frame >= d).length)
      : "Summer".slice(0, TYPES.filter((a) => frame >= a).length);
  const typed = TYPES[TYPES.length - 1];
  const caret = frame > 60 && frame < typed + 40 && Math.floor(frame / 18) % 2 === 0;
  // Once the new launch has filled, the changed line lights up: this line made that card.
  const mark = springTo(
    frame,
    fps,
    [
      { at: -1, to: 0 },
      { at: typed + 100, to: 1 },
    ],
    { duration: 24, bounce: 0 },
  );
  // Then both panels lift away, fast, into the line that names what was shown.
  const length = T.written - T.code;
  const away = interpolate(frame, [length - 22, length - 2], [0, 1], { easing: ease.in });
  return (
    <Stage>
      <div
        style={{ ...fill, opacity: 1 - away, transform: away ? `translateY(${Math.round(-away * 70)}px)` : undefined }}
      >
        <div style={{ ...fill, opacity: rest }}>
          <Orbit cues={DONE} withoutCard />
        </div>
        <div
          data-launch-check="off"
          style={{
            position: "absolute",
            left: 96,
            top: 162,
            width: 846,
            height: 756,
            borderRadius: 28,
            background: "#0d0d10",
            border: "1.5px solid rgb(255 255 255 / 0.09)",
            padding: "64px 64px",
            boxSizing: "border-box",
            font: `400 42px/1.65 ${MONO}`,
            whiteSpace: "pre",
            color: "#b9b9c4",
            opacity: codeIn,
            transform: `translateX(${(1 - codeIn) * -40}px)`,
            filter: codeIn < 1 ? `blur(${(1 - codeIn) * 3}px)` : undefined,
          }}
        >
          {CODE.map((l) => {
            if (!l.includes("★")) return <div key={l}>{l}</div>;
            const [a, b] = l.split("★");
            return (
              <div key={l} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -24,
                    right: -24,
                    top: 4,
                    bottom: 4,
                    transform: `scaleX(${mark})`,
                    transformOrigin: "0 50%",
                    borderRadius: 10,
                    background: "rgb(169 180 255 / 0.14)",
                  }}
                />
                <span style={{ position: "relative" }}>{a}</span>
                <span style={{ position: "relative", color: "#a9b4ff" }}>{`${word} launch`}</span>
                <span style={{ display: "inline-block", width: 0, opacity: caret ? 1 : 0, color: INK }}>▍</span>
                {b}
              </div>
            );
          })}
        </div>
        <div
          style={{ position: "absolute", left: x, top: y, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          data-launch-check="off"
        >
          <LaunchCard
            cues={frame < typed + 2 ? DONE : { click: -1e4, ticks: typed + 22 }}
            title="Summer launch"
            titleAt={typed + 2}
          />
        </div>
      </div>
    </Stage>
  );
}

// 6. styles: "Any style." in five styles, one per cut.
const WORDS = "Any style.";
const DEPTH_LAYERS = 48;
const centred: CSSProperties = { ...fill, display: "grid", placeItems: "center", whiteSpace: "nowrap" };

type Look = { name: string; becomes: string; render: (f: number) => ReactNode };

const LOOKS: Look[] = [
  {
    name: "plain",
    becomes: "the film's own type, masked in by word",
    render: () => (
      <Stage>
        <div style={{ ...centred, font: `${WEIGHT} ${LINE * 1.6}px/1 ${SANS}`, letterSpacing: "-0.03em" }}>
          <Reveal mask stagger={0.06}>
            {WORDS}
          </Reveal>
        </div>
      </Stage>
    ),
  },
  {
    name: "3D",
    becomes: "Stage3D: the words extruded in space, turning on a spring, with depth of field",
    render: (f) => {
      const turn = springTo(
        f,
        60,
        [
          { at: -1, to: -42 },
          { at: 0, to: -16 },
        ],
        { duration: 50 },
      );
      return (
        <Stage>
          <div style={{ ...fill, perspective: 1400 }}>
            <div style={{ ...fill, transform: `rotateY(${turn}deg) rotateX(12deg)`, transformStyle: "preserve-3d" }}>
              {/* A solid extrusion: thin layers close together, the sides falling from lit to shadow. */}
              {Array.from({ length: DEPTH_LAYERS }, (_, n) => {
                const i = DEPTH_LAYERS - 1 - n; // back to front, so the face paints last
                const t = i / (DEPTH_LAYERS - 1);
                const v = Math.round(interpolate(t, [0, 0.05, 1], [104, 88, 24]));
                return (
                  <div
                    key={i}
                    data-launch-check={i === 0 ? undefined : "off"}
                    style={{
                      ...centred,
                      font: `600 220px/1 ${SANS}`,
                      letterSpacing: "-0.03em",
                      transform: `translateZ(${-i * 1.5}px)`,
                      color: i === 0 ? INK : `rgb(${v} ${v} ${v + 8})`,
                    }}
                  >
                    {WORDS}
                  </div>
                );
              })}
            </div>
          </div>
        </Stage>
      );
    },
  },
  {
    name: "hand drawn",
    becomes: "DrawOn + Displace: the outline drawn on in ink, boiling",
    render: (f) => {
      const seed = Math.floor(f / 6);
      const draw = interpolate(f, [0, 40], [0, 1], { easing: ease.out });
      return (
        <Stage ground="#f2efe8">
          <svg viewBox="0 0 1920 1080" style={fill} aria-hidden>
            <filter id={`boil-${seed}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={seed} />
              <feDisplacementMap in="SourceGraphic" scale={6} />
            </filter>
            <text
              x="960"
              y="620"
              textAnchor="middle"
              fill="none"
              stroke="#18181c"
              strokeWidth={5}
              strokeDasharray={1400}
              strokeDashoffset={1400 * (1 - draw)}
              filter={`url(#boil-${seed})`}
              style={{ font: `600 250px ${SANS}`, letterSpacing: "-0.02em" }}
            >
              {WORDS}
            </text>
          </svg>
        </Stage>
      );
    },
  },
  {
    name: "serif",
    becomes: "an editorial serif italic, set letter by letter",
    render: () => (
      <Stage ground="#efe9dc">
        <div style={{ ...centred, font: `italic 400 240px/1 Georgia, "Times New Roman", serif`, color: "#1c1a17" }}>
          <Reveal by="char" stagger={0.025} mask>
            {WORDS}
          </Reveal>
        </div>
      </Stage>
    ),
  },
  {
    name: "neon",
    becomes: "light: the words as tubes switching on, bloom on black",
    render: (f) => {
      // The tubes strike: a few quick flickers, then steady.
      const on = [0, 1, 0.2, 1, 0.5, 1][Math.min(5, Math.floor(f / 3))];
      return (
        <Stage>
          <div
            style={{
              ...centred,
              font: `400 220px/1 ${SANS}`,
              color: "#fff",
              opacity: 0.15 + 0.85 * on,
              textShadow: `0 0 10px #fff, 0 0 40px rgb(255 79 216 / ${on}), 0 0 100px rgb(255 79 216 / ${0.8 * on})`,
            }}
          >
            {WORDS}
          </div>
        </Stage>
      );
    },
  },
];

function Styles() {
  const frame = useFrame();
  const abs = frame + T.montage[0];
  const cut = Math.max(0, T.montage.filter((c) => abs >= c).length - 1);
  // The words are read on the first cut; after that they repeat in new styles, not to be read again.
  return (
    <div data-launch-check={cut === 0 ? undefined : "off"} style={fill}>
      {LOOKS[cut].render(abs - T.montage[cut])}
    </div>
  );
}

// 7. create: "Create ___ video." The middle word rolls through a slot; the line closes around it.
// Kinds of video, one per change, landing on "launch".
const KINDS = [
  "product",
  "update",
  "intro",
  "ad",
  "demo",
  "teaser",
  "tutorial",
  "onboarding",
  "recap",
  "feature",
  "launch",
];
function CreateLine() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  useFontsReady(LINE_FONT, `Create video. ${KINDS.join(" ")}`);
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
  // The slot's width springs to each new word, so "video." glides with it.
  const slot = springTo(
    frame,
    fps,
    // It grows at once for a longer word, and shrinks for a shorter one only once the old word has gone.
    T.create.map((c, n) => ({
      at: c - T.create[0] + (n > 0 && measure(KINDS[n]) < measure(KINDS[n - 1]) ? 6 : 0),
      to: measure(KINDS[n]),
    })),
    { duration: 12, bounce: 0 },
  );
  const before = measure("Create");
  // Whole pixels: text left on a fraction of a pixel by a settling spring steps as it moves.
  const left = Math.round((1920 - (before + space + slot + space + measure("video."))) / 2);
  const wordLeft = Math.round(left + before + space);
  const enter = interpolate(frame, [4, 30], [0, 1], { easing: ease.out });
  const travel = LINE * 0.35;
  const text: CSSProperties = {
    position: "absolute",
    top: 480,
    font: `${WEIGHT} ${LINE}px/1 ${SANS}`,
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
        left: wordLeft,
        opacity,
        transform: `translateY(${Math.round(y)}px)`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {KINDS[n]}
    </div>
  );
  // Real motion blur on every change, as on the reel's whips.
  const changes = T.create.slice(1).map((c): [number, number] => [c - T.create[0] - 1, c - T.create[0] + 16]);
  return (
    <Stage>
      <div
        style={{ ...fill, opacity: enter, filter: enter < 1 ? `blur(${((1 - enter) * 6).toFixed(2)}px)` : undefined }}
      >
        <div style={{ ...text, left }}>Create</div>
        <MotionBlur when={changes}>
          <div style={fill}>
            {i > 0 && gone < 1 && word(i - 1, -gone * travel, 1 - gone, gone * 6)}
            {word(i, (1 - k) * travel, k, (1 - k) * 6)}
          </div>
        </MotionBlur>
        <div style={{ ...text, left: Math.round(left + before + space + slot + space) }}>video.</div>
      </div>
    </Stage>
  );
}

// 9. sizes: one launch clip posted three times (feed.tsx), the button in all three becoming
// "Launched" on the same frame.
/** Every platform: a family of devices in 3D (sizes3d.tsx), each on another platform, the line above them. */
function SizesDevices() {
  const length = T.breakdown - T.sizes[0];
  return (
    <Stage>
      <SizesFamily />
      <Line at={4} out={length - 14} top={112}>
        Every platform.
      </Line>
    </Stage>
  );
}

// 12. countdown: a breath of black, then 3, 2, 1 every second beat into the hit. No logo yet.
function Countdown() {
  const frame = useFrame();
  const at = T.countdown.map((c) => c - T.breakdown);
  const n = at.filter((c) => frame >= c).length;
  const since = n > 0 ? frame - at[n - 1] : 0;
  // Each digit lands out of a blur, then holds still (a slow push on type steps a pixel at a time).
  const p = interpolate(since, [0, 12], [0, 1], { easing: ease.out });
  // The last digit gathers speed into the hit and leaves through the lens a few frames before it.
  const end = T.hit - T.breakdown;
  const punch = n === 3 ? interpolate(frame, [end - 16, end], [0, 1], { easing: ease.in }) : 0;
  const scale = (1.12 - 0.12 * p) * (1 + 1.6 * punch);
  return (
    <Stage>
      {n > 0 && (
        <div
          style={{
            ...centred,
            font: `${WEIGHT} 460px/1 ${SANS}`,
            opacity: p * (1 - punch),
            transform: `scale(${scale})`,
            filter: p < 1 || punch > 0 ? `blur(${(1 - p) * 8 + punch * 14}px)` : undefined,
          }}
        >
          {String(4 - n)}
        </div>
      )}
    </Stage>
  );
}

// 13. end: on the hit, the Launch mark's own intro, alone and centred; once it has parked, it rises
// and the name and URL arrive below it, the group optically centred.
function End() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const settle = 120; // the flight (1.9 s); the rays are still settling as the lockup rises
  const rise = springTo(
    frame,
    fps,
    [
      { at: -1, to: 0 },
      { at: settle, to: 1 },
    ],
    { duration: 36 },
  );
  const url = "launch.intentface.com";
  const typed = url.slice(0, Math.max(0, Math.floor((frame - settle - 40) / 3)));
  // The mark's drawn shape sits about at the centre of its 460 px box; centred, then 150 px up.
  const markTop = 540 - 230 - 30 - 150 * rise;
  // The film ends as the track's tail decays: the lockup fades to black.
  const fade = interpolate(frame, [T.end - T.hit - 100, T.end - T.hit - 6], [1, 0], { easing: ease.inOut });
  return (
    <Stage>
      <div style={{ ...fill, opacity: fade }}>
        <div style={{ position: "absolute", left: 960 - 230, top: markTop }}>
          <LaunchIntro size={460} glint={settle + 110} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 590,
            textAlign: "center",
            font: `${WEIGHT} 96px/1 ${SANS}`,
            letterSpacing: "-0.03em",
          }}
        >
          <Reveal at={settle + 8} mask stagger={0.06}>
            Intentface Launch
          </Reveal>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 720,
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

export default defineVideo({
  id: "intentface-launch",
  title: "Intentface Launch",
  logline: "For developers and product teams: launch videos written as code, from your real UI.",
  audio: { src: new URL("./audio/the-launch.wav", import.meta.url).href },
  // Sound on what the picture does, sparing where the track is busy (the drop, the reel).
  // Sound on what the picture does. Levels are peaks before the master: placed 8 dB or more under a
  // dense track they vanish, so each sits about where the track's own hits do.
  sfx: [
    { src: "sfx:click-button", at: T.click, peak: -3 },
    { src: "sfx:whoosh-soft", at: T.click + 150, align: "peak", peak: -12 }, // the pull back
    { src: "sfx:swish", at: T.code + 14, align: "peak", peak: -11 },
    ...[...DELETES, ...TYPES].map((at, i) => ({ src: "sfx:click", at: T.code + at, peak: i % 3 === 1 ? -15 : -12 })),
    // The new launch's checklist ticking (LaunchCard ticks a row every 5 frames after its cue).
    ...[0, 1, 2, 3, 4].map((n) => ({ src: "sfx:tick", at: T.code + TYPES[TYPES.length - 1] + 22 + 5 * n, peak: -11 })),
    ...T.reel.slice(1, 5).map((at) => ({ src: "sfx:whip", at: at - 7, align: "peak" as const, peak: -8 })),
    { src: "sfx:whoosh-soft", at: T.reel[5] + 20, align: "peak", peak: -12 },
    // A tick on every word: slow at first, then a ratchet as the words blur past.
    ...T.create.slice(1).map((at, n, all) => ({ src: "sfx:tick", at, peak: n === all.length - 1 ? -6 : -9 })),
    { src: "sfx:whoosh-soft", at: T.sizes[0] + 24, align: "peak", peak: -12 }, // the family rising into frame
    { src: "sfx:swish", at: T.sizes[0] + 50, align: "peak", peak: -16 }, // the lid opening
    ...[36, 44, 52].map((at) => ({ src: "sfx:tap-glass", at: T.sizes[0] + at, peak: -16 })), // screens waking
    { src: "sfx:click-button", at: T.sizes[1], peak: -7 },
    ...[26, 34, 42].map((at) => ({ src: "sfx:pop", at: T.sizes[1] + at, peak: -14 })),
    ...T.countdown.map((at) => ({ src: "sfx:whoomp-soft", at, peak: -5 })),
    { src: "sfx:shimmer", at: T.hit + 10, peak: -9 },
  ],
  shots: [
    {
      id: "hook",
      title: "Launch",
      duration: T.click,
      component: AppScene3D,
      says: "A product's own Launch button, close up, is clicked.",
      camera:
        "Stage3D: low across the example app's window (a slab with a lit edge) on the Launch button, the rest in bokeh; a slow dolly closer as the cursor arrives, a light sweeping across.",
      notes:
        "Click on the first riser's peak (3.76 s). The app is a made-up example, named Example app on screen (sample-app.tsx).",
      board: [0.3, 0.97],
    },
    {
      id: "app",
      offBeat: true,
      hits: [{ at: 0, sound: "riser" }],
      title: "The app",
      duration: len(T.click, T.code),
      continues: "hook",
      component: AppScene3D,
      says: "The product answers: Launched, Live; the camera pulls back to the whole app.",
      camera:
        "Holds on the button until Launched has landed, then pulls back and turns straight on as the lens stops down; lands on the flat window 16 frames before the cut.",
      notes:
        "Same stage as the hook. The flat window dissolves in over the slab while the camera is still, so the cut to code is pixel-identical (diff app:end against code).",
      board: [0.12, 0.5, 0.95],
    },
    {
      id: "code",
      offBeat: true,
      title: "Code",
      duration: len(T.code, T.written),
      component: Code,
      says: "The video is code: change a line and the frame changes.",
      camera: "Still. The card is carried out of the app to the right, the code arrives on the left.",
      notes: "Spring is deleted and Summer typed; the card's title swaps.",
      board: [0.08, 0.3, 0.9],
    },
    {
      id: "written",
      offBeat: true,
      title: "Written as code",
      duration: len(T.written, T.drop),
      component: card("Written as code.", T.drop - T.written),
      says: "Videos written as code.",
      copy: ["Written as code."],
      notes: "Alone on black, over the swell into the drop.",
      board: [0.6],
    },
    {
      id: "reel",
      offBeat: true,
      hits: [{ at: 0, sound: "boom" }],
      title: "The launch video",
      duration: len(T.drop, T.montage[0]),
      component: Reel3D,
      says: "On the drop, the launch video that code makes: the app coming alive, part by part.",
      camera:
        "A whip on every second beat (motion blur): the card going Live, the checklist ticking, sign-ups counting, the chart drawing, the team arriving; then a pull back to the app.",
      notes:
        "Stage3D on the same slab, the shutter open on the whips; 3D draws at 96 samples, so this stretch is the slow part of a render.",
      board: [0.05, 0.28, 0.45, 0.62, 0.8, 0.98],
    },
    {
      id: "styles",
      title: "Any style",
      duration: len(T.montage[0], T.create[0]),
      component: Styles,
      says: "The same words in any style.",
      copy: ["Any style."],
      camera: "Full frame; a hard cut for each style.",
      notes: `Five styles, one per cut: the first held 1.4 s to read, then two beats each. Stand-ins; build: ${LOOKS.map((l) => `${l.name} (${l.becomes})`).join("; ")}.`,
      board: [0.2, 0.4, 0.58, 0.74, 0.9],
    },
    {
      id: "create",
      title: "Create any video",
      duration: len(T.create[0], T.fromUI),
      component: CreateLine,
      says: "Any kind of video: product, update, intro, ad, demo, teaser, tutorial, podcast, onboarding, recap, launch.",
      copy: ["Create product video."],
      notes: "The middle word rolls through every second beat; the line closes around it on a spring. No UI.",
      board: [0.2, 0.42, 0.62, 0.95],
    },
    {
      id: "from-ui",
      title: "From real product UI",
      duration: len(T.fromUI, T.install),
      component: rolling("From real product UI.", T.install - T.fromUI),
      says: "Made from the product's real interface.",
      copy: ["From real product UI."],
      notes: "Alone on black, finishing the line before it. One bar.",
      board: [0.6],
    },
    {
      id: "install",
      title: "Install it",
      duration: len(T.install, T.fork),
      component: rolling("Install it.", T.fork - T.install),
      says: "It goes into your repo as a dependency.",
      copy: ["Install it."],
      notes: "One bar. No commands on screen.",
      board: [0.6],
    },
    {
      id: "fork",
      title: "Or fork it",
      duration: len(T.fork, T.open),
      component: rolling("Or fork it.", T.open - T.fork),
      says: "Or fork it and make it yours.",
      copy: ["Or fork it."],
      notes: "One bar.",
      board: [0.6],
    },
    {
      id: "open",
      title: "Open source",
      duration: len(T.open, T.sizes[0]),
      component: card("Open source.", T.sizes[0] - T.open, 0),
      says: "It is open source (MIT).",
      copy: ["Open source."],
      notes: "One bar, as the pulse stops.",
      board: [0.6],
    },
    {
      id: "sizes",
      title: "Every platform",
      duration: len(T.sizes[0], T.breakdown),
      component: SizesDevices,
      says: "One launch clip made for every platform: a video site on a laptop (16:9), a photo feed on a tablet (1:1), a short-video app on a phone (9:16), each laid out again.",
      copy: ["Every platform."],
      notes:
        "Stage3D: generic devices on a black mirror floor, each screen a different kind of platform told apart by layout and theme (no platform's name or marks). The lid opens as the line lands and the other screens wake; on the lift (47.82 s) the button in all three becomes Launched on the same frame, then the likes come in.",
      board: [0.12, 0.45, 0.9],
    },
    {
      id: "countdown",
      title: "Countdown",
      duration: len(T.breakdown, T.hit),
      component: Countdown,
      says: "A breath, then the count down to the launch.",
      copy: ["3", "2", "1"],
      notes: "Breakdown: black, then 3, 2, 1 every second beat into the hit. No logo before the hit.",
      board: [0.5, 0.92],
    },
    {
      id: "end",
      offBeat: true,
      hits: [{ at: 0, sound: "boom" }],
      title: "Launch",
      duration: len(T.hit, T.end),
      component: End,
      says: "Intentface Launch, and where to find it.",
      copy: ["Intentface Launch", "launch.intentface.com"],
      notes:
        "The Launch mark's own intro on the hit (55.75 s), alone and centred; once parked it rises and the name and URL arrive.",
      board: [0.08, 0.3, 0.9],
    },
  ],
});
