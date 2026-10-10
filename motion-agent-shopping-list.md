# Motion Video Agent — Capability Shopping List

A list of reusable capabilities for an agent that makes launch and reveal videos. The spine (deterministic renderer and beat-sheet timeline) is assumed to exist. This list covers what gets built on top of it.

**Out of scope:** Lottie, Remotion, video generation and music generation. Music is made by the user in Suno or similar. The agent only writes the music brief (see A3).

Priorities: **P0** means build first, because every video depends on it. **P1** means it's needed for quality. **P2** means nice to have, or needed only for some use cases.

---

## A. Timing utilities (P0)

### A1. `getBeats(audioPath)` — music analysis
- [x] Returns `{ bpm, beats[], downbeats[], onsets[], confidence, energy[], sections[] }`. All times are in seconds, and each one is also converted to frames at the project fps. Done in `pnpm launch beats` → `audio/beats.json` (plus `breaths`). Frames come from `beatGrid(beats, fps)`. Confidence is 0 to 1: beat steadiness times how far beats stand out.
- [x] Beat tracking uses **essentia.js** `RhythmExtractor2013` with `method: "multifeature"`. It returns BPM, beat positions and a confidence value. Confidence runs from 0 to 5.32. Anything above 1.5 counts as good, and anything below 1 means "don't trust it." Resample the input to **44.1 kHz** first, because the algorithm requires that rate. Done with librosa instead (`tools/beats.py`, run by uv), which was already in place. Each beat and onset is then moved to the steepest loudness rise nearby, which fixed a steady 20 ms lag: on a test track with a real kick, beats land within 5 ms. BPM comes from a line fit through the beats.
- [ ] A lighter JS fallback is `@audio/beat`, which does onsets, tempo and beat tracking and runs in both Node and the browser. Not needed while uv runs librosa. (Left out on purpose.)
- [x] **Downbeats:** assume 4/4. Pick the bar phase using per-beat loudness (essentia's `BeatsLoudness` measures loudness around each beat). Done, with the phase picked by onset strength per beat.
- [x] **Energy envelope:** compute RMS per frame and smooth it. This is used to find the build, drop and outro. Done: 20 values per second, smoothed over a quarter second.
- [x] **Section changes:** use a novelty curve (essentia's `NoveltyCurve`) to mark drops and transitions. Done: a checkerboard novelty over timbre and harmony, per beat, with whether energy goes up or down after.
- [x] `findBreaths(energy, { minDuration })` finds low-energy gaps. Those gaps are candidates for the "silence before the reveal." Done: quiet relative to the median of the 3 s either side, so a dip counts in a quiet intro as well as before a drop. `beats` prints them.
- [x] Cache the results next to the audio file (e.g. `track.beats.json`) so analysis runs only once.
- [x] Low-confidence fallback: if the BPM is known from the Suno brief, build the grid from BPM plus the first detected strong onset. Done as advice: under 0.5, `beats` prints the first strong onset to use as `audio.offset` with `tempo()` at the brief's BPM, and the music-brief skill says when to use it.

### A2. Beat and frame math
- [x] `beatToFrame(beatIndex)`, `frameToBeat(frame)`, `bars(n)` → seconds, and `beats(n)` → seconds. Done on `tempo()` and `beatGrid()`: `beats(n)`, `bars(n)`, `beat(n)`, `bar(n)` in frames, and `at(frame)` for the fractional beat.
- [x] `snapToBeat(t, { mode: "nearest" | "next" | "prev", subdivision: 1 | 2 | 4, grid: "beat" | "downbeat" })`. Done as `snap(frame, { mode, subdivision, grid })` on both.
- [ ] `quantizeBeatSheet(beatSheet, beats)` snaps each beat boundary and reports how far it moved, with a warning above a threshold. Not built on purpose: `check` reports each off-beat cut with the beat to move it to, and shots are timed in beats in code.
- [x] `offGridReport(cuts, beats)` lists which cuts land off-beat. Deliberately off-grid cuts get flagged as intentional rather than as errors. Done in `pnpm launch check <id>`. A transition counts as on the beat if its start, middle or end lands on one. `offBeat: true` on a shot marks a deliberate one.

### A3. `musicBrief(beatSheet)` → Suno prompt helper
- [x] Outputs the target length, a BPM suggestion, and a timestamped structure (intro, build, breath, drop, sustain, outro) derived from the beat sheet's energy curve. Done as the music-brief skill.
- [x] Outputs style tags, mood, instrumentation, "instrumental, no vocals," and a line saying where the breath and the drop should land. Done as the music-brief skill.
- [x] BPM heuristics (a starting point, to be tuned): 85–105 for calm or premium, 115–128 for confident or energetic, 135+ for hype. Done, limited to BPMs with a whole number of frames per beat at 60 fps: 90 or 100 calm, 120 confident, 144 hype.
- [x] After the user brings the track back, `getBeats()` verifies the actual BPM and section times, and the beat sheet is re-quantized to the real track. Generated music drifts from the prompt. Done: `beats`, then `check` reports cuts off the detected grid.

### A4. `readingTime(text, opts)` — how long text stays on screen
- [x] Returns `{ seconds, frames, cps, warnings[] }`. `readingTime(text, fps, options)` in core.
- [x] Formula: `hold = clamp(entryAnim + chars / cps + settle, minHold, maxHold)`. The hold is measured from when the text lands. `entry` adds the entrance time when wanted, and `wps` (words per second) covers short words that characters undercount.
- [x] Defaults for launch videos: The brand overrides these with its own rule (2 s + max(words / 3, characters / 15)).
  - Subtitling practice for streaming platforms is roughly **17 CPS** for general audiences and up to **20 CPS** for adults.
  - Standard TV subtitling sits around **12–15 CPS**.
  - In motion pieces the text competes with other movement, so the default is **14 CPS**. The ceiling is 17, and anything above that raises a warning.
  - Also: `minHold` 1.0s, `maxHold` 5s, `settle` 0.3s. `entryAnim` is taken from the motion token used.
- [x] Options: `cps`, `audience: "general" | "technical"`, `competingMotion: "low" | "high"` (a multiplier), and `language`, since translations usually run longer than English and need extra time. Done except `language`: time is counted per character, so longer translations already get longer holds.
- [x] `readingTimeOnBeats(text, beats)` returns the reading-time floor rounded **up** to whole beats. This is the function the timeline actually calls.
- [x] `wordTimings(text, { start, cps })` gives a start time per word for kinetic type when there's no VO.
- [x] `lintText(text)` checks the text itself:
  - Warns above 6 words for a headline line.
  - Uses a 42-characters-per-line cap, borrowed from subtitle practice.
  - Warns above 2 lines.

### A5. Motion token gallery
- [x] `tokens/motion.ts` holds the named easings, springs, durations and staggers. Nothing in a scene uses raw numbers. Done in core's `engine/motion.ts`: `ease` (with `settle`, `glide`, `exit` as names), `springs` and `springsAt` (as `{ duration, bounce }`), `durations()`, `staggers()`. A brand's MOTION.md still overrides them.
- [x] **Easings** (cubic-bezier). These are starter values, tuned by eye in the gallery. Done: `ease.settle`, `ease.glide`, `ease.exit`, `ease.pop`, `ease.linear`. The list's `swap` (0.65, 0, 0.35, 1) is core's `ease.inOut`; core's `ease.swap` is the gentler symmetric 0.42, 0, 0.58, 1, for exchanges in place.

| Token | Value | Use |
|---|---|---|
| `settle` (expo out) | `0.16, 1, 0.3, 1` | Premium entrances, UI panels landing |
| `glide` (quint out) | `0.22, 1, 0.36, 1` | Camera moves, general default |
| `swap` (cubic in-out) | `0.65, 0, 0.35, 1` | Position swaps, crossfades with movement |
| `exit` (quint in) | `0.64, 0, 0.78, 0` | Things leaving frame |
| `pop` (back out) | `0.34, 1.56, 0.64, 1` | Playful accents only, used sparingly |
| `linear` | `0, 0, 1, 1` | Tickers, constant drift, marquees |

- [x] **Springs** as `{ stiffness, damping, mass }` presets: `springs.gentle`, `snappy`, `bouncy`, `heavy`.
  - `gentle`: slow, no overshoot.
  - `snappy`: fast, slight overshoot.
  - `bouncy`: playful.
  - `heavy`: device models and large objects.
- [x] **Durations** as frame counts at 30 and 60 fps: `xs` 6f, `s` 12f, `m` 18f, `l` 30f, `xl` 48f (at 30 fps). There is also a `beat` duration derived from the BPM. Done: `durations(fps)`, scaled to the frame rate; `durations(tempo(…))` adds `beat(n)`.
- [x] **Staggers:** `tight` 2f, `default` 4f, `loose` 8f, plus `onBeat` (one element per beat or half-beat). Done: `staggers(fps)`, with `onBeat` and `halfBeat` given a tempo. Words use `tight` (the kinetic-typography skill keeps a headline's stagger under 18 frames); `default` and `loose` space rows and cards.
- [x] **Motion personalities** bundle an easing family, spring and stagger, and each video picks one. Done: `motion("premium" | "energetic" | "playful", t)` returns the curves, spring, durations, word `stagger` and element `step`.
  - `premium`: settle, glide, heavy.
  - `energetic`: snappy, tight, onBeat.
  - `playful`: pop, bouncy, loose.
- [x] **Gallery page:** an HTML file that animates every token side by side (a dot, a card, a text line, and a camera push). It is used to tune the values and as a visual reference for the agent's own reviews. Done as a video, `videos/motion-gallery`: easings, springs (with settle frames and a retarget), personalities, the Reveal presets, a camera push.

---

## B. Review loop (P0)

### B1. Seeing the output
- [x] `previewRender({ scale: 0.25, fps: 15 })` renders a fast draft. `render --preview` (960×540, 30 fps).
- [x] `contactSheet(render, beatSheet)` puts one frame per beat midpoint, plus the first and last frame of every transition, into a labelled grid image. Done as `sheet` (every N frames of a shot or range) and `board` (stills per shot at set points, plus an animatic).
- [x] `frameAt(t)` and `stripAround(t, ±n frames)` let the agent inspect a single transition closely. `still --frame`, and `sheet --from --to --every 1`.
- [x] A vision-model review prompt compares the contact sheet with the beat sheet and checks hierarchy, legibility, one focus per shot, and motion consistency. The motion-review skill.

### B2. Automated checks
- [x] **Text hold:** every text layer's on-screen time is at least `readingTime()`. Done in `pnpm launch check <id>`, on the rendered page: every text block on screen is measured every 0.1 s after camera zoom, opacity and clipping. The check also flags text under the minimum size.
- [x] **Safe zones** per aspect ratio (16:9, 9:16, 1:1, 4:5), including platform UI overlays for vertical video. Done: the title-safe margin scales to the short side, and in 9:16 `check` flags text under TikTok's, Reels' and Shorts' UI (`platform`; `checks.platforms` picks which). `clearArea(format)` gives the clear rect for layout. The zones are published estimates (sources in `engine/formats.ts`).
- [x] **Contrast:** measure the WCAG contrast ratio on rendered pixels behind each text box, checked at phone size. Done: the frame is captured with text and again with all text hidden, then glyph pixels are compared with the worst side of what is behind them.
- [x] **Loudness:** ffmpeg `ebur128` measurement. Target -14 LUFS integrated with a -1 dBTP true-peak ceiling for social, configurable per platform. Done on the source track, with the video's offset and volume. It gives the `volume` to reach the target, or says the track needs limiting when that gain would clip.
- [x] **Energy variance:** flag stretches longer than N seconds where the energy stays flat. Done as a visual check: stretches of 2 s or more where the picture's edges do not change (so the drifting gradient does not count as motion). Calibrated on a frozen layout (0.5 to 0.7) against a 3% drift (1.2 and up).
- [x] **Cut rhythm:** report cuts that are off-beat, and flag three or more consecutive shots with identical durations.
- [x] Output everything as one JSON report that the agent must resolve before a final render. `out/check.json`. `check` fails on errors and leaves warnings to judgement; `render` does not yet refuse to run without it.

---

## C. Audio assembly (P1)

### C1. SFX library
- [x] Folder layout plus `sfx/index.json` metadata. Done: a launch folder's `sfx/` (shared by its videos) over core's bundled starter pack, `packages/core/sfx/` (22 sounds generated with ElevenLabs, prompts in `generate.sh`, cut and levelled to -3 dBTP by `finish.mjs`). `pnpm launch sfx index` measures each file (duration, onset, `peakOffset`, loudness, true peak) and keeps the hand-written `category`, `tags`, `license`, `source` and `prompt`:

```json
{ "id": "whoosh", "file": "whoosh.mp3", "category": "whoosh", "tags": ["medium","move","transition"],
  "duration": 1.05, "onset": 0.01, "peakOffset": 0.38, "lufs": -15.5, "peak": -3,
  "license": "ElevenLabs, generated (see README.md)", "source": "…", "prompt": "…" }
```

- [x] **`peakOffset` is the key field.** It records where the transient or peak sits inside the file. Alignment places the peak on the frame, not the file start. Done: `align: "peak"` on an `sfx` entry puts the loudest 10 ms on the frame (measured on the clip itself, so trims still work); the index's `peakOffset` is for choosing a sound.
- [x] Categories: riser, whoosh, impact, sub-drop, ui, typing, shimmer, swell, reverse, stinger, logo, ambience. The starter pack fills all but stinger, logo and ambience (a sonic logo is made per product; see the logo-animation skill).
- [x] `placeSfx(id, { peakAt: frame, gainDb })` and `findSfx({ category, maxDuration, tags })`. Done as `{ src: "sfx:<id>", at, align: "peak", peak | gain }` on a shot, and `pnpm launch sfx find [text] --category --tags --max`.
- [x] Sources: Freesound (filter to CC0/CC-BY and record the attribution) and paid libraries. Record the licence for every file. Done as `license` and `source` per entry, listed by `licences` and warned about by `check` when missing. The starter pack is generated, not downloaded.

### C2. Mix chain (ffmpeg)
- [x] Assemble the music, SFX and VO stems. If VO exists, duck the music under it. Done in `mix`: `audio.voice` (one file or one per line, at frames); the music ducks -8 dB by default, down before the voice starts, pauses under `hold` bridged (`audio.duck`). Computed in the float mix rather than with `sidechaincompress`, so it looks ahead.
- [x] Add fades and a tail. Run a `loudnorm` two-pass to the target from B2. Done: `audio.fadeIn`, `audio.fadeOut`; the master gains to the target with the same ebur128 meter `check` uses, limits the true peak, and corrects itself (up to two more passes), which a two-pass `loudnorm` would have done less exactly.
- [x] Optional stem support: if the user exports stems from Suno, allow per-stem mutes, such as dropping the drums for the breath. Done: `audio.stems` with per-stem `volume` and `mute: [[from, to]]` in frames.

### C3. VO timing (P2, only when the user supplies VO)
- [ ] Forced alignment with WhisperX gives word timestamps, so kinetic type can land on spoken words. Not built: `levels` gives phrases and onsets, and words are placed by syllable inside a phrase (LAUNCH.md).

---

## D. 3D kit (P1)

### D1. Device models
- [ ] iPhone (current generation), a Pixel, and a MacBook with a **rigged hinge** (open, close, and angle as a single parameter). Not built as real hardware (licensing and trademarks). Built instead: the generic devices below.
- [x] Every screen has a named material slot with correct UVs. It accepts an image, video or HTML-rendered texture, with an emissive boost control and a separate glass reflection layer. Done for the generic devices: the screen is live DOM (as on `Panel`), `brightness`, and a cover-glass layer (`reflection`, `glare`) that reflects the stage's environment and lights.
- [ ] Model optimisation: a GLB with Draco/meshopt compression and a separate high-detail version for macro shots. Not needed for procedural devices; comes with real models.
- [x] A licence note per model. Check platform trademark rules for depicting real hardware. Also keep one **generic device** as a clean fallback that ages better. Done: `Phone`, `Tablet` and `Laptop` (with `open`/`angle` on a hinge) in `@intentface-launch/three`, procedural, no real product's likeness, no licence needed.

### D2. Lighting and environment
- [x] A studio HDRI set (Poly Haven has CC0 options): soft box, dark studio, and bright seamless. Done as `environment` presets `dark`, `softbox`, `seamless` (built from soft boxes, so nothing to license), plus `url` for any `.hdr`/`.exr`; tested with Poly Haven's `studio_small_09`. `rotation` animates the reflections.
- [x] A **light-sweep rig**: an animatable strip light that runs across the product, with a speed that follows motion tokens. `sweep({ from, to, at, duration, easing })`.
- [x] Rim and edge light presets, a three-point preset, and a shadow catcher floor. `rimLight`, `threePoint`, `keyLight`, and `<Floor shadow reflect>`: shadows soft by the size of the soft box (a different point on the light each sample), and a glossy reflection that blurs with distance (a different floor tilt each sample).

### D3. Camera rigs
- [x] Parameterised camera moves: orbit, push-in, pull-back, dolly-through, turntable, macro slide, and top-down drop. Every move takes a motion token. `rig(keys)` over framings (target, distance in log space, elevation, azimuth, fov, roll, blur by effect), and `orbitMove`, `pushIn`, `pullBack`, `dollyThrough`, `turntable`, `macroSlide`, `topDown`, `sequence`.
- [x] `lookAt` targets with smoothing, plus an optional handheld noise layer that can be turned on or off. `follow(point, frames)` and `rig(keys, { lag })`; `handheld(lens, { amount, speed, seed })`. Both pure functions of the frame.

### D4. Materials
- [x] Physical glass (transmission), brushed aluminium, anodised colours, matte plastic, and **frosted UI panels** (glass with blur behind). `surfaces.*` for `<Panel body>`; glass refracts the stage's `backdrop` (DOM painted inside the scene). Panels also blend translucent UI the way the browser does (sRGB), so 5% white stays a 5% wash.

### D5. Post stack
- [x] pmndrs `postprocessing` with bloom, vignette, subtle chromatic aberration, and LUT colour grading. Built into the stage's output pass instead (`post={{ bloom, vignette, aberration, grade, lut }}`), after the samples are averaged; `.cube` LUTs load through three's loader. Depth of field and grain are in the stage too (below); plain three.js, not react-three-fiber.
- [x] **Depth of field with real bokeh:** `Stage3D` (`@intentface-launch/three`) averages renders through points across a thin-lens aperture, so bokeh and occlusion are physically correct. Aperture is set from the blur wanted in pixels (`apertureFor`).
- [x] **Real motion blur via sub-frame accumulation:** render N sub-frames per frame and average them, with a shutter-angle parameter (180° by default). This is the biggest fix for footage looking cheap. Done in `Stage3D` (in-GPU, same samples as the lens) and for DOM layers with `<MotionBlur>`.
- [x] A small LUT library: neutral, warm, cool, and a high-contrast premium grade. As parameter grades (`grades.neutral`, `warm`, `cool`, `premium`: contrast, saturation, white balance, lift, gain), plus any `.cube`.

### D6. UI in 3D space
- [x] `uiPlane(source)` maps a screenshot, video or rendered HTML onto a plane with rounded corners, shadow and thickness. Done as `<Panel>`: live DOM (a `Snapshot` of the product, or its real components) through Chrome's HTML-in-Canvas, mipmapped, with a lit lip and no shadow (brand rule). `api.isolate()`/`api.hide()` split one UI into layers.
- [x] Layouts: stacked panels, fanned deck, floating grid, and an exploded view with z-separation. `stack`, `fan`, `grid` (with `curve`), `exploded`, animated with `mixPose`. `pnpm launch marks` measures parts of a saved snapshot (rows, pills) so each can be its own panel without recapturing.

---

## E. 2D, SVG and shaders (P1)

### E1. Shader library (GLSL with uniforms driven by the timeline)
- [x] Animated mesh gradients, noise fields, film grain, glow, light leaks, dither, and scanline/halftone. Done: `<Shader frag uniforms>` (WebGL, painted synchronously per frame, context released on unmount) with `shaderPrelude` (noise, fbm, sRGB, dither helpers), and `MeshGradient`, `NoiseField`, `FilmGrain`, `LightGlow`, `LightLeak`, `Dither`, `Scanlines`, `Halftone`.
- [x] Transition shaders: displacement dissolve, luma wipe, radial wipe, and chromatic split. Done as SVG filter and CSS mask transitions instead (`transitions.displace`, `luma`, `clock`, `chromatic`): a shader cannot read the DOM shots it would transition between.
- [x] Every shader exposes `progress` (0–1) and `seed`, so a video renders the same way each time. `u_progress`, `u_seed`, `u_time`, `u_frame`, `u_resolution`.

### E2. SVG toolkit
- [x] Path draw-on (stroke-dash) with a motion token. `DrawOn` (`pathLength` 1, trim `from`/`to`, `trail`), and `dash()` for any shape.
- [x] Shape morphing (flubber-style path interpolation). `morphPath(a, b, t)` and `Morph` (several paths at frames): resampled, start point and winding matched, cached. Single closed shapes.
- [x] Filters: turbulence displacement, gooey merge, glow, and blur-in. `Displace` (seeded, `boil`), `Goo`, `Glow`, `BlurIn`, each with its `…Filter` defs.
- [x] Mask and clip helpers. `MaskReveal` (wipe, circle, clock, rect or any path), and `wipeMask`, `circleMask`, `clockMask` in `transitions`.

### E3. Transition library
- [x] Mask wipe, shape and circle reveal, zoom-through (push into an element that becomes the next scene), whip-pan blur, and a light-sweep transition. `transitions.wipe`, `iris`, `shape`, `clock`, `zoomInto`, `whip`, `sweep`, plus `displace`, `luma`, `chromatic` and `honest`. Transitions can draw an `overlay` above both shots (light, SVG filter defs).
- [x] **Match-cut helper:** carries the position, scale and velocity of an element in shot A into the matching element in shot B. `transitions.matchCut({ from, to, velocity })`, settling on `springTo`; as a transition, or `cut.at(frame)` on the element's layer alone.
- [x] Every transition is defined as `(outgoing, incoming, progress, token)`. As `{ frames, style(p, frame), overlay?, easing }`: each factory takes its frames and an `easing`.

### E4. Kinetic typography
- [x] Text splitting into lines, words and characters, with measurement. `splitText`, `revealTimes`, and `useFontsReady` / `useMeasureText` (measured once the font has loaded).
- [x] Reveal presets: masked line rise, per-character stagger, word-by-word on beats, blur-in, scale settle, and variable-font axis animation. `Reveal` with `mask`, `by="char"`, `times`, `blur`, `scale`, `axes`.
- [x] Every text layer calls `readingTime()` automatically to get its hold. `<Reveal exit="read">`, and `check` measures every text on screen against it.
- [ ] A licensed font set with a small type-scale token file. Not built: a video takes its type from the product (`useProductLook`) or from a brand add-on.

### E5. UI demo kit (the most important kit for SaaS launches)
- [ ] **Capture:** Playwright at 3× device-pixel ratio, with clean-state scripts (sample data, notifications off). Also import frames and assets from Figma. Done except the Figma import (`captures/*.capture.ts`, frame-stepped, with `Snapshot` for vectors).
- [x] **Cursor component:** bezier paths, deceleration into targets, `hover` (arrive, rest, press in, click), a click state, `hidden` (or hidden ranges), and `cursorSounds(keys, sound)` for the click sounds from the same keys.
- [x] **Focus tools:** spotlight/dim, isolate-and-lift, focus zoom, and callout label with leader line. `Spotlight`, `Lift`, `Callout`, `Focus`; focus zoom is a `Camera` key on a rect.
- [x] **UI extras:** keyboard shortcut chip, typing simulation with realistic cadence, and a skeleton-to-content load. `KeyChip`, `Typewriter cadence` / `typingCadence` (whose times also build the keystroke `sfx`), `Skeleton`.
- [x] **Honest-cut helper:** inserts a dissolve when the edit compresses time. `transitions.honest()`.

### E6. Data and proof visuals
- [x] Number ticker or counter, bar and line grow, before/after split, and speed comparison (side-by-side with timer). `Count`, `Bars`, `LineChart`, `BeforeAfter`, `SpeedRace`.

---

## F. Generation and assets (P2)

- [ ] **Image generation endpoint** (Gemini, or a self-hostable open model for EU-only projects). Use it for backgrounds, textures and styleframe exploration, not for UI. Not built.
- [ ] **Asset cleanup:** background removal, upscaling, and colour-match to palette. Not built.
- [x] **Brand kit loader:** reads `brand.json` (logo files, colour tokens, fonts, motion personality, sonic logo, do/don't rules) and applies it globally. Done as brand add-ons (`pnpm launch add <brand>`: tokens, fonts, logos, checks and a LAUNCH.md), and `useProductLook` for a product's own look.

---

## G. Delivery (P2)

- [x] **Multi-aspect layouts:** each scene declares how it reflows for 16:9, 9:16, 1:1 and 4:5, rather than relying on cropping. `formats` on the video, `useVideoInfo().format` in scenes, `clearArea()`, `--format` on render, still, sheet and check, and format tabs in the studio.
- [x] **Captions:** SRT/VTT export and burn-in, with cues timed by `readingTime()`, a 42-character line cap and a two-line maximum. `captions` on the video, `pnpm launch captions`, written by `render` too; `burnCaptions` draws them in frame.
- [x] **End-card templates:** logo, claim line, CTA and URL, with the sonic logo hit placed on a downbeat. `EndCard` (`hit` on a downbeat from `beatGrid().snap(…, { grid: "downbeat" })`).
- [x] **Licence manifest:** every model, HDRI, font, SFX and track used, plus its licence. Generated automatically per render. `out/licences.json` from `render` and `pnpm launch licences`; `check` warns about files with none recorded.
- [ ] **Reference library:** 10–20 annotated launch films written in the beat-sheet schema, used as few-shot examples for concept and pacing. Not built: research and writing, not code.

---

## Suggested build order

1. A4 `readingTime` and A5 motion tokens with the gallery page. These are small, used everywhere, and quick to build.
2. A1 `getBeats`, A2 beat math, and A3 `musicBrief`. Together they close the Suno loop.
3. B1 contact sheets and B2 checks. After this the agent can review its own work.
4. C1 the SFX index with `peakOffset`, and C2 the mix chain.
5. E5 the UI demo kit, E4 kinetic type, and E3 transitions.
6. D1–D6 the 3D kit, starting with one device, the light sweep, and motion blur.
7. E1/E2 shaders and SVG, and F/G as projects need them.
