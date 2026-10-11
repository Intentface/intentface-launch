# Intentface Launch: the launch film

The example video for this repo and the hero of launch.intentface.com. It is made with Intentface Launch and shows what the tool makes: the product on screen is Orbit, a made-up release tracker built for this film (`sample-app.tsx`), so the film shows a launch video's material, not the tool's own UI.

## Look

Large type, minimal, stylish and dynamic, in the spirit of Swiss design and of Apple's launch films. Set in the Intentface brand, as asked (`@intentface/brand`, from npm; its DESIGN, MOTION and COPY rules apply, and where this direction goes further than them it says so below).

- **One line at a time, quick to read.** Every line on screen is one to four words on a single line, never wrapped. A thought longer than that is split across cuts, a phrase per beat ("One video." / "Every size." / "Every update."). The messages the film must convey are carried by the pictures; the words only name them.
- **One typographic style, the whole film:** Intent Sans Regular (400), 120 px, -0.03 em, sentence case, `#fafafa` on black. Alone on screen, the line is centred; beside the UI, it sits in the space the camera leaves free, aligned to the UI's edge, at the same size. The style breaks only where the break is the point: the montage, where "Any style." is itself set in a different style on every cut (3D, hand drawn, serif, neon, print, CRT, wide and condensed posters, echo, sliced, dot matrix), with nothing behind it.
- **Negative space:** most of the frame empty and dark. UI is cropped hard by the frame edge rather than shrunk to fit.
- **Colour:** black (`#000`) ground, `#fafafa` type. No gradient backgrounds (no `<Atmosphere>`). Colour comes from Orbit's own UI, the montage's styles, and the Launch mark's own gradient on the end card, which is on full black (`#000`), as is the whole film.
- **Logo:** the Launch mark in its gradient from the brand package (`launch-color.svg`), never redrawn, on full black.
- **Surfaces:** no shadows (brand); radii only where the UI has them.
- **Motion, dynamic but exact:** lines are masked in by word on the beat (`Reveal`, no bounce) and cut away on the next; the camera moves in straight lines and lands; hard cuts on the downbeats. No em dashes on screen.
- **The UI on screen:** Orbit, light, with its own blue accent and green for done, set in Intent Sans. Product shots fill the frame; lines are never over them, they get their own short card on the dark ground between product shots.

## Claim

Launch videos written as code, from your real UI.

## Audience and placement

Developers and product teams shipping software, who make (or skip) launch videos. First on the launch.intentface.com hero and the README, muted autoplay first, so the story must read with the sound off. 63 s (the track's full length, with its tail), 16:9, with 9:16 and 1:1 delivered from the same source.

## Recurring device

Orbit, one made-up product the whole way through: clicked, taken apart in depth, rewritten in code, and delivered as every kind of video.

## Hero and supports

| | Feature | The moment it is seen | Source |
|---|---|---|---|
| Hero | Your real UI, in motion | Orbit's own Launch button is clicked; the product answers (launched, the checklist ticks, sign-ups climb) as the camera pulls back | LAUNCH.md "Captured UI", "Close-ups use snapshots" |
| Support 1 | Written as code | One line of the video's code changes (Spring launch to Summer launch) and the frame beside it follows | README "A video in code" |
| Support 2 | Any style | Orbit's cards burst apart in depth on the drop; then "Any style." in six styles, one per cut | core kit (`DrawOn`, `Displace`, `Halftone`, `Dither`, `FilmGrain`, `Scanlines`), three add-on (`Stage3D`, `Light.*`) |
| Support 3 | One source, many outputs: launches, updates, podcast intros, ads, any size | The Orbit film as tiles: 16:9, then 9:16 and 1:1; an update variant; a podcast intro; ads | LAUNCH.md "Other shapes reflow", "Variants of one video" |
| Close | Use it as a dependency or fork it | Two short lines, no commands; where to start is launch.intentface.com | README "Quick start" |

Cut: the studio and Claude Code (reviewed: confusing in a launch film; the film shows what is made, not the tool), the review loop, `check` (strong, but a second "how" beat would slow the middle; it can be one line on the docs page), beats detection, captions, motion blur as its own feature (it is in every fast move anyway), performance numbers.

## Script

Timed to the track (`audio/the-launch.wav`): times in seconds, cuts on the detected downbeats (`beatGrid`; 126 BPM is not a whole number of frames, so not `tempo()`).

| # | Time (s) | Music | Picture: what, how close, what moves | Words | Hand-off |
|---|---|---|---|---|---|
| 1 hook | 0–3.8 | Pulse, riser ending at 3.76 | Macro on Orbit's Launch button, the UI tilted in perspective and fading into the dark at the edges; the cursor clicks on the riser's peak. | None | The click |
| 2 product | 3.8–10.3 | Build, riser 9.6–11 | The button turns to Launched; the camera whips back (motion blur) over the checklist as it ticks, then to the whole app as sign-ups climb, the UI turning towards flat. | None | Cut to the line |
| 4 code | 10.3–14.8 | Build | Code on the left, the frame on the right: `Spring` is deleted from the title and `Summer` typed; the card becomes Summer launch. | Typed code | Cut to the line |
| 5 written | 14.8–17.0 | Swell into the drop | Alone on dark. | "Written as code." | Hard cut on the drop |
| 6 layers | 17.0–23.1 | **Drop** | On the hit Orbit bursts into its cards in depth (motion blur), the view sweeping over them, and they land back together as the app. | None | Cut on the downbeat |
| 7 styles | 23.1–28.9 | Groove | "Any style." in six styles, one per cut, nothing behind it: plain (held 1.4 s to read), 3D, hand drawn, serif italic, neon, a yellow poster; two beats each. | "Any style." | Back to the plain style on the section at 28.9 |
| 8 create | 28.9–36.6 | Groove | Black, one line; the middle word rolls through on every second beat: product, update, intro, ad, demo, launch. No UI. | "Create product video." (the word cycling) | Cut |
| 8b real UI | 36.6–40.4 | Groove | Alone on black, finishing the thought. | "From your real UI." | Cut |
| 8c platforms | 46.1–51.7 | Lift | A device family in 3D, each on another kind of platform (video site 16:9, photo feed 1:1, short-video 9:16), one clip laid out for each; Launched on all three on the lift. | "Every platform." | Up to the impact at 51.45 |
| 9 install | 44.2–51.7 | Change, lift at 47.8, hit at 51.4 | Alone on dark: "Install it.", then on the lift "Or fork it.", fading on the hit. No commands. | "Install it." "Or fork it." | Fades as the bass drops out |
| 10 countdown | 51.7–55.75 | **Breakdown**, riser 54.9–55.75 | Full black: a breath, then a huge 3, 2, 1 every second beat into the hit. No logo yet. | 3, 2, 1 | The hit |
| 11 end | 55.75–63.1 | **Hit**, then the tail | Full black; the Launch mark in its gradient appears on the hit and lifts into place; "Intentface Launch"; launch.intentface.com types in. | Name, URL | End |

- **Running time:** 63.1 s (the track, with its tail).
- **UI on screen:** Orbit in rows 1, 2, 4, 6 and 8: about 55%. The rest is type, by design.
- **Overlay words:** about 20, in single lines of 2 to 4 words, plus the countdown.
- **Text-only shots:** the line cards between product shots, row 8, the countdown and the end card.

## Music

`audio/the-launch.wav` (16-bit, 48 kHz, 63.12 s; the MP3 and M4A copies were removed). `pnpm launch beats`: 126 BPM, steady (beat-to-beat spread 20 ms), confidence 0.45; beats are found from the drop on, the intro's grid extends back at the same tempo. A minor, -16.2 LUFS (render masters to -14).

| Time (s) | Frame | Section | Events (`pnpm launch sound`) |
|---|---|---|---|
| 0–17.0 | 0–1022 | Intro build, 8th-note pulse, no kick | Riser 0.24–3.76, riser 9.6–11.0, swell 16.6–17.4 |
| 17.03 | 1022 | **Drop** | Cut to boom; first downbeat about 17.4 (f1045) |
| 17.4–43.7 | 1045–2624 | Groove | Section at 28.9 (same energy); the pulse ends at 43.7 |
| 43.7–47.5 | 2624–2848 | Change | Sweeps, cuts |
| 47.5–52 | 2848–3115 | Lift | Section up at 47.5; impacts at 49.48 (+35 dB) and 51.45 (+31 dB) |
| 52–55.75 | 3115–3345 | **Breakdown** | Sub drops out; riser 54.94–55.75 |
| 55.75 | 3345 | **Hit** | Cut to boom, section up at 55.5 |
| 60.5–63.1 | 3632–3787 | Tail | Decays to silence |

## Facts and limits

- No install commands on screen (the person's call): the film says it can be added or forked, and launch.intentface.com is where to start. Nothing on screen depends on the npm release.
- Orbit is made up for this film: its name, data and look come from nothing real.
- The montage's styles are all things the packages do today: no style is shown that the kit cannot render.
- The tiles in row 7 become real renders in the build: an Orbit film made with this repo, in its `formats` and `variants`.
- The repo URL is `github.com/Intentface/intentface-launch` (README).

## Open

- Whether the countdown also gets a voice ("three, two, one" as `audio.voice`), decided after hearing it with ticks only.
- Hits to confirm by frame in the sketch: the drop's first downbeat (about f1045) and the logo hit (f3345), declared as `hits` so `check` holds them.
