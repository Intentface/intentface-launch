// Example: camera and composition. Each shot is one pattern for moving the frame over made-up UI:
// paging across a field wider than the frame, flicking a rail of cards, proof by multiplication,
// and a wall of tiles around a held headline. Copy a pattern's component and change its props.
// Run: pnpm launch sheet example-camera --shot wide-field --every 3 (and flick, count-grid, wall)
// Expect:
// - wide-field: the caret types on without a pause; the camera sets off while the caret is still
//   two characters short of the safe margin, and the caret never crosses it; the pan lands with the
//   field's right end and its button in frame.
// - flick: each flick peaks within 5 frames, then slows for about 1.4 s and stops dead on a card
//   centred in frame (2 cards, then 1), no overshoot; blur only on the fast part; title still.
// - count-grid: the grid enters at speed from the right, brakes onto three cards, the plate lands;
//   then cells fill from the centre out while the camera pulls back a little and 3 counts to 2,480
//   on a plate just above the three cards, near the frame's centre, with no card cut behind it.
// - wall: the headline and its plate never move; tiles flow out from behind the plate, and new
//   ones keep sliding in from every edge as the camera pulls back at an even rate.

import { bezier, defineVideo, ease, progress, random, tempo, useFrame, useVideoInfo } from "@intentface-launch/core";
import {
  brake,
  Camera,
  Count,
  MotionBlur,
  measureTextNow,
  Reveal,
  Typewriter,
  typingCadence,
  useFontsReady,
} from "@intentface-launch/core/kit";
import type { CSSProperties, ReactNode } from "react";

const t = tempo(120, 60);

/** The examples library's shared look: neutral, light, one accent. */
const look = {
  ground: "#f4f3f0",
  surface: "#ffffff",
  ink: "#16161a",
  muted: "#6b6b76",
  line: "rgb(22 22 26 / 0.08)",
  accent: "#4f5bff",
  accentSoft: "rgb(79 91 255 / 0.12)",
  done: "#1f9d6b",
  font: '"Studio Sans", system-ui, sans-serif',
  mono: '"Studio Mono", ui-monospace, Menlo, monospace',
  shadow: "0 1px 2px rgb(22 22 26 / 0.06), 0 6px 20px rgb(22 22 26 / 0.06)",
};

/** Colours for made-up marks: the accent and a few neutral companions. */
const MARKS = [look.accent, look.done, "#e0a33a", "#d9576b", "#2f9bd6", "#8a63d2"];

const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: look.ground,
  color: look.ink,
  fontFamily: look.font,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A made-up mark: one of eight plain geometric shapes, in a 48-unit box. */
function Mark({ shape, color, size }: { shape: number; color: string; size: number }) {
  const shapes = [
    <circle key="c" cx="24" cy="24" r="17" fill={color} />,
    <rect key="s" x="8" y="8" width="32" height="32" rx="8" fill={color} />,
    <path key="t" d="M24 7 L42 39 H6 Z" fill={color} />,
    <circle key="r" cx="24" cy="24" r="14" fill="none" stroke={color} strokeWidth="7" />,
    <g key="b" fill={color}>
      <rect x="7" y="9" width="12" height="30" rx="4" />
      <rect x="29" y="9" width="12" height="30" rx="4" />
    </g>,
    <path key="d" d="M24 5 L43 24 L24 43 L5 24 Z" fill={color} />,
    <path key="h" d="M6 30 A18 18 0 0 1 42 30 Z" fill={color} />,
    <path key="p" d="M19 6 H29 V19 H42 V29 H29 V42 H19 V29 H6 V19 H19 Z" fill={color} />,
  ];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
      {shapes[shape % shapes.length]}
    </svg>
  );
}

// ─── wide-field ──────────────────────────────────────────────────────────────

const FIELD = { x: 320, y: 508, width: 1280, height: 64, text: 56, button: 104 };
const FIELD_FONT = `400 28px "Studio Sans"`;
/**
 * The page's curve: rest to rest like `ease.inOut`, but it sets off sooner. Over a 48-frame page,
 * `ease.inOut` lets a caret typing at 12 px a frame gain 59 px on the frame's edge and peaks at
 * 82 px a frame (a whip); this one lets it gain about 25 px and peaks at about 48.
 */
const PAGE = bezier(0.4, 0, 0.6, 1);

/**
 * A field wider than the frame: the camera pages across it while someone types.
 *
 * Use it when the thing being typed is the point and is too long to show whole at a readable size
 * (a long query, a prompt, a formula). The field is drawn at its real size (1280 × 64, 28 px type)
 * and filmed close, at `zoom` 2.4, so the frame shows about two thirds of it (1920 / 2.4 = 800 of
 * 1280 + margins) and the type is 67 px on screen.
 *
 * The page starts when the caret is `lead` characters short of the safe margin (96 px from the
 * frame's right edge), measured from the typed text in its own font. The lead is needed because the
 * pan eases in: while it gathers speed the caret keeps going at 11 to 14 px a frame, and gains about
 * 25 px on the frame's edge before the camera overtakes it (on `PAGE` over `pan` = 48 frames; on
 * `ease.inOut` it would gain 59). Two characters (about 65 px on screen) cover that with room to
 * spare: the caret peaks about 40 px inside the margin. Typing runs on its own clock
 * (`typingCadence`, 20 characters a second) and never waits for the camera. The pan is one move
 * from rest to rest, landing with the field's far end and its button 115 px from the frame's edge,
 * under motion blur while it moves (peak about 48 px a frame).
 */
export function WideField({
  query,
  placeholder = "Search orders, people and files",
  at = 24,
  lead = 2,
  pan = 48,
  zoom = 2.4,
  cps = 20,
}: {
  query: string;
  placeholder?: string;
  /** Frame the first key lands. */
  at?: number;
  /** Characters of lead before the safe margin when the pan sets off. */
  lead?: number;
  /** Frames the pan takes. */
  pan?: number;
  zoom?: number;
  /** Average characters a second. */
  cps?: number;
}) {
  const frame = useFrame();
  const { fps, width } = useVideoInfo();
  useFontsReady(FIELD_FONT, query + placeholder);

  const keys = typingCadence(query, fps, { cps, seed: 7 });
  const chars = Array.from(query);
  const textLeft = FIELD.x + FIELD.text;
  const caretX = (n: number) => textLeft + measureTextNow(chars.slice(0, n).join(""), FIELD_FONT).width;

  // The frame in content pixels: half its width, and the safe margin, at this zoom.
  const half = width / 2 / zoom;
  const safe = 96 / zoom;
  const margin = 48;
  const from = FIELD.x - margin + half;
  const to = FIELD.x + FIELD.width + margin - half;
  const leadPx = (lead * (caretX(chars.length) - textLeft)) / chars.length;
  const edge = from + half - safe - leadPx;
  // The key whose character first brings the caret within the lead: the pan sets off as it lands.
  const trigger = chars.findIndex((_, i) => caretX(i + 1) > edge);
  const panAt = at + (trigger < 0 ? keys[keys.length - 1] : keys[trigger]);

  const y = FIELD.y + FIELD.height / 2;
  const typed = keys.filter((k) => frame - at >= k).length;
  const focus = progress(frame, at - 12, 9, ease.soft);

  return (
    <div style={fill}>
      <MotionBlur when={[[panAt, panAt + pan]]}>
        <Camera
          keys={[
            { at: 0, view: { x: from, y, zoom } },
            { at: panAt + pan, view: { x: to, y, zoom }, travel: pan, easing: PAGE },
          ]}
        >
          {/* Product UI, read as it is typed; the field runs past the frame by design, so it is not checked as copy. */}
          <div
            data-launch-check="off"
            style={{
              position: "absolute",
              left: FIELD.x,
              top: FIELD.y,
              width: FIELD.width,
              height: FIELD.height,
              boxSizing: "border-box",
              borderRadius: 10,
              background: look.surface,
              border: `1px solid ${focus > 0 ? `color-mix(in srgb, ${look.accent} ${focus * 100}%, ${look.line})` : look.line}`,
              boxShadow: `0 0 0 ${4 * focus}px ${look.accentSoft}, ${look.shadow}`,
            }}
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={look.muted}
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ position: "absolute", left: 20, top: 20 }}
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 L20 20" />
            </svg>
            <div
              style={{
                position: "absolute",
                left: FIELD.text,
                top: 0,
                lineHeight: `${FIELD.height - 2}px`,
                fontSize: 28,
                whiteSpace: "pre",
                color: typed ? look.ink : look.muted,
              }}
            >
              {typed ? (
                <Typewriter at={at} times={keys}>
                  {query}
                </Typewriter>
              ) : (
                placeholder
              )}
            </div>
            <div
              style={{
                position: "absolute",
                right: 9,
                top: 9,
                width: FIELD.button,
                height: FIELD.height - 20,
                borderRadius: 8,
                background: look.accent,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              Search
            </div>
          </div>
        </Camera>
      </MotionBlur>
    </div>
  );
}

// ─── flick ───────────────────────────────────────────────────────────────────

export type Flick = {
  /** Frame the flick starts. */
  at: number;
  /** How far it travels, in px: a whole number of cards, so it comes to rest on one. */
  distance: number;
  /** Frames from rest to peak speed: the throw. */
  rise?: number;
  /** Frames from peak speed to rest. */
  glide?: number;
};

/**
 * Where a flicked rail is, `frame` frames into the shot: speed rises linearly to its peak over
 * `rise` frames, then `brake` takes it from that speed to rest at exactly `distance`, the speed
 * falling as (1 − u)², so it stops without overshoot. The peak is solved from the distance, so any
 * rise and glide land on the same card.
 */
export function flickAt(frame: number, { at, distance, rise = 5, glide = 84 }: Flick) {
  const f = frame - at;
  if (f <= 0) return 0;
  const peak = distance / (rise / 2 + glide / 3);
  if (f < rise) return (peak * f * f) / (2 * rise);
  return brake({ speed: peak, frames: glide, to: distance }).position(f - rise);
}

/** The frames of a flick worth blurring: the throw and the glide until the speed falls to a quarter of its peak. */
const flickBlur = ({ at, rise = 5, glide = 84 }: Flick): [number, number] => [at, Math.ceil(at + rise + glide / 2)];

const TEMPLATES = [
  "Weekly review",
  "Launch plan",
  "Hiring loop",
  "Retro board",
  "Roadmap",
  "Budget",
  "Onboarding",
  "Field notes",
  "Release notes",
  "Standup",
  "Interviews",
  "Offsite",
  "Postmortem",
  "Sprint plan",
];
const CARD = { width: 400, height: 440, pitch: 448, perspective: 1400 };

/** One template card: a made-up thumbnail of blocks, a name and a count, upright on the rail. */
function TemplateCard({ index, selected }: { index: number; selected: number }) {
  const rnd = random(index + 11);
  const tint = MARKS[index % MARKS.length];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        boxSizing: "border-box",
        borderRadius: 14,
        background: look.surface,
        border: `2px solid color-mix(in srgb, ${look.accent} ${selected * 100}%, ${look.line})`,
        boxShadow: `0 0 0 ${6 * selected}px ${look.accentSoft}, ${look.shadow}`,
        padding: 24,
      }}
    >
      <div
        style={{
          height: 270,
          borderRadius: 10,
          background: `color-mix(in srgb, ${tint} 10%, ${look.surface})`,
          padding: 20,
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderRadius: 6,
              background: tint,
              opacity: 0.25 + rnd() * 0.5,
              gridColumn: i === 0 && rnd() > 0.4 ? "span 2" : undefined,
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 26, fontSize: 38, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {TEMPLATES[index % TEMPLATES.length]}
      </div>
      <div style={{ marginTop: 6, fontSize: 30, color: look.muted }}>{`${3 + Math.floor(rnd() * 9)} sections`}</div>
    </div>
  );
}

/**
 * Cards flicked along a rail, on a plane tilted away from the camera.
 *
 * Use it to show a choice of many (templates, styles, plans) with the energy of a hand flicking
 * through them, and to land on the one the story goes on with. Each card is tilted back `tilt`
 * degrees (22) under its own 1400 px perspective, about its own centre: bottoms wider than tops,
 * which says "this is a surface you can push" without a 3D stage. One shared vanishing point would
 * lean the side cards' verticals and make their type read as italic; one per card keeps every card
 * symmetric and its type upright. The title is flat and still, above the rail.
 *
 * Each flick is a throw and a glide (`flickAt`): peak speed 5 frames in, then a 84-frame (1.4 s)
 * brake that lands exactly a whole number of cards further, so a card comes to rest centred with no
 * overshoot. A glide shorter than about a second reads as a snap, not a flick. Motion blur covers
 * each throw and the first half of its glide, where the rail moves faster than a quarter of its peak
 * (about 7 px a frame); below that the blur only softens type.
 */
export function FlickRail({
  title,
  flicks,
  start = 3,
  tilt = 22,
}: {
  title: string;
  flicks: Flick[];
  /** The card centred before the first flick. */
  start?: number;
  tilt?: number;
}) {
  const frame = useFrame();
  const offset = flicks.reduce((sum, f) => sum + flickAt(frame, f), 0);
  return (
    <div style={fill}>
      {/* Cards flying past are a montage, not copy: only the title is checked. */}
      <MotionBlur when={flicks.map(flickBlur)}>
        <div data-launch-check="off">
          {TEMPLATES.map((name, i) => {
            const x = (i - start) * CARD.pitch - offset;
            if (Math.abs(x) > 1500) return null;
            const selected = clamp01(1 - Math.abs(x) / (CARD.pitch * 0.5));
            return (
              <div
                key={name}
                style={{
                  position: "absolute",
                  left: 960 - CARD.width / 2 + x,
                  top: 350,
                  width: CARD.width,
                  height: CARD.height,
                  transform: `perspective(${CARD.perspective}px) rotateX(${tilt}deg)`,
                }}
              >
                <TemplateCard index={i} selected={ease.soft(selected)} />
              </div>
            );
          })}
        </div>
      </MotionBlur>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          textAlign: "center",
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        <Reveal at={4} frames={30}>
          {title}
        </Reveal>
      </div>
    </div>
  );
}

// ─── count-grid ──────────────────────────────────────────────────────────────

const GRID = { cols: 13, rows: 9, width: 168, height: 112, gap: 20 };
const GRID_W = GRID.cols * (GRID.width + GRID.gap) - GRID.gap;
const GRID_H = GRID.rows * (GRID.height + GRID.gap) - GRID.gap;
const GRID_X = 960 - GRID_W / 2;
const GRID_Y = 540 - GRID_H / 2;
const CENTRE = { col: 6, row: 4 };

/** One small card in the grid: an outline while empty, filling in at `at` (container first, content 3 frames behind). */
function GridCell({ col, row, at }: { col: number; row: number; at: number }) {
  const frame = useFrame();
  const shown = progress(frame, at, 18, ease.out);
  const fade = progress(frame, at, 12, ease.soft);
  const content = progress(frame, at + 3, 15, ease.soft);
  const rnd = random(col * 31 + row);
  return (
    <div
      style={{
        position: "absolute",
        left: GRID_X + col * (GRID.width + GRID.gap),
        top: GRID_Y + row * (GRID.height + GRID.gap),
        width: GRID.width,
        height: GRID.height,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          background: "rgb(255 255 255 / 0.7)",
          border: "2px dashed rgb(22 22 26 / 0.2)",
          opacity: 1 - fade,
        }}
      />
      {shown > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            background: look.surface,
            border: `1px solid ${look.line}`,
            boxShadow: look.shadow,
            opacity: fade,
            transform: `scale(${0.9 + 0.1 * shown})`,
            padding: 18,
            boxSizing: "border-box",
          }}
        >
          <div style={{ opacity: content }}>
            <Mark shape={Math.floor(rnd() * 8)} color={MARKS[Math.floor(rnd() * MARKS.length)]} size={30} />
            <div
              style={{
                marginTop: 14,
                width: 70 + rnd() * 50,
                height: 10,
                borderRadius: 5,
                background: look.ink,
                opacity: 0.75,
              }}
            />
            <div
              style={{
                marginTop: 8,
                width: 40 + rnd() * 40,
                height: 8,
                borderRadius: 4,
                background: look.muted,
                opacity: 0.4,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Proof by multiplication: a few, then many, and the number that says how many.
 *
 * Use it right after the hero moment, to say "and it does this at scale" without a sentence. Two
 * moves, one after the other:
 *
 * 1. The grid rushes in from the right at 60 px a frame (100 on screen, under motion blur) and
 *    `brake`s over 48 frames onto the few cards already filled (`seed`), framed close at zoom 1.7.
 *    The plate with the number lands as the brake ends; its contents trail it by 3 frames.
 * 2. On `grow`, every empty cell fills in, staggered 5 frames per cell of distance from the centre
 *    (one ring at a time, the whole grid in about 55 frames), while the camera pulls back to zoom
 *    1.2 over 60 frames on `ease.inOut` (longer, and its slow tail makes the plate's type creep a
 *    pixel at a time) and `Count` runs from the seed's count to `total` over 72 frames on
 *    `ease.inOut`, so the number keeps pace with the rings filling, in tabular figures.
 *
 * The number labels the cards, so it sits with them: its plate takes the place of a block of cells
 * (`plate`, 3 × 2) just above the seed cards, inside the grid and under the camera. It arrives with
 * them, is the hero of the frame at both zooms (163 px type at 1.7, 115 px at 1.2) near the frame's
 * centre, and no card is ever cut behind it, because the cells it covers are not drawn. It scales
 * only while it counts (the pull-back lands before the count does), so the final number is held
 * still.
 */
export function CountGrid({
  label,
  total,
  seed = [
    [5, 5],
    [6, 5],
    [7, 5],
  ],
  plate: block = { col: 5, row: 3, cols: 3, rows: 2 },
  grow = t.beats(4),
}: {
  label: string;
  total: number;
  /** Cells already filled when the grid lands, as [col, row]. */
  seed?: [number, number][];
  /** The cells the number's plate covers, beside the seed cards. */
  plate?: { col: number; row: number; cols: number; rows: number };
  /** Frame the empty cells start to fill. */
  grow?: number;
}) {
  const frame = useFrame();
  // The rush: constant speed for `pre` frames, then a brake to rest.
  const pre = 14;
  const rush = brake({ speed: 60, frames: 48, to: 0 });
  const offset = -rush.position(frame - pre);
  const landed = pre + 48;
  const plate = progress(frame, landed - 6, 21, ease.out);
  const plateFade = progress(frame, landed - 6, 12, ease.soft);
  const plateContent = progress(frame, landed - 3, 12, ease.soft);

  const isSeed = (c: number, r: number) => seed.some(([sc, sr]) => sc === c && sr === r);
  const underPlate = (c: number, r: number) =>
    c >= block.col && c < block.col + block.cols && r >= block.row && r < block.row + block.rows;
  const cells: ReactNode[] = [];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      if (underPlate(c, r)) continue;
      // Distance from the centre in cells, rows scaled to the column pitch so the rings are round.
      const d = Math.hypot(c - CENTRE.col, ((r - CENTRE.row) * (GRID.height + GRID.gap)) / (GRID.width + GRID.gap));
      cells.push(<GridCell key={`${c}-${r}`} col={c} row={r} at={isSeed(c, r) ? -1e4 : grow + d * 5} />);
    }
  }

  return (
    <div style={fill}>
      <MotionBlur when={[[0, pre + 24]]}>
        <Camera
          keys={[
            { at: 0, view: { x: 960, y: 540, zoom: 1.7 } },
            { at: grow, view: { x: 960, y: 540, zoom: 1.7 } },
            { at: grow + 60, view: { x: 960, y: 540, zoom: 1.2 }, easing: ease.inOut },
          ]}
        >
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${offset}px)` }}>
            {cells}
            <div
              style={{
                position: "absolute",
                left: GRID_X + block.col * (GRID.width + GRID.gap),
                top: GRID_Y + block.row * (GRID.height + GRID.gap),
                width: block.cols * (GRID.width + GRID.gap) - GRID.gap,
                height: block.rows * (GRID.height + GRID.gap) - GRID.gap,
                boxSizing: "border-box",
                borderRadius: 14,
                background: look.surface,
                border: `1px solid ${look.line}`,
                boxShadow: "0 2px 4px rgb(22 22 26 / 0.06), 0 16px 48px rgb(22 22 26 / 0.12)",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                opacity: plateFade,
                transform: `translateY(${12 * (1 - plate)}px)`,
              }}
            >
              <div style={{ opacity: plateContent }}>
                <Count
                  from={seed.length}
                  to={total}
                  at={grow}
                  duration={72}
                  easing={ease.inOut}
                  style={{ display: "block", fontSize: 96, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}
                />
                <div style={{ marginTop: 10, fontSize: 30, color: look.muted }}>{label}</div>
              </div>
            </div>
          </div>
        </Camera>
      </MotionBlur>
    </div>
  );
}

// ─── wall ────────────────────────────────────────────────────────────────────

const APPS = [
  "Ledger",
  "Inbox",
  "Agenda",
  "Tickets",
  "Vault",
  "Relay",
  "Forms",
  "Billing",
  "Notes",
  "Builds",
  "Pulse",
  "Tasks",
  "Payroll",
  "Survey",
  "Metrics",
  "Archive",
  "Signals",
  "Desk",
];
/** The golden angle: consecutive tiles turn by it, so the field never lines up in spokes. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const TILE = 132;

/**
 * A wall of integrations: a headline held still in the middle, a field of tiles flowing out from
 * behind it, and a camera pulling back so the field never runs out.
 *
 * Use it for "works with everything" and "used by many": breadth that should feel endless. The
 * tiles sit on a sunflower spiral (tile n at radius `spacing` × √n, turned n golden angles), which
 * covers the plane evenly with no rows or spokes. Every tile's index grows at `flow` a frame, so
 * tiles move straight out along their own angle, new ones appear at the centre behind the plate,
 * and the field stays evenly filled at every moment. The outward speed falls with distance
 * (spacing² × flow / 2r: about 5 px a frame just outside the plate, 1 px at the edges).
 *
 * The camera pulls back at an even rate in log space for the whole shot (zoom 1.3 to 0.72,
 * `ease.linear`: the shot starts and ends inside the move, so it never eases). Near the plate the
 * flow is faster than the pull and tiles drift outward; near the edges the pull wins and new tiles
 * slide in from every side. Tile names are decoration (`data-launch-check="decor"`: neither read nor product UI): only the
 * headline is meant to be read, on an opaque plate in screen space that never moves or scales.
 */
export function IntegrationWall({
  headline,
  flow = 0.1,
  spacing = 140,
  zoom = [1.3, 0.72],
  length,
}: {
  headline: string;
  /** The shot's length in frames: the pull runs from its first frame to its last. */
  length: number;
  /** Tiles that appear at the centre per frame. */
  flow?: number;
  /** Radius step of the spiral, in content px (neighbours are about 1.8 × this apart). */
  spacing?: number;
  /** Zoom at the first and last frame. */
  zoom?: [number, number];
}) {
  const frame = useFrame();
  const s = frame * flow;
  const tiles: ReactNode[] = [];
  for (let n = -Math.ceil(length * flow) - 2; n < 180; n++) {
    const m = n + s;
    if (m <= 0) continue;
    const r = spacing * Math.sqrt(m);
    const a = n * GOLDEN;
    // A tile emerges from behind the plate: it grows and fades in over its first 1.5 steps.
    const born = ease.out(clamp01(m / 1.5));
    const i = ((n % APPS.length) + APPS.length) % APPS.length;
    tiles.push(
      <div
        key={n}
        style={{
          position: "absolute",
          left: 960 + r * Math.cos(a) - TILE / 2,
          top: 540 + r * Math.sin(a) - TILE / 2,
          width: TILE,
          height: TILE,
          boxSizing: "border-box",
          borderRadius: 14,
          background: look.surface,
          border: `1px solid ${look.line}`,
          boxShadow: look.shadow,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: born,
          transform: `scale(${0.7 + 0.3 * born})`,
        }}
      >
        <Mark shape={(n * 5 + 3) & 7} color={MARKS[((n % 6) + 6) % 6]} size={52} />
        <div style={{ fontSize: 20, fontWeight: 500, color: look.muted }}>{APPS[i]}</div>
      </div>,
    );
  }
  return (
    <div style={fill}>
      <Camera
        keys={[
          { at: 0, view: { x: 960, y: 540, zoom: zoom[0] } },
          { at: length, view: { x: 960, y: 540, zoom: zoom[1] }, easing: ease.linear },
        ]}
      >
        <div data-launch-check="decor">{tiles}</div>
      </Camera>
      <div
        style={{
          position: "absolute",
          left: 270,
          top: 430,
          width: 1380,
          height: 220,
          borderRadius: 14,
          background: look.surface,
          border: `1px solid ${look.line}`,
          boxShadow: "0 2px 4px rgb(22 22 26 / 0.06), 0 24px 64px rgb(22 22 26 / 0.14)",
          display: "grid",
          placeItems: "center",
          fontSize: 80,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          whiteSpace: "nowrap",
        }}
      >
        <Reveal at={4} frames={30}>
          {headline}
        </Reveal>
      </div>
    </div>
  );
}

// ─── the video ───────────────────────────────────────────────────────────────

const QUERY = "orders shipped from the north warehouse last month that arrived two days late";

const FLICKS: Flick[] = [
  { at: t.beats(1), distance: 2 * CARD.pitch },
  { at: t.beats(5), distance: CARD.pitch },
];

export default defineVideo({
  id: "example-camera",
  title: "Examples: camera and composition",
  logline: "Reusable camera patterns: a page across a wide field, a flicked rail, proof by multiplication, a wall.",
  bpm: t.bpm,
  background: look.ground,
  shots: [
    {
      id: "wide-field",
      title: "Wide field",
      duration: t.beats(10),
      component: () => <WideField query={QUERY} />,
      says: "A long query, typed without a pause, the camera paging ahead of the caret.",
      camera: "Close on the field's left two thirds; one pan to its right end, set off two characters early.",
      moments: { typing: 24 },
    },
    {
      id: "flick",
      title: "Flick",
      duration: t.beats(10),
      component: () => <FlickRail title="Start from a template" flicks={FLICKS} />,
      copy: ["Start from a template"],
      says: "Many to choose from, flicked through by hand.",
      camera: "Locked off; the rail moves on a tilted plane.",
      moments: { first: FLICKS[0].at, second: FLICKS[1].at },
    },
    {
      id: "count-grid",
      title: "Count grid",
      duration: t.beats(9),
      component: () => <CountGrid label="Projects running" total={2480} />,
      copy: ["Projects running"],
      says: "Three became thousands.",
      camera: "Grid rushes in and brakes onto three cards; a small pull back as the rest fill in.",
      moments: { grow: t.beats(4) },
    },
    {
      id: "wall",
      title: "Wall",
      duration: t.beats(10),
      component: () => <IntegrationWall headline="Connects to everything you use" length={t.beats(10)} />,
      copy: ["Connects to everything you use"],
      says: "It fits with whatever you already have.",
      camera: "One even pull back for the whole shot; headline locked in screen space.",
    },
  ],
});
