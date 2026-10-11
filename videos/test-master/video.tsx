// Test: mastering to a delivery spec, and editing the track. Each second of chirp.wav is a tone
// of (second + 1) × 110 Hz, so after audio.edit replays beats 4 to 8 (2 to 4 s), seconds 2 and 3
// play again from 4 s. Run: pnpm launch mix test-master (pnpm launch sound test-master --png to see it)
// Expect: the "sting" spec, -23 LUFS with its loudest 3 s at most -18. Audio is synthetic (audio/make.sh).

import { defineVideo } from "@intentface-launch/core";

export default defineVideo({
  id: "test-master",
  title: "Master test",
  audio: { src: "/videos/test-master/audio/chirp.wav", edit: [{ replay: [4, 8] }], loudness: "sting" },
  shots: [{ id: "one", title: "One", duration: 540, component: () => <div /> }],
});
