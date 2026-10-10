import { type CSSProperties, createContext, type ReactNode, useContext, useMemo } from "react";
import { type Format, shapeName } from "./formats.js";

type Clock = {
  /** Frame inside the current sequence. Fractional during motion-blur subframes. */
  frame: number;
  /** Frame on the whole video's timeline. */
  absolute: number;
  /** Length of the current sequence in frames. */
  duration: number;
  fps: number;
  width: number;
  height: number;
  /** The format on screen, or its name (see engine/formats.ts). Derived from the size when missing. */
  format?: string | Format;
  /** Where each shot starts on the video's timeline, by id, for `useFrame({ from })`. */
  shots?: Record<string, number>;
};

const ClockContext = createContext<Clock | null>(null);

function useClock(): Clock {
  const clock = useContext(ClockContext);
  if (!clock) throw new Error("Timing hooks only work inside a video");
  return clock;
}

/**
 * Current frame, counted from the start of the enclosing <Sequence> or shot
 * (a shot with `continues` counts from the start of the shot it continues).
 * `{ from: "ask" }` counts from the start of shot "ask" instead, from
 * anywhere: one shared clock for a camera, a light or a drift that carries on
 * across a cut. Frames before that shot's start are negative.
 */
export const useFrame = (options?: { from?: string }) => {
  const clock = useClock();
  if (!options?.from) return clock.frame;
  const start = clock.shots?.[options.from];
  if (start === undefined)
    throw new Error(`useFrame({ from: "${options.from}" }): no shot "${options.from}" in this video`);
  return clock.absolute - start;
};
/** Seconds since the start of the enclosing <Sequence> or shot. */
export const useSeconds = () => {
  const { frame, fps } = useClock();
  return frame / fps;
};
// The variant on screen: one per page, set when the video is loaded (studio/main.tsx).
let activeVariant: { name: string | null; data: Record<string, unknown> } = { name: null, data: {} };

/** Set by the page that mounts a video, from `withVariant`'s result. */
export function setActiveVariant(video: { variant: string | null; variantData: Record<string, unknown> }) {
  activeVariant = { name: video.variant, data: video.variantData };
}

/**
 * The video's clock and frame. `format` is the shape on screen (`name`:
 * "landscape", "vertical", "square", "portrait" or a key of the video's
 * `formats`); scenes reflow on it, as in `format.aspect < 1 ? column : row`.
 * `variant` is the variant on screen (a key of the video's `variants`), or
 * null for the video itself.
 */
export const useVideoInfo = () => {
  const { fps, width, height, duration, absolute, format: given } = useClock();
  const name = (typeof given === "string" ? given : given?.name) ?? shapeName({ width, height });
  const format: Format = { name, width, height, aspect: width / height };
  return { fps, width, height, duration, absolute, format, variant: activeVariant.name };
};

/**
 * The variant on screen and its `data` (`{ name: null, data: {} }` for the
 * video itself): `const { data } = useVariant<{ line: string }>()`.
 */
export const useVariant = <T extends Record<string, unknown> = Record<string, unknown>>() =>
  activeVariant as { name: string | null; data: Partial<T> };

export function ClockProvider({ value, children }: { value: Clock; children: ReactNode }) {
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

const fill: CSSProperties = { position: "absolute", inset: 0 };

/**
 * Show children from `from` for `duration` frames, with the frame counter
 * restarting at 0. CSS animations inside run on this sequence's clock too
 * (see syncAnimations), which is what `data-launch-from` is for.
 */
export function Sequence({
  from = 0,
  duration = Number.POSITIVE_INFINITY,
  children,
  style,
  keepMounted = false,
}: {
  from?: number;
  duration?: number;
  children: ReactNode;
  style?: CSSProperties;
  /** Keep rendering (hidden) outside the range, for things that are costly to mount. */
  keepMounted?: boolean;
}) {
  const parent = useClock();
  const local = parent.frame - from;
  const active = local >= 0 && local < duration;
  const value = useMemo(() => ({ ...parent, frame: local, duration }), [parent, local, duration]);
  if (!active && !keepMounted) return null;
  return (
    <div
      data-launch-from={parent.absolute - local}
      style={{ ...fill, visibility: active ? undefined : "hidden", ...style }}
    >
      <ClockProvider value={value}>{children}</ClockProvider>
    </div>
  );
}

// --- Readiness -----------------------------------------------------------------
// A frame is only captured once every pending promise has settled: images
// decoded, fonts loaded, canvases painted. Components register work here.

const pending = new Map<Promise<unknown>, { label: string; since: number }>();

/**
 * Hold the current frame until `work` settles. Returns `work`. `label` names
 * it in the renderer's report when a frame stalls ("Snapshot results").
 */
export function waitFor<T>(work: Promise<T>, label = "unnamed"): Promise<T> {
  pending.set(work, { label, since: performance.now() });
  const done = () => pending.delete(work);
  work.then(done, done);
  return work;
}

/** What the current frame is still waiting for, with how long each has been pending (ms). */
export const pendingWork = () =>
  [...pending.values()].map((p) => `${p.label} (${Math.round(performance.now() - p.since)} ms)`);

export async function settle(): Promise<void> {
  // New work can be registered while earlier work resolves (an image that
  // triggers a re-render that needs another image), so loop until quiet.
  for (let round = 0; round < 20 && pending.size > 0; round++) {
    await Promise.allSettled([...pending.keys()]);
  }
}

// --- Motion-blur requests ------------------------------------------------------
// In the renderer, <MotionBlur> layers do not composite their own samples (8-bit
// compositing posterizes dark gradients). They ask for samples here instead;
// the renderer captures the subframes and averages them at full precision.

export type BlurRequest = { samples: number; angle: number; phase: number };

let renderMode = false;
let request: BlurRequest | null = null;

export const isRenderMode = () => renderMode;
export const setRenderMode = (on: boolean) => {
  renderMode = on;
};

/** Called while rendering a frame: this frame needs `samples` across the shutter. */
export function requestBlur(next: BlurRequest) {
  if (!request || next.samples > request.samples) request = next;
}

export function takeBlurRequest(): BlurRequest | null {
  const r = request;
  request = null;
  return r;
}

// --- Render quality --------------------------------------------------------------
// Overrides the CLI sets on the render page (`still --samples 8`, `check`), read
// by costly layers such as a 3D stage, so a draft does not need code changes.

export type RenderQuality = {
  /** Samples per frame for accumulation renderers (a `Stage3D`), over their own setting. */
  samples?: number;
  /** Layers that can show their internal passes register them (see `addDebugView`). */
  debug?: boolean;
};

let quality: RenderQuality = {};
export const renderQuality = (): RenderQuality => quality;
export const setRenderQuality = (next: RenderQuality) => {
  quality = next;
};

/** One labelled image of a layer's internals (a data URL), for `still --stage-debug`. */
export type DebugView = { label: string; src: string };
const debugViews = new Set<() => DebugView[]>();

/** Register what a layer can show of its internals at the current frame. Returns the unregister. */
export function addDebugView(views: () => DebugView[]) {
  debugViews.add(views);
  return () => {
    debugViews.delete(views);
  };
}

export const takeDebugViews = (): DebugView[] => [...debugViews].flatMap((views) => views());

// Set by the renderer once a frame is let go (seeked, settled, painted), until
// the next seek. Paints after that are screenshots of the same frame, so a
// costly layer can present what it drew instead of drawing it again.
let frameSettled = false;
export const isFrameSettled = () => frameSettled;
export const setFrameSettled = (on: boolean) => {
  frameSettled = on;
};
