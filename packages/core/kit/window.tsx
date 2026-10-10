import type { CSSProperties, ReactNode } from "react";

/**
 * Minimal browser chrome around product UI: a translucent title bar with
 * three dots and the address. No shadow (DESIGN.md): the frame separates
 * from the background by tone and a hairline.
 */
export function BrowserWindow({
  url,
  width,
  height,
  children,
  radius = 16,
  bar = 44,
  style,
}: {
  url?: string;
  /** Content size in CSS pixels (the captured viewport). */
  width: number;
  height: number;
  children: ReactNode;
  radius?: number;
  bar?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width,
        height: height + bar,
        borderRadius: radius,
        overflow: "hidden",
        background: "rgb(255 255 255 / 0.06)",
        outline: "1px solid rgb(255 255 255 / 0.1)",
        ...style,
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "rgb(255 255 255 / 0.18)" }} />
        ))}
        {url && (
          <div
            style={{
              margin: "0 auto",
              padding: "5px 16px",
              borderRadius: 999,
              background: "rgb(255 255 255 / 0.06)",
              font: "400 14px var(--if-mono)",
              color: "rgb(255 255 255 / 0.6)",
              transform: "translateX(-30px)",
            }}
          >
            {url}
          </div>
        )}
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
