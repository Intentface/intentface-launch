import { useFrame, useVideoInfo } from "@intentface-launch/core";
import { type CSSProperties, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import { type Lens, project, type Vec3 } from "./lens.js";
import { StageContext } from "./stage.js";

export type Overlay3DProps = {
  /** The world point the DOM is pinned to, or a function of the frame for one that moves. */
  at: Vec3 | ((frame: number) => Vec3);
  /** The camera. Default: the enclosing `Stage3D`'s; required outside one. */
  lens?: (frame: number) => Lens;
  /**
   * Scale the DOM with distance, as a flat card standing at the point and
   * facing the camera: `true` makes one CSS pixel one world unit (a 400 px
   * label is as wide as a 400-unit panel there); a number multiplies that.
   * Default: no scaling, the DOM keeps its size wherever the point goes.
   */
  scale?: boolean | number;
  /** Which point of the DOM sits on `at`, as fractions of its box. Default: its centre, [0.5, 0.5]. */
  anchor?: [number, number];
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * DOM pinned to a point in the 3D scene, placed through the stage's camera
 * every frame (fractional frames included): labels and callouts that follow a
 * panel through a camera move, or the flat layer a 3D shot hands off to. It
 * paints as ordinary DOM above the stage, so its text stays sharp and `check`
 * measures it. Inside a `Stage3D` it uses the stage's lens; beside one, pass
 * the same `lens` function. Hidden while the point is behind the camera.
 */
export function Overlay3D({ at, lens, scale = false, anchor = [0.5, 0.5], style, children }: Overlay3DProps) {
  const frame = useFrame();
  const { width, height } = useVideoInfo();
  const stage = useContext(StageContext);
  const lensAt = lens ?? stage?.lens();
  if (!lensAt) throw new Error("<Overlay3D> needs `lens` outside a <Stage3D>");
  const point = typeof at === "function" ? at(frame) : at;
  const p = project(lensAt(frame), point, [width, height]);
  const k = scale === false ? 1 : p.scale * (scale === true ? 1 : scale);
  const node = (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate(${p.x}px, ${p.y}px) scale(${k}) translate(${-anchor[0] * 100}%, ${-anchor[1] * 100}%)`,
        visibility: p.depth > 0 ? undefined : "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
  // Inside a stage, children of its canvas are not painted: render in its overlay layer.
  return stage?.overlay ? createPortal(node, stage.overlay) : node;
}
