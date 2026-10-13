import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

const PROBE: CSSProperties = { display: "inline-block", width: 0, height: 0 };

/**
 * Where a line of text's baseline sits in its box, for scaling text about its baseline.
 *
 * Text scaled about its centre judders: its baseline lands between pixels and glyphs are not placed
 * at fractions of a pixel vertically, so the line climbs the pixel grid a whole pixel at a time.
 * Measured on a 120 px line scaling 1.35 → 1 at an even rate: 0.285 px of judder and 30 changes of
 * direction about the centre, 0.037 px and none about the baseline (videos/test-text-scale).
 *
 * Render `probe` inside the element that scales, give that element `position: relative` (the
 * probe measures from it), and use `origin(x)` as its `transformOrigin`. Until the first layout it
 * falls back to the centre. It re-measures every render, so a font that loads late moves it.
 */
export function useBaseline() {
  const ref = useRef<HTMLSpanElement>(null);
  const [y, setY] = useState<number | null>(null);
  useLayoutEffect(() => {
    // An empty inline-block sits on the baseline, so its top is the baseline's y in the line.
    const top = ref.current?.offsetTop;
    if (top !== undefined && top !== y) setY(top);
  });
  return {
    y,
    probe: <span ref={ref} aria-hidden style={PROBE} />,
    origin: (x = "50%") => `${x} ${y === null ? "50%" : `${y}px`}`,
  };
}
