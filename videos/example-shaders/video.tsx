// Example: shaders around and on UI. Each shot is one pattern built from the Shaders add-on
// (@intentface-launch/shaders) and core's kit: the middle card (a hero on a shader, the card
// frosted or the surround blurred), type that turns fluid under a cursor, and a liquid-metal
// button. Copy a pattern's component and change its props.
// Run: pnpm launch still example-shaders --at hero-frosted:+60,hero-window:+60,fluid-type:+45,liquid-metal:+80 --grid
// Expect:
// - hero-frosted: warm light bands fill the frame, sharp; the card in the middle opens over the
//   first half second and blurs them through its glass; its headline, nav and button sit inside it,
//   crisp; the bands keep moving behind.
// - hero-window: a pink and violet mesh fills the card, sharp; round it the same mesh is blurred
//   and washed pale, coming out of focus as the card opens.
// - fluid-type: the frosted cursor sweeps through the word; the letters ripple behind it, the
//   ripple splitting into colour at its edges, and settle back to the word within about a second.
// - liquid-metal: three buttons whose rims are liquid metal, polished (rainbow along the bends),
//   halfway, and matte (soft bands, no colour), the reflections flowing round them.
import { defineVideo, tempo, useFrame } from "@intentface-launch/core";
import { Cursor, type CursorKey, cursorAt, MiddleCard, Reveal, useFontsReady } from "@intentface-launch/core/kit";
import { type CanvasPicture, LiquidMetal, Shaders, textPicture, usePictures } from "@intentface-launch/shaders";
import type { CSSProperties } from "react";
import { look } from "../example-look";

const t = tempo(120, 60);
const fill: CSSProperties = { position: "absolute", inset: 0 };

/**
 * A made-up product's hero, as a website lays it out: mark and name top left,
 * three links in the middle, a button top right, one big headline, two small
 * labels at its sides. `ink` is the text colour over the card.
 */
function Hero({ ink, accent, headline }: { ink: string; accent: string; headline: string }) {
  const text: CSSProperties = { position: "absolute", color: ink, font: `500 20px/1 ${look.font}` };
  // The site's chrome is UI round the headline, not copy to read: `check` measures only the headline.
  return (
    <div style={{ ...fill, fontFamily: look.font }}>
      <div data-launch-check="off" style={{ ...text, left: 44, top: 40, font: `600 26px/1 ${look.font}` }}>
        Northwind
      </div>
      <div
        data-launch-check="off"
        style={{
          ...text,
          left: 0,
          right: 0,
          top: 44,
          display: "flex",
          justifyContent: "center",
          gap: 40,
          opacity: 0.8,
        }}
      >
        <span>Features</span>
        <span>Pricing</span>
        <span>Docs</span>
      </div>
      <div
        data-launch-check="off"
        style={{
          ...text,
          right: 40,
          top: 30,
          padding: "11px 20px",
          borderRadius: 999,
          background: accent,
          color: "#fff",
          font: `600 18px/1 ${look.font}`,
        }}
      >
        Download
      </div>
      <div
        style={{
          ...text,
          left: 0,
          right: 0,
          top: 300,
          textAlign: "center",
          font: `700 200px/1 ${look.font}`,
          letterSpacing: "-0.045em",
        }}
      >
        <Reveal at={14} mask stagger={0.05}>
          {headline}
        </Reveal>
      </div>
      <div data-launch-check="off" style={{ ...text, left: 44, top: 395, opacity: 0.7 }}>
        Week to week
      </div>
      <div data-launch-check="off" style={{ ...text, right: 44, top: 395, opacity: 0.7 }}>
        Made for teams
      </div>
    </div>
  );
}

/**
 * Middle card, frosted: the shader fills the frame and the card is glass over
 * it (blur 36 px, a dark tint at 22%, a hairline edge). The card opens on
 * frame 0 over 30 frames; its headline reveals 14 frames in. Use for a hero
 * section or a feature card that should feel set in the light behind it.
 */
function HeroFrosted() {
  useFontsReady(`700 200px ${look.font}`, "Run hotter.");
  return (
    <MiddleCard
      at={1}
      width={1500}
      height={820}
      background={
        <Shaders
          components={[
            {
              type: "Satin",
              props: {
                color: "#c43d00",
                highlightColor: "#ffd27a",
                foldCount: 4,
                foldDirection: 120,
                foldDepth: 0.7,
                foldWidth: 0.3,
                gloss: 0.7,
                bloom: 0.8,
                sheen: 0.7,
                speed: 0.8,
              },
            },
          ]}
        />
      }
    >
      <Hero ink="#fff6ec" accent="#ff6a1f" headline="Run hotter." />
    </MiddleCard>
  );
}

/**
 * Middle card, a window: the card shows the shader sharp and everything round
 * it blurs (64 px) and washes pale as it opens, so the card is the subject.
 * Use for a product's own gradient hero, shown as its website would.
 */
function HeroWindow() {
  useFontsReady(`700 200px ${look.font}`, "Feel lighter.");
  return (
    <MiddleCard
      at={1}
      blur="around"
      tint="rgb(244 196 216 / 0.45)"
      width={1500}
      height={820}
      background={
        <Shaders
          components={[
            {
              type: "MeshGradient",
              props: {
                stops: [
                  { color: "#2a0b3d", position: 0 },
                  { color: "#ff6fae", position: 0.4 },
                  { color: "#5b1f6e", position: 0.7 },
                  { color: "#ffb3d1", position: 1 },
                ],
                count: 5,
                swirl: 0.4,
                speed: 0.8,
              },
            },
          ]}
        />
      }
    >
      <Hero ink="#fff" accent="#ff4f9a" headline="Feel lighter." />
    </MiddleCard>
  );
}

/** The word, set in the example look's face; made while rendering (the look is read then). */
const rippleWord = (font: string) =>
  textPicture({
    text: "ripple",
    font: `600 300px ${font}`,
    x: 960,
    y: 640,
    align: "center",
    letterSpacing: -0.04,
    color: "#16161a",
  });
const SWEEP: CursorKey[] = [
  { at: 10, to: { x: 420, y: 560 } },
  { at: 70, to: { x: 1500, y: 540 }, arc: 0.08 },
];

/**
 * Type that goes fluid under a cursor: the word is a picture in a Shaders
 * layer, `CursorRipples` distorts what is below it, and the layer's `pointer`
 * is the kit cursor's own path (`cursorAt`), so the ripples follow the cursor
 * on screen. Intensity 9, decay 4: they settle in about a second.
 */
function FluidType() {
  const word = rippleWord(look.font);
  const [url] = usePictures([word.picture]);
  return (
    <div style={{ ...fill, background: look.ground }}>
      <Shaders
        text={word.text()}
        pointer={(f) => cursorAt(SWEEP, f)}
        components={[
          { type: "LinearGradient", props: { colorA: "#f6f5f2", colorB: "#e4e3df", angle: 90 } },
          ...(url ? [{ type: "ImageTexture", props: { url } }] : []),
          { type: "CursorRipples", props: { intensity: 9, decay: 4, radius: 0.5, chromaticSplit: 1.2 } },
        ]}
      />
      <Cursor keys={SWEEP} look="frosted" screenSize={72} />
    </div>
  );
}

const W = 760;
const H = 200;
/** Room round the ring inside its canvas: a shape drawn to its canvas's edge reads as cut there. */
const PAD = 40;
const rim: CanvasPicture = {
  key: `example-rim-${W}x${H}-${PAD}`,
  width: W + PAD * 2,
  height: H + PAD * 2,
  draw: (ctx) => {
    ctx.translate(PAD, PAD);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, H / 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.roundRect(16, 16, W - 32, H - 32, (H - 32) / 2);
    ctx.fill();
  },
};

/**
 * Liquid metal, from polished to matte: Paper's liquid-metal shader in a ring
 * round a button (the ring drawn on a canvas, `LiquidMetal`'s `shape`), at
 * `matte` 0, 0.5 and 1. Polished splits colour along the bends; matte is soft
 * satin bands.
 */
function LiquidMetalButtons() {
  useFrame();
  return (
    <div
      style={{ ...fill, background: "radial-gradient(120% 120% at 50% 35%, #f1f1f3, #cfd0d5)", fontFamily: look.font }}
    >
      {[0, 0.5, 1].map((matte, i) => (
        <div key={matte} style={{ position: "absolute", left: 580, top: 120 + i * 300, width: W, height: H }}>
          <div style={{ ...fill, inset: 14, borderRadius: H, background: "linear-gradient(#f0f0f2, #dadbdf)" }} />
          <LiquidMetal
            shape={rim}
            matte={matte}
            width={W + PAD * 2}
            height={H + PAD * 2}
            style={{ left: -PAD, top: -PAD }}
          />
          <div
            style={{
              ...fill,
              display: "grid",
              placeItems: "center",
              font: `500 72px ${look.font}`,
              color: "#17171a",
              letterSpacing: "-0.02em",
            }}
          >
            {["Polished", "Halfway", "Matte"][i]}
          </div>
        </div>
      ))}
    </div>
  );
}

export default defineVideo({
  id: "example-shaders",
  title: "Example: shaders around and on UI",
  bpm: t.bpm,
  shots: [
    {
      id: "hero-frosted",
      title: "Middle card, frosted",
      duration: t.beats(7),
      component: HeroFrosted,
      copy: ["Run hotter."],
    },
    {
      id: "hero-window",
      title: "Middle card, a window",
      duration: t.beats(6),
      component: HeroWindow,
      copy: ["Feel lighter."],
    },
    {
      id: "fluid-type",
      title: "Fluid type under a cursor",
      duration: t.beats(5),
      component: FluidType,
      copy: ["ripple"],
    },
    {
      id: "liquid-metal",
      title: "Liquid metal, polished to matte",
      duration: t.beats(7),
      component: LiquidMetalButtons,
    },
  ],
});
