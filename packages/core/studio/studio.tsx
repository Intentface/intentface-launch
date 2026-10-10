import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { syncAnimations } from "../engine/animations.js";
import type { Video } from "../engine/index.js";
import { tempo } from "../engine/motion.js";
import { allSounds } from "../engine/runtime.js";
import { currentShot, Stage } from "../engine/stage.js";
import { LaunchTile } from "./launch-mark.js";
import { videos } from "./videos.js";

const timecode = (frame: number, fps: number) => {
  const total = Math.floor(frame / fps);
  const f = String(Math.floor(frame % fps)).padStart(2, "0");
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}.${f}`;
};

export function VideoList() {
  const ids = Object.keys(videos);
  return (
    <main className="list">
      <div className="brand">
        <LaunchTile size={40} animateIn />
        <span className="label">Intentface Launch</span>
      </div>
      <h1>Videos</h1>
      {ids.length === 0 && <p className="muted">None yet. Run pnpm launch new &lt;name&gt;.</p>}
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <a href={`/?v=${id}`}>{id}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

function useFitScale(ref: React.RefObject<HTMLDivElement | null>, width: number, height: number) {
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setScale(Math.min(el.clientWidth / width, el.clientHeight / height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, width, height]);
  return scale;
}

function useWaveform(src: string | undefined, buckets: number) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    (async () => {
      const data = await (await fetch(src)).arrayBuffer();
      const audio = await new AudioContext().decodeAudioData(data);
      const channel = audio.getChannelData(0);
      const size = Math.floor(channel.length / buckets);
      const out: number[] = [];
      for (let b = 0; b < buckets; b++) {
        let peak = 0;
        for (let i = b * size; i < (b + 1) * size; i += 16) peak = Math.max(peak, Math.abs(channel[i]));
        out.push(peak);
      }
      if (!cancelled) setPeaks(out);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, buckets]);
  return peaks;
}

type Playback = { src: string; offset: number; volume: number };

/**
 * What the studio plays: the mix the renderer will use, rebuilt by the dev
 * server whenever a sound, the voice, a stem or a fade changes, or the music
 * as it is when the server says there is nothing to mix.
 */
function usePlayback(video: Video, folder: string): Playback | null {
  const sounds = allSounds(video);
  const key = JSON.stringify([sounds, video.audio]);
  const [mixed, setMixed] = useState<{ src: string | null } | null>(null);
  const asks = sounds.length > 0 || Boolean(video.audio);
  useEffect(() => {
    if (!asks) return;
    let cancelled = false;
    fetch(`/__launch/mix?v=${encodeURIComponent(folder)}`, {
      method: "POST",
      body: JSON.stringify({
        sfx: sounds,
        audio: video.audio,
        fps: video.fps,
        durationInFrames: video.durationInFrames,
      }),
    })
      .then((r) => r.json())
      .then((j: { src?: string | null; error?: string }) => {
        if (j.error) console.error(`Mix: ${j.error}`);
        if (!cancelled) setMixed({ src: j.src ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, folder]);
  // While a changed mix builds, the last one keeps playing.
  if (!asks || !mixed) return null;
  if (mixed.src) return { src: mixed.src, offset: 0, volume: 1 };
  return video.audio
    ? { src: video.audio.src, offset: video.audio.offset ?? 0, volume: video.audio.volume ?? 1 }
    : null;
}

export function Studio({ video, folder }: { video: Video; folder: string }) {
  const total = video.durationInFrames;
  const initial = Number(new URLSearchParams(location.hash.slice(1)).get("f") ?? 0);
  const [frame, setFrame] = useState(Math.min(Math.max(0, initial), total - 1));
  const [playing, setPlaying] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const scale = useFitScale(viewport, video.width, video.height);
  const playback = usePlayback(video, folder);
  const peaks = useWaveform(playback?.src, 600);
  const shot = currentShot(video, frame);
  const beat = video.bpm ? tempo(video.bpm, video.fps) : null;
  const audioOffset = playback?.offset ?? 0;

  const seek = useCallback((f: number) => setFrame(Math.max(0, Math.min(total - 1, Math.round(f)))), [total]);

  // Playback: the audio element is the master clock when there is one.
  // Restarts only when play toggles; `frame` is read once as the start point.
  useEffect(() => {
    if (!playing) return;
    const el = audio.current;
    const startFrame = frame >= total - 1 ? 0 : frame;
    const startTime = performance.now();
    if (el) {
      el.currentTime = startFrame / video.fps - audioOffset;
      el.volume = Math.min(1, playback?.volume ?? 1);
      el.play().catch(() => {});
    }
    let raf = 0;
    const tick = () => {
      const next =
        el && !el.paused
          ? (el.currentTime + audioOffset) * video.fps
          : startFrame + ((performance.now() - startTime) / 1000) * video.fps;
      if (next >= total) {
        setFrame(total - 1);
        setPlaying(false);
        return;
      }
      setFrame(Math.floor(next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el?.pause();
    };
  }, [playing]);

  useEffect(() => {
    syncAnimations(frame, video.fps);
    if (!playing) history.replaceState(null, "", `#f=${frame}`);
  }, [frame, playing, video.fps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const step = e.shiftKey ? video.fps : 1;
      const starts = video.shots.map((s) => s.from);
      if (e.key === " ") setPlaying((p) => !p);
      else if (e.key === "ArrowRight") seek(frame + step);
      else if (e.key === "ArrowLeft") seek(frame - step);
      else if (e.key === "Home") seek(0);
      else if (e.key === "End") seek(total - 1);
      else if (e.key === "]") seek(starts.find((s) => s > frame) ?? total - 1);
      else if (e.key === "[") seek([...starts].reverse().find((s) => s < frame) ?? 0);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, seek, total, video]);

  const track = useRef<HTMLDivElement>(null);
  const scrub = (e: React.PointerEvent) => {
    const el = track.current;
    if (!el) return;
    const at = (x: number) => {
      const rect = el.getBoundingClientRect();
      seek(((x - rect.left) / rect.width) * total);
    };
    setPlaying(false);
    at(e.clientX);
    const move = (ev: PointerEvent) => at(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pct = (f: number) => `${(f / total) * 100}%`;

  return (
    <div className="studio">
      <header>
        <a href="/" className="home" aria-label="All videos">
          <LaunchTile size={24} />
        </a>
        <span className="title">{video.title}</span>
        <nav className="tabs">
          <a href={`/?v=${folder}`} aria-current="page">
            Timeline
          </a>
          <a href={`/?v=${folder}&board`}>Board</a>
        </nav>
        {Object.keys(video.formats).length > 1 && (
          <nav className="tabs" aria-label="Format">
            {Object.keys(video.formats).map((name) => (
              <a
                key={name}
                href={`/?v=${folder}&format=${name}${location.hash}`}
                aria-current={name === video.format ? "page" : undefined}
              >
                {name}
              </a>
            ))}
          </nav>
        )}
        <span className="mono muted">
          {video.width}×{video.height} · {video.fps} fps · {timecode(total, video.fps)}
          {video.bpm ? ` · ${video.bpm} BPM` : ""}
        </span>
      </header>

      <div className="viewport" ref={viewport}>
        <div className="frame" style={{ width: video.width * scale, height: video.height * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <Stage video={video} frame={frame} />
          </div>
        </div>
      </div>

      <aside className="shot-info">
        {shot && (
          <>
            <p className="label">
              {shot.id} · {timecode(frame - shot.from, video.fps)} / {timecode(shot.duration, video.fps)}
            </p>
            <h2>{shot.title}</h2>
            {shot.says && <p>{shot.says}</p>}
            {shot.camera && <p className="muted">Camera: {shot.camera}</p>}
          </>
        )}
      </aside>

      <footer>
        <div className="transport">
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <span className="mono">
            {timecode(frame, video.fps)} <span className="muted">f{frame}</span>
          </span>
          <span className="mono muted keys">space · ← → · shift ← → · [ ]</span>
          <span className="mono muted keys">
            pnpm launch still {folder} --frame {frame}
          </span>
        </div>
        <div className="track" ref={track} onPointerDown={scrub}>
          <div className="shots">
            {video.shots.map((s) => (
              <div
                key={s.id}
                className={s === shot ? "shot active" : "shot"}
                style={{ left: pct(s.from), width: pct(s.duration) }}
                title={s.title}
              >
                <span>{s.title}</span>
              </div>
            ))}
          </div>
          {peaks && (
            <svg className="wave" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none">
              <title>Audio waveform</title>
              <path d={peaks.map((p, i) => `M${i},${50 - p * 48}L${i},${50 + p * 48}`).join("")} />
            </svg>
          )}
          {beat && (
            <div className="beats">
              {Array.from({ length: Math.ceil(total / beat.framesPerBeat) }, (_, i) => (
                <i key={i} className={i % 4 === 0 ? "bar" : undefined} style={{ left: pct(i * beat.framesPerBeat) }} />
              ))}
            </div>
          )}
          <div className="playhead" style={{ left: pct(frame) }} />
        </div>
      </footer>
      {playback && (
        // biome-ignore lint/a11y/useMediaCaption: music bed, no speech
        <audio ref={audio} src={playback.src} preload="auto" />
      )}
    </div>
  );
}
