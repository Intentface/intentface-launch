import { BloomEffect, Effect } from "postprocessing";
import type { CSSProperties, ReactNode } from "react";
import { Uniform } from "three";
import { PostFX, usePostEffect } from "./effects.js";

// A CRT over any DOM: the tube's face bulging a little, colour fringing that
// grows towards the edges, scanlines (and, optionally, a phosphor dot mask) that only
// show on what is lit (video compression would smear them off a dark ground),
// a slow roll bar as when a screen is filmed, a flicker, a vignette, and a
// soft glow around bright text. Every part is on the video's clock. The
// defaults are a texture, not a costume: text stays crisp enough to read.

const FRAGMENT = /* glsl */ `
uniform float curvature;
uniform float fringe;
uniform float scanlines;
uniform float mask;
uniform float dither;
uniform float roll;
uniform float flicker;
uniform float vignette;

float crtHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Barrel distortion: the picture bulges towards the viewer like a tube's face.
vec2 crtBend(vec2 q) {
  vec2 c = q * 2.0 - 1.0;
  c *= 1.0 + curvature * vec2(0.6, 1.0) * (c.yx * c.yx);
  return c * 0.5 + 0.5;
}

void mainUv(inout vec2 uv) { uv = crtBend(uv); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // 1080p pixels, whatever the device ratio: the look keeps its scale in 4K.
  float px = resolution.y / 1080.0;
  vec2 c = uv - 0.5;

  // Colour fringing: red a little left, blue a little right, more towards the edges. Only the
  // difference a shift makes is added, at half strength: flat colour stays exactly its colour (the
  // raw samples are in the buffer's encoding, inputColor is decoded), and only edges tint.
  vec2 shift = (vec2(fringe, 0.0) + c * vec2(fringe * 2.0, fringe)) * px * texelSize;
  vec4 raw = texture2D(inputBuffer, uv);
  vec3 col = inputColor.rgb;
  col.r += 0.5 * (texture2D(inputBuffer, uv + shift).r - raw.r);
  col.b += 0.5 * (texture2D(inputBuffer, uv - shift).b - raw.b);

  // A slow roll bar and a per-frame flicker.
  float frame = floor(time * 60.0 + 0.5);
  float bar = exp(-pow((fract(uv.y + time * 0.11) - 0.5) * 7.0, 2.0));
  float light = (1.0 + roll * bar) * (1.0 + (crtHash(vec2(frame, 7.0)) - 0.5) * 2.0 * flicker);
  col *= light;

  // Scanlines and phosphor dots on a fixed grid of output pixels, so they never shimmer as the
  // picture moves. Their strength follows brightness: lit text is textured, the dark glass is not.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float lit = smoothstep(0.02, 0.4, lum);
  float line = 0.5 + 0.5 * cos(6.2831853 * gl_FragCoord.y / (3.0 * px));
  col *= 1.0 - scanlines * lit * (1.0 - line);
  vec2 cell = mod(gl_FragCoord.xy, 3.0 * px) / (3.0 * px) - 0.5;
  float dot3 = exp(-dot(cell, cell) / 0.18);
  col *= mix(1.0, 0.75 + 0.5 * dot3, mask * lit);

  // The glass: darker towards the corners, and the edge of the bent picture soft.
  float edge = smoothstep(0.0, 0.004, uv.x) * smoothstep(0.0, 0.004, uv.y)
    * smoothstep(0.0, 0.004, 1.0 - uv.x) * smoothstep(0.0, 0.004, 1.0 - uv.y);
  float v = pow(clamp(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.0, 1.0), 0.25);
  col *= mix(1.0, v, vignette) * edge;

  // Optional dither against banding in glows and the vignette. Off by default: per-pixel noise that
  // changes every frame is what video compression handles worst, and turns into blocks.
  col += (crtHash(gl_FragCoord.xy + frame * 17.13) - 0.5) * (dither / 255.0);
  outputColor = vec4(max(col, 0.0), inputColor.a);
}`;

export type CrtOptions = {
  /** How far the face bulges (0 flat; default 0.012, barely there; 0.05 a real tube). */
  curvature?: number;
  /** Colour fringing in 1080p pixels at the centre, twice that at the edges (default 0.7). */
  fringe?: number;
  /** Scanline depth on lit pixels, 0 to 1 (default 0.14). */
  scanlines?: number;
  /** Phosphor dot texture on lit pixels, 0 to 1 (default 0: fine texture breaks up under video compression; 0.05 to 0.1 for a master that will not be recompressed). */
  mask?: number;
  /** Dither in 8-bit levels against banding (default 0: per-frame noise compresses into blocks). */
  dither?: number;
  /** Brightness of the slow roll bar (default 0.03). */
  roll?: number;
  /** Per-frame brightness flicker, ± (default 0.01). */
  flicker?: number;
  /** Darkening towards the corners, 0 to 1 (default 0.25). */
  vignette?: number;
};

const DEFAULTS: Required<CrtOptions> = {
  curvature: 0.012,
  fringe: 0.7,
  scanlines: 0.14,
  mask: 0,
  dither: 0,
  roll: 0.03,
  flicker: 0.01,
  vignette: 0.25,
};

/**
 * The CRT pass as a postprocessing effect, for `PostFX` or a `Stage3D`'s
 * `post.effects`. Its look is uniforms: `crt.set({ scanlines: 0.3 })` from the frame.
 */
export class CrtEffect extends Effect {
  constructor(options: CrtOptions = {}) {
    const values = { ...DEFAULTS, ...options };
    super("CrtEffect", FRAGMENT, {
      uniforms: new Map(Object.entries(values).map(([k, v]) => [k, new Uniform(v)])),
    });
  }

  set(options: CrtOptions) {
    for (const [k, v] of Object.entries(options)) {
      const uniform = this.uniforms.get(k);
      if (uniform && v !== undefined) uniform.value = v;
    }
  }
}

/**
 * Any DOM on a subtle CRT, with a soft glow around what is bright: a
 * terminal, a code editor, type that should feel like a screen. The children
 * are drawn in through Chrome's HTML-in-Canvas (`PostFX`), so text inside is
 * not measured by `check`. Every option can change per frame.
 *
 *   <Crt glow={0.6}><Terminal /></Crt>
 */
export function Crt({
  children,
  glow = 0.6,
  width,
  height,
  style,
  ...options
}: CrtOptions & {
  children: ReactNode;
  /** Bloom around bright pixels (0 none; default 0.6, a halo you notice only when it is gone). */
  glow?: number;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  const crt = usePostEffect(() => new CrtEffect());
  const bloom = usePostEffect(
    () => new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.12, luminanceSmoothing: 0.3, radius: 0.62 }),
  );
  crt.set({ ...DEFAULTS, ...options });
  bloom.intensity = glow;
  return (
    <PostFX effects={glow > 0 ? [bloom, crt] : [crt]} width={width} height={height} style={style}>
      {children}
    </PostFX>
  );
}
