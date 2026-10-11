// Test: Reveal with masks, a variable weight axis and cutOff.
// Run: pnpm launch still test-reveal --at caps:+40,caps:end --grid
// Expect: at +40 the words rising out of their masks, their letters gaining weight one after
// another; at the end both lines whole.

import { defineVideo } from "@intentface-launch/core";
import { Reveal } from "@intentface-launch/core/kit";

const sans = '"Studio Sans", system-ui, sans-serif';

/** Masked words rising as one while their letters gain weight; the last word cut off. */
function Caps() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0b0d", color: "#fff", fontFamily: sans }}>
      <div style={{ position: "absolute", left: 160, top: 300, fontSize: 150, lineHeight: 1.1 }}>
        <Reveal at={10} by="word" every={14} duration={0.6} mask axes={{ wght: [200, 900] }} axesEvery={3} cutOff>
          Hold my coffee
        </Reveal>
      </div>
      <div style={{ position: "absolute", left: 160, top: 640, fontSize: 64 }}>
        <Reveal at={10} by="word" every={8} exit="read" cutOff>
          The rest is read, the last word is not
        </Reveal>
      </div>
    </div>
  );
}

export default defineVideo({
  id: "test-reveal",
  title: "Reveal caps",
  logline: "Scratch test for Reveal axesEvery and cutOff.",
  background: "#0b0b0d",
  shots: [{ id: "caps", title: "Caps", duration: 150, component: Caps }],
});
