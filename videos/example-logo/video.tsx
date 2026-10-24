// Example: logo stings through a lens of oil, after Apple Music's 2026 sting (filmed in a tray of
// mineral oil rippled by low notes). Each shot is one pattern built on core's `OilLens`: one camera
// looks straight down through moving oil at a bright mark on a dark floor; a dome of oil magnifies
// it, splits its edges into spectral fringes on its steep rim and reveals it only where it has
// reached. `oilDomes` are the film's two domes; `ascii` writes the mark in glyphs as it builds in.
// The marks here are made up (Northwind); swap in the product's own SVG.
// Run: pnpm launch still example-logo --at tile:+10,tile:+40,tile:+100,orb:+20,orb:+60,orb:end --grid
// Expect:
// - tile: black; a small orb rises, its front a band of glyphs, the inside resolving into the
//   magnified star with cyan and orange fringes; it rounds into an app tile whose steep rim smears
//   the star's points into the corners, a ripple leaving its edge; the star sinks away into
//   glyphs while the tile's outline fades.
// - orb: a small orb with rings rises in the middle, widens into an oval over the wordmark, its rim
//   smearing the ends of "Northwind" outward in colour with faint echoes, and falls flat on the
//   plain white word.

import { defineVideo, ease, interpolate, tempo } from "@intentface-launch/core";
import {
  type CanvasPicture,
  monotoneCurve,
  OilLens,
  oilDomes,
  oilShots,
  usePictures,
} from "@intentface-launch/core/kit";
import { look } from "../example-look";

const t = tempo(120, 60);

/** A made-up mark: a four-point spark, white on transparent. */
const SPARK = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100"><path fill="#fff" d="M50 2C53 33 67 47 98 50C67 53 53 67 50 98C47 67 33 53 2 50C33 47 47 33 50 2Z"/></svg>',
)}`;

// --- Tile: a mark grows out of an orb into an app tile ----------------------------------------

const RISE = 6;
const PACE = 1.2;
const at = (seconds: number) => RISE + seconds * 60 * PACE;
const tile = oilDomes.tile({ size: 560, at: RISE, pace: PACE, strength: 0.9 });
const tileFade = monotoneCurve([
  [at(0.04), 0],
  [at(0.25), 1],
]);
const tileColour = monotoneCurve([
  [at(0.1), 0.3],
  [at(0.21), 1],
]);
/** The mark sinks away from the camera, accelerating into the cut. */
const recede = monotoneCurve([
  [at(1.2), 1],
  [at(1.307), 0.87],
  [at(1.44), 0.426],
  [at(1.5), 0.3],
]);

/**
 * A mark in an app tile, built in from glyphs: the film's icon shot. Use it to open on the
 * product's icon. `oilDomes.tile` rises over 0.2 s, rounds into the tile by 0.45 s and falls from
 * 1.15 s at `pace` 1 (1.2 here); the mark is about 45% of the tile (`size` 560, `width` 250) so the
 * magnified mark stays inside it. Glyphs: the front band for 0.6 s, a third of the cells resolving
 * over 0.8 s, row slips only in the first 0.3 s; the mark turns back into glyphs as it sinks.
 */
function Tile() {
  return (
    <OilLens
      src={SPARK}
      width={250}
      dome={tile}
      fade={tileFade}
      colour={tileColour}
      scale={recede}
      optics={oilShots.tile.optics}
      look={oilShots.tile.look}
      ascii={(f) => {
        const out = interpolate(f, [at(1.24), at(1.5)], [0, 1], { easing: ease.in });
        return {
          front: Math.max(interpolate(f, [RISE, RISE + 36], [1, 0], { easing: ease.soft }), out * 0.25),
          amount: Math.max(0.8 * interpolate(f, [RISE, RISE + 48], [1, 0], { easing: ease.soft }), 0.8 * out),
          glitch: 0.5 * interpolate(f, [RISE, RISE + 18], [1, 0]),
        };
      }}
    />
  );
}

// --- Orb: a wordmark opens out of an orb -------------------------------------------------------

const WORD_W = 760;
const WORD_H = 150;
const orb = oilDomes.orb({ size: 960, aspect: 2.6, at: 0, tip: false });
const orbFade = monotoneCurve([
  [0, 0.3],
  [2, 1],
]);
const orbColour = monotoneCurve([
  [22, 0.2],
  [35, 1],
]);
const orbGloss = monotoneCurve([
  [15, 1],
  [25, 0.1],
  [36, 0],
]);

/**
 * A wordmark opening out of an orb: the film's wordmark shot. Use it for the name after the icon,
 * or alone as an end card. The orb widens for 0.94 s, its rim lying on the word's ends and smearing
 * them outward (`aspect` stretches it to the word's shape; `size` about 1.25 times the word's
 * width), echoes run off its edge from 0.7 s, and it is flat by 1.6 s: from there the floor is the
 * word itself, ready to hand to the exact logo.
 */
function Orb() {
  const fonts = [`700 120px ${look.font}`];
  const [word] = usePictures([
    {
      key: `northwind-${look.font}`,
      width: WORD_W,
      height: WORD_H,
      fonts,
      draw: (ctx) => {
        ctx.fillStyle = "#fff";
        ctx.font = fonts[0];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Northwind", WORD_W / 2, WORD_H / 2 + 6);
      },
    } satisfies CanvasPicture,
  ]);
  if (!word) return null;
  return (
    <OilLens
      src={word}
      width={WORD_W}
      dome={orb}
      fade={orbFade}
      colour={orbColour}
      gloss={orbGloss}
      optics={oilShots.orb.optics}
      look={oilShots.orb.look}
      ascii={(f) => ({
        front: interpolate(f, [0, 60], [1, 0], { easing: ease.soft }),
        frontWidth: 0.35,
        amount: 0.6 * interpolate(f, [0, 40], [1, 0], { easing: ease.soft }),
        glitch: 0.4 * interpolate(f, [0, 14], [1, 0]),
      })}
    />
  );
}

export default defineVideo({
  id: "example-logo",
  title: "Example: logo stings through oil",
  bpm: t.bpm,
  background: "#000000",
  shots: [
    {
      id: "tile",
      title: "A mark in a tile",
      duration: Math.round(at(1.5)),
      component: Tile,
      offBeat: true,
    },
    {
      id: "orb",
      title: "A wordmark out of an orb",
      duration: t.beats(5),
      component: Orb,
      offBeat: true,
    },
  ],
});
