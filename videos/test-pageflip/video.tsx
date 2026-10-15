// Test: PageFlip on a black e-ink book of blueprints (yellow-white-grey art in three depth layers),
// turning one leaf of each paper, alone on a dark ground.
// Run: pnpm launch still test-pageflip --at vellum:+52,vellum:end,film:+52,film:end,paper:+44,paper:+92 --grid
// Expect: `vellum` a light frosted sheet glowing against the black: the art under it shows through as
// soft smudges mid-turn and only slightly softened once it lies on the left page, where its printed
// interconnect registers on the die beneath. `film` a clear sheet: the art under it stays sharp, the
// sheet shows as a sheen along the bend and a bright edge; its white overlay registers on landing.
// `paper` an opaque black page: its art shifts a few px between layers as it turns (parallax), and
// both pages redraw once on landing (a pale negative frame, then the art dithers in; gone by +9).
// Every turn casts a soft shadow that tightens where the sheet nears the page; flat sheets cast none.
// `plate` and `curl` come in on transitions.pageCurl: the book shot peels off from the right as a
// black sheet, then the plate peels off from the bottom-right corner as light vellum, the next plate
// showing through it blurred; both have just left the frame at the transition's end (check:
// --at plate:+24,curl:+12,curl:+30,curl:+48 --grid, and `pnpm launch sheet test-pageflip --shot curl --every 3`).
import { defineVideo, ease, interpolate, tempo, transitions, useFrame } from "@intentface-launch/core";
import { type ArtLayer, type PageContent, PageFlip, type PaperSpec } from "@intentface-launch/core/kit";
import {
  AMBER,
  coldPlate,
  coreExploded,
  coreSection,
  dieFloorplan,
  H,
  InterconnectOverlay,
  Notes,
  PAPER,
  page,
  VELLUM_ACCENT,
  VELLUM_INK,
  W,
  WHITE,
  wiring,
} from "./drawings.js";

const t = tempo(120, 60);
const ground = "#0b0b0c";

const floorPlan = page({
  heading: "SHEET 2 · DIE FLOOR PLAN · LATTICE M7",
  title: "DIE FLOOR PLAN",
  sheet: "2 / 6",
  drawing: dieFloorplan,
  stamp: [418, 668],
  body: <Notes top={548} />,
});
const section = page({
  heading: "SHEET 3 · NEURAL CORE · SECTION A–A",
  title: "CORE SECTION",
  sheet: "3 / 6",
  drawing: (part) => coreSection(part),
  body: <Notes top={452} />,
});
const exploded = page({
  heading: "SHEET 4 · NEURAL CORE · EXPLODED",
  title: "CORE ASSEMBLY",
  sheet: "4 / 6",
  drawing: (part) => coreExploded(part),
  stamp: [150, 560],
});
const cooling = page({
  heading: "SHEET 5 · COLD PLATE · COOLANT LOOP",
  title: "COLD PLATE",
  sheet: "5 / 6",
  drawing: (part) => coldPlate(part),
  body: <Notes top={476} />,
});
const power = page({
  heading: "SHEET 6 · POWER AND DATA",
  title: "WIRING",
  sheet: "6 / 6",
  drawing: (part) => wiring(part),
});

/** The book alone on a soft, dark ground, a slow drift in; one leaf turns on beats 1 to 3. */
const spread = (paper: PaperSpec, left: PageContent, front: PageContent, back: PageContent, right: PageContent) =>
  function Spread() {
    const frame = useFrame();
    const turn = (f: number) => interpolate(f, [t.beats(1), t.beats(3)], [0, 1], { easing: ease.inOut });
    const push = interpolate(frame, [0, t.beats(6)], [1, 1.03]);
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: `radial-gradient(70% 70% at 50% 46%, #1a1a1d 0%, #111113 45%, ${ground} 100%)`,
        }}
      >
        <div
          style={{ position: "absolute", left: 960 - W, top: 540 - H / 2, transform: `scale(${push}) rotate(-1.2deg)` }}
        >
          <PageFlip
            width={W}
            height={H}
            left={left}
            leaves={[{ front, back, paper }]}
            right={right}
            turn={turn}
            paper="black"
            pageColor={PAPER}
            surface={ground}
          />
        </div>
      </div>
    );
  };

/** A blueprint sheet filling the frame (for the page curl transition). */
const plate = (content: PageContent) =>
  function Plate() {
    const layers = (content as { layers: ArtLayer[] }).layers;
    return (
      <div style={{ position: "absolute", inset: 0, background: PAPER, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 960 - W * 0.68,
            top: 540 - H * 0.68,
            width: W,
            height: H,
            transform: "scale(1.36)",
            transformOrigin: "0 0",
          }}
        >
          {layers.map((l, i) => (
            <div key={i} style={{ position: "absolute", inset: 0 }}>
              {l.node}
            </div>
          ))}
        </div>
      </div>
    );
  };

export default defineVideo({
  id: "test-pageflip",
  title: "Page flip",
  logline: "Scratch test for PageFlip papers and the page curl transition.",
  bpm: t.bpm,
  background: ground,
  shots: [
    {
      id: "vellum",
      title: "Vellum over e-ink",
      duration: t.beats(6),
      component: spread(
        "vellum",
        floorPlan,
        null,
        <InterconnectOverlay ink={VELLUM_INK} accent={VELLUM_ACCENT} />,
        section,
      ),
    },
    {
      id: "film",
      title: "Clear film",
      duration: t.beats(6),
      component: spread("film", floorPlan, null, <InterconnectOverlay ink={WHITE} accent={AMBER} />, cooling),
    },
    {
      id: "paper",
      title: "Black e-ink page",
      duration: t.beats(6),
      component: spread("black", section, exploded, power, floorPlan),
    },
    {
      id: "plate",
      title: "Curl, black sheet",
      duration: t.beats(4),
      component: plate(cooling),
      transition: transitions.pageCurl(54, { from: "right", paper: "black" }),
    },
    {
      id: "curl",
      title: "Curl, vellum",
      duration: t.beats(4),
      component: plate(exploded),
      transition: transitions.pageCurl(54, { from: "bottom-right", paper: "vellum" }),
    },
  ],
});
