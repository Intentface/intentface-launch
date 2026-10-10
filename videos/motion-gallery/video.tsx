import {
  defineVideo,
  type Easing,
  ease,
  interpolate,
  lerp,
  motion,
  type Personality,
  personalities,
  progress,
  type SpringConfig,
  settleFrames,
  springEase,
  springs,
  springsAt,
  springTo,
  springToVelocity,
  tempo,
  useFrame,
  useVideoInfo,
} from "@intentface-launch/core";
import { Camera, Reveal, Typewriter, typingCadence, useFontsReady, useMeasureText } from "@intentface-launch/core/kit";
import type { ReactNode } from "react";

const t = tempo(120, 60);
const ground = "#0f1013";
const ink = "#f3f2ef";
const dim = "rgb(243 242 239 / 0.6)";
const rule = "rgb(243 242 239 / 0.14)";
const accent = "#8cc8ff";
const sans = '"Studio Sans", ui-sans-serif, system-ui, sans-serif';
const mono = '"Studio Mono", ui-monospace, Menlo, monospace';

const fill = { position: "absolute", inset: 0, background: ground, color: ink, fontFamily: sans } as const;

function Label({
  x,
  y,
  children,
  size = 30,
  color = dim,
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: mono,
        fontSize: size,
        color,
        whiteSpace: "pre",
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

/** A dot on a track, with three fading copies behind it so a still shows its speed. */
function Track({ y, at, length = 1300 }: { y: number; at: (frame: number) => number; length?: number }) {
  const frame = useFrame();
  const left = 440;
  return (
    <>
      <div style={{ position: "absolute", left, top: y, width: length, height: 2, background: rule }} />
      {[12, 8, 4, 0].map((lag) => (
        <div
          key={lag}
          style={{
            position: "absolute",
            left: left + at(frame - lag) * length - 14,
            top: y - 13,
            width: 28,
            height: 28,
            borderRadius: 14,
            background: lag === 0 ? accent : "rgb(140 200 255 / 0.18)",
          }}
        />
      ))}
    </>
  );
}

const EASINGS: [string, Easing][] = [
  ["settle", ease.settle],
  ["glide", ease.glide],
  ["inOut", ease.inOut],
  ["swap", ease.swap],
  ["soft", ease.soft],
  ["exit", ease.exit],
  ["in", ease.in],
  ["pop", ease.pop],
  ["linear", ease.linear],
];

/** Every easing token over the same second, out and back. */
function Easings() {
  return (
    <div style={fill}>
      <Label x={120} y={100} size={36} color={ink}>
        Easing tokens, 1 s out and back
      </Label>
      {EASINGS.map(([name, easing], i) => {
        const y = 210 + i * 86;
        return (
          <div key={name}>
            <Label x={120} y={y - 15}>
              {name}
            </Label>
            <Track
              y={y}
              at={(f) => interpolate(f, [30, 90], [0, 1], { easing }) - interpolate(f, [150, 210], [0, 1], { easing })}
            />
          </div>
        );
      })}
    </div>
  );
}

const SPRINGS: [string, SpringConfig][] = [
  ["gentle", springs.gentle],
  ["snappy", springs.snappy],
  ["bouncy", springs.bouncy],
  ["heavy", springs.heavy],
  ["d 24, b 0.3", { duration: 24, bounce: 0.3 }],
];

/** The spring presets, with their settle time, and one value retargeted mid-flight. */
function Springs() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const feel = springsAt(fps);
  const retarget = [
    { at: 0, to: 0 },
    { at: 30, to: 1 },
    { at: 48, to: 0.4 },
    { at: 150, to: 0 },
  ];
  return (
    <div style={fill}>
      <Label x={120} y={100} size={36} color={ink}>
        Springs: out at 0.5 s, back at 2.5 s
      </Label>
      {SPRINGS.map(([name, config], i) => {
        const y = 230 + i * 120;
        const keys = [
          { at: 0, to: 0 },
          { at: 30, to: 1 },
          { at: 150, to: 0 },
        ];
        const f = name in feel ? feel[name as keyof typeof feel] : null;
        return (
          <div key={name}>
            <Label x={120} y={y - 15}>
              {name}
            </Label>
            <Label x={440} y={y + 30} size={28}>
              {`${f ? `duration ${f.duration.toFixed(0)}f, bounce ${f.bounce.toFixed(2)}, ` : ""}settles in ${settleFrames(config, fps).toFixed(0)}f`}
            </Label>
            <Track y={y} length={1000} at={(fr) => springTo(fr, fps, keys, config)} />
          </div>
        );
      })}
      {(() => {
        const y = 230 + SPRINGS.length * 120;
        const speed = Math.abs(springToVelocity(frame, fps, retarget, springs.snappy)) * 1000;
        return (
          <>
            <Label x={120} y={y - 15}>
              retarget
            </Label>
            <Label x={440} y={y + 30} size={28}>
              {`1 then 0.4 mid-flight, speed ${speed.toFixed(0)} px/f`}
            </Label>
            <Track y={y} length={1000} at={(fr) => springTo(fr, fps, retarget, springs.snappy)} />
          </>
        );
      })()}
    </div>
  );
}

const SUMMARY: Record<Personality, string> = {
  premium: "settle, heavy, on the beat",
  energetic: "out, snappy, on the beat",
  playful: "pop, bouncy, half beat",
};

/** A card landing per personality, its rows a step apart, a line of type with its stagger. */
function Personalities() {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  return (
    <div style={fill}>
      {(Object.keys(personalities) as Personality[]).map((name, col) => {
        const m = motion(name, t);
        const cx = 400 + col * 560;
        const land = 30;
        const leave = 200;
        const y = springTo(
          frame,
          fps,
          [
            { at: 0, to: 220 },
            { at: land, to: 0 },
          ],
          m.spring,
        );
        const shown = progress(frame, land, m.duration, m.enter);
        const out = progress(frame, leave, m.exitDuration, m.exit);
        return (
          <div key={name}>
            <Label x={cx - 210} y={110} size={40} color={ink}>
              {name}
            </Label>
            <Label x={cx - 210} y={166} size={28}>
              {SUMMARY[name]}
            </Label>
            <div
              style={{
                position: "absolute",
                left: cx - 210,
                top: 300,
                width: 420,
                height: 300,
                borderRadius: 32,
                background: "rgb(255 255 255 / 0.07)",
                border: `2px solid ${rule}`,
                opacity: Math.min(1, shown * 1.5) * (1 - out),
                transform: `translateY(${y + out * 120}px) scale(${lerp(0.92, 1, shown)})`,
              }}
            >
              {[0, 1, 2].map((i) => {
                const p = progress(frame, m.at(i, land + 12), m.duration, m.enter);
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 36,
                      top: 44 + i * 80,
                      height: 44,
                      width: [300, 220, 260][i] * p,
                      borderRadius: 22,
                      background: i === 0 ? accent : "rgb(255 255 255 / 0.18)",
                      opacity: p,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                left: cx - 210,
                top: 680,
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              <Reveal
                at={land + 40}
                every={m.stagger}
                frames={m.duration}
                easing={m.enter}
                scale={name === "playful" ? 0.6 : undefined}
                exit={leave}
                exitDuration={m.exitDuration / fps}
              >
                Ready when you are
              </Reveal>
            </div>
            <Label x={cx - 210} y={800} size={28}>
              {`stagger ${m.stagger}f, step ${m.step}f`}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

const TYPED = "Find flights to Lisbon";
const TYPED_AT = 60;
/** Shared with the sound: `sfx: TYPED_KEYS.map((f, i) => ({ at: TYPED_AT + f, hit: i … }))`. */
const TYPED_KEYS = typingCadence(TYPED, 60, { cps: 14 });
const TYPE_FONT = '600 56px "Studio Sans"';

/** The typed line with an underline as wide as what has been typed, measured once the font has loaded. */
function Typed() {
  const frame = useFrame();
  const shown = TYPED_KEYS.filter((f) => frame - TYPED_AT >= f).length;
  const measure = useMeasureText(TYPED.slice(0, shown), TYPE_FONT, { letterSpacing: -1.12 });
  return (
    <div style={{ position: "relative" }}>
      <Typewriter at={TYPED_AT} times={TYPED_KEYS}>
        {TYPED}
      </Typewriter>
      <div style={{ position: "absolute", left: 0, top: 74, height: 4, width: measure.width, background: accent }} />
    </div>
  );
}

/** One line per Reveal preset, and typing with a person's cadence. */
function Type() {
  useFontsReady(TYPE_FONT);
  const rows: [string, ReactNode][] = [
    [
      "mask, exit read",
      <Reveal key="m" by="line" mask at={20} frames={40} easing={ease.settle} exit="read">
        Rise out of the line
      </Reveal>,
    ],
    [
      "char, every 2f",
      <Reveal key="c" by="char" at={40} every={2} frames={30}>
        Letter by letter
      </Reveal>,
    ],
    [
      "times on beats",
      <Reveal key="b" times={[t.beats(1), t.beats(2), t.beats(3), t.beats(4)]} frames={24} rise={0.6}>
        One word per beat
      </Reveal>,
    ],
    [
      "blur in",
      <Reveal key="u" at={60} blur={0.35} rise={0} frames={48} easing={ease.soft}>
        Condense out of blur
      </Reveal>,
    ],
    [
      "scale settle",
      <Reveal key="s" at={80} scale={0.7} rise={0} frames={30} easing={ease.pop}>
        Settle into scale
      </Reveal>,
    ],
    [
      "axes wght",
      <Reveal key="a" by="char" at={100} every={3} frames={40} rise={0} blur={0} axes={{ wght: [200, 800] }}>
        Weight ripple
      </Reveal>,
    ],
    ["typed, cadence", <Typed key="t" />],
  ];
  return (
    <div style={fill}>
      {rows.map(([label, node], i) => {
        const y = 140 + i * 122;
        return (
          <div key={label}>
            <Label x={120} y={y + 16} size={28}>
              {label}
            </Label>
            <div
              style={{
                position: "absolute",
                left: 520,
                top: y,
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                fontFamily: sans,
              }}
            >
              {node}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CARDS = ["Search", "Compare", "Book", "Pack", "Fly", "Land"];

/** A camera push into one card and a partial pull back, the second move set off before the first lands. */
function Push() {
  const m = motion("premium", t);
  return (
    <div style={fill}>
      <Camera
        keys={[
          { at: 0, view: { x: 960, y: 560, zoom: 1 } },
          { at: 30, view: { x: 960, y: 560, zoom: 1 } },
          { at: 120, view: { x: 720, y: 260, width: 480, height: 280 }, easing: ease.inOut, padding: 0.18 },
          { at: 220, view: { x: 960, y: 560, zoom: 1.4 }, easing: springEase(0.1), travel: 110 },
        ]}
      >
        {CARDS.map((name, i) => {
          const x = 180 + (i % 3) * 540;
          const y = i < 3 ? 400 : 740;
          return (
            <div
              key={name}
              style={{
                position: "absolute",
                left: x,
                top: y - 140,
                width: 480,
                height: 280,
                borderRadius: 28,
                background: i === 1 ? "rgb(140 200 255 / 0.16)" : "rgb(255 255 255 / 0.06)",
                border: `2px solid ${i === 1 ? accent : rule}`,
                padding: 36,
                boxSizing: "border-box",
                fontSize: 48,
                fontWeight: 600,
              }}
            >
              {name}
              <div
                style={{ fontSize: 28, fontWeight: 400, color: dim, marginTop: 16 }}
              >{`Step ${i + 1} of ${CARDS.length}`}</div>
            </div>
          );
        })}
      </Camera>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 960,
          width: 1728,
          height: 68,
          background: ground,
          opacity: 0.85,
          borderRadius: 16,
        }}
      />
      <Label x={120} y={980} size={28}>
        {`camera: inOut push, springEase(0.1) pull back (premium enter is ${m.duration}f)`}
      </Label>
    </div>
  );
}

export default defineVideo({
  id: "motion-gallery",
  title: "Motion gallery",
  logline: "Every motion token side by side, to tune them and to review against.",
  bpm: t.bpm,
  background: ground,
  shots: [
    { id: "easings", title: "Easings", duration: t.beats(8), component: Easings, offBeat: true },
    { id: "springs", title: "Springs", duration: t.beats(8), component: Springs },
    { id: "personalities", title: "Personalities", duration: t.beats(8), component: Personalities },
    { id: "type", title: "Kinetic type", duration: t.beats(8), component: Type },
    { id: "push", title: "Camera push", duration: t.beats(8), component: Push },
  ],
});
