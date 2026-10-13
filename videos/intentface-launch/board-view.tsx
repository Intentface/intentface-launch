import "./board.css";
import { ease, interpolate, springTo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Camera, type CameraKey, Cursor, useFontsReady } from "@intentface-launch/core/kit";
import type { CSSProperties } from "react";
import { LaunchIntro } from "./launch-intro";
import { Terminal } from "./terminal";
import { NOTE, T } from "./timing";
import { AREAS, type Cues, DONE, TodoApp, TodoReflow } from "./todo-app";

// The studio's board view (packages/core/studio/board.tsx), as it looks in
// dark mode, for the to-do video Claude has just sketched. It opens out of the
// link in the terminal and lands on the boom; a note is typed on the first
// shot ("Make this a closeup"); the shot's panels turn into closeups and
// Claude's reply arrives under the note. On the film's clock.

/** The page's CSS size: in 4:5 it runs on below, so a wider framing never shows past its end. */
const PAGE = { width: 1920, height: 1080, tall: 1900 };

/** A storyboard panel: the app as it is in that still, or the closeup Claude made of it. */
function Still({ cues, closeup = 0 }: { cues: Cues; closeup?: number }) {
  const w = 403;
  const wide = w / 1920;
  const box = AREAS.checkbox;
  const cx = box.x + 250;
  const cy = box.y + box.height / 2;
  const app = (style: CSSProperties) => (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", ...style }}>
      <TodoApp cues={cues} />
    </div>
  );
  // The closeup: low across the first task's row, its checkbox in focus, the rest falling off.
  const near = `translate(${w / 2}px, ${(w * 9) / 16 / 2}px) perspective(900px) rotateX(24deg) scale(${wide * 2.5}) translate(${-cx}px, ${-cy}px)`;
  return (
    <div className="still">
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: 1 - closeup }}>
        {app({ transform: `scale(${wide})` })}
      </div>
      {closeup > 0 && (
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: closeup }}>
          {app({ transform: near })}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: "blur(3px)",
              WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 38%, transparent 62%, #000 100%)",
              maskImage: "linear-gradient(180deg, #000 0%, transparent 38%, transparent 62%, #000 100%)",
            }}
          />
        </div>
      )}
    </div>
  );
}

const SWAP = 14;

function Figure({ cues, at, caption }: { cues: Cues; at: number; caption: string }) {
  const f = useFrame();
  // The panel turns over to its closeup: a quick dip and a slight pop, panels a few frames apart.
  const closeup = interpolate(f, [at, at + SWAP], [0, 1], { easing: ease.inOut });
  const pop = interpolate(f, [at, at + SWAP / 2, at + SWAP + 10], [0, 1, 0], { easing: ease.out });
  return (
    <figure>
      <div
        style={{
          transform: `scale(${1 - 0.03 * pop})`,
          filter: pop > 0.02 ? `brightness(${1 + 0.25 * pop})` : undefined,
        }}
      >
        <Still cues={cues} closeup={closeup} />
      </div>
      <figcaption className="mono muted small">{caption}</figcaption>
    </figure>
  );
}

const BEFORE: Cues = {};

function Notes() {
  const f = useFrame();
  const typed = NOTE.slice(0, T.noteKeys.filter((k) => f >= k).length);
  const added = f >= T.addNote;
  const focus = f >= T.noteClick && !added;
  const caret = focus && (f - (T.noteKeys.findLast((k) => f >= k) ?? T.noteClick) < 20 || Math.floor(f / 30) % 2 === 0);
  const pop = springTo(
    f,
    60,
    [
      { at: -1, to: 0 },
      { at: T.addNote, to: 1 },
    ],
    { duration: 20, bounce: 0.1 },
  );
  // Claude's reply arrives as the camera turns from the changed panels towards it.
  const reply = interpolate(f, [T.closeups + 56, T.closeups + 66], [0, 1], { easing: ease.out });
  const text = added ? "" : typed;
  return (
    <div className="notes">
      {added && (
        <div
          className="note"
          style={{
            opacity: Math.min(1, pop * 2),
            transform: Math.abs(1 - pop) < 0.02 ? undefined : `translateY(${(1 - pop) * 10}px)`,
          }}
        >
          <div className="note-head mono small" data-launch-check="off">
            <span>You</span>
            <span className="muted">10/13/2026</span>
            <span className="resolve">Resolve</span>
          </div>
          {/* The note is the text the viewer just watched being typed: not timed again. */}
          <p data-launch-check="off">{NOTE}</p>
          {reply > 0 && (
            <p className="reply" style={{ opacity: reply }}>
              Done.
            </p>
          )}
        </div>
      )}
      <div className={focus ? "textarea focus" : "textarea"} data-launch-check="off">
        {text ? text : <span className="placeholder">{focus ? "" : "Note on this shot"}</span>}
        {caret && (
          <span
            style={{
              display: "inline-block",
              width: 1.5,
              height: 17,
              marginLeft: 1,
              verticalAlign: -3,
              background: "var(--ink)",
            }}
          />
        )}
      </div>
      <span className="button add" data-launch-check="off" style={{ opacity: text ? 1 : 0.45 }}>
        Add note
      </span>
    </div>
  );
}

function Page({ height }: { height: number }) {
  const f = useFrame();
  const working = f >= T.addNote + 8 && f < T.closeups;
  const open = f >= T.addNote && f < T.closeups + 30 ? 1 : 0;
  const camera =
    f < T.closeups
      ? "Wide on the list; the cursor checks the first task."
      : "Close on the checkbox, low across the row.";
  return (
    <div className="lb" style={{ width: PAGE.width, height }}>
      <div className="chrome" data-launch-check="off">
        <div className="lights">
          <i />
          <i />
          <i />
        </div>
        <div className="address">localhost:4400/?v=task-feature&amp;board</div>
        <div style={{ width: 52 }} />
      </div>
      <div className="board">
        <header data-launch-check="off">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "#18181b",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
              overflow: "hidden",
            }}
          >
            <LaunchIntro at={-1e5} size={24} />
          </div>
          <span className="title">Task feature</span>
          <nav className="tabs">
            <span>Timeline</span>
            <span className="on">Board</span>
          </nav>
          <span className="mono muted">
            0:30.0 · 4 shots · {open} open {open === 1 ? "note" : "notes"}
          </span>
          <span className="button rebuild" style={{ opacity: working ? 0.6 : 1 }}>
            {working ? "Rendering panels…" : "Rebuild board"}
          </span>
        </header>
        <main>
          <section className="board-shot">
            <div className="shot-head" data-launch-check="off">
              <span className="num mono">01</span>
              <h2>Check a task</h2>
              <span className="mono muted">0:00.0–0:06.0 · 6.0s</span>
              <span className="open mono small">Open in timeline</span>
            </div>
            <div className="shot-body">
              <div className="panels n2" data-launch-check="off">
                <Figure cues={BEFORE} at={T.closeups} caption="0:00.5 · f30" />
                <Figure cues={DONE} at={T.closeups + 5} caption="0:04.8 · f288" />
              </div>
              <div className="direction">
                <p className="says" data-launch-check="off">
                  A task is checked off in one click, and the week fills in.
                </p>
                <dl data-launch-check="off">
                  <dt>Camera</dt>
                  <dd>{camera}</dd>
                  <dt>Notes</dt>
                  <dd>The app in demo mode, the first task on screen.</dd>
                </dl>
                <Notes />
              </div>
            </div>
          </section>
          <section className="board-shot">
            <div className="shot-head" data-launch-check="off">
              <span className="num mono">02</span>
              <h2>Every format</h2>
              <span className="mono muted">0:06.0–0:11.0 · 5.0s</span>
              <span className="open mono small">Open in timeline</span>
            </div>
            <div className="shot-body">
              <div className="panels n3" data-launch-check="off">
                {(["wide", "portrait", "tall"] as const).map((s) => (
                  <figure key={s}>
                    <div className="still" style={{ display: "grid", placeItems: "center" }}>
                      {s === "wide" ? (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            transform: `scale(${262 / 1920})`,
                            transformOrigin: "0 0",
                          }}
                        >
                          <TodoApp cues={DONE} />
                        </div>
                      ) : (
                        <div
                          style={{
                            position: "relative",
                            width: s === "portrait" ? 118 : 83,
                            height: 147,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              transform: `scale(${147 / (s === "portrait" ? 1350 : 1920)})`,
                              transformOrigin: "0 0",
                            }}
                          >
                            <TodoReflow shape={s} />
                          </div>
                        </div>
                      )}
                    </div>
                  </figure>
                ))}
              </div>
              <div className="direction" data-launch-check="off">
                <p className="says">The same week, laid out again for 4:5 and vertical.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// Camera framings on the page, in its CSS pixels.
const WIDE = { x: 290, y: 60, width: 1340, height: 620 };
const NOTES = { x: 1166, y: 168, width: 440, height: 360 };
const PANELS = { x: 320, y: 168, width: 840, height: 330 };
/** The second panel and the notes: the closeup beside the reply that made it. */
const AFTER = { x: 744, y: 176, width: 860, height: 340 };

/**
 * The camera: wide as the window lands; in to the note as it is typed; across to the panels before
 * they change, holding on them after; then to the reply beside a changed panel (in 4:5, the note alone).
 */
const keys = (narrow: boolean): CameraKey[] => [
  { at: 0, view: WIDE, padding: 0 },
  { at: T.noteClick - 6, view: NOTES, padding: narrow ? 0.11 : 0.06, travel: 30, easing: ease.inOut },
  { at: T.addNote + 46, view: PANELS, padding: 0.05, travel: 30, easing: ease.inOut },
  { at: T.closeups + 80, view: narrow ? NOTES : AFTER, padding: narrow ? 0.11 : 0.03, travel: 32, easing: ease.inOut },
];

// The pointer, in page pixels: to the note field, then (hidden while typing) to "Add note".
const FIELD = { x: 1240, y: 452 };
const ADD = { x: 1218, y: 500 };

export function Board() {
  const f = useFrame();
  const { fps, width: W, height: H, format } = useVideoInfo();
  const narrow = format.aspect < 1;
  useFontsReady(['400 14px "Board Sans"', '600 20px "Board Sans"', '400 13px "Board Mono"']);
  // The window grows out of the link the pointer clicked and lands on the boom.
  const [sx, sy, ss] = springTo(
    f,
    fps,
    [
      { at: -1, to: narrow ? [470, 697, 0.22] : [868, 590, 0.18] },
      { at: T.board, to: [W / 2, H / 2, 1] },
    ],
    { duration: T.boardOpen - T.board, bounce: 0.06 },
  );
  // Landed exactly once within a fraction of a pixel, or the page creeps as the spring settles.
  const rest = Math.abs(1 - ss) < 0.0004;
  const [x, y, s] = rest ? [W / 2, H / 2, 1] : [sx, sy, ss];
  const shown = interpolate(f, [T.board, T.board + 6], [0, 1]);
  const behind = f < T.boardOpen + 10;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {behind && (
        <div style={{ position: "absolute", inset: 0, opacity: interpolate(f, [T.board, T.boardOpen], [1, 0.25]) }}>
          <Terminal />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: rest ? undefined : `translate(${x - (W / 2) * s}px, ${y - (H / 2) * s}px) scale(${s})`,
          borderRadius: 18 / s,
          overflow: "hidden",
          opacity: shown,
          boxShadow: s < 0.999 ? "0 30px 80px rgb(0 0 0 / 0.6)" : undefined,
        }}
      >
        <Camera keys={keys(narrow)} contentWidth={PAGE.width} contentHeight={narrow ? PAGE.tall : PAGE.height}>
          <Page height={narrow ? PAGE.tall : PAGE.height} />
          <Cursor
            keys={[
              { at: T.boardOpen, to: { x: 1500, y: 640 } },
              { at: T.noteClick, to: FIELD, click: true, hover: 10 },
              { at: T.addNote - 12, to: FIELD },
              { at: T.addNote, to: ADD, click: true, hover: 6, travel: 10 },
              { at: T.addNote + 40, to: { x: 1500, y: 700 } },
            ]}
            appear={T.boardOpen}
            hidden={[
              [T.noteClick + 6, T.addNote - 14],
              [T.addNote + 10, 1e6],
            ]}
          />
        </Camera>
      </div>
    </div>
  );
}
