import { ease, interpolate, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Camera, Cursor } from "@intentface-launch/core/kit";
import { Crt } from "@intentface-launch/three";
import type { CSSProperties, ReactNode } from "react";
import { CLAUDE_CMD, CLAUDE_KEYS, INIT_CMD, INIT_KEYS, PROMPT, PROMPT_KEYS, T, TERM } from "./timing";

// The terminal, close up, on a subtle CRT with a soft glow: the install, then
// Claude Code in the same window, its questions, the board link, and (after
// the board) the render. One component on the film's clock (the shots that
// show it continue the first shot), so the terminal carries on across cuts.
// Lines only ever append, as in a real terminal; the camera travels down them.

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SIZE = 30;
const LH = 48;
const CH = SIZE * 0.6; // IBM Plex Mono's advance
const X0 = 140;

const C = {
  bg: "#0b0c0d",
  ink: "#e8e8e4",
  muted: "#8d8d88",
  dim: "#55554f",
  claude: "#d97757",
  green: "#62c073",
  path: "#7fa8f5",
  link: "#8fb4ff",
  select: "#b9a3ff",
};

const PATH = "~/code/productivity-app";
const LINK = "http://localhost:4400/?v=task-feature&board";

// Rows, in content pixels.
const Y = {
  init: 300,
  output: [348, 396, 444],
  claude: 540,
  welcome: 612,
  input: 836,
  thinking: 908,
  tools: [908, 956, 1004],
  ask: 1060,
  panel: 1132,
  answered: 1132,
  ready: 1196,
  link: 1244,
  input2: 1316,
  render: 1316,
  bar: 1376,
  done: 1436,
  input3: 1508,
};

const row = (y: number, x = X0): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  height: LH,
  lineHeight: `${LH}px`,
  whiteSpace: "pre",
});

/** Typed text: the characters whose key has come, and a block caret that is solid while typing and blinks at rest. */
function Typed({
  text,
  keys,
  caret = true,
  until = Infinity,
}: {
  text: string;
  keys: number[];
  caret?: boolean;
  until?: number;
}) {
  const f = useFrame();
  const n = keys.filter((k) => f >= k).length;
  const last = n > 0 ? keys[n - 1] : -Infinity;
  const blinkOn = f - last < 24 || Math.floor((f - keys[0]) / 30) % 2 === 0;
  return (
    <>
      {text.slice(0, n)}
      {caret && f < until && <Caret on={blinkOn} />}
    </>
  );
}

function Caret({ on = true }: { on?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: CH,
        height: SIZE * 1.15,
        verticalAlign: "middle",
        marginTop: -4,
        background: C.ink,
        opacity: on ? 0.9 : 0,
      }}
    />
  );
}

/** Appears at `at`: a terminal prints a line at once; a 3-frame rise keeps it from feeling pasted. */
function Line({
  at,
  until = Infinity,
  y,
  x,
  children,
}: {
  at: number;
  until?: number;
  y: number;
  x?: number;
  children: ReactNode;
}) {
  const f = useFrame();
  if (f < at || f >= until) return null;
  const p = interpolate(f, [at, at + 4], [0, 1], { easing: ease.out });
  return (
    <div style={{ ...row(y, x), opacity: p, transform: `translateY(${Math.round((1 - p) * 6)}px)` }}>{children}</div>
  );
}

const Prompt = () => (
  <>
    <span style={{ color: C.path }}>{PATH}</span>
    <span style={{ color: C.muted }}> % </span>
  </>
);

/** A tool call, as Claude Code prints it. */
const Tool = ({ name, arg }: { name: string; arg: string }) => (
  <>
    <span style={{ color: C.green }}>⏺ </span>
    <span style={{ fontWeight: 600 }}>{name}</span>
    <span style={{ color: C.muted }}>({arg})</span>
  </>
);

/** Claude Code's input box: a rounded frame with "> " and what is typed in it. */
function InputBox({ y, children, hint = true }: { y: number; children?: ReactNode; hint?: boolean }) {
  const { box } = useShape();
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: X0 - 6,
          top: y,
          width: box,
          height: 88,
          boxSizing: "border-box",
          border: `2px solid ${C.dim}`,
          borderRadius: 12,
          padding: "0 22px",
          lineHeight: "84px",
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: C.muted }}>{"> "}</span>
        {children}
      </div>
      {hint && <div style={{ ...row(y + 96, X0 + 16), fontSize: 24, color: C.dim }}>? for shortcuts</div>}
    </>
  );
}

const SPIN = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];

/** The question panel: tabs for the questions, the current one, its options and the pointer. */
function Questions() {
  const { panel } = useShape();
  const f = useFrame();
  const second = f >= T.q2;
  const pointer = second ? (f >= T.q2Down ? 1 : 0) : 0;
  const picked = second ? T.a2 : T.a1;
  // The chosen option flashes as it is entered.
  const flash = interpolate(f, [picked - 2, picked + 2, picked + 10], [0, 1, 0]);
  const options = second ? ["Calm and precise", "Bold and energetic"] : ["Our current users", "New sign-ups"];
  const tab = (label: string, done: boolean, current: boolean) => (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 6,
        background: current ? "rgb(255 255 255 / 0.1)" : "transparent",
        color: done ? C.green : current ? C.ink : C.muted,
      }}
    >
      {done ? "✔" : "☐"} {label}
    </span>
  );
  return (
    <div style={{ position: "absolute", left: X0 - 6, top: Y.panel, width: panel }}>
      <div style={{ borderTop: `2px solid ${C.dim}`, paddingTop: 18, display: "flex", gap: 18, lineHeight: `${LH}px` }}>
        {tab("Audience", second, !second)}
        {tab("Feel", false, second)}
        {tab("Submit", false, false)}
      </div>
      <div style={{ marginTop: 18, lineHeight: `${LH}px`, fontWeight: 600 }}>
        {second ? "How should it feel?" : "Who is the video for?"}
      </div>
      {options.map((o, i) => {
        const on = i === pointer;
        return (
          <div
            key={o}
            style={{
              lineHeight: `${LH}px`,
              whiteSpace: "pre",
              color: on ? C.select : C.ink,
              textShadow: on && flash > 0 ? `0 0 ${12 * flash}px ${C.select}` : undefined,
            }}
          >
            {on ? "❯ " : "  "}
            {i + 1}. {o}
          </div>
        );
      })}
    </div>
  );
}

/** The render's progress bar: 30 cells filling, with the percentage. */
function RenderBar() {
  const f = useFrame();
  const p = interpolate(f, [T.render + 14, T.rendered - 6], [0, 1], { easing: ease.inOut });
  const { cells } = useShape();
  const full = Math.round(p * cells);
  return (
    <>
      <span style={{ color: C.muted }}>{"  task-feature.mp4  "}</span>
      <span style={{ color: C.claude }}>{"━".repeat(full)}</span>
      <span style={{ color: C.dim }}>{"━".repeat(cells - full)}</span>
      <span>{` ${String(Math.round(p * 100)).padStart(3)}%`}</span>
    </>
  );
}

/** Where the camera looks: a content point at the frame's centre, and a zoom. */
type V = [number, number, number];

/**
 * The framings, by the frame's shape. 16:9 is close (30 px mono at about 1.4×); 4:5 is narrower,
 * so the camera stands further back for the long lines and the boxes are narrower.
 */
function shape(narrow: boolean) {
  const W = narrow ? 1080 : 1920;
  const margin = narrow ? 44 : 220;
  /** A view with content x `X0` at screen x `margin`, and content y `y` at the centre. */
  // In 4:5 the frame is tall: the lines being read sit lower, with what came before above them.
  const lift = narrow ? 170 : 0;
  const view = (y: number, zoom: number, m = margin): V => [X0 + (W / 2 - m) / zoom, y - lift, zoom];
  const z = narrow
    ? { close: 1.9, install: 0.9, wide: 0.9, read: 0.92, link: 0.95 }
    : { close: 2.2, install: 1.45, wide: 1.35, read: 1.4, link: 1.5 };
  return {
    view,
    z,
    margin,
    closeMargin: narrow ? 90 : 260,
    /** Where the caret is held on screen while the install is typed. */
    caretAt: narrow ? 800 : 1480,
    box: narrow ? 940 : 1000,
    panel: narrow ? 940 : 1180,
    cells: narrow ? 22 : 30,
  };
}
const useShape = () => shape(useVideoInfo().format.aspect < 1);

/**
 * Moves that end exactly: each key sets off at its `at` and arrives `frames` later on ease.inOut, and
 * moves that overlap add up, so the camera rounds corners. A spring would never quite stop, and its
 * slow tail creeps the whole terminal a fraction of a pixel at a time.
 */
function eased(f: number, keys: { at: number; to: V }[], frames: number): V {
  const out = [...keys[0].to] as V;
  for (let i = 1; i < keys.length; i++) {
    const t = ease.inOut(Math.min(1, Math.max(0, (f - keys[i].at) / frames)));
    for (let c = 0; c < 3; c++) out[c] += (keys[i].to[c] - keys[i - 1].to[c]) * t;
  }
  return out;
}

function cameraAt(f: number, _fps: number, narrow: boolean): V {
  const { view, z, closeMargin, caretAt } = shape(narrow);
  // The render is a cut back into the terminal: its own settle from a little wider.
  if (f >= T.render)
    return eased(
      f,
      [
        { at: T.render - 1, to: view(Y.bar - 20, z.link * 0.95) },
        { at: T.render, to: view(Y.bar + 10, z.link) },
        { at: T.rendered, to: view(Y.done, z.link) },
      ],
      36,
    );
  const close = z.close;
  const keys: { at: number; to: V }[] = [{ at: -1, to: [view(0, close, closeMargin)[0], Y.init + 24, close] }];
  // While the install is typed the camera rides along with the caret, close in.
  const promptWidth = (PATH.length + 3) * CH;
  INIT_KEYS.forEach((k, i) => {
    if (i % 4 !== 3) return;
    const caret = X0 + promptWidth + (i + 1) * CH;
    const W = narrow ? 1080 : 1920;
    const x = Math.max(view(0, close, closeMargin)[0], caret - (caretAt - W / 2) / close);
    keys.push({ at: k, to: [x, Y.init + 24, close] });
  });
  keys.push(
    { at: T.initEnter, to: view(Y.output[1], z.install) },
    { at: CLAUDE_KEYS[0], to: view(Y.claude - 10, z.install) },
    { at: T.welcome, to: view(Y.welcome + 220, z.wide) },
    { at: PROMPT_KEYS[0], to: view(Y.input + 10, z.read) },
    { at: T.submit, to: view(Y.thinking + 20, z.read) },
    { at: T.tools[2], to: view(Y.tools[2], z.read) },
    { at: T.ask, to: view(Y.panel + 80, z.read) },
    { at: T.a2, to: view(Y.answered + 60, z.read) },
    { at: T.ready, to: view(Y.link, z.link) },
  );
  return eased(f, keys, 30);
}

function Screen() {
  const f = useFrame();
  const { box, panel } = useShape();
  const asked = f >= T.submit;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920,
        height: 2000,
        font: `400 ${SIZE}px ${MONO}`,
        color: C.ink,
      }}
    >
      {/* The install */}
      <div style={row(Y.init)}>
        <Prompt />
        <Typed text={INIT_CMD} keys={INIT_KEYS} until={T.initEnter} />
      </div>
      <Line at={T.output[0]} y={Y.output[0]}>
        <span style={{ color: C.green }}>✓ </span>Added @intentface-launch/core
      </Line>
      <Line at={T.output[1]} y={Y.output[1]}>
        <span style={{ color: C.green }}>✓ </span>Created launch/
      </Line>
      <Line at={T.output[2]} y={Y.output[2]}>
        <span style={{ color: C.green }}>✓ </span>Installed the video skills for Claude
      </Line>
      <Line at={T.output[2] + 6} y={Y.claude}>
        <Prompt />
        <Typed text={CLAUDE_CMD} keys={CLAUDE_KEYS} until={T.claudeEnter} />
      </Line>

      {/* Claude Code */}
      {f >= T.welcome && (
        <div
          style={{
            position: "absolute",
            left: X0 - 6,
            top: Y.welcome,
            width: box,
            boxSizing: "border-box",
            border: `2px solid ${C.claude}`,
            borderRadius: 12,
            padding: "22px 26px",
            lineHeight: `${LH}px`,
            whiteSpace: "pre",
          }}
        >
          <div>
            <span style={{ color: C.claude }}>✻ </span>Welcome to <span style={{ fontWeight: 600 }}>Claude Code</span>!
          </div>
          <div style={{ color: C.muted }}>{"  /help for help, /status for your setup"}</div>
          <div style={{ color: C.muted }}>
            {"  cwd: "}
            <span style={{ color: C.ink }}>{PATH}</span>
          </div>
        </div>
      )}
      {f >= T.welcome && !asked && (
        <InputBox y={Y.input}>
          <Typed text={PROMPT} keys={PROMPT_KEYS} caret={f >= T.welcome + 20} />
        </InputBox>
      )}
      {asked && (
        <div
          style={{
            ...row(Y.input),
            left: X0 - 6,
            width: panel,
            padding: "0 16px",
            background: "rgb(255 255 255 / 0.06)",
            borderRadius: 8,
          }}
        >
          <span style={{ color: C.muted }}>{"> "}</span>
          {PROMPT}
        </div>
      )}
      <Line at={T.thinking} until={T.tools[0]} y={Y.thinking}>
        <span style={{ color: C.claude }}>{SPIN[Math.floor(f / 5) % SPIN.length]} </span>
        <span style={{ color: C.claude }}>Thinking…</span>
      </Line>
      <Line at={T.tools[0]} y={Y.tools[0]}>
        <Tool name="Skill" arg="product-launch-video" />
      </Line>
      <Line at={T.tools[1]} y={Y.tools[1]}>
        <Tool name="Read" arg="src/features/tasks/TaskList.tsx" />
      </Line>
      <Line at={T.tools[2]} y={Y.tools[2]}>
        <Tool name="Bash" arg="pnpm launch look localhost:3000" />
      </Line>
      <Line at={T.ask} y={Y.ask}>
        <span>⏺ </span>I looked at the app. Two questions first:
      </Line>
      {f >= T.q1 && f < T.a2 + 4 && <Questions />}
      <Line at={T.a2 + 4} y={Y.answered}>
        <span style={{ color: C.muted }}>{"  ⎿  Our current users · Bold and energetic"}</span>
      </Line>
      <Line at={T.ready} y={Y.ready}>
        <span>⏺ </span>The script and the storyboard are ready:
      </Line>
      <Line at={T.ready + 8} y={Y.link}>
        <BoardLink />
      </Line>
      {f >= T.ready + 16 && f < T.render && <InputBox y={Y.input2} />}

      {/* After the board: Claude acts on the note, renders */}
      <Line at={T.render} y={Y.render}>
        <span>⏺ </span>Shot 1 is a closeup now. Rendering the video:
      </Line>
      <Line at={T.render + 6} y={Y.bar}>
        <RenderBar />
      </Line>
      <Line at={T.rendered} y={Y.done}>
        <span style={{ color: C.green }}>✓ </span>Done: <span style={{ fontWeight: 600 }}>out/task-feature.mp4</span>
        <span style={{ color: C.muted }}> · 0:30</span>
      </Line>
      {f >= T.rendered + 8 && <InputBox y={Y.input3} />}

      <Cursor
        keys={[
          { at: T.ready + 14, to: { x: 1400, y: Y.link + 150 } },
          { at: T.linkClick, to: { x: X0 + 2 * CH + 15 * CH, y: Y.link + LH / 2 + 4 }, click: true, hover: 14 },
        ]}
        appear={T.ready + 14}
        hidden={[[T.linkClick + 30, 1e6]]}
      />
    </div>
  );
}

/** The link brightens and underlines as the pointer reaches it. */
function BoardLink() {
  const f = useFrame();
  const hover = interpolate(f, [T.linkClick - 16, T.linkClick - 10], [0, 1]);
  return (
    <>
      {"  "}
      <span
        style={{
          color: hover > 0.5 ? "#c4d7ff" : C.link,
          textDecoration: "underline",
          textDecorationColor: `rgb(143 180 255 / ${0.35 + 0.65 * hover})`,
          textUnderlineOffset: 6,
        }}
      >
        {LINK}
      </span>
    </>
  );
}

/** The terminal on the CRT. */
export function Terminal() {
  const f = useFrame();
  const { fps, format } = useVideoInfo();
  const [x, y, zoom] = cameraAt(f, fps, format.aspect < 1);
  // The silent part opens out of black.
  const open = interpolate(f, [TERM, TERM + 16], [0, 1], { easing: ease.out });
  return (
    <div data-launch-check="off" style={{ position: "absolute", inset: 0, background: C.bg }}>
      <Crt glow={0.7}>
        <div style={{ position: "absolute", inset: 0, background: C.bg, opacity: open }}>
          <Camera keys={[{ at: 0, view: { x, y, zoom } }]} contentWidth={1920} contentHeight={2000}>
            <Screen />
          </Camera>
        </div>
      </Crt>
    </div>
  );
}
