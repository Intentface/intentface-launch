import { type CSSProperties, type ReactNode, useContext } from "react";
import { useFrame, useVideoInfo } from "../engine/index.js";
import { ClockProvider, isRenderMode, requestBlur } from "../engine/timeline.js";
import { BlurContext } from "./blur-context.js";

export type MotionBlurProps = {
  children: ReactNode;
  /** Samples across the exposure. 16 matches After Effects; fast whips want 24+. */
  samples?: number;
  /** Shutter angle in degrees (180 = film). */
  angle?: number;
  /** Shutter phase in degrees (−angle/2 centres the blur on the frame). */
  phase?: number;
  /**
   * Frames where the layer is moving, as [from, to) pairs in this sequence's
   * frames. Outside them the layer renders once, sharp and cheap. Omit to blur always.
   */
  when?: [number, number][];
  style?: CSSProperties;
};

const fill: CSSProperties = { position: "absolute", inset: 0 };

/**
 * After Effects-style motion blur, switched on per layer and per frame range.
 *
 * In renders, the layer asks the renderer for `samples` subframes on the
 * frames it is moving; the renderer captures each and averages them at full
 * precision. Everything in frame blurs by its own motion, so static parts
 * stay sharp and nothing is ghosted.
 *
 * In the studio, the samples are composited live instead: the children render
 * once per sample, summed with `plus-lighter` at 1/N opacity in an isolated
 * group (averaging colour and coverage). It is a close preview, but 8-bit
 * compositing bands dark gradients, which is why renders do not use it.
 */
export function MotionBlur({ children, samples = 16, angle = 180, phase = -angle / 2, when, style }: MotionBlurProps) {
  const frame = useFrame();
  const info = useVideoInfo();
  const nested = useContext(BlurContext);
  const moving = !when || when.some(([a, b]) => frame >= a - 1 && frame < b + 1);
  // A blur inside a blur would square the sample count; the outer one already covers it.
  if (!moving || nested || samples <= 1) {
    return <div style={{ ...fill, ...style }}>{children}</div>;
  }
  if (isRenderMode()) {
    requestBlur({ samples, angle, phase });
    return <div style={{ ...fill, ...style }}>{children}</div>;
  }
  const copies = Array.from({ length: samples }, (_, i) => frame + (phase + ((i + 0.5) * angle) / samples) / 360);
  return (
    <div style={{ ...fill, isolation: "isolate", ...style }}>
      {copies.map((t, i) => (
        <div key={i} style={{ ...fill, opacity: 1 / samples, mixBlendMode: "plus-lighter" }}>
          <BlurContext.Provider value>
            <ClockProvider value={{ ...info, frame: t, absolute: info.absolute + (t - frame) }}>
              {children}
            </ClockProvider>
          </BlurContext.Provider>
        </div>
      ))}
    </div>
  );
}
