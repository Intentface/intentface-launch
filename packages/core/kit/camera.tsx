import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { type Easing, ease, useFrame, useVideoInfo } from "../engine/index.js";
import { type CaptureManifest, markRect } from "./capture.js";

/** A view into the content: centre point in content pixels and a zoom factor. */
export type View = { x: number; y: number; zoom: number; rotate?: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type CameraKey = {
  /** Frame (in the enclosing sequence) where the camera arrives at this view. */
  at: number;
  /**
   * A view, a rect to frame (fitted with `padding`), or mark names from the
   * Camera's `capture`: `"editor:panel"`, or the union of several,
   * `"editor:instructions+editor:options"`. Names follow the capture when a
   * recapture moves the UI; numbers do not.
   */
  view: View | Rect | string;
  /** The capture whose marks a named `view` refers to, when it is not the Camera's. */
  capture?: CaptureManifest;
  /** Easing of the move that ends at this key. `springEase(0.1)` for a spring's settle. */
  easing?: Easing;
  /**
   * Frames the move takes (default: from the previous key). Longer than the
   * gap to the previous key, it sets off before that move lands, and the
   * camera rounds the corner instead of stopping there.
   */
  travel?: number;
  /** Extra space around a rect target, as a fraction of the frame (0.1 = 10%). */
  padding?: number;
};

const isRect = (v: View | Rect): v is Rect => "width" in v;

/** A key's view as a View: rects and mark names fitted into the frame. */
function resolve(key: CameraKey, width: number, height: number, capture?: CaptureManifest): View {
  const view = key.view;
  if (typeof view === "string") {
    const source = key.capture ?? capture;
    if (!source) throw new Error(`Camera key at ${key.at} names marks ("${view}") but the Camera has no \`capture\``);
    return frameRect(markRect(source, view), width, height, key.padding);
  }
  return isRect(view) ? frameRect(view, width, height, key.padding) : view;
}

const CameraView = createContext<View | null>(null);

/** The enclosing <Camera>'s view at this frame, or null outside one. Divide a size by `zoom` to keep it constant on screen. */
export const useCameraView = () => useContext(CameraView);

/** The view that fits `rect` into a frame of `width` × `height`. */
export function frameRect(rect: Rect, width: number, height: number, padding = 0.12): View {
  const zoom = Math.min(width / (rect.width * (1 + padding * 2)), height / (rect.height * (1 + padding * 2)));
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, zoom };
}

/**
 * Where the camera is at `frame`: the sum of one move per key, each from the
 * previous key's view to its own. Moves that overlap (see `travel`) add up, so
 * the camera carries its speed through a view instead of stopping on it. Zoom
 * moves in log space, so a 1× → 4× push feels even all the way in instead of
 * rushing at the end.
 */
export function cameraAt(
  keys: CameraKey[],
  frame: number,
  width: number,
  height: number,
  capture?: CaptureManifest,
): View {
  const views = keys.map((k) => resolve(k, width, height, capture));
  let x = views[0].x;
  let y = views[0].y;
  let zoom = Math.log(views[0].zoom);
  let rotate = views[0].rotate ?? 0;
  for (let i = 1; i < keys.length; i++) {
    const key = keys[i];
    const start = key.travel !== undefined ? key.at - key.travel : keys[i - 1].at;
    if (frame <= start) continue;
    const t = (key.easing ?? ease.inOut)(Math.min(1, (frame - start) / (key.at - start || 1)));
    const a = views[i - 1];
    const b = views[i];
    x += (b.x - a.x) * t;
    y += (b.y - a.y) * t;
    zoom += (Math.log(b.zoom) - Math.log(a.zoom)) * t;
    rotate += ((b.rotate ?? 0) - (a.rotate ?? 0)) * t;
  }
  return { x, y, zoom: Math.exp(zoom), rotate };
}

/**
 * Film the children like a camera: pan, push in and pull out between
 * keyframed views. Children are laid out at `contentWidth` × `contentHeight`
 * (default: the video size), so a 2× capture stays sharp when zoomed 2×.
 *
 * Wrap in <MotionBlur when={…}> for blur on fast moves.
 *
 * With `capture`, keys can name its marks instead of giving numbers:
 * `{ at: 40, view: "editor:instructions+editor:options", padding: 0.08 }`.
 */
export function Camera({
  keys,
  capture,
  children,
  contentWidth,
  contentHeight,
  style,
}: {
  keys: CameraKey[];
  /** The capture whose marks named views refer to. */
  capture?: CaptureManifest;
  children: ReactNode;
  contentWidth?: number;
  contentHeight?: number;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { width, height } = useVideoInfo();
  const cw = contentWidth ?? width;
  const ch = contentHeight ?? height;
  const view = cameraAt(keys, frame, width, height, capture);
  // Content point (view.x, view.y) lands on the frame centre.
  const transform = `translate(${width / 2}px, ${height / 2}px) rotate(${view.rotate ?? 0}deg) scale(${view.zoom}) translate(${-view.x}px, ${-view.y}px)`;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: cw, height: ch, transformOrigin: "0 0", transform }}>
        <CameraView.Provider value={view}>{children}</CameraView.Provider>
      </div>
    </div>
  );
}

/** Whole-content view: content of `cw` × `ch` fitted into the frame. */
export const fit = (cw: number, ch: number, width: number, height: number): View => ({
  x: cw / 2,
  y: ch / 2,
  zoom: Math.min(width / cw, height / ch),
});
