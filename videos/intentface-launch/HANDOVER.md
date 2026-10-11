# Handover: the Intentface Launch film

State on 2026-10-11, for the next thread. Read this, then `brief.md` (look and claims; its script table is older than this file, see below), `timing.ts` (every cut, the source of truth) and `video.tsx`.

## What it is

The launch film for this repo and the hero of launch.intentface.com, made with Intentface Launch itself. 63.1 s, 16:9, cut to `audio/the-launch.wav` (Joni's track, 126 BPM, steady; `beats.json` and `out/sound.json` hold its analysis). Stage: build. The hero shots are real 3D (`hero3d.tsx`, `sizes3d.tsx`); the final render is `out/intentface-launch.mp4`. Joni has not seen this cut.

## Decisions already made by Joni (do not re-ask)

- **Look:** black ground (`#000`) everywhere. Intent Sans (from `@intentface/brand`) for all the film's own type, Regular 400 at 120 px for lines, one style throughout; it breaks only in the "Any style" montage. No mono in the film's type (code in the code shot is UI). No frame counter. No gradients except the Launch mark's own.
- **Copy:** single lines of 1 to 4 words, quick to read; a longer thought split across cuts. No install commands on screen. The messages to convey (real product UI; programmatic: launches, updates, sizes; any use: product, intro, ad...; any style from 3D to 2D; dependency or fork; launch.intentface.com) are what to show, not literal copy.
- **Product on screen:** Orbit, a made-up launch planner (`sample-app.tsx`), dark mode, in its own window with rounded corners, plain words ("Launch" → "Launched ✓"). Not the studio, not Claude Code (both cut as confusing).
- **Any style:** few distinct styles, no repeats, no UI behind, no shaking glitch, no yellow poster. Currently plain, 3D extrusion, hand drawn (outline drawing on), serif italic, neon.
- **Kinds of video:** one line, "Create [word] video.", the word rolling through; no UI per kind.
- **After it:** "From your real UI."
- **Ending:** 3, 2, 1 on black, then only the Launch mark animating in (its own intro: flight, burner rays), centred; then the texts ("Intentface Launch", launch.intentface.com) below, the group optically centred. Gradient mark, full black.
- **Pacing:** keep it moving. Short lines one bar; no holds longer than their content earns. Reading time is a floor, not a target.
- **Quality:** boards are judged as the finished film. Use the motion tools (springs, `Swap`, staggers, Camera `travel`, `MotionBlur`, `Focus`, perspective) from the first pass, and review every shot's stills against motion-review's defect list before showing anything.

## Current cut (timing.ts)

| Shot | Time (s) | What |
|---|---|---|
| hook | 0–3.76 | Fades up from black. `Stage3D`: Orbit's window as a slab (lit edge) seen low across it, focus on the Launch button, the rest in bokeh; a light sweeps across; cursor clicks on the first riser's peak |
| app | 3.76–9.62 | `continues: "hook"`: button morphs to Launched, badge Live; the camera pulls back and turns straight on as the lens stops down, lands 16 frames before the cut, and the flat window dissolves in: the cut to code is pixel-identical |
| code | 9.62–14.8 | The launch card is carried right (spring), code slides in left; "Spring" deleted, "Summer" typed; title swaps |
| written | 14.8–17.03 | "Written as code." |
| reel | 17.03–23.14 | Drop: the launch video, on the same slab in 3D. Whips every two beats with the shutter open: card Live, checklist ticking, sign-ups counting, chart drawing, team popping in; pull back straight on |
| styles | 23.14–28.89 | "Any style." in 5 styles, the first held 1.4 s, then two beats each |
| create | 28.89–38.48 | "Create [product … launch] video.", 11 words accelerating (a bar, then every two beats, then every beat) |
| from-ui | 38.48–40.39 | "From your real UI." |
| install / fork / open | 40.39–46.14 | "Install it." / "Or fork it." / "Open source." one bar each (the repo is MIT) |
| sizes | 46.14–51.65 | "Every platform." over a device family in 3D on a black mirror floor, each on a different kind of platform told apart by layout and theme: a video site on the laptop (16:9; the lid opens as the line lands), a photo feed in light mode on the tablet (1:1), a short-video app on the phone (9:16). One clip on all three; on the lift (47.82) the button on all three becomes Launched on the same frame, then the likes come in |
| countdown | 51.65–55.71 | Breakdown: black, then 3, 2, 1 every second beat, each landing out of a blur and pushing slowly; the 1 punches through the lens into the hit |
| end | 55.71–63.12 | The Launch mark's intro (`launch-intro.tsx`, a frame-driven port of core's `studio/launch-mark.tsx`), centred; it rises and the texts arrive |

## Fixed on 2026-10-11 (second pass)

- Camera rect keys took core's default 12% padding on top of `view()`'s own: every framing was looser than meant and the app's last frame did not match the code shot's first. All keys now `padding: 0`; the app ends on `AREAS.app`, and the code shot starts from Orbit in the same state (`LAUNCHED`, not `DONE`).
- hook: macro centred on the button with the window's corner, the rest blurred (the view may rise above the window onto the black).
- reel: the count and chart stops frame the whole sign-ups card.
- sizes: rebuilt as feed mockups (Joni: the UI tiles read as nothing and hid the line).
- Dead holds: the app's pull-back runs to the cut; slow pushes through the code shot's hold and the end card; the lockup rises 0.5 s sooner.
- Launch intro: the motion lines fade radially, so the SVG's square no longer shows.
- Sound: a first sfx pass from the library (click, keystrokes, whips, ticks, pops, countdown whoomps, shimmer on the mark), mixed to -14 LUFS.
- Sync: `hits` on app (3.76 s, from the track alone), reel and end (booms); the end hit moved to 55.71 s. `check`: 0 errors.
- Board rebuilt.

## Third pass (2026-10-11, toward an Apple-grade finish)

- hook, app and reel moved from CSS tilts to `Stage3D` (`hero3d.tsx`): a real lens, depth of field, a light sweep, shutter blur on the reel's whips. The old flat `AppScene`, `Reel` and `Tilt` are gone.
- sizes: from flat feed mockups to a device family in 3D (`sizes3d.tsx`); the mockups live in `feed.tsx` and are the devices' screens.
- The code shot's carried card sat 1 px off the app's (the window's border); fixed, so app:end and code:+0 diff as identical.
- Lines push slowly through their holds (`Line drift`), as does "Create ___ video."; its word slot opens before a longer word and closes after a shorter one, so words never touch "video.".
- The 3D style is a solid extrusion (48 layers), not a stack of shadows.
- Countdown: push and punch. The film fades up from black.
- Sound follows the new sizes picture (lid, screens waking).
- Joni (2026-10-11): "Every size" is not about devices but about making material for any platform; keep the devices if they read as different platforms. So the line is now "Every platform." (one-word revert if Joni prefers "Every size."), and the screens are three kinds of platform (`VideoSiteScreen`, `PhotoFeedScreen`, `ShortVideoScreen` in `feed.tsx`). The 3D devices stay library components (`Phone`, `Tablet`, `Laptop` in `@intentface-launch/three`); the family-shot recipe is in that package's LAUNCH.md.
- Skills now carry this pass's finish (product-launch-video "The finish", creative-direction, motion-review defects and the delivered-file review, kinetic-typography rolling word, the 3D guide's handoff, family and floor notes).
- Final render: `out/intentface-launch.mp4`, 63.1 s, 1080p60, about 10 MB (x264 CRF 16; small because the film is mostly black). Renders in about 6 minutes with `--workers 4`.

## Fourth pass: Joni's review of the render (2026-10-11)

Joni's notes, and what each turned out to be:
- "Texts weirdly moving 1px at a time": the 2% push on held lines (Chrome snaps glyphs to whole pixels). All slow drift on type removed; rolling-word positions rounded. Verified on the mp4: held frames are pixel-identical.
- "What's wrong with the bokeh": 96 samples for 120 px blur (grainy discs, streaks), and the cursor out of the focus plane blurring into a disc. Now 80 px at 256 samples in the app scene, 192 in the reel and behind "From your real UI."; the cursor enters along the button's row.
- "Why is the UI empty": the app stayed at rest after the click. It now fills during the pull-back (ticks, count, chart, team); the code shot starts from the full app, and the new Summer launch's checklist ticks through after the title changes.
- "The zoom after clicking has a weird stop": a rig key in the middle of the pull-back (arrived on `ease.in`, left on `ease.inOut`). Now one move, with focus on its own curve (`framingAt` + `frame`).
- "Create [variable] video" should speed up with ticks: 41 words, each change 16% sooner, down to a 4-frame reel of similar-length words centred in a fixed slot, a tick on each, landing on "launch".
- "No sfx used": they were in the mix but 8 to 16 dB too low. Raised; measured at +8 to +25 dB over the music in the highs.
- "Orbit is weird": the app is "Example app" on screen (`APP_NAME` in `sample-app.tsx`; `<ExampleApp` in the code shot). Code identifiers still say Orbit.
- Also: the end card fades to black over the track's tail; `check`'s stillness advice no longer says "add a drift".

## Fifth pass (2026-10-11)

- The run of lines "From your real UI." / "Install it." / "Or fork it." rolls: each rises out of its mask in its last frames and the next rises in on the cut (`Line roll`), no fade through empty black.
- Code shot: once the new launch has filled, the changed line lights up (the cause of the card), then both panels lift away fast into "Written as code.".
- End card: one glint along the mark's rays, then the fade with the track's tail.
- `check`: 0 errors. Its two "still" warnings are decisions: the code shot holds 2 s on the finished state with its cause highlighted, and the end card holds about 3.5 s with a glint before fading (check does not count small-area motion). `sound --png` shows the effects as their own events (keystrokes f640 to f700, the countdown thumps as a pulse f3185 to f3285).
- Not yet done by a person: listening to the mix, and recording the track's licence (source unknown to this thread).

## Sixth pass: Joni's notes (2026-10-11)

- "From your real UI" → "From real product UI.", on black (no product behind; `UIBehind` removed).
- "Create ___ video": back to 11 options on the beats; each change a swap (old word out in 6 frames, new in 4 frames later from 0 opacity and a slight blur), `MotionBlur` on each change, a tick each; the slot grows at once and shrinks after the old word has gone. The accelerating scroller is gone.
- Too much cropping: lines no longer use the masked rise; they fade up out of a blur (`Reveal rise blur`, no mask) and lift out with blur and fade (`Line roll`).
- The sample clip is neutral: a gray ground, a green button from the start (`LaunchButton idle`); thumbnails, stories and the progress bar gray.
- Devices larger, and they rise into frame from below as the camera pans down (`sizes3d.tsx`), the lid opening once in view.
- Skills corrected to match (kinetic-typography: fade-up by default, the swap recipe; product-launch-video: type on black, a handful of options, neutral sample content, the family large and entering from below).

## Rendering (Joni, 2026-10-11): no more full renders while iterating

A final render of this film takes about 12 minutes (3D at 192 to 256 samples, motion blur on the word changes). Iterate with `still`/`sheet` (`--samples 8`), `diff` and `check`; for a whole-film review use `pnpm launch render intentface-launch --preview` (now 3D at 8 samples, no motion blur: minutes). Render the final once, after Joni signs off. The current `out/intentface-launch.mp4` matches the source as of this pass.

## Open

- The run from "Any style." to "Open source." is about 23 s of type on black. That is Joni's agreed copy, but it is the most slideshow-like part of the film. Ask before changing it.
- Countdown "3" and "2" are under the reading floor in `check` (warnings, read at a glance).
- Licence for `audio/the-launch.wav` not recorded.

## Files

- `video.tsx`: the shots. `hero3d.tsx`: the 3D app scene and reel (`AppScene3D`, `Reel3D`, `OrbitSlab`). `sizes3d.tsx`: the device family. `feed.tsx`: the feed mockups and the clip they play. `sample-app.tsx`: Orbit (`Orbit`, `OrbitReflow`, `LaunchCard`, `SignupsCard`, `TeamCard`, `LaunchButton`, `AREAS`, `Cues`, `DONE`). `launch-intro.tsx`: the Launch mark intro. `timing.ts`: every cut. `brief.md`: look, claims, music map (its script table predates the latest restructure; update it from the table above). `comments.json`: Joni's board notes, all answered and resolved.
- `package.json` here: the video is its own workspace package (listed in `pnpm-workspace.yaml`) so `@intentface/brand` and its check rules apply to this video only, not to the test videos.

## Done this session outside the video (uncommitted)

- Skills: product-launch-video ("The quality bar, from the first board", short single-line copy, a tool shown by what it makes, sketches not flat), sketch.md, motion-review ("Defects to hunt in every still"), creative-direction (every effect shows something), kinetic-typography (hold is a floor). `LAUNCH.md`: review gate before showing anything, holds no longer than needed.
- Nothing is committed. The tree also holds someone else's in-progress work (packages/shaders, three, docs, README, LICENSE); leave it alone.

## Also open

- Whether the countdown gets a voice.
- Wishlist issues to draft for Joni: a measure of how far each sfx stands above the music in its band (`mix` or `sound` could print it; audibility was judged by ear only after the render); `sheet` on the rendered mp4, sampled on beats (done here with an ffmpeg one-liner); `check` hits read the mix, so an sfx placed on a music event moves that event's measured time (the hook's riser end read 3.76, then 3.70, then 3.66 s as the click moved); `audio.edit` skip (trim a track to a shorter cut); `Snapshot` replays in light scheme whatever `colorScheme` the capture used.
