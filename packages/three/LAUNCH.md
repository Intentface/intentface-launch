# 3D (@intentface-launch/three)

`import { Stage3D, Panel, Overlay3D, Phone, Laptop, Floor, rig, project, surfaces, sweep, threePoint, fan, mixPose, PostFX, usePostEffect, … } from "@intentface-launch/three"`

For UI reveals in space: parts of the product's UI landing in place on panels, glass and soft light across them, a real camera with shallow depth of field. Use 3D for transitions and moments of awe; go flat when the viewer has to read.

## The stage

- **`<Stage3D lens={(f) => Lens} …>`** renders like a film camera. Each frame averages `samples` (96) renders taken through different points of a real lens aperture (depth of field with true bokeh and correct occlusion), at different moments of an open shutter (`shutter={{ when: [[from, to]] }}` for motion blur), and at sub-pixel offsets (anti-aliasing), summed in 32-bit float. The studio previews with `preview` (8) samples, so bokeh looks stepped there; stills and renders are smooth. Drop `samples` to 48 or 64 on shots without strong blur.
- **World units are CSS pixels**, y up, origin at the centre. `fillDistance(height, fov)` is the camera distance at which something `height` tall fills the frame.
- **`backdrop={<Atmosphere …/>}`** paints DOM behind the scene, inside it: glass refracts and blurs it. A layer behind a transparent stage cannot be seen through glass. `background` is a flat fill.

## Camera (`rig`)

- **Samples follow the blur, and they are the cost.** A 3D frame costs about 0.1 s up to 32 samples, then about 2 ms per sample (0.5 s at 256). `samplesForBlur(px)` gives what a blur needs, about (px / 5)²: 80 px needs 256, 40 px 64, a sharp frame 24. `samples` takes a function of the frame, so a shot pays for heavy bokeh only while it has it: `samples={(f) => samplesForBlur(blurAt(f))}` with the same curve that drives the lens. On stills, judge bokeh at full samples, never at `--samples 8`.
- **A key in the middle of a move stops it.** Each key's `easing` shapes the move into it, and the next move starts from rest on `ease.inOut`. For one flowing move with focus changing on the way, compose the lens: `(f) => frame({ ...framingAt(keys, f), blur: { px: myCurve(f), depth } })`.
- `rig(keys, { handheld, lag })` interpolates framings: `{ at, target, distance, elevation, azimuth, fov, roll, blur | aperture, easing }`. Distance moves in log space; `easing` shapes the move arriving at that key (default `ease.inOut`).
- `elevation` 90 is straight on to the UI; `azimuth` 0 looks from below (a tabletop shot up the UI's length), 180 from above. For panels standing on a `<Floor>`, use azimuth near 180 so the camera is above the floor.
- `blur: { px, depth }` sets depth of field by effect: a point `depth` behind the focus plane blurs into a `px` disk at 1080p. Long lenses (`fov` 20 to 30) flatten UI nicely.
- Named moves, each two keys: `pushIn`, `pullBack`, `orbitMove`, `turntable`, `macroSlide`, `topDown`, `dollyThrough`; `sequence` chains lens functions. `handheld(lens, { amount })` adds seeded operator sway (1 steady, 2 to 3 on the move); `follow(point, frames)` is a lagging look-at.

## Panels

- **`<Panel region={mark.rect} pose={(f) => Pose} …>{<Snapshot …/>}</Panel>`** puts live DOM on a slab: `radius` to match the UI's corners, `depth` for thickness (0 is a flat layer with no edges), `resolution` texture pixels per CSS pixel (raise for close-ups), `surface` fill behind translucent UI (`null` for layers). `pose` returns `{ position, rotation (degrees), scale, opacity }`; it is called at fractional frames. `centerOf(rect, w, h)` places a region panel where it sits in the UI.
- **`body={surfaces.frosted()}`** makes the slab frosted glass: the product's translucent card in 3D, blurring the backdrop. Isolate the card (`api.isolate("aside")`) so the page behind it does not come along. Also `glass`, `aluminium`, `anodised`, `matte`, `plastic`, `gloss`.
- Translucent UI is blended as the browser does it (sRGB), over `over` (default black). Without that, 5% white reads as 25% grey.
- **Layers that assemble:** give the base panel a snapshot with `animate={(api) => api.hide(el)}`, the part its own flat panel with `api.isolate(el)`, and land it just on the base's face: a slab's face is at z = depth / 2, so a layer on a 14-deep panel lands at z ≈ 7.5, not 0 (inside glass it disappears).
- **Rows, cards, pills as their own panels:** `<Panel snapshot={{ capture, name, animate }} select="aside ul > li:nth-child(3)" pose={(f, region) => ({ position: centerOf(region, w, h) })}>` measures its region in the snapshot when it loads (no marks step, and it follows a recapture), shows that snapshot, and hands the measured region to `pose`. `measureSnapshot(capture, name, selector)` (core kit) gives the same rect anywhere. `pnpm launch marks <id> <capture> <snapshot> --select "<css>" --name row` still writes marks when the rects are needed outside a panel.
- **Layouts:** `stack`, `fan`, `grid`, `exploded` give the pose of panel `i` of `n`; animate between them with `mixPose(a, b, t)`, staggered by index.

## Devices

- **`<Phone>`, `<Tablet>`, `<Laptop>`** are generic hardware whose screen is live DOM, as on a `Panel`: children are laid out at `screen` (390×844, 820×1180, 1440×900 by default) or at `region`'s size. Procedural, with no real product's likeness or marks, so they need no licence and do not date.
- `brightness` turns the screen up (above 1 it blooms); `lit` 0 (default) keeps the UI's exact colours. `reflection` (0.25) and `glare` set a separate cover-glass layer that reflects the stage's `environment` and `lights`: animate the environment's `rotation`, or a `sweep`, to run a highlight across the glass.
- Bodies take `surfaces`: `body` (and `back` on phone and tablet). Metal only reflects, so a silver body reads as grey in a dark studio: give it a bright environment (`seamless`, or a stronger `softbox`) or a sweep.
- **`<Laptop open={(f) => …}>`** opens on its hinge (0 to 1 of `maxAngle`, 110°), or `angle` in degrees, evaluated per sample, so the lid blurs with the shutter. Its origin is the middle of the base's underside: pose `position: [0, floorY, 0]` to stand it on a `<Floor>`. The screen stands at the back hinge, about 900 units behind that origin when open, so focus there (a rig `target` at the screen's z), not at the laptop's position, or the screen is the softest thing in frame.
- Phone and tablet are centred with the screen facing +z. Turn them with `pose` rotation; the `turntable` rig orbits the other axis.
- **A family shot** (one output on several platforms) that worked: laptop at x 0, the tablet at scale 0.82 about 1120 to its left turned 14°, the phone at 0.86 about 1030 to its right turned −16°, all three screens within about 100 units of one depth (the laptop's screen is at its back hinge, so the tablet and phone stand back to meet it). Phone and tablet stand at `floorY + half height × scale`. `fov` 26, the rig focused at the screens' depth with `blur` about 4 px, `environment` softbox at 0.7 so the metal reads, and a `<Floor reflect={0.12} roughness={0.03} fade={[300, 1300]}>` mirror. Frame it large (`fillDistance` about 2100 at `fov` 26) and bring it in from below: the rig starts with its target about 1100 units higher and eases down onto the family over 50 frames. Open the lid on a spring once it is in view, and wake the other screens from black a few frames apart.

## Light as the subject (`Beam`, `Ring`, `Glow`, `Cone`, `Prism`, `Smear`)

Beams, rings, cones and points of light that add into the stage's float sum. They bloom, blur with the lens and streak with the shutter like real light. On a black `background` they are the whole picture (as in a logo sting); on a transparent stage they do not show, so give light-only shots `background="#000"`.

For a few lights, use the components: each takes its class's colour options as props and `pose`, a pose or a function of the (fractional) frame, called once per sample:

```tsx
<Light.Beam color="#fff" pose={(f) => ({ from: [-900, 0, 0], direction: [1, 0, 0], end: f * 12, width: 6 })} />
<Light.Prism pose={{ center: [0, 0, 0], size: 420, dispersion: 4, beam: { from: [-1200, -260, 0], direction: [1, 0.36, 0], width: 7 } }} />
```

`Light.Beam`, `Light.Ring`, `Light.Wave`, `Light.Glow`, `Light.Cone`, `Light.Smear`, `Light.Prism`. For dozens or hundreds of lights (a logo's streams), build the classes once in one stage item and pose them from the frame:

```tsx
function Streams() {
  useStageItem(() => {
    const beam = new Beam({ gradient, spectrum: ["#74E6FF", "#FE9EFF", "#FFDC74"] });
    return { object: beam.object, update: (t) => beam.pose({ from: [0, 0, 0], direction: [1, 0.4, 0], end: 600, width: 4, spread: 2 }) };
  });
  return null;
}
```

- **`Beam.pose({ from, direction, start, end, width, gain, hard, taper, streak, spread, spectrumMix, iris })`** draws a camera-facing ribbon.
  - `hard` 0 is soft light: a gaussian core plus a faint volumetric halo, fading at both ends. `hard` 1 is a crisp stroke exactly `width` wide, for landing on a logo's strokes.
  - `taper` falls off away from the source. Pose from the head backwards for a pulse that fades behind it. `streak` 1 is soft at both ends, for light in flight.
  - With `spectrum`, the beam splits into one sub-beam per colour, fanned `spread` degrees apart around `spreadAxis`: light through a prism. `spectrumMix` 0 recombines them into the gradient. The gain is shared between sub-beams.
- **Colour:** `color`, or a `gradient` laid over the world's xy plane (`{ from, to, stops }`, as an SVG `userSpaceOnUse` gradient). Light that falls on a logo's plane then carries exactly the logo's colours. `iris` shifts the colour with depth, for iridescence off the plane.
- **`Ring.pose({ center, normal, radius, tube, squash, soft, gain })`**: echoes on a surface, a rim. Flattened with `squash` and seen edge-on, it is a straight bar. `soft` 0 (default) is a hard torus; 1 is a glowing tube, a gaussian across its width that fades out by 2.5 `tube` from the centre line.
- **`Wave.pose({ center, normal, radius, width, trail, gain })`**: a soft wave of light spreading over a surface, with a blurred front and a long trail, where a `Ring` is a crisp line. Move `center` along the normal as it grows and it travels off the surface, through the focal plane, into bokeh; it reads as the lens reacting to the light. Keep the gain low (0.1 to 0.2): big soft waves wash the frame quickly.
- **`Glow.pose({ at, size, gain })`**: a soft point. Keep it small; under depth of field a large one renders as a grey disk.
- **`Cone.pose({ from, direction, start, end, radius, angle, gain, soft, falloff, fade, haze, hazeScale, hazeOffset })`**: a cone of light through haze (a spotlight, sun through a window, the white beam going into a prism). A real volume, marched per pixel: brighter where the eye looks through more of it, dimmer as it spreads (`falloff` 1, as real light does; 0 keeps it even), fading over the last `fade` of its length. `angle` is the full opening in degrees (0 is a parallel shaft), `radius` the aperture at `from`. `gain` is the brightness seen across it where it is narrowest. `haze` 0.2 to 0.4 makes the air faintly uneven, like smoke (above 0.6 it turns to beads of light); animate `hazeOffset` slowly with the frame so it drifts. It works with the camera inside it.
- **`Prism.pose({ center, rotation, size, apex, length, glass, dispersion, beam, reach, wall, inside, glints, reflection, edges })`** splits `beam` (`{ from, direction, width, gain }`) by real refraction: Snell's law at each face with each wavelength's own index (Cauchy: `glasses.bk7`, `flint` (default), `denseFlint`, `diamond`, `water`, or `{ A, B }`), Fresnel losses, the faint reflection off the first face, total internal reflection, and the beam's width changing as it bends. Out comes a fan of beams in spectral colours that adds back up to white.
  - Real glass spreads the spectrum by a degree or two; `dispersion` 3 to 5 makes it wide enough to read (it scales B about the d line, so the mean bend stays). Too much with dense flint and the violet end reflects inside the glass and leaves through another face, as it would.
  - Aim for minimum deviation: the beam meets the first face at about asin(n · sin(apex / 2)) from its normal (about 54° for flint, 63° for dense flint). Steeper and the spectrum narrows; much flatter and it reflects inside.
  - The prism traces as many wavelengths as it needs for neighbouring rays to overlap, so the fan never striates. `pose` returns where the light went (`entry`, and per band `exit`, `direction`, `hit`), to place other things on it. `onTrace` on `<Light.Prism>` gives the same.
  - `wall: { point, normal, gain }` stops the rays on a surface and lights it as a smear, where they really land. A smear is as thick as the beam and as long as the spectrum has spread, so it is dim (the light is spread out): raise its `gain` 2 to 3.
  - Clear glass is invisible on black: only the glints where light crosses its faces show. `edges` 0.1 to 0.2 draws its edges faintly.
- **`Smear.pose({ center, normal, along, length, width, stretch, soft, gain })`**: a spectrum landed on a surface. Each wavelength is a soft image `width` across, from violet to red over `length`; short, the middle overlaps into white with coloured edges (a prism photograph); long, it is a pure rainbow. `stretch` elongates each image along `along`, for light landing at a slant.
- **Spectral colour:** `wavelengthToLinear(nm)` and `spectrumBands(count)` (bands that add up to white) for light of your own; `Beam.setLinearColor(rgb)` colours a beam in linear light.
- **`useStageItem(build)`** registers any three.js object with the stage. `build` returns `{ object, update(t) }`, and the stage calls `update` once per sample, at fractional frames.
- **Mood:** calm light reads better than sparks.
  - Keep gains around 1, and bloom soft and wide (`{ strength: 0.45, threshold: 0.35, radius: 1 }`).
  - Add faint ambient haze: large, dim `Glow`s in the palette, one near the source and one far behind. Light with no air around it looks flat.
  - Use a wide lens up close (fov around 60) and shallow depth of field (`blur` 80 to 120 px while nothing must be read).
  - A beam passing close to the camera needs `samples` 192 to 256 and a wide, soft profile. A thin core in a huge blur disk shows as separate striations.
- **Handing off to a flat logo:** seen straight on from `fillDistance(1080, fov) / zoom`, one world unit is `zoom` pixels, so an SVG layer can take over pixel for pixel (logo-animation skill).

## DOM over 3D

- **`<Overlay3D at={[x, y, z]}>`** pins DOM to a world point through the stage's camera, every frame (fractional ones too): a label that follows a panel's corner through a camera move. It paints as ordinary DOM above the stage, so its text stays sharp and `check` measures it. `at` can be a function of the frame; `anchor` ([0.5, 0.5]) is which point of the DOM sits on it; `scale` sizes it with distance (`true`: one CSS pixel is one world unit there). Inside `Stage3D` it uses the stage's lens; beside one, pass the same `lens`. A point on a turning panel has to turn with it: rotate it with the panel's pose.
- **`project(lens, point, [width, height])`** gives the screen pixel `{ x, y, depth, scale, visible }` of a world point (the stage's maths, without aperture and jitter); `pixelsPerUnit(lens)` the scale on the plane in focus. Use them to hand a 3D shot off to flat DOM: put the flat layer where `project` says, at `scale`.

## Handing a slab off to flat UI

- A `Panel`'s face sits at z = depth / 2. To land straight on at one unit per pixel (`fillDistance(1080, fov)`) with the face exactly where the flat DOM lays out, pose the panel at z = −depth / 2.
- Even then, the texture is not the browser's own raster: text reads a touch heavier, and the face picks up the environment. Land the camera 10 to 20 frames before the cut, then dissolve the same DOM in flat over the stage (on the shot's own ground, so the slab's lit edge goes with it). The cut to a flat shot is then pixel-identical; `diff <id> --frame <shot>:end --against <next>` should say "identical".

## One stage across a cut

- **`continues: "ask"`** on the next shot runs it on the clock of shot "ask" (core), so the same scene component carries on across the cut: camera, lights, handheld sway and a drifting `backdrop` do not jump. Render the same component in both shots and change what differs by frame; check with `still --at ask:end,next:+0 --grid`.

## Drafts and debugging

- `still` and `sheet` take `--samples 8`: every stage drawn at 8 samples (a frame of the test stage took 0.15 s instead of 1 s), for composition. `check` draws stages at 8 samples by default.
- `still <id> --at shot:+30 --stage-debug` writes the frame beside the stage's passes: one sample without post, what glass sees (the transmission buffer), the floor's reflection, alpha (backdrop and floor off), and the backdrop. Use it when glass reads grey, a layer is missing or a reflection looks wrong, before guessing.

## Cutting to and from a stage

- **Cut straight into and out of a `Stage3D` shot, or dissolve with opacity only (`transitions.fade`).** A blur or zoom transition puts a CSS filter over the stage's canvas, and under several render workers Chromium stops delivering screenshots of those frames; retries stall on the same frame. For a move through the scene into the next shot, push the camera in with the shutter open and fade on the last few frames.

## Light, floor, finish

- `lights={(f) => SoftBox[]}` (or `light` for one): `threePoint(target)`, `rimLight(target)`, `keyLight(target)`, and `sweep({ from, to, at, duration })` for a strip light that runs over glossy faces and edges.
- `environment`: a strength, or `{ preset: "dark" | "softbox" | "seamless", url, intensity, rotation }`, or a function of the frame (animate `rotation` to run reflections across the product). `url` takes an equirectangular `.hdr`/`.exr` (Poly Haven studios are CC0) from the launch folder.
- **`<Floor y reflect roughness shadow fade />`** is a ground plane that is otherwise invisible: a glossy reflection that blurs with distance, and shadows as soft as the lights are large. Brands may rule out shadows. Under screens showing UI, keep `roughness` near 0.03 and the `fade` short (300 to 1300): above about 0.1 the blur smears small text into vertical streaks.
- `post={{ bloom, vignette, aberration, grade, lut }}`: bloom on highlights above `threshold`, a lens vignette, corner colour fringing, a grade (`neutral`, `warm`, `cool`, `premium` or your own) and a `.cube` LUT. All off by default, so the UI's colours stay exact.
- Lens effects from the frame's own light, instead of faking them with waves: `halation` (a warm, tight glow that bright light bleeds into, as on film; 0.3 subtle, 0.6 a look; `{ strength, threshold, radius, color }`) and `ghosts` (reflections between lens elements: tinted discs mirrored through the centre of frame from wherever bright light is, and a thin ring; they move as the light moves; `{ strength, threshold, count, ring, ringRadius, dispersion }`). Keep ghosts faint (0.2 to 0.4): every bright source makes its own set, and on a light-only shot that adds up fast.
- **UI textures need Chrome's HTML-in-Canvas.** The CLI's browser has it; in the studio, enable chrome://flags/#canvas-draw-element or panels show untextured.

## Post effects (postprocessing)

pmndrs' postprocessing library (`import { BloomEffect, GlitchEffect, … } from "postprocessing"`, installed with this add-on) on the video's clock, on a stage or on any flat DOM.

```tsx
const glitch = usePostEffect(() => new GlitchEffect());
const noise = usePostEffect(() => new NoiseEffect({ blendFunction: BlendFunction.OVERLAY }));
glitch.mode = frame >= 60 && frame < 80 ? GlitchMode.CONSTANT_WILD : GlitchMode.DISABLED;
noise.blendMode.opacity.value = interpolate(frame, [0, 120], [0.1, 0.4]);

<PostFX effects={[glitch, noise]}>{/* any DOM: a Snapshot, type, a whole shot */}</PostFX>
<Stage3D post={{ effects: [glitch, noise], vignette: 0.3 }} …>
```

- **`usePostEffect(() => new XEffect(…))`** builds an effect once per mount, with `Math.random` seeded, and disposes it with the shot. Set its values in the render from the frame, as above: never from its own timers.
- **`<PostFX effects>`** draws its children into a texture through HTML-in-Canvas, runs the effects and shows the result; with no effects it matches the DOM to within one level. In the studio without the flag it shows the children without effects.
- **`post.effects` on a `Stage3D`** runs on the averaged samples, before the stage's own finishing (bloom, grade, LUT, grain).
- **Time is set, not accumulated.** Every pass renders at the frame's time with a delta of 0, and each effect's updates draw from a random stream seeded by the frame, so any frame renders alone, in any order, the same every time (tested with glitch, bloom, noise, aberration, pixelation, vignette). Effects that keep their own clock need it driven from the frame: `GlitchEffect`'s `SPORADIC` mode never fires, so switch `mode` between `DISABLED` and `CONSTANT_MILD` or `CONSTANT_WILD` by frame.
- **Effects that need depth are refused**: `DepthOfFieldEffect`, `BokehEffect`, `RealisticBokehEffect`, `SSAOEffect`, `DepthEffect`, `GodRaysEffect`, `SelectiveBloomEffect`, `SMAAEffect`. A finished frame has no depth; the stage's lens already gives real depth of field and its samples anti-alias. Effects placed in the world (`ShockWaveEffect`, `OutlineEffect`) need a camera and scene these layers do not expose.
- The effects merge into as few passes as postprocessing allows, in the order given. Each `PostFX` is a WebGL context: keep a few per shot.

