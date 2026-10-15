// The classified engineering archive of an invented corporation, ORDINAL, for an AI system: black
// e-ink pages of SVG blueprints (a processor die floor plan, a neural core in section and pulled
// apart, cooling channels, an orthographic housing, a wiring diagram) in pale yellow, white and grey,
// in three depth layers that shift in parallax as a page turns: the frame and construction sunk
// below the page, the drawing on it, the annotations floating above. Nothing here is a real
// company's.

import type { PageContent } from "@intentface-launch/core/kit";
import type { ReactNode } from "react";

export const YELLOW = "#e2d49a";
export const WHITE = "#efece2";
export const GREY = "#56565c";
export const AMBER = "#d19f48";
export const PAPER = "#0c0c0e";
export const VELLUM_INK = "#2a2a2f";
export const VELLUM_ACCENT = "#a8701f";
export const mono = '"Studio Mono", ui-monospace, Menlo, monospace';
export const sans = '"Studio Sans", Inter, system-ui, sans-serif';
export const W = 560;
export const H = 760;

const C = "14 3 2 3";
type Part = "lines" | "notes";

export const Label = ({
  x,
  y,
  children,
  color = GREY,
  size = 7,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
}) => (
  <text x={x} y={y} fill={color} fontFamily={mono} fontSize={size} letterSpacing={1.1} textAnchor={anchor}>
    {children}
  </text>
);

/** ORDINAL's mark: a square, a diagonal, a dot. */
export const Mark = ({ x, y, s = 14, color = WHITE }: { x: number; y: number; s?: number; color?: string }) => (
  <g stroke={color} strokeWidth={1} fill="none">
    <rect x={x} y={y} width={s} height={s} />
    <path d={`M ${x + s * 0.3} ${y + s} L ${x + s} ${y + s * 0.3}`} />
    <rect x={x + s * 0.16} y={y + s * 0.16} width={s * 0.22} height={s * 0.22} fill={color} stroke="none" />
  </g>
);

const arrow = (x: number, y: number, a: number, s = 5.5) =>
  `M ${x} ${y} L ${x - s * Math.cos(a - 0.3)} ${y - s * Math.sin(a - 0.3)} L ${x - s * Math.cos(a + 0.3)} ${y - s * Math.sin(a + 0.3)} Z`;

/** A linear dimension between two points, offset to one side, with its value. */
export function Dim({
  x1,
  y1,
  x2,
  y2,
  off,
  label,
  color = WHITE,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  off: number;
  label: string;
  color?: string;
}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const s = Math.sign(off);
  const [ax, ay, bx, by] = [x1 + nx * off, y1 + ny * off, x2 + nx * off, y2 + ny * off];
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  return (
    <g stroke={color} strokeWidth={0.5} fill="none" strokeOpacity={0.8}>
      <path
        d={`M ${x1 + nx * s * 3} ${y1 + ny * s * 3} L ${ax + nx * s * 4} ${ay + ny * s * 4} M ${x2 + nx * s * 3} ${y2 + ny * s * 3} L ${bx + nx * s * 4} ${by + ny * s * 4} M ${ax} ${ay} L ${bx} ${by}`}
      />
      <path d={`${arrow(ax, ay, a + Math.PI)} ${arrow(bx, by, a)}`} fill={color} stroke="none" />
      <text
        x={mx}
        y={my - 3.5}
        fill={color}
        stroke="none"
        fontFamily={mono}
        fontSize={7.5}
        letterSpacing={0.6}
        textAnchor="middle"
        transform={`rotate(${(a * 180) / Math.PI} ${mx} ${my})`}
      >
        {label}
      </text>
    </g>
  );
}

/** A numbered balloon with a leader to a point. */
export function Balloon({
  x,
  y,
  tx,
  ty,
  n,
  color = WHITE,
}: {
  x: number;
  y: number;
  tx: number;
  ty: number;
  n: number | string;
  color?: string;
}) {
  const a = Math.atan2(ty - y, tx - x);
  return (
    <g stroke={color} strokeWidth={0.5} fill="none">
      <circle cx={x} cy={y} r={7.5} />
      <path d={`M ${x + 7.5 * Math.cos(a)} ${y + 7.5 * Math.sin(a)} L ${tx} ${ty}`} />
      <circle cx={tx} cy={ty} r={1.3} fill={color} />
      <text x={x} y={y + 2.6} fill={color} stroke="none" fontFamily={mono} fontSize={7.5} textAnchor="middle">
        {n}
      </text>
    </g>
  );
}

const Reg = ({ x, y }: { x: number; y: number }) => (
  <g stroke={GREY} strokeWidth={0.5} fill="none">
    <circle cx={x} cy={y} r={6} />
    <path d={`M ${x - 10} ${y} H ${x + 10} M ${x} ${y - 10} V ${y + 10}`} />
  </g>
);

/** The grid: fine lines, heavier every fifth. Drawn as paths (no pattern ids to clash between copies). */
function Grid({ step = 16 }: { step?: number }) {
  const fine: string[] = [];
  const bold: string[] = [];
  for (let x = 28, i = 0; x <= W - 28; x += step, i++) (i % 5 ? fine : bold).push(`M ${x} 28 V ${H - 28}`);
  for (let y = 28, i = 0; y <= H - 28; y += step, i++) (i % 5 ? fine : bold).push(`M 28 ${y} H ${W - 28}`);
  return (
    <g fill="none" strokeWidth={0.5}>
      <path d={fine.join(" ")} stroke="#fff" strokeOpacity={0.035} />
      <path d={bold.join(" ")} stroke="#fff" strokeOpacity={0.065} />
    </g>
  );
}

function TitleBlock({ title, sheet, doc, rev }: { title: string; sheet: string; doc: string; rev: string }) {
  const x = W - 28 - 236;
  const y = H - 28 - 58;
  const cells: [number, number, number, string, string][] = [
    [36, 0, 130, "TITLE", title],
    [166, 0, 70, "SHEET", sheet],
    [36, 29, 80, "DOC", doc],
    [116, 29, 50, "REV", rev],
    [166, 29, 70, "CLASS", "R-3"],
  ];
  return (
    <g fontFamily={mono}>
      <rect x={x} y={y} width={36} height={58} fill="none" stroke={GREY} strokeWidth={0.5} />
      <Mark x={x + 11} y={y + 12} s={14} />
      <text x={x + 18} y={y + 46} fontSize={5} fill={GREY} textAnchor="middle" letterSpacing={0.8}>
        ORDINAL
      </text>
      {cells.map(([cx, cy, w, k, v]) => (
        <g key={k}>
          <rect x={x + cx} y={y + cy} width={w} height={29} fill="none" stroke={GREY} strokeWidth={0.5} />
          <text x={x + cx + 5} y={y + cy + 9} fontSize={5.2} fill={GREY} letterSpacing={1}>
            {k}
          </text>
          <text x={x + cx + 5} y={y + cy + 21} fontSize={8} fill={WHITE} letterSpacing={0.6}>
            {v}
          </text>
        </g>
      ))}
    </g>
  );
}

/** RESTRICTED / ARCHIVE, stamped at an angle in amber. */
function Stamp({ x, y, r = -7 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`rotate(${r} ${x} ${y})`} opacity={0.85}>
      <rect x={x - 70} y={y - 17} width={140} height={34} fill="none" stroke={AMBER} strokeWidth={1.4} />
      <rect x={x - 66} y={y - 13} width={132} height={26} fill="none" stroke={AMBER} strokeWidth={0.5} />
      <text x={x} y={y - 1} fill={AMBER} fontFamily={mono} fontSize={10} letterSpacing={2.4} textAnchor="middle">
        RESTRICTED
      </text>
      <text x={x} y={y + 9} fill={AMBER} fontFamily={mono} fontSize={6} letterSpacing={3} textAnchor="middle">
        ARCHIVE · VAULT 3
      </text>
    </g>
  );
}

const svg = (children: ReactNode) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
    {children}
  </svg>
);

/**
 * A page of the archive as display art in three layers: the frame, grid and construction lines sunk
 * 2 px below the page, the drawing on it, the annotations (labels, dimensions, balloons, title block,
 * stamp, notes) floating 5 px above.
 */
export function page({
  heading,
  title,
  sheet,
  doc = "7781-C",
  rev = "04",
  drawing,
  stamp,
  body,
}: {
  heading: string;
  title: string;
  sheet: string;
  doc?: string;
  rev?: string;
  drawing: (part: Part) => ReactNode;
  stamp?: [number, number];
  body?: ReactNode;
}): PageContent {
  return {
    layers: [
      {
        depth: -2,
        node: svg(
          <>
            <Grid />
            <rect x={28} y={28} width={W - 56} height={H - 56} fill="none" stroke={GREY} strokeWidth={0.6} />
            <Reg x={16} y={16} />
            <Reg x={W - 16} y={16} />
            <Reg x={16} y={H - 16} />
            <Reg x={W - 16} y={H - 16} />
          </>,
        ),
      },
      { depth: 0, node: svg(drawing("lines")) },
      {
        depth: 5,
        node: (
          <>
            {svg(
              <>
                <Mark x={44} y={44} s={11} />
                <Label x={62} y={53} color={WHITE}>
                  ORDINAL · SYSTEMS DIVISION
                </Label>
                <Label x={W - 44} y={53} anchor="end">
                  {`DOC ${doc} · REV ${rev}`}
                </Label>
                <Label x={44} y={76} size={8.5} color={YELLOW}>
                  {heading}
                </Label>
                <TitleBlock title={title} sheet={sheet} doc={doc} rev={rev} />
                {drawing("notes")}
                {stamp && <Stamp x={stamp[0]} y={stamp[1]} />}
              </>,
            )}
            {body}
          </>
        ),
      },
    ],
  };
}

// --- Drawings ----------------------------------------------------------------------------------

/** The die, shared by the floor plan and the overlay that registers on it. */
export const DIE = { x: 96, y: 112, s: 368, inset: 26 };
const tileAt = (col: number, row: number) => {
  const a = DIE.s - DIE.inset * 2;
  const t = (a - 12 * 3) / 4;
  return { x: DIE.x + DIE.inset + col * (t + 12), y: DIE.y + DIE.inset + row * (t + 12), t };
};

/** A processor die seen from above: an IO ring of pads, twelve compute tiles and two SRAM banks. */
export function dieFloorplan(part: Part) {
  const { x, y, s, inset } = DIE;
  const sram = tileAt(0, 3);
  const half = (s - inset * 2 - 12) / 2;
  if (part === "notes") {
    const labels: ReactNode[] = [];
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++) {
        const { x: tx, y: ty } = tileAt(col, row);
        labels.push(
          <Label key={`${col}${row}`} x={tx + 4} y={ty + 9} size={5.5}>
            {`NPU ${row}${col}`}
          </Label>,
        );
      }
    return (
      <>
        {labels}
        {[0, 1].map((i) => (
          <Label key={i} x={sram.x + i * (half + 12) + 4} y={sram.y + 9} size={5.5}>
            {`SRAM ${i} · 96 MB`}
          </Label>
        ))}
        <Dim x1={x} y1={y} x2={x + s} y2={y} off={-16} label="21.40" />
        <Dim x1={x + s} y1={y} x2={x + s} y2={y + s} off={-18} label="21.40" />
      </>
    );
  }
  let pads = "";
  for (let i = 0; i < 24; i++) {
    const o = 16 + i * ((s - 32) / 23);
    pads += `M ${x + o - 2.5} ${y + 4} h 5 v 9 h -5 Z M ${x + o - 2.5} ${y + s - 13} h 5 v 9 h -5 Z M ${x + 4} ${y + o - 2.5} h 9 v 5 h -9 Z M ${x + s - 13} ${y + o - 2.5} h 9 v 5 h -9 Z `;
  }
  let tiles = "";
  let cells = "";
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const { x: tx, y: ty, t } = tileAt(col, row);
      tiles += `M ${tx} ${ty} h ${t} v ${t} h ${-t} Z `;
      for (let i = 0; i < 4; i++) cells += `M ${tx + 8 + (i * (t - 16)) / 3} ${ty + 14} V ${ty + t - 8} `;
      cells += `M ${tx + 8} ${ty + t / 2 + 4} H ${tx + t - 8} `;
    }
  let banks = "";
  let rows = "";
  for (let i = 0; i < 2; i++) {
    const bx = sram.x + i * (half + 12);
    banks += `M ${bx} ${sram.y} h ${half} v ${sram.t} h ${-half} Z `;
    for (let k = 0; k < 13; k++)
      rows += `M ${bx + 8 + k * ((half - 16) / 12)} ${sram.y + 16} V ${sram.y + sram.t - 6} `;
  }
  return (
    <g fill="none" strokeWidth={0.6}>
      <rect x={x} y={y} width={s} height={s} stroke={YELLOW} strokeWidth={0.9} />
      <rect x={x + 18} y={y + 18} width={s - 36} height={s - 36} stroke={GREY} />
      <path d={pads} stroke={GREY} />
      <path d={`${tiles} ${banks}`} stroke={YELLOW} />
      <path d={`${cells} ${rows}`} stroke={GREY} />
    </g>
  );
}

/** Printed on a sheet laid over the floor plan: the interconnect, registering on the die beneath it. */
export function InterconnectOverlay({ ink = VELLUM_INK, accent = VELLUM_ACCENT }: { ink?: string; accent?: string }) {
  const a = tileAt(0, 0);
  const b = tileAt(3, 2);
  let lanes = "";
  for (let i = 0; i < 3; i++) {
    const gx = tileAt(i, 0).x + a.t + 6;
    const gy = tileAt(0, i).y + a.t + 6;
    lanes += `M ${gx} ${a.y - 8} V ${b.y + b.t + 6} M ${a.x - 8} ${gy} H ${b.x + b.t + 8} `;
  }
  const nodes: ReactNode[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const nx = tileAt(i, 0).x + a.t + 6;
      const ny = tileAt(0, j).y + a.t + 6;
      nodes.push(<rect key={`${i}${j}`} x={nx - 3} y={ny - 3} width={6} height={6} fill={ink} />);
    }
  const hot = tileAt(1, 1);
  return svg(
    <g fill="none" stroke={ink} strokeWidth={0.9}>
      <rect x={a.x - 8} y={a.y - 8} width={b.x + b.t + 16 - a.x} height={b.y + b.t + 14 - a.y} strokeDasharray="2 3" />
      <path d={lanes} />
      {nodes}
      <rect x={hot.x - 3} y={hot.y - 3} width={hot.t + 6} height={hot.t + 6} stroke={accent} strokeWidth={1.4} />
      <path
        d={`M ${hot.x + hot.t + 3} ${hot.y - 3} L ${hot.x + hot.t + 40} ${hot.y - 40} H ${DIE.x + DIE.s + 4}`}
        stroke={accent}
        strokeWidth={0.7}
      />
      <Label x={DIE.x + DIE.s + 4} y={hot.y - 44} color={accent} anchor="end" size={6.5}>
        HOT SPOT · 112 °C
      </Label>
      <Label x={DIE.x} y={DIE.y + DIE.s + 36} color={ink} size={8}>
        OVERLAY B · NOC MESH 3 × 3 · 4.2 TB/S
      </Label>
      <Label x={DIE.x} y={DIE.y + DIE.s + 50} color={ink} size={6}>
        LAY OVER SHEET 2 · REGISTER ON MARKS
      </Label>
      <Balloon x={DIE.x - 20} y={DIE.y + DIE.s + 14} tx={a.x - 8} ty={b.y + b.t + 6} n="B1" color={ink} />
    </g>,
  );
}

/** The neural core cut in half: housing walls hatched, the die stack, coolant bores. */
export function coreSection(part: Part, x = 70, y = 130) {
  const w = 300;
  const h = 236;
  const wall = 14;
  const stack = [
    ["SPREADER", 18],
    ["LATTICE 4", 13],
    ["LATTICE 3", 13],
    ["LATTICE 2", 13],
    ["LATTICE 1", 13],
    ["INTERPOSER", 9],
    ["SUBSTRATE", 15],
  ] as const;
  const sx = x + 46;
  const sw = w - 92;
  const tops: number[] = [];
  let sy = y + wall + 22;
  for (const [, t] of stack) {
    tops.push(sy);
    sy += t + 5;
  }
  if (part === "notes")
    return (
      <>
        {stack.map(([name, t], i) => (
          <g key={name}>
            <path d={`M ${sx + sw} ${tops[i] + t / 2} H ${x + w + 26}`} stroke={GREY} strokeWidth={0.4} />
            <Label x={x + w + 30} y={tops[i] + t / 2 + 2.5} size={6} color={name.startsWith("LATTICE") ? YELLOW : GREY}>
              {name}
            </Label>
          </g>
        ))}
        <Dim x1={x} y1={y + h} x2={x + w} y2={y + h} off={22} label="96.00" />
        <Dim x1={x} y1={y} x2={x} y2={y + h} off={22} label="74.50" />
      </>
    );
  // Hatching as lines clipped by hand to the walls (no pattern ids).
  const hatch: string[] = [];
  for (let k = -h; k < w; k += 6) {
    const seg = (y0: number, y1: number, x0: number, x1: number) => {
      const a = Math.max(x0, x + k + (y0 - y));
      const b = Math.min(x1, x + k + (y1 - y));
      if (b > a) hatch.push(`M ${a} ${y0 + (a - x - k - (y0 - y))} L ${b} ${y0 + (b - x - k - (y0 - y))}`);
    };
    seg(y, y + wall, x, x + w);
    seg(y + h - wall, y + h, x, x + w);
  }
  for (let k = 0; k < h; k += 6) {
    hatch.push(`M ${x} ${y + k} L ${x + Math.min(wall, h - k)} ${y + k + Math.min(wall, h - k)}`);
    hatch.push(`M ${x + w - wall} ${y + k} L ${x + w - wall + Math.min(wall, h - k)} ${y + k + Math.min(wall, h - k)}`);
  }
  return (
    <g fill="none" stroke={YELLOW} strokeWidth={0.6}>
      <path
        d={`M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z M ${x + wall} ${y + wall} V ${y + h - wall} H ${x + w - wall} V ${y + wall} Z`}
      />
      <path d={hatch.join(" ")} stroke={GREY} strokeWidth={0.45} />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={x + 30 + i * 40} cy={y + wall / 2} r={4} fill={PAPER} />
      ))}
      {stack.map(([name, t], i) => (
        <g key={name}>
          <rect x={sx} y={tops[i]} width={sw} height={t} stroke={i === 0 ? WHITE : YELLOW} />
          {i > 0 && i < 6 && (
            <path
              d={Array.from({ length: 20 }, (_, k) => `M ${sx + 6 + k * ((sw - 12) / 19)} ${tops[i] - 4} v 3`).join(
                " ",
              )}
              stroke={GREY}
            />
          )}
        </g>
      ))}
      <path
        d={Array.from({ length: 14 }, (_, k) => `M ${sx + 8 + k * ((sw - 16) / 13) - 2} ${sy} h 4 v 10 h -4 Z`).join(
          " ",
        )}
        stroke={GREY}
      />
      <path d={`M ${x + w / 2} ${y - 16} V ${y + h + 16}`} stroke={GREY} strokeDasharray={C} />
    </g>
  );
}

/** The core pulled apart along its axis, as isometric plates, with balloons. */
export function coreExploded(part: Part, x = 200, y = 170) {
  const plates = [
    { name: "CAP", a: 66, t: 8, gap: 0 },
    { name: "SPREADER", a: 62, t: 10, gap: 50 },
    { name: "LATTICE × 4", a: 54, t: 4, gap: 46, layers: 4 },
    { name: "INTERPOSER", a: 60, t: 5, gap: 70 },
    { name: "BASE / POWER", a: 66, t: 12, gap: 50 },
  ];
  const at: number[] = [];
  let cy = y;
  for (const p of plates) {
    cy += p.gap;
    at.push(cy);
  }
  if (part === "notes")
    return (
      <>
        {plates.map((p, i) => {
          const accent = p.name.startsWith("LATTICE");
          return (
            <g key={p.name}>
              <Balloon
                x={x + 168}
                y={at[i] - 4}
                tx={x + p.a * 1.732 - 8}
                ty={at[i] + 4}
                n={i + 1}
                color={accent ? YELLOW : WHITE}
              />
              <Label x={x + 182} y={at[i] - 1} size={6.5} color={accent ? YELLOW : GREY}>
                {p.name}
              </Label>
            </g>
          );
        })}
      </>
    );
  const out: ReactNode[] = [];
  plates.forEach((p, i) => {
    const layers = p.layers ?? 1;
    for (let k = layers - 1; k >= 0; k--) {
      const py = at[i] + k * 9;
      const hw = p.a * 1.732;
      const accent = p.name.startsWith("LATTICE");
      out.push(
        <g key={`${p.name}${k}`} stroke={accent ? YELLOW : WHITE} fill={PAPER} strokeWidth={0.6}>
          <path d={`M ${x} ${py - p.a} L ${x + hw} ${py} L ${x} ${py + p.a} L ${x - hw} ${py} Z`} />
          <path
            d={`M ${x - hw} ${py} V ${py + p.t} L ${x} ${py + p.a + p.t} L ${x + hw} ${py + p.t} V ${py} M ${x} ${py + p.a} V ${py + p.a + p.t}`}
            fill="none"
          />
          {accent && k === 0 && (
            <path
              d={Array.from({ length: 5 }, (_, j) => {
                const f = (j + 1) / 6;
                return `M ${x - hw * (1 - f)} ${py - p.a * f} L ${x + hw * f} ${py + p.a * (1 - f)} M ${x + hw * (1 - f)} ${py - p.a * f} L ${x - hw * f} ${py + p.a * (1 - f)}`;
              }).join(" ")}
              stroke={GREY}
              fill="none"
            />
          )}
        </g>,
      );
    }
  });
  return (
    <g>
      <path d={`M ${x} ${y - 40} V ${cy + 110}`} stroke={GREY} strokeWidth={0.5} strokeDasharray={C} />
      {out}
    </g>
  );
}

/** A cold plate with a serpentine coolant channel, inlet and outlet. */
export function coldPlate(part: Part, x = 100, y = 150) {
  const w = 360;
  const h = 250;
  const runs = 7;
  if (part === "notes")
    return (
      <>
        <Label x={x - 30} y={y + 22} color={AMBER} size={6.5}>
          IN 18 °C
        </Label>
        <Label x={x + w + 30} y={y + 22 + (runs - 1) * 30} size={6.5} anchor="end" color={WHITE}>
          OUT 31 °C
        </Label>
        <Dim x1={x} y1={y + h} x2={x + w} y2={y + h} off={22} label="180.00" />
        <Dim x1={x + w} y1={y} x2={x + w} y2={y + h} off={-16} label="125.00" />
      </>
    );
  let d = `M ${x - 30} ${y + 34}`;
  for (let i = 0; i < runs; i++) {
    const ry = y + 34 + i * 30;
    const right = i % 2 === 0;
    d += ` H ${right ? x + w - 34 : x + 34}`;
    if (i < runs - 1) d += ` A 15 15 0 0 ${right ? 1 : 0} ${right ? x + w - 34 : x + 34} ${ry + 30}`;
  }
  d += ` H ${x + w + 30}`;
  return (
    <g fill="none">
      <rect x={x} y={y} width={w} height={h} rx={10} stroke={YELLOW} strokeWidth={0.8} />
      <path d={`M ${x + 12} ${y + 12} m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0`} stroke={GREY} />
      <path d={d} stroke={YELLOW} strokeWidth={9} strokeLinejoin="round" />
      <path d={d} stroke={PAPER} strokeWidth={7.6} strokeLinejoin="round" />
      <path d={d} stroke={GREY} strokeWidth={0.4} strokeDasharray="3 5" />
      <path d={arrow(x - 4, y + 34, 0, 7)} fill={AMBER} />
      <path d={arrow(x + w + 30, y + 34 + (runs - 1) * 30, 0, 7)} fill={WHITE} />
    </g>
  );
}

/** The wiring between the core and what feeds it: modules, buses, junctions. */
export function wiring(part: Part, x = 70, y = 130) {
  const boxes: [number, number, number, number, string, boolean][] = [
    [80, 120, 160, 80, "CORE · M7", true],
    [330, 30, 110, 60, "MEMORY", false],
    [330, 250, 110, 60, "POWER", false],
    [400, 130, 60, 60, "LINK", false],
    [-40, 130, 50, 60, "SENSE", false],
  ];
  if (part === "notes")
    return (
      <>
        {boxes.map(([bx, by, , , name, accent]) => (
          <Label key={name} x={x + bx + 6} y={y + by + 12} size={6.5} color={accent ? YELLOW : WHITE}>
            {name}
          </Label>
        ))}
        <Label x={x + 250} y={y + 52} size={6} color={YELLOW}>
          HBM · 8 × 128 BIT
        </Label>
        <Label x={x + 250} y={y + 296} size={6}>
          48 V · 1.2 KW
        </Label>
        <Label x={x + 290} y={y + 136} size={6}>
          TX0 · TX1 · TX2
        </Label>
      </>
    );
  const bus = (d: string, accent: boolean) => (
    <g key={d}>
      <path d={d} stroke={accent ? YELLOW : WHITE} strokeWidth={3.2} fill="none" />
      <path d={d} stroke={PAPER} strokeWidth={1.8} fill="none" />
    </g>
  );
  return (
    <g fill="none" strokeWidth={0.6}>
      {bus(`M ${x + 160} ${y + 120} V ${y + 60} H ${x + 330}`, true)}
      {bus(`M ${x + 160} ${y + 200} V ${y + 280} H ${x + 330}`, false)}
      {bus(`M ${x + 80} ${y + 160} H ${x + 10}`, false)}
      <path
        d={`M ${x + 240} ${y + 140} H ${x + 400} M ${x + 240} ${y + 160} H ${x + 400} M ${x + 240} ${y + 180} H ${x + 400}`}
        stroke={YELLOW}
      />
      {boxes.map(([bx, by, w, h, name, accent]) => (
        <rect key={name} x={x + bx} y={y + by} width={w} height={h} stroke={accent ? YELLOW : WHITE} fill={PAPER} />
      ))}
      {[
        [240, 140],
        [240, 160],
        [240, 180],
        [160, 60],
        [160, 280],
      ].map(([dx, dy]) => (
        <circle key={`${dx}${dy}`} cx={x + dx} cy={y + dy} r={2} fill={WHITE} stroke="none" />
      ))}
      <path
        d={`M ${x + 385} ${y + 310} V ${y + 330} M ${x + 375} ${y + 330} H ${x + 395} M ${x + 379} ${y + 334} H ${x + 391} M ${x + 383} ${y + 338} H ${x + 387}`}
        stroke={GREY}
      />
    </g>
  );
}

export const NOTES =
  "Cores leave the vault one at a time and are signed for by two officers. A core that has run must not be powered again outside a shielded bay, and its lattice is never imaged. Coolant is drained before transport; residual charge in the interposer is held for 72 hours. Anomalies in self-test are logged by number only. Revisions to this sheet supersede all prior issues.";

/** A paragraph of notes, set in HTML. */
export const Notes = ({ top }: { top: number }) => (
  <p
    style={{
      position: "absolute",
      left: 44,
      right: 44,
      top,
      margin: 0,
      fontFamily: sans,
      fontSize: 11,
      lineHeight: 1.62,
      color: "#8d8b84",
      textAlign: "justify",
    }}
  >
    {NOTES}
  </p>
);
