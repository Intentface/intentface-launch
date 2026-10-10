---
name: music-brief
description: Get the music for a launch video and cut the video to it - write the brief for a generated track from the agreed script (or a locked cut), point the person to a generator such as Suno or ElevenLabs Music, then sync the shots to the delivered track's beats, sections and breaths. Use when a script is agreed and the video has no track yet, when a video's timing is locked and it needs music, or when a track has been added to audio/.
---

# Music brief

Intentface Launch does not make music; it cuts the video to a track. The best order is the track first and the video built around it: brief it from the agreed script, before the sketch, so shots are timed to the music the person actually has. Briefing a track to a locked cut works too, but the music then has to fit timing it had no say in.

## Where the track comes from

- **The person's own music** (bought, licensed, made for the product): skip the brief and go to "When the track arrives". Check its licence covers the video's use.
- **A music generator**, from the brief below. The person makes it in their own account and picks the take; a generator never gives the same result twice, so they listen to several.
  - **ElevenLabs Music** takes an exact length and a plan of sections, each with its own duration, so the structure can match the script closely.
  - **Suno** (and similar song generators) take a style prompt with the BPM and mood in words, and an instrumental switch. Songs come out longer than a launch video and their structure is not exact: generate, pick the take whose sections suit, and trim or replay bars to fit (below).
  - Commercial use needs a plan that allows it (Suno's free plan does not). Say so when handing over the brief.

## Writing the brief

Read the script table in `brief.md` (rows with their beats) or, for a locked cut, `video.tsx` for the shot list and total length. Give the person a brief they can paste into a music generator, plus the numbers they need:

- **Length**: the video length plus 2 s of tail, in seconds.
- **Tempo**: the video's `bpm`. It must give a whole number of frames per beat at 60 fps (90, 100, 120, 144). By mood: 90 or 100 for calm and premium, 120 for confident, 144 for hype.
- **Sections** with timestamps from the script's rows or the shot list: intro under the title, build under the product flow, a breath (a beat or two of near silence) before the reveal, lift where the payoff shot lands, resolve under the end card.
- **Hits**: exact times of the cuts that must land on a downbeat and of the logo. For the logo, also its sound (logo-animation skill): the pattern (two hits then a release, texture to tone, one swelling chord), the signature timbre, and a transient on the lock frame or 1 to 2 frames before it.
- **Character**: instrumental, no vocals, and a mood in plain words that fits the brand (calm, confident, technical, warm).

## When the track arrives

1. It goes in `videos/<id>/audio/`. Set `audio: { src: new URL("./audio/<file>", import.meta.url).href }` in `defineVideo`.
2. `pnpm launch beats <id>` writes `audio/beats.json`.
3. Read what it prints. If `confidence` is under 0.5, the grid is unreliable: keep `tempo()` at the brief's BPM and set `audio.offset` to the first strong onset. If the detected BPM is within 0.2 of the video's, keep `tempo()`. Otherwise import `beats.json` and time shots with `beatGrid(beats, 60)`: `span(a, b)` for durations, `beat(n)` for hits, `snap(frame)` to move a cut onto the nearest beat.
4. Compare `sections` and `breaths` with the brief (or, for the person's own track, with the script): the reveal should sit in or just after a breath, the payoff on a section where energy goes up. Move shots to the track, not the track to the shots.
5. Set `audio.offset` if the first downbeat is not at 0, so the title lands on it.
6. `pnpm launch sound <id> --png` lists the track's events (impact, boom, cut to boom, riser, pulse, tail) with frames, and draws them on a spectrogram: put hits on those frames, and declare the ones that matter as `hits: [{ at, sound: "boom" }]` on the shot so `check` holds them within 2 frames.
7. `pnpm launch check <id>` reports cuts off the detected beats and the loudness (-14 LUFS integrated, -1 dBTP peak). If it says the track needs limiting, ask for a louder master rather than raising `volume`.
8. Preview render with audio and check the hits by frame in the studio (the waveform and beat ticks are under the timeline).

## When the cut outgrows the track

A re-cut that holds a shot longer does not need a new track: replay whole bars of the one you have (one video replayed one ambient bar twice for a longer opener, and a two-bar phrase once for more reading time).

- **Find the passages:** `pnpm launch beats <id> --seams` lists phrases of 1, 2 and 4 bars that can replay, best first: `replay: [from, to]` in beats, a score (0 to 1), how many dB apart the music is either side of the seam, the harmony (0 the same chord, 1 unrelated) and a crossfade. Beats before the first one found count back from it at the track's tempo (an ambient intro has no beats to find), so `[-6, -2]` is fine. Prefer a seam a few dB apart in the same chord; a phrase boundary (a section start) for drums, any bar in an ambient pad.
- **Apply it:** `audio: { edit: [{ replay: [from, to], times: 1, crossfade }] }` plays the passage `times` more times straight after itself, in `render`, `mix`, `check` and the studio, and on every stem. The seam sits 8 ms before the beat, so the beat's attack comes whole from the bar that follows, and crosses over with equal power: about 120 ms across a pad, 12 ms across drums (`--seams` suggests one from whether an attack sits on the beat).
- **Time from the edited track:** `beatGrid(beats, fps, offset, edit)` and `sheet --beats` follow the edit, so cuts on `grid.beat(n)` move with it; `check` checks cuts against the edited grid. On the events music a 4-bar replay put every later beat within 3 ms of an onset in the mix.
- **Check the seams by numbers:** `pnpm launch sound <id>` on the result should show no impact or cut at a seam, and the replayed events again, the passage's length later. The person listens to each seam before sign-off.
