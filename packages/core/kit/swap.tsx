import type { CSSProperties, ReactNode } from "react";
import { type Easing, ease, progress, useFrame } from "../engine/index.js";

export type SwapItem = {
  /** Frame this content takes over. At or before 0, the first item is simply there. */
  at: number;
  content: ReactNode;
};

/**
 * Content that changes inside a container that is itself changing shape (a
 * button becoming a loader, a toggle becoming a tab bar). The old content
 * leaves quickly with a short blur, while the container is still near its old
 * size; the new content arrives `delay` frames later, once there is room for
 * it. Separate exit and entry timing keeps the two from overlapping into a
 * smudge. All items share one grid cell, so the Swap does not size the container:
 * drive the container's size with springs and let the content sit in it.
 */
export function Swap({
  items,
  exit = 8,
  enter = 14,
  delay = 4,
  blur = 6,
  scale = 0.04,
  rise = 0,
  easing = { enter: ease.out, exit: ease.out },
  style,
}: {
  items: SwapItem[];
  /** Frames the old content takes to leave. */
  exit?: number;
  /** Frames the new content takes to arrive. */
  enter?: number;
  /** Frames after the change before the new content starts to arrive. */
  delay?: number;
  /** Blur in pixels at the start of an entry and the end of an exit. */
  blur?: number;
  /** How much smaller content is when it arrives and when it has left (0.04 = 96%). */
  scale?: number;
  /** Pixels the old content rises as it leaves and the new rises from as it arrives (4 for a text swap). */
  rise?: number;
  /**
   * Curve of the entry and the exit, or one curve for both. The default is
   * `ease.out` for both: the old content is mostly gone within a few frames,
   * before the new one arrives (on `ease.in` the old label is still nearly
   * opaque when the new one starts, and the two read as one smudge). A swap in
   * place, where nothing else moves, can take `ease.swap`.
   */
  easing?: Easing | { enter: Easing; exit: Easing };
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const curve = typeof easing === "function" ? { enter: easing, exit: easing } : easing;
  return (
    <div style={{ display: "grid", placeItems: "center", ...style }}>
      {items.map((item, i) => {
        const next = items[i + 1];
        const inP = i === 0 && item.at <= 0 ? 1 : progress(frame, item.at + (i === 0 ? 0 : delay), enter, curve.enter);
        const outP = next ? progress(frame, next.at, exit, curve.exit) : 0;
        if (inP <= 0 || outP >= 1) return null;
        const away = Math.max(1 - inP, outP);
        const y = rise * (outP > 0 ? -outP : 1 - inP);
        return (
          <div
            key={i}
            style={{
              gridArea: "1 / 1",
              opacity: Math.min(inP, 1 - outP),
              transform: away > 0 ? `translateY(${y}px) scale(${1 - scale * away})` : undefined,
              filter: away > 0.001 ? `blur(${blur * away}px)` : undefined,
            }}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
