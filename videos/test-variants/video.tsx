// Test: variants, three videos from one folder.
// Run: pnpm launch check test-variants --variant all
// Expect: a report per variant (check.json, check-ep02.json, check-ep03.json), no errors, each
// variant's own copy found on screen, and ep02's line held a second longer (5.0 s).

import { defineVideo, useVariant, useVideoInfo } from "@intentface-launch/core";

function Line() {
  const { data } = useVariant<{ line: string }>();
  const { variant } = useVideoInfo();
  return (
    <div
      style={{ position: "absolute", left: 200, top: 440, color: "#fafafa", fontSize: 96, fontFamily: "sans-serif" }}
    >
      {data.line ?? "Five mistakes in this one"}
      <div style={{ fontSize: 40, opacity: 0.8 }}>{variant ?? "episode 1"}</div>
    </div>
  );
}

export default defineVideo({
  id: "test-variants",
  title: "Variants test",
  shots: [
    { id: "intro", title: "Intro", duration: 60, component: () => null },
    { id: "line", title: "Line", duration: 240, component: Line, copy: ["Five mistakes in this one"] },
  ],
  variants: {
    ep02: {
      data: { line: "Four mistakes in this one" },
      shots: { line: { duration: 300, copy: ["Four mistakes in this one"] } },
    },
    ep03: { data: { line: "Three mistakes" }, shots: { line: { copy: ["Three mistakes"] } } },
  },
});
