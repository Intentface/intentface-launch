import { random, useFrame, useVideoInfo } from "@intentface-launch/core";
import type { CSSProperties } from "react";

// The Launch mark's intro animation (the rocket flies in from the lower left
// and parks, the burner rays spring out and flicker, motion lines stream
// past), on the video's clock. The geometry, timing and gradient are the
// studio's (packages/core/studio/launch-mark.tsx, which runs the same intro on
// requestAnimationFrame); here every value is a function of the time.

const VB = 571;
const C = VB / 2;
const HUB = [291.817, 276.3];
const HEADING = [Math.SQRT1_2, -Math.SQRT1_2];
const BAR_W = 24.9;
const RAY_LEN = 200;
const RAY_BACK = 16;
const APEX = -14.36;
const RAY_ANGLES = [-60, -30, 0, 30, 60];
const RAY_DELAY = [0.28, 0.2, 0.12, 0.2, 0.28];
const ROCKET_X = -207.82;
const ROCKET_LEN = 158.535;
const GRAD = { x1: -9.299, y1: -179.434, x2: 78.667, y2: 170.007 };
const FLIGHT_DIST = 720;
const FLIGHT_S = 1.9;
const LINE_COUNT = 20;
const LINE_SPAN = 430;
const LINE_MAX = 0.26;
const TAU = Math.PI * 2;

const RAY_NOISE = RAY_ANGLES.map((_, i) => ({
  f: [2.3 + i * 0.37, 5.1 + ((i * 1.7) % 1.3), 9.7 + i * 0.9],
  p: [i * 1.3, i * 2.9 + 0.4, i * 0.7 + 1.1],
  jf: 3.3 + i * 0.41,
}));

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function spring(t: number, w = 3.4, z = 0.62) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w * t);
  return 1 - e * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
function flame(i: number, t: number) {
  const n = RAY_NOISE[i];
  return (
    0.55 * Math.sin(TAU * n.f[0] * t + n.p[0]) +
    0.3 * Math.sin(TAU * n.f[1] * t + n.p[1]) +
    0.15 * Math.sin(TAU * n.f[2] * t + n.p[2]) +
    0.35 * Math.sin(TAU * 1.6 * t - i * 0.9) -
    0.25
  );
}
function rayPoints(angleDeg: number, len: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const h = BAR_W / 2;
  const nx = -dy * h;
  const ny = dx * h;
  const bx = -RAY_BACK * dx;
  const by = -RAY_BACK * dy;
  const ex = Math.max(0, len) * dx;
  const ey = Math.max(0, len) * dy;
  const p = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  return `${p(bx - nx, by - ny)} ${p(ex - nx, ey - ny)} ${p(ex + nx, ey + ny)} ${p(bx + nx, by + ny)}`;
}

/** Motion lines, seeded: each streams past at its own speed and wraps round. */
const LINES = Array.from({ length: LINE_COUNT }, (_, i) => {
  const r = random(`launch-line-${i}`);
  const th = 1.6 + r() * 2.4;
  return {
    u0: -LINE_SPAN - 200 + r() * (LINE_SPAN * 2 + 200),
    v: (r() * 2 - 1) * 390,
    len: 50 + r() * 190,
    th,
    o: 0.35 + r() * 0.65,
    k: 0.6 + ((th - 1.6) / 2.4) * 0.8,
  };
});

/** The mark's intro, `at` frames into the shot; at rest before it has started is the parked mark. */
export function LaunchIntro({
  at = 0,
  size = 360,
  glint,
  burner = 1,
  lines = 1,
  colors = ["#7CE7FF", "#FE9EFF", "#FFEFA9"],
  style,
}: {
  at?: number;
  size?: number;
  /** A frame (in the shot) at which a band of light runs once along the parked mark, from the rocket out through the rays. */
  glint?: number;
  /** The burner rays' opacity (1): lower it when real flames take over from them. */
  burner?: number;
  /** The motion lines' opacity (1). */
  lines?: number;
  /** The rays' gradient, three stops (default the mark's own cyan, pink and butter). */
  colors?: [string, string, string];
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const t = Math.max(0, (frame - at) / fps);

  // Flight: in from the lower left, easing out on a quartic.
  const p = Math.min(1, t / FLIGHT_S);
  const s = -FLIGHT_DIST * (1 - p) ** 4;
  const flown = FLIGHT_DIST * (1 - (1 - p) ** 4); // distance travelled, for the lines' speed
  const amp = 1 - smoothstep(0.9, 2.5, t); // the burner's flicker, dying out as it settles
  const mx = HUB[0] + HEADING[0] * s;
  const my = HUB[1] + HEADING[1] * s;
  let envMin = 1;
  const rays = RAY_ANGLES.map((angle, i) => {
    const env = spring(t - RAY_DELAY[i]);
    envMin = Math.min(envMin, env);
    const len = RAY_LEN * env * (1 + 0.16 * amp * flame(i, t));
    const jitter = amp * 1.8 * Math.sin(TAU * RAY_NOISE[i].jf * t + i);
    return rayPoints(angle + jitter, len);
  });
  const ignite = clamp01(envMin * 3);
  // The glint: a soft band moving along the mark's own axis (local x: rocket at -208, rays to +200).
  const g = glint === undefined ? -1 : (frame - glint) / 40;
  const band = g > 0 && g < 1 ? -330 + g * 640 : null;

  // Lines: in fast for 1.5 s, then fading out slowly.
  const linesOp = t < 1.5 ? 1 - Math.exp(-5 * t) : (1 - Math.exp(-7.5)) * Math.exp(-1.6 * (t - 1.5));
  const span = LINE_SPAN * 2 + 240;

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      style={{ display: "block", overflow: "hidden", ...style }}
      aria-hidden
    >
      <defs>
        <linearGradient id="launch-intro-g" gradientUnits="userSpaceOnUse" {...GRAD}>
          <stop stopColor={colors[0]} />
          <stop offset="0.505208" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
        <clipPath id="launch-intro-w">
          <polygon points={`${APEX},0 ${APEX + 1000},-1732 ${APEX + 1000},1732`} />
        </clipPath>
        {/* The lines fade out before the box's edge, so its square never shows. */}
        <radialGradient id="launch-intro-r" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.35" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="launch-intro-m" maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}>
          <rect width={VB} height={VB} fill="url(#launch-intro-r)" />
        </mask>
        {band !== null && (
          <linearGradient
            id="launch-intro-gl"
            gradientUnits="userSpaceOnUse"
            x1={band - 90}
            y1={0}
            x2={band + 90}
            y2={0}
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        )}
        <linearGradient id="launch-intro-l" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.08" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g mask="url(#launch-intro-m)">
        <g opacity={(linesOp * LINE_MAX * lines).toFixed(4)} transform={`rotate(-45 ${C} ${C})`}>
          {LINES.map((l) => {
            const travel = l.k * (560 * t + 1.1 * flown);
            const u = ((((l.u0 - travel + LINE_SPAN + 240) % span) + span) % span) - LINE_SPAN - 240;
            return (
              <rect
                key={`${l.u0}-${l.v}`}
                x={C + u}
                y={C + l.v - l.th / 2}
                width={l.len}
                height={l.th}
                opacity={l.o}
                fill="url(#launch-intro-l)"
              />
            );
          })}
        </g>
      </g>
      <g transform={`translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(135)`}>
        <g clipPath="url(#launch-intro-w)" fill="url(#launch-intro-g)" opacity={ignite * burner}>
          {rays.map((points, i) => (
            <polygon key={RAY_ANGLES[i]} points={points} />
          ))}
        </g>
        <rect x={ROCKET_X} y={-BAR_W / 2} width={ROCKET_LEN} height={BAR_W} fill="#fff" />
        {band !== null && (
          <g fill="url(#launch-intro-gl)">
            <g clipPath="url(#launch-intro-w)">
              {rays.map((points, i) => (
                <polygon key={RAY_ANGLES[i]} points={points} />
              ))}
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
