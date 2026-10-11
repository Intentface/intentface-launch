// Test: the mixer. Two stems (drums muted over frames 300 to 420), a voice that ducks the
// music, fades, and library sounds placed by peak and onset. Run: pnpm launch mix test-mixer
// Expect: about -14 LUFS and below -1 dBTP, the music 8 dB under the voice at frames 120 to 240.
// Audio is synthetic (audio/make.sh).

import { defineVideo, useFrame } from "@intentface-launch/core";

function Plain() {
  const frame = useFrame();
  return <div style={{ position: "absolute", inset: 0, background: `hsl(${frame % 360} 40% 30%)` }} />;
}

export default defineVideo({
  id: "test-mixer",
  title: "Mixer test",
  audio: {
    src: "/videos/test-mixer/audio/track.wav",
    fadeIn: 1,
    fadeOut: 2,
    stems: {
      bass: "audio/stems/bass.wav",
      drums: { src: "audio/stems/drums.wav", mute: [[300, 420]] },
    },
    voice: { src: "audio/voice/line.wav", at: 120 },
  },
  sfx: [
    { src: "sfx:whoosh", at: 480, align: "peak", gain: 0 },
    { src: "sfx:click", at: 90 },
  ],
  shots: [{ id: "one", title: "One", duration: 600, component: Plain }],
});
