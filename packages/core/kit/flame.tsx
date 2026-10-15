import type { CSSProperties } from "react";
import { useVideoInfo } from "../engine/index.js";
import { colourOf, Shader } from "./shader.js";

/*
 * Fire from a nozzle: a jet of flame leaving a point in one direction,
 * turbulent and flickering on the video's clock. Burns in a fan (`spread`),
 * optionally split into tongues (a logo's rays catching fire), coloured
 * across the fan by a gradient and white hot where it leaves the nozzle.
 */

const frag = /* glsl */ `
uniform vec2 u_size;
uniform vec2 u_origin;
uniform float u_angle;
uniform float u_length;
uniform float u_spread;
uniform float u_tongues;
uniform float u_width;
uniform float u_grow;
uniform vec3 u_colors[4];
uniform float u_count;
uniform vec3 u_core;
uniform float u_hot;
uniform float u_intensity;
uniform float u_turbulence;
uniform float u_speed;
uniform float u_across;
uniform float u_along;

vec3 ramp(float x) {
  float k = clamp(x, 0.0, 1.0) * (u_count - 1.0);
  vec3 c = toLinear(u_colors[0]);
  for (int i = 1; i < 4; i++) {
    if (float(i) >= u_count) break;
    c = mix(c, toLinear(u_colors[i]), smoothstep(0.0, 1.0, clamp(k - float(i - 1), 0.0, 1.0)));
  }
  return c;
}

// One tongue along angle \`ang\` (radians off the jet's axis): a teardrop that
// licks sideways more the further it burns, its tip flickering in length.
// Returns its body (x), its hot spine (y), how bright it burns there (z) and
// the light it throws round itself (w).
vec4 tongue(vec2 q, float ang, float width, float id, float t) {
  float c = cos(ang);
  float s = sin(ang);
  vec2 u = vec2(c * q.x + s * q.y, -s * q.x + c * q.y) / u_length;
  if (u.x < -0.06) return vec4(0.0);
  float x = max(u.x, 0.0);
  // Noise carried out along the tongue, fast: the flame's own flow.
  vec2 f = vec2(x * 4.0 - t * 2.6, u.y * 5.0 + id * 7.31);
  float n = fbm(f + vec2(0.0, fbm(f * 0.7 + vec2(t * 0.9, id)) * 1.4));
  float n2 = noise(vec2(x * 8.0 - t * 4.7, u.y * 9.0 + id * 3.7));
  // It licks sideways, more towards the tip.
  float lateral = u.y + (n - 0.5) * 0.24 * u_turbulence * (0.1 + x * 1.4);
  // Its length breathes, each tongue on its own phase.
  float reach = u_grow * (0.86 + 0.08 * sin(t * 2.3 + id * 1.9) + (noise(vec2(t * 1.9, id * 5.0)) - 0.5) * 0.22);
  float along = x / max(reach, 1e-3);
  // A teardrop: from the nozzle's width, widest a third out, narrowing to the tip.
  float w = width * (0.45 + 1.6 * along) * pow(max(1.0 - along, 0.0), 0.8);
  float d = abs(lateral) + (n2 - 0.5) * 0.03 * u_turbulence;
  float body = 1.0 - smoothstep(w * 0.55, w, d);
  float spine = 1.0 - smoothstep(0.0, w * 0.45, d);
  // Ragged near the tip only: flame breaking up as it burns out.
  float ragged = smoothstep(0.3, 0.55, n + (1.0 - along) * 0.85);
  float start = smoothstep(-0.06, 0.02, u.x);
  // Brighter near the nozzle, flickering inside, dimmer as it burns out.
  float burn = (0.5 + 0.9 * n) * (1.15 - 0.55 * along);
  float halo = exp(-d / max(w, 1e-3) * 1.6) * (1.0 - along) * start * step(along, 1.0);
  return vec4(body * ragged * start, spine * ragged * start * (1.0 - along), burn, halo);
}

void main() {
  vec2 p = v_uv * u_size - u_origin;
  float ca = cos(u_angle);
  float sa = sin(u_angle);
  vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  float t = u_time * u_speed + u_seed * 13.7;
  vec4 fire = vec4(0.0);
  float burn = 0.0;
  if (u_tongues > 1.5) {
    for (int i = 0; i < 9; i++) {
      if (float(i) >= u_tongues) break;
      float k = float(i) / (u_tongues - 1.0) * 2.0 - 1.0;
      vec4 f = tongue(q, k * u_spread, u_width * 0.3, float(i), t);
      if (f.x > fire.x) burn = f.z;
      fire = max(fire, f);
    }
  } else {
    fire = tongue(q, 0.0, u_width * tan(u_spread) * 1.1, 0.0, t);
    burn = fire.z;
  }
  // Light: the gradient across the jet (or along it, hot to cool), white hot along each tongue's spine.
  float reachAt = max(q.x, 0.0) / (u_length * max(u_grow, 0.05));
  vec3 tint = u_along > 0.5 ? ramp(smoothstep(0.0, 0.95, reachAt)) : ramp(0.5 + q.y / max(u_across, 1.0) * 0.5);
  vec3 light = tint * fire.x * burn * 1.2;
  light = mix(light, toLinear(u_core) * 1.3, clamp(fire.y * fire.y * u_hot, 0.0, 1.0));
  light += tint * fire.w * 0.35;
  // A soft glow in the air round the burner.
  float r = length(q) / u_length;
  light += tint * exp(-r * 5.5) * 0.07 * u_grow;
  light *= u_intensity;
  vec3 srgb = toSrgb(light);
  float alpha = clamp(max(srgb.r, max(srgb.g, srgb.b)), 0.0, 1.0);
  gl_FragColor = vec4(min(srgb, vec3(1.0)) + dither8() * alpha, alpha);
}`;

export type FlameProps = {
  /** The nozzle, in the layer's CSS pixels. */
  origin: [number, number];
  /** The jet's direction on screen, in degrees (0 right, 90 down). */
  angle: number;
  /** How far it reaches when fully lit, in CSS pixels. */
  length: number;
  /** Half the fan's opening, in degrees (default 60). */
  spread?: number;
  /** Separate tongues across the fan (0 or 1: one plume). */
  tongues?: number;
  /** Each tongue's width, as a fraction of the gap between tongues (default 0.55). */
  width?: number;
  /** 0 unlit → 1 burning: the flame grows out of the nozzle. */
  grow?: number;
  /** Up to 4 colours across the fan, from its -y side (left of the jet) to its +y side; with `along`, from the nozzle to the tips. */
  colors?: string[];
  /** Colour along the jet instead (hot at the nozzle, cooling to the tips), as real fire burns (default false: across, a logo's gradient). */
  along?: boolean;
  /** Half the distance across the jet the colours span, in CSS pixels (default `length` × 0.5). */
  across?: number;
  /** The white-hot colour near the nozzle, and how much of it shows (default 0.8). */
  core?: string;
  hot?: number;
  intensity?: number;
  /** How much the flame licks and curls (default 1). */
  turbulence?: number;
  /** How fast the fire flows (default 1). */
  speed?: number;
  seed?: number;
  /** The layer's size in CSS pixels (default the video's). */
  size?: [number, number];
  resolution?: number;
  style?: CSSProperties;
};

/**
 * A jet of fire leaving `origin` towards `angle`: turbulent, flickering,
 * frame-locked, white hot at the nozzle and cooling into `colors` across the
 * fan; `tongues` splits it into separate flames (a burner's rays). Light only
 * (premultiplied, transparent elsewhere): put it over a dark ground, or give it
 * `mix-blend-mode: screen`. Ignite it by driving `grow` from 0 to 1 on a spring.
 */
export function Flame({
  origin,
  angle,
  length,
  spread = 60,
  tongues = 0,
  width = 0.55,
  grow = 1,
  colors = ["#ffd27a", "#ff7a3d", "#c2185b"],
  across,
  along = false,
  core = "#fffbe8",
  hot = 0.8,
  intensity = 1.2,
  turbulence = 1,
  speed = 1,
  seed = 0,
  size,
  resolution = 1,
  style,
}: FlameProps) {
  const video = useVideoInfo();
  const [w, h] = size ?? [video.width, video.height];
  const list = colors.slice(0, 4);
  const rgb = list.map((c) => colourOf(c).slice(0, 3));
  while (rgb.length < 4) rgb.push(rgb[rgb.length - 1]);
  return (
    <Shader
      frag={frag}
      seed={seed}
      width={w}
      height={h}
      resolution={resolution}
      style={style}
      uniforms={{
        u_size: [w, h],
        u_origin: origin,
        u_angle: (angle * Math.PI) / 180,
        u_length: length,
        u_spread: (spread * Math.PI) / 180,
        u_tongues: tongues,
        u_width: width,
        u_grow: grow,
        u_colors: rgb,
        u_count: list.length,
        u_core: core,
        u_hot: hot,
        u_intensity: intensity,
        u_turbulence: turbulence,
        u_speed: speed,
        u_across: across ?? length * 0.5,
        u_along: along ? 1 : 0,
      }}
    />
  );
}
