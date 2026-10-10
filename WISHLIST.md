# Wishlist

Tools that would have made the work faster, easier or cheaper in tokens, written down when the lack was felt. Each entry says what happened, what would have helped, and roughly what it would save. When one is built, delete its entry and mention it in the relevant skill or LAUNCH.md.

## After 0.1

Additive: each can arrive in a minor release without breaking a video. (The items that had to come first, because they set a default or a shape people depend on, are built: `sfx` mixed by `render`, frame names and grids for stills, `Clip`, capture secrets, the screen-sized cursor, and check's contrast by size and per-check counts.)

### Hearing the audio

Agents cannot listen. Everything about a track reaches them as numbers, so the numbers need to answer the questions a sound designer would.

- **Trusted pitch and key in `sound`.** (`sound` is built: events, band onsets, centroid, loudness, spectrogram. It also prints a key and the note of each boom, but these are unverified estimates: on the Intentface sting it says C major (0.94) where librosa's chroma says F major, weakly (0.64), and the brief said F major; on the events music both say C minor.) Wanted: test both against tracks with a known key and known hit pitches, and only then let skills tell agents to retune effects to them. Deferred because nothing yet depends on it; until then, treat the key line as a hint.

### Looking at frames

- **The brand's static lockup as a `matches` reference.** (Partly built: a shot's `matches: { at, reference }` makes `check` render the held frame and the reference alone and fail on a difference, and `checks.match.tolerance` lets a brand tighten it. Tested on a synthetic lockup only.) Still wanted, in the brand's repo (intentface-com-v3): `@intentface/brand` exporting its static lockup as a component placed by position and size (`<Lockup x y width />`), used both as the end card's final state and as its `matches` reference, and its LAUNCH.md telling videos to do so. Then a first real end card checked against it, to see whether 0.1% at 16 levels is the right tolerance for an anti-aliased wordmark over a moving `Atmosphere`.

### 3D light (`@intentface-launch/three`)

The light module has `Beam`, `Wave`, `Ring`, `Glow`, `Cone`, `Prism`, `Smear`, the `<Light.*>` components, `useStageItem`, and halation and ghosts in `post` (see LAUNCH.md). What it still lacks:

- **Caustics** (deferred): light focused by rippled glass or water into a net of filaments on a surface. A prototype works and looks right in stills (a dense grid moved by the ripples' gradient, brightness 1 / |det J| from their exact second derivatives, spectral bands for rainbow edges; about 250 lines, kept in this repo's git-ignored `videos/_light-lab/caustic-prototype.ts.txt`). Left out of the package until a video needs it: no launch video has asked for water light yet, and every export is API to keep.

### Checks

- **`render --check` reusing the frames it just rendered** (deferred). Built: `check` draws 3D stages at 8 samples by default (`--samples N`), and a stage presents its summed samples again for later screenshots of the same frame instead of redrawing them (check's text-hidden contrast shot and thumbnails). On a 2 s 3D test, check went from 75 s (96 samples, every screenshot redrawn) to 39 s at 96 samples and 7 s at the default 8. Not built: reading the stillness thumbnails from the rendered mp4. With draft samples the sampling pass is cheap, and thumbnails decoded from x264 would need the stillness threshold (calibrated on screenshots) measured again. Worth it only if a long 3D check is still slow at 8 samples.

### Sketching from the product

- **A sketch shot in one line.** Every sketch shot is the same scaffolding: a `Camera` on marks over the snapshot for each state, switched on the click frame, a `Cursor` on the same marks, the copy at a position. Wanted: `<SketchShot capture states={[{ at, snapshot }]} camera={[…marks]} clicks={[…]} />` in the kit, so a whole sketch is a list of rows and revising the script after a board review is editing data. Unproven until a few sketches have been built by hand; build it when the second product's sketch repeats the first's code.
