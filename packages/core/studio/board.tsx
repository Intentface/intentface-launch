import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFile } from "../cli/board.js";
import type { Video } from "../engine/index.js";
import { LaunchTile } from "./launch-mark.js";
import type { Comment } from "./server.js";

const clock = (frames: number, fps: number) => {
  const s = frames / fps;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

function useComments(folder: string) {
  const [list, setList] = useState<Comment[]>([]);
  const refresh = useCallback(async () => {
    const r = await fetch(`/__launch/comments?v=${folder}`);
    if (r.ok) setList(await r.json());
  }, [folder]);
  useEffect(() => {
    refresh();
    // comments.json can change underneath (Claude answers, a teammate pulls): poll gently.
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/__launch/${path}?v=${folder}`, { method: "POST", body: JSON.stringify(body) });
    if (r.ok) setList(await r.json());
  };
  return {
    list,
    add: (shot: string, text: string, frame?: number) => post("comments", { shot, text, frame }),
    resolve: (id: string, resolved: boolean) => post("comments/resolve", { id, resolved }),
  };
}

/**
 * The storyboard, where the video lives: panels rendered from each shot's
 * code, the direction straight from video.tsx, and review notes saved to
 * videos/<id>/comments.json for Claude to read.
 */
export function Board({ video, folder }: { video: Video; folder: string }) {
  const [board, setBoard] = useState<BoardFile | null>(null);
  const [building, setBuilding] = useState(false);
  const [version, setVersion] = useState(0);
  const player = useRef<HTMLVideoElement>(null);
  const comments = useComments(folder);
  const base = `/videos/${folder}/out/board/`;

  useEffect(() => {
    fetch(`${base}board.json?${version}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBoard)
      .catch(() => setBoard(null));
  }, [base, version]);

  const rebuild = async () => {
    setBuilding(true);
    await fetch(`/__launch/board?v=${folder}`, { method: "POST" });
    setBuilding(false);
    setVersion((v) => v + 1);
  };

  const play = (frame: number) => {
    const el = player.current;
    if (!el) return;
    el.currentTime = frame / video.fps;
    el.play().catch(() => {});
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const open = comments.list.filter((c) => !c.resolved).length;

  return (
    <div className="board">
      <header>
        <a href="/" className="home" aria-label="All videos">
          <LaunchTile size={24} loading={building} />
        </a>
        <span className="title">{video.title}</span>
        <nav className="tabs">
          <a href={`/?v=${folder}`}>Timeline</a>
          <a href={`/?v=${folder}&board`} aria-current="page">
            Board
          </a>
        </nav>
        <span className="mono muted">
          {clock(video.durationInFrames, video.fps)} · {video.shots.length} shots · {open} open notes
        </span>
        <button type="button" className="rebuild" onClick={rebuild} disabled={building}>
          {building ? "Rendering panels…" : "Rebuild board"}
        </button>
      </header>

      <main>
        {video.logline && <p className="logline">{video.logline}</p>}
        {board?.animatic && (
          // biome-ignore lint/a11y/useMediaCaption: animatic without dialogue
          <video
            ref={player}
            className="animatic"
            src={`${base}animatic.mp4?${board.generated}`}
            controls
            playsInline
            preload="metadata"
          />
        )}
        {!board && <p className="muted">No panels yet. Rebuild the board to render them.</p>}
        {board && (
          <p className="mono muted small">
            Panels rendered {new Date(board.generated).toLocaleString()}. Direction below is live from video.tsx.
          </p>
        )}

        {video.shots.map((shot, i) => {
          const panels = board?.panels[shot.id] ?? [];
          const notes = comments.list.filter((c) => c.shot === shot.id);
          return (
            <section key={shot.id} id={shot.id} className="board-shot">
              <div className="shot-head">
                <span className="num mono">{String(i + 1).padStart(2, "0")}</span>
                <h2>{shot.title}</h2>
                <span className="mono muted">
                  {clock(shot.from, video.fps)}–{clock(shot.from + shot.duration, video.fps)} ·{" "}
                  {(shot.duration / video.fps).toFixed(1)}s
                </span>
                <a className="mono small" href={`/?v=${folder}#f=${shot.from}`}>
                  Open in timeline
                </a>
              </div>
              <div className="shot-body">
                <div className="stills">
                  <div className={`panels n${Math.max(1, panels.length)}`}>
                    {panels.map((p) => (
                      <figure key={p.file}>
                        <button type="button" onClick={() => play(p.frame)} title="Play the animatic from here">
                          <img
                            src={`${base}${p.file}?${board?.generated}`}
                            alt={`${shot.title} at ${clock(p.frame, video.fps)}`}
                          />
                        </button>
                        <figcaption className="mono muted">
                          {clock(p.frame, video.fps)} · f{p.frame}
                        </figcaption>
                      </figure>
                    ))}
                    {panels.length === 0 && <div className="empty mono muted">No panel yet</div>}
                  </div>
                  <TextChecks list={board?.text?.[shot.id]} fps={video.fps} />
                </div>
                <div className="direction">
                  {shot.says && <p className="says">{shot.says}</p>}
                  {shot.copy && shot.copy.length > 0 && (
                    <div className="copy">
                      {shot.copy.map((c) => (
                        <p key={c}>{c}</p>
                      ))}
                    </div>
                  )}
                  <dl>
                    {shot.camera && (
                      <>
                        <dt>Camera</dt>
                        <dd>{shot.camera}</dd>
                      </>
                    )}
                    {shot.sound && (
                      <>
                        <dt>Sound</dt>
                        <dd>{shot.sound}</dd>
                      </>
                    )}
                    {i > 0 && (
                      <>
                        <dt>In</dt>
                        <dd>
                          {shot.transition
                            ? `${shot.transition.name}, ${(shot.transition.frames / video.fps).toFixed(2)}s`
                            : "Cut"}
                        </dd>
                      </>
                    )}
                    {shot.notes && (
                      <>
                        <dt>Notes</dt>
                        <dd>{shot.notes}</dd>
                      </>
                    )}
                  </dl>
                  <Notes notes={notes} onAdd={(t) => comments.add(shot.id, t)} onResolve={comments.resolve} />
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

/** check's text pass for one shot, from the last board build: holds, sizes, margins to fix before sign-off. */
function TextChecks({ list, fps }: { list?: NonNullable<BoardFile["text"]>[string]; fps: number }) {
  if (!list?.length) return null;
  return (
    <ul className="text-checks">
      {list.map((p) => (
        <li key={`${p.check}-${p.frame}-${p.text ?? p.message}`} className={p.severity}>
          <span className="mono small muted">
            {p.check}
            {p.frame === undefined ? "" : ` · ${clock(p.frame, fps)}`}
          </span>{" "}
          {p.message}
          {p.text && (
            <>
              {" "}
              <q>{p.text}</q>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function Notes({
  notes,
  onAdd,
  onResolve,
}: {
  notes: Comment[];
  onAdd: (text: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="notes">
      {notes.map((n) => (
        <div key={n.id} className={n.resolved ? "note resolved" : "note"}>
          <div className="note-head mono small">
            <span>{n.author}</span>
            <span className="muted">{new Date(n.at).toLocaleDateString()}</span>
            <button type="button" onClick={() => onResolve(n.id, !n.resolved)}>
              {n.resolved ? "Reopen" : "Resolve"}
            </button>
          </div>
          <p>{n.text}</p>
          {n.reply && <p className="reply">{n.reply}</p>}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text.trim());
          setText("");
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Note on this shot"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <button type="submit" disabled={!text.trim()}>
          Add note
        </button>
      </form>
    </div>
  );
}
