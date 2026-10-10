"use client";

import { type CSSProperties, useEffect, useId, useRef } from "react";

/*
 * The Launch mark: a rocket with a fan of burner rays. Studio chrome, not a
 * scene, so it runs on the browser's clock (requestAnimationFrame) rather than
 * useFrame(). The docs import this same file.
 *
 * Geometry is reconstructed from launch-dark.svg (571 × 571 viewBox).
 * Everything for the mark lives in a local frame: origin at the burner hub,
 * +x pointing down-left (the exhaust direction).
 */
const VB = 571;
const HUB = [291.817, 276.3]; // where the ray centerlines meet
const HEADING = [Math.SQRT1_2, -Math.SQRT1_2]; // rocket travel direction (screen)
const BAR_W = 24.9;
const RAY_LEN = 200;
const RAY_BACK = 16; // rays reach behind the hub; the wedge clip trims them
const APEX = -14.36; // tip of the burner wedge
const RAY_ANGLES = [-60, -30, 0, 30, 60];
const ROCKET_X = -207.82;
const ROCKET_LEN = 158.535;
const GRAD = { x1: -9.299, y1: -179.434, x2: 78.667, y2: 170.007 };

/** The resting mark's bounds in the viewBox, measured; centred on them it reads
    as an icon, where the full viewBox leaves room for the flight path. */
const MARK_CENTER = [271.5, 296.6];
const MARK_SIZE = 352.2;
const ICON_FILL = 0.66;
const ICON_SIDE = MARK_SIZE / ICON_FILL;
/** An optical nudge toward the lower left: the burner fan is the heavier end. */
const ICON_NUDGE = [-16, 16];
export const ICON_VIEWBOX = [
  MARK_CENTER[0] - ICON_NUDGE[0] - ICON_SIDE / 2,
  MARK_CENTER[1] - ICON_NUDGE[1] - ICON_SIDE / 2,
  ICON_SIDE,
  ICON_SIDE,
]
  .map((n) => +n.toFixed(2))
  .join(" ");

/* Timing, in seconds */
const FLIGHT_DIST = 720;
const FLIGHT_S = 1.9;
const INTRO_S = 2.8;
const RAY_DELAY = [0.28, 0.2, 0.12, 0.2, 0.28];

/* Motion lines */
const LINE_COUNT = 20;
const LINE_SPAN = 430;
const C = VB / 2;

const THEMES = {
  dark: { mark: "#ffffff", lines: "#ffffff", linesMax: 0.26 },
  light: { mark: "#000000", lines: "#000000", linesMax: 0.14 },
  // Follows the page: the app sets --launch-mark-ink and --launch-mark-lines
  // (the motion lines' peak opacity) per theme; unset, it is the dark version.
  auto: { mark: "var(--launch-mark-ink, #ffffff)", lines: "var(--launch-mark-ink, #ffffff)", linesMax: 1 },
};

const RAY_NOISE = RAY_ANGLES.map((_, i) => ({
  f: [2.3 + i * 0.37, 5.1 + ((i * 1.7) % 1.3), 9.7 + i * 0.9],
  p: [i * 1.3, i * 2.9 + 0.4, i * 0.7 + 1.1],
  jf: 3.3 + i * 0.41,
}));

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Damped spring from 0 to 1 with a soft overshoot. */
function spring(t: number, w = 3.4, z = 0.62) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w * t);
  return 1 - e * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Flame-like noise per ray: layered sines plus a wave that rolls across the fan. */
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
  const f = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  return `${f(bx - nx, by - ny)} ${f(ex - nx, ey - ny)} ${f(ex + nx, ey + ny)} ${f(bx + nx, by + ny)}`;
}

function markTransform(s: number) {
  const x = HUB[0] + HEADING[0] * s;
  const y = HUB[1] + HEADING[1] * s;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(135)`;
}

type Line = { u: number; v: number; len: number; th: number; o: number; k: number };

function newLine(u?: number): Line {
  const th = 1.6 + Math.random() * 2.4;
  return {
    u: u ?? LINE_SPAN + Math.random() * 240,
    v: (Math.random() * 2 - 1) * 390,
    len: 50 + Math.random() * 190,
    th,
    o: 0.35 + Math.random() * 0.65,
    k: 0.6 + ((th - 1.6) / 2.4) * 0.8, // thicker lines read as nearer, move faster
  };
}

function placeLine(el: SVGRectElement | null, l: Line) {
  if (!el) return;
  el.setAttribute("y", (C + l.v - l.th / 2).toFixed(2));
  el.setAttribute("height", l.th.toFixed(2));
  el.setAttribute("width", l.len.toFixed(2));
  el.setAttribute("opacity", l.o.toFixed(2));
}

export type LaunchMarkProps = {
  size?: number | string;
  theme?: keyof typeof THEMES;
  /** The rocket flies in from the bottom left and parks; the burner ignites and settles. Read on mount. */
  animateIn?: boolean;
  /** The burner flickers like an afterburner and motion lines stream past. */
  loading?: boolean;
  color?: string;
  lineColor?: string;
  onAnimateInEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  label?: string;
  /** "icon" centres the resting mark and fills two thirds of the box; "flight" (the default) is the full drawing. */
  framing?: "flight" | "icon";
};

/** The mark alone. Neither `animateIn` nor `loading`: the static logo. */
export function LaunchMark({
  size = 160,
  theme = "dark",
  animateIn = false,
  loading = false,
  color,
  lineColor,
  onAnimateInEnd,
  className,
  style,
  label = "Launch",
  framing = "flight",
}: LaunchMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { grad: `lm-g-${uid}`, wedge: `lm-w-${uid}`, line: `lm-l-${uid}` };
  const palette = THEMES[theme] ?? THEMES.dark;
  const markColor = color ?? palette.mark;
  const streakColor = lineColor ?? palette.lines;

  const markRef = useRef<SVGGElement>(null);
  const burnerRef = useRef<SVGGElement>(null);
  const raysRef = useRef<(SVGPolygonElement | null)[]>([]);
  const linesGroupRef = useRef<SVGGElement>(null);
  const linesRef = useRef<(SVGRectElement | null)[]>([]);

  const loadingRef = useRef(loading);
  const endRef = useRef(onAnimateInEnd);
  const kickRef = useRef(() => {});
  const linesMaxRef = useRef(palette.linesMax);
  loadingRef.current = loading;
  endRef.current = onAnimateInEnd;
  linesMaxRef.current = palette.linesMax;

  // animateIn is read on mount; remount (change `key`) to replay the launch.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const start = performance.now();
    const sim = {
      intro: animateIn,
      introEnded: !animateIn,
      burn: 0,
      linesOp: 0,
      last: start,
      raf: 0,
      lines: Array.from({ length: LINE_COUNT }, () =>
        newLine(-LINE_SPAN - 200 + Math.random() * (LINE_SPAN * 2 + 200)),
      ),
    };

    sim.lines.forEach((l, i) => {
      placeLine(linesRef.current[i], l);
    });

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - sim.last) / 1000);
      sim.last = now;
      const t = (now - start) / 1000;
      const ti = sim.intro ? t : Number.POSITIVE_INFINITY;
      const isLoading = loadingRef.current;

      // Flight
      let s = 0;
      let v = 0;
      if (!reduced && ti < FLIGHT_S) {
        const p = ti / FLIGHT_S;
        s = -FLIGHT_DIST * (1 - p) ** 4;
        v = (4 * FLIGHT_DIST * (1 - p) ** 3) / FLIGHT_S;
      }

      // Burner intensity
      const introFlicker = ti < INTRO_S ? 1 - smoothstep(0.9, 2.5, ti) : 0;
      sim.burn = approach(sim.burn, isLoading ? 1 : 0, isLoading ? 5 : 3, dt);
      const amp = reduced ? 0 : Math.max(introFlicker, sim.burn);

      // Gentle hover while idling on the pad
      const hover = reduced ? 0 : sim.burn * 2.6 * Math.sin(TAU * 0.7 * t);
      const markOpacity = reduced && sim.intro ? clamp01(ti / 0.5) : 1;

      markRef.current?.setAttribute("transform", markTransform(s + hover));
      markRef.current?.setAttribute("opacity", markOpacity.toFixed(3));

      let envMin = 1;
      RAY_ANGLES.forEach((angle, i) => {
        const env = reduced || ti === Number.POSITIVE_INFINITY ? 1 : spring(ti - RAY_DELAY[i]);
        envMin = Math.min(envMin, env);
        const len = RAY_LEN * env * (1 + 0.16 * amp * flame(i, t));
        const jitter = amp * 1.8 * Math.sin(TAU * RAY_NOISE[i].jf * t + i);
        raysRef.current[i]?.setAttribute("points", rayPoints(angle + jitter, len));
      });

      if (burnerRef.current) {
        const ignite = clamp01(envMin * 3);
        const pulse = reduced ? 1 - sim.burn * 0.22 * (1 + Math.sin(TAU * 0.8 * t)) : 1;
        burnerRef.current.setAttribute("opacity", (ignite * pulse).toFixed(3));
      }

      // Motion lines
      const linesOn = !reduced && (isLoading || ti < 1.5);
      sim.linesOp = approach(sim.linesOp, linesOn ? 1 : 0, linesOn ? 5 : 1.6, dt);
      linesGroupRef.current?.setAttribute("opacity", (sim.linesOp * linesMaxRef.current).toFixed(4));
      if (sim.linesOp > 0.001) {
        const speed = 560 + v * 1.1;
        sim.lines.forEach((l, i) => {
          l.u -= speed * l.k * dt;
          const el = linesRef.current[i];
          if (l.u + l.len < -LINE_SPAN) {
            Object.assign(l, newLine());
            placeLine(el, l);
          }
          el?.setAttribute("x", (C + l.u).toFixed(2));
        });
      }

      if (!sim.introEnded && ti >= INTRO_S) {
        sim.introEnded = true;
        endRef.current?.();
      }

      const settled = sim.introEnded && !isLoading && sim.burn < 0.002 && sim.linesOp < 0.002;
      if (settled) {
        markRef.current?.setAttribute("transform", markTransform(0));
        markRef.current?.setAttribute("opacity", "1");
        burnerRef.current?.setAttribute("opacity", "1");
        linesGroupRef.current?.setAttribute("opacity", "0");
        RAY_ANGLES.forEach((a, i) => {
          raysRef.current[i]?.setAttribute("points", rayPoints(a, RAY_LEN));
        });
        sim.burn = 0;
        sim.linesOp = 0;
        sim.raf = 0;
        return;
      }
      sim.raf = requestAnimationFrame(frame);
    };

    kickRef.current = () => {
      if (!sim.raf) {
        sim.last = performance.now();
        sim.raf = requestAnimationFrame(frame);
      }
    };
    kickRef.current();

    return () => {
      cancelAnimationFrame(sim.raf);
      sim.raf = 0;
      kickRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    kickRef.current();
  }, [loading]);

  const restOffset = animateIn ? -FLIGHT_DIST : 0;

  return (
    <svg
      viewBox={framing === "icon" ? ICON_VIEWBOX : `0 0 ${VB} ${VB}`}
      width={size}
      height={size}
      className={className}
      style={{ display: "block", overflow: "hidden", ...style }}
      role="img"
      aria-label={label}
      aria-busy={loading || undefined}
    >
      <defs>
        <linearGradient id={ids.grad} gradientUnits="userSpaceOnUse" {...GRAD}>
          <stop stopColor="#7CE7FF" />
          <stop offset="0.505208" stopColor="#FE9EFF" />
          <stop offset="1" stopColor="#FFEFA9" />
        </linearGradient>
        <clipPath id={ids.wedge}>
          <polygon points={`${APEX},0 ${APEX + 1000},-1732 ${APEX + 1000},1732`} />
        </clipPath>
        <linearGradient id={ids.line} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: streakColor }} stopOpacity="0" />
          <stop offset="0.08" style={{ stopColor: streakColor }} stopOpacity="1" />
          <stop offset="1" style={{ stopColor: streakColor }} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g style={theme === "auto" ? { opacity: "var(--launch-mark-lines, 0.26)" } : undefined}>
        <g ref={linesGroupRef} opacity="0" transform={`rotate(-45 ${C} ${C})`}>
          {Array.from({ length: LINE_COUNT }, (_, i) => (
            <rect
              key={i}
              ref={(el) => {
                linesRef.current[i] = el;
              }}
              x={-9999}
              y={C}
              width={0}
              height={2}
              fill={`url(#${ids.line})`}
            />
          ))}
        </g>
      </g>

      <g ref={markRef} transform={markTransform(restOffset)}>
        <g ref={burnerRef} clipPath={`url(#${ids.wedge})`} fill={`url(#${ids.grad})`}>
          {RAY_ANGLES.map((a, i) => (
            <polygon
              key={a}
              ref={(el) => {
                raysRef.current[i] = el;
              }}
              points={rayPoints(a, RAY_LEN)}
            />
          ))}
        </g>
        <rect x={ROCKET_X} y={-BAR_W / 2} width={ROCKET_LEN} height={BAR_W} style={{ fill: markColor }} />
      </g>
    </svg>
  );
}

export const DARK_TILE_SHADOW =
  "inset 0 0 0 1px rgb(255 255 255 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.16), 0 1px 2px rgb(0 0 0 / 0.12)";

/**
 * The mark on its app-icon tile, following the page's theme: the app sets
 * --launch-tile-bg and --launch-tile-shadow (and the mark's variables, see
 * THEMES.auto). Unset, it is the dark tile with the code frames' inset ring. Size the tile; the mark fills it.
 */
export function LaunchTile({
  size = 24,
  className,
  style,
  ...mark
}: Omit<LaunchMarkProps, "size" | "theme"> & { size?: number }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-grid",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.27),
        overflow: "hidden",
        background: "var(--launch-tile-bg, #18181b)",
        boxShadow: `var(--launch-tile-shadow, ${DARK_TILE_SHADOW})`,
        ...style,
      }}
    >
      <LaunchMark size="100%" theme="auto" framing="icon" {...mark} />
    </span>
  );
}
