import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { syncAnimations } from "./animations.js";
import type { CaptionCue } from "./captions.js";
import {
  hideText,
  type LayerBox,
  measureLayers,
  measureText,
  measureUiText,
  type TextSample,
  type UiTextSample,
  unclipLayer,
} from "./measure.js";
import { Stage } from "./stage.js";
import {
  type BlurRequest,
  ClockProvider,
  type DebugView,
  pendingWork,
  setFrameSettled,
  setRenderMode,
  setRenderQuality,
  settle,
  takeBlurRequest,
  takeDebugViews,
} from "./timeline.js";
import type { Sound, Video } from "./video.js";

export type LaunchBridge = {
  info: {
    id: string;
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    /** The format on screen, and every format the video declares (its own included). */
    format: string;
    formats: Video["formats"];
    /** Captions resolved to frames (empty without `captions`). */
    captions: CaptionCue[];
    /** Whether they are drawn into the picture. */
    burnCaptions: boolean;
    /** The variant on screen (`?variant=`), or null for the video itself, and every variant it declares. */
    variant: string | null;
    variants: string[];
    audio?: Video["audio"];
    checks?: Video["checks"];
    /** Every sound effect, `at` in video frames, with the shot it came from. */
    sfx: (Sound & { shot?: string })[];
    title: string;
    logline?: string;
    bpm?: number;
    shots: {
      id: string;
      title: string;
      from: number;
      duration: number;
      board: number[];
      says?: string;
      copy?: string[];
      camera?: string;
      sound?: string;
      notes?: string;
      transition?: { name: string; frames: number };
      offBeat?: boolean;
      moments?: Record<string, number>;
      /** Frames that must equal a reference rendered alone (`matches`), by index. */
      matches?: { at: string; tolerance?: number; label?: string }[];
      /** Picture locks declared against the audio (`hits`). */
      hits?: { at: number | string; sound: number | string; tolerance?: number }[];
    }[];
  };
  /**
   * Render `frame` (fractional for motion-blur subframes) and resolve when it
   * is safe to capture, with any motion blur the frame's layers asked for.
   */
  seek(frame: number): Promise<BlurRequest | null>;
  /** The text on screen at the current frame (see measure.ts). */
  inspect(): TextSample[];
  /** The product's UI text on screen and its sizes (see measure.ts), for UI shown too far away. */
  uiText(): UiTextSample;
  /** Hide or show all text, painted, for measuring what is behind it. */
  hideText(hidden: boolean): Promise<void>;
  /** Layers on screen whose own edge could cut their content (see measure.ts). */
  layers(): LayerBox[];
  /** Let a layer from `layers()` draw past its edge, or put it back (`null`), painted. */
  unclip(id: number | null): Promise<void>;
  /**
   * Show, at the current frame, a shot's `matches[index].reference` alone on
   * the video's background in place of the video; `null` shows the video again.
   */
  reference(shot: string | null, index?: number): Promise<void>;
  /** Where the last seek is (for a stalled frame): its step and the work it waits on. */
  status(): { frame: number; step: string; pending: string[] };
  /** Internal passes of the layers on screen (a 3D stage's), with `&debug` in the page's URL. */
  debugViews(): DebugView[];
};

declare global {
  interface Window {
    __launch?: LaunchBridge;
  }
}

async function fontsReady() {
  await document.fonts.ready;
  // `ready` resolves before lazily-used faces load; wait for any still loading.
  const loading = [...document.fonts].filter((face) => face.status === "loading");
  await Promise.allSettled(loading.map((face) => face.loaded));
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** The video's sound effects and its shots', on the video's timeline. */
export function allSounds(video: Video): (Sound & { shot?: string })[] {
  return [
    ...(video.sfx ?? []),
    ...video.shots.flatMap((s) => (s.sfx ?? []).map((x) => ({ ...x, at: s.from + x.at, shot: s.id }))),
  ].sort((a, b) => a.at - b.at);
}

/**
 * Headless render surface: the stage alone at native size, driven only by
 * `window.__launch.seek()`. The CLI's render, still and sheet commands use it.
 */
export function mountRenderer(video: Video, element: HTMLElement) {
  const status = { frame: 0, step: "idle" };
  let setFrame: (frame: number) => void = () => {};
  let setShown: (shown: { reference: { shot: string; index: number } | null; tick: number }) => void = () => {};
  let shownNow: { reference: { shot: string; index: number } | null; tick: number } = { reference: null, tick: 0 };
  function Host() {
    const [frame, set] = useState(0);
    const [shown, show] = useState(shownNow);
    setFrame = set;
    setShown = (next) => {
      shownNow = next;
      show(next);
    };
    if (shown.reference) return <Reference video={video} frame={frame} {...shown.reference} />;
    return <Stage video={video} frame={frame} />;
  }
  const ready = async () => {
    await settle();
    await fontsReady();
    await nextPaint();
  };
  setRenderMode(true);
  // Draft and debug settings from the CLI (`still --samples 8`, `--stage-debug`).
  const params = new URLSearchParams(location.search);
  const samples = Number(params.get("samples"));
  setRenderQuality({ samples: samples > 0 ? samples : undefined, debug: params.has("debug") });
  document.body.style.margin = "0";
  document.body.style.background = video.background;
  const root = createRoot(element);
  flushSync(() => root.render(<Host />));

  window.__launch = {
    info: {
      id: video.id,
      title: video.title,
      logline: video.logline,
      bpm: video.bpm,
      width: video.width,
      height: video.height,
      fps: video.fps,
      durationInFrames: video.durationInFrames,
      format: video.format,
      formats: video.formats,
      captions: video.captionCues,
      burnCaptions: Boolean(video.burnCaptions),
      variant: video.variant,
      variants: Object.keys(video.source.variants ?? {}),
      audio: video.audio,
      checks: video.checks,
      sfx: allSounds(video),
      shots: video.shots.map((s) => ({
        id: s.id,
        title: s.title,
        from: s.from,
        duration: s.duration,
        board: s.board ?? [0.15, 0.85],
        says: s.says,
        copy: s.copy,
        camera: s.camera,
        sound: s.sound,
        notes: s.notes,
        transition: s.transition && { name: s.transition.name, frames: s.transition.frames },
        offBeat: s.offBeat,
        moments: s.moments,
        matches: matchesOf(s).map((m) => ({ at: String(m.at ?? "end"), tolerance: m.tolerance, label: m.label })),
        hits: s.hits,
      })),
    },
    async seek(frame) {
      status.frame = frame;
      status.step = "render";
      setFrameSettled(false);
      takeBlurRequest();
      flushSync(() => setFrame(frame));
      const blur = takeBlurRequest();
      status.step = "waitFor";
      await settle();
      status.step = "fonts";
      await fontsReady();
      syncAnimations(frame, video.fps);
      status.step = "paint";
      await nextPaint();
      setFrameSettled(true);
      status.step = "done";
      return blur;
    },
    status: () => ({ ...status, pending: pendingWork() }),
    debugViews: takeDebugViews,
    inspect() {
      const stage = element.querySelector<HTMLElement>(".launch-stage");
      return stage ? measureText(stage) : [];
    },
    async hideText(hidden) {
      hideText(hidden);
      // Re-render, so canvases that declare text can paint without it (isTextHidden).
      flushSync(() => setShown({ ...shownNow, tick: shownNow.tick + 1 }));
      await ready();
    },
    uiText() {
      const stage = element.querySelector<HTMLElement>(".launch-stage");
      return stage ? measureUiText(stage) : { chars: 0, sizes: [] };
    },
    layers() {
      const stage = element.querySelector<HTMLElement>(".launch-stage");
      return stage ? measureLayers(stage) : [];
    },
    async unclip(id) {
      unclipLayer(id);
      await nextPaint();
    },
    async reference(shot, index = 0) {
      flushSync(() => setShown({ ...shownNow, reference: shot === null ? null : { shot, index } }));
      await ready();
    },
  };
}

const matchesOf = (shot: Video["shots"][number]) =>
  shot.matches === undefined ? [] : Array.isArray(shot.matches) ? shot.matches : [shot.matches];

/** A shot's reference picture alone, on the video's background, on the shot's clock at `frame`. */
function Reference({ video, frame, shot, index }: { video: Video; frame: number; shot: string; index: number }) {
  const placed = video.shots.find((s) => s.id === shot);
  const match = placed && matchesOf(placed)[index];
  if (!placed || !match) throw new Error(`Shot "${shot}" has no matches[${index}]`);
  const Component = match.reference;
  const { width, height, fps, background } = video;
  return (
    <div className="launch-stage" style={{ position: "relative", width, height, overflow: "hidden", background }}>
      <div data-shot={shot} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <ClockProvider
          value={{
            frame: frame - (placed.clock ?? placed.from),
            absolute: frame,
            duration: placed.duration,
            fps,
            width,
            height,
            format: video.format,
          }}
        >
          <Component />
        </ClockProvider>
      </div>
    </div>
  );
}
