// Test: board reports text that cannot be read, before the timing is signed off.
// Run: pnpm launch board test-board
// Expect, per shot: hook, reading (held 0.9 s, needs 3.0 s); small, size (20 px, minimum 28);
// edge, safe (inside the 96 px margin); ok, a copy warning ("Try it free" is not on screen).

import { defineVideo } from "@intentface-launch/core";

const Line = ({
  text,
  size = 80,
  left = 200,
  top = 480,
}: {
  text: string;
  size?: number;
  left?: number;
  top?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      fontSize: size,
      fontWeight: 500,
      color: "#fafafa",
      fontFamily: "sans-serif",
    }}
  >
    {text}
  </div>
);

export default defineVideo({
  id: "test-board",
  title: "Board reading test",
  shots: [
    {
      id: "hook",
      title: "Hook",
      duration: 50,
      component: () => <Line text="Every note in one place you can search" />,
      copy: ["Every note in one place you can search"],
    },
    {
      id: "small",
      title: "Small label",
      duration: 180,
      component: () => <Line text="Filters by date and owner" size={20} />,
    },
    {
      id: "edge",
      title: "Near the edge",
      duration: 180,
      component: () => <Line text="Shared with your team" left={20} top={40} />,
    },
    { id: "ok", title: "Fine", duration: 240, component: () => <Line text="Try it" />, copy: ["Try it free"] },
  ],
});
