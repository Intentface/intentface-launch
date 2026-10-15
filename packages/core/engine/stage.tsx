import type { CSSProperties, ReactNode } from "react";
import { Captions } from "../kit/captions.js";
import { ClockProvider } from "./timeline.js";
import type { PlacedShot, Transition, Video } from "./video.js";

const fill: CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };

/** How long a transition runs from its shot's start: its own `span`, or the overlap. */
const spanOf = (transition: Transition) => transition.span ?? transition.frames;

function shotAt(
  shot: PlacedShot,
  next: PlacedShot | undefined,
  frame: number,
  size: { width: number; height: number },
) {
  const local = frame - shot.from;
  if (local < 0 || local >= shot.duration) return null;
  const style: CSSProperties = {};
  // Incoming half of this shot's own transition.
  if (shot.transition && local < spanOf(shot.transition)) {
    Object.assign(style, shot.transition.style(local / spanOf(shot.transition), size).in);
  }
  // Outgoing half of the next shot's transition, while the two overlap.
  if (next?.transition) {
    const into = frame - next.from;
    if (into >= 0 && into < next.transition.frames) {
      Object.assign(style, next.transition.style(into / spanOf(next.transition), size).out);
    }
  }
  return { local, style };
}

/** The whole video at one frame, at its native pixel size. */
export function Stage({ video, frame }: { video: Video; frame: number }) {
  const { shots, width, height, fps, background } = video;
  const size = { width, height };
  const starts = shotStarts(video);
  // Transition overlays (light bands, the SVG filters their styles point at) sit above every shot.
  const overlays: ReactNode[] = [];
  shots.forEach((shot, i) => {
    const t = shot.transition;
    const into = frame - shot.from;
    if (!t?.overlay || into < 0 || into >= spanOf(t)) return;
    overlays.push(
      <div
        key={`transition-${shot.id}`}
        data-transition={shot.id}
        data-launch-check="off"
        // Above every shot, and blended with them (it is not isolated in a stacking context of its own content).
        style={{ ...fill, zIndex: shots.length + i, pointerEvents: "none", mixBlendMode: t.blend }}
      >
        <ClockProvider
          value={{
            frame: into,
            absolute: frame,
            duration: spanOf(t),
            fps,
            width,
            height,
            format: video.format,
            shots: starts,
          }}
        >
          {t.overlay(into / spanOf(t), size)}
        </ClockProvider>
      </div>,
    );
  });
  /** A shot's scene on its own clock (a shot that `continues` another runs on that shot's clock). */
  const content = (shot: PlacedShot, local: number) => {
    const Component = shot.component;
    const lead = shot.from - (shot.clock ?? shot.from);
    return (
      <ClockProvider
        value={{
          frame: local + lead,
          absolute: frame,
          duration: shot.duration + lead,
          fps,
          width,
          height,
          format: video.format,
          shots: starts,
        }}
      >
        <Component />
      </ClockProvider>
    );
  };
  return (
    <div className="launch-stage" style={{ position: "relative", width, height, overflow: "hidden", background }}>
      {shots.map((shot, i) => {
        const state = shotAt(shot, shots[i + 1], frame, size);
        if (!state) return null;
        const lead = shot.from - (shot.clock ?? shot.from);
        // A transition that draws the outgoing shot itself (a page curl) gets both shots, and keeps the outgoing one on top.
        const next = shots[i + 1];
        const into = next ? frame - next.from : -1;
        const t = next?.transition;
        const composing = t?.compose && into >= 0 && into < t.frames ? t : undefined;
        const body = content(shot, state.local);
        return (
          <div
            key={shot.id}
            data-shot={shot.id}
            data-launch-from={shot.from - lead}
            // Later shots stack on top, so an incoming shot covers the outgoing one.
            style={{ ...fill, zIndex: composing ? i + 2 : i, ...state.style }}
          >
            {composing?.compose && next
              ? composing.compose(into / spanOf(composing), size, { out: body, in: content(next, into) })
              : body}
          </div>
        );
      })}
      {overlays}
      {video.burnCaptions && video.captionCues.length > 0 ? (
        <div style={{ ...fill, zIndex: shots.length * 2 }}>
          <ClockProvider
            value={{
              frame,
              absolute: frame,
              duration: video.durationInFrames,
              fps,
              width,
              height,
              format: video.format,
              shots: starts,
            }}
          >
            <Captions cues={video.captionCues} style={video.burnCaptions === true ? {} : video.burnCaptions} />
          </ClockProvider>
        </div>
      ) : null}
    </div>
  );
}

const startsByVideo = new WeakMap<Video, Record<string, number>>();

/** Each shot's first frame on the video's timeline, by id (for `useFrame({ from })`). */
function shotStarts(video: Video) {
  let found = startsByVideo.get(video);
  if (!found) {
    found = Object.fromEntries(video.shots.map((s) => [s.id, s.from]));
    startsByVideo.set(video, found);
  }
  return found;
}

/** Which shot is on screen at `frame` (the incoming one during a transition). */
export function currentShot(video: Video, frame: number): PlacedShot | undefined {
  let found: PlacedShot | undefined;
  for (const shot of video.shots) if (frame >= shot.from && frame < shot.from + shot.duration) found = shot;
  return found;
}
