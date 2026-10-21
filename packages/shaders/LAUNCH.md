# Shader effects (@intentface-launch/shaders)

`import { Shaders, useShapes, usePictures, textPicture, clipTexture, shift, LiquidMetal, PaperShader } from "@intentface-launch/shaders"`

The 200 WebGPU components of the Shaders library (shaders.com, MIT): gradients, noise, light, glass, metal, distortions, blurs, wipes, particles, fluids; and Paper's shaders (shaders.paper.design, Apache-2.0: liquid metal, mesh and grain gradients, dithering, halftones, fluted glass). Use them for backdrops, transitions and texture around the product, for type made of glass, chrome or plasma, and for UI materials (a liquid-metal button). The product's UI stays in `Snapshot`s.

## The layer

```tsx
<Shaders
  components={(f) => [
    { type: "SolidColor", props: { color: "#05060f" } },
    { type: "Aurora", props: { colorA: "#3df5b0", colorB: "#4f6bff", colorC: "#c04bff" } },
    { type: "Glass", props: { shape: { type: "circleSDF", radius: 0.3 }, center: { x: 0.3 + 0.4 * (f / 180), y: 0.5 } } },
  ]}
/>
```

- `components` is the tree as the library's vanilla API takes it: `{ type, props, children, id }`, first at the bottom. Effects ("needs input" in the catalogue) apply to the layers before them, or to their `children`. A function of the frame animates props; it is called at fractional frames too.
- It fills its parent at the video's size (`width`, `height` to change it); `resolution` 0.5 halves the drawing buffer for soft fields.
- The catalogue and every prop: the library's own skill (`skills/shaders/components.md` in github.com/shader-effects-inc/shaders) and `https://shaders.com/docs/components/<Name>` (send `Accept: text/markdown`). Its `<Shader>` JSX maps one to one: `<Aurora colorA="#…" />` is `{ type: "Aurora", props: { colorA: "#…" } }`. Ignore its setup steps (`npx shaders connect`, presets, the editor): this package brings the library.
- Each component's own `speed` sets how fast it moves; time comes from the frame.
- Any node can be masked by another (`maskSource: "<id>"`, `maskType: "alpha"`; a mask's own mask applies too, and a node used only as a mask takes `visible: false`), confined to a rounded rect (`boundingBox: { x, y, width, height }` with `{ value, unit: "px" }` and `cornerRadius`), moved (`transform`, see `shift`), faded (`opacity`) and blended (`blendMode: "screen"`).

## Type and shapes as shaders

The library's shape effects (Chrome, Glass, LiquidMetal, Obsidian, Neon, ThinFilm, Frost, Plastic, Holographic, Crystal, Water, Goo, Emboss, …) take a custom shape as a signed distance field. `useShapes` bakes one in the page from a word in any font the page has loaded, an SVG path or any canvas drawing, so a headline in the video's own face can be chrome, glass or ice:

```tsx
const [word] = useShapes([{ text: "launch", font: '600 800px "Intent Sans"', letterSpacing: -0.045 }]);
<Shaders
  text={word?.text(x, 540)}
  components={(f) => word ? [
    { type: "StudioBackground", props: { color: "#cfd2da" } },
    { type: "Chrome", props: { ...word.at(x, 540), bevelWidth: 0.011 } },
  ] : []}
/>
```

- `useShapes([source])` returns a shape per source (null until baked; the frame waits). A source is `{ text, font, letterSpacing }` (em), `{ path, viewBox, width }`, or `{ draw(ctx), width, height, key }`, plus `pad` (0.08: room round it for bevels and rims).
- `shape.at(x, y, { scale, rotation, extrude })` gives the props that put its centre at (x, y) in the layer's CSS pixels; spread them into the effect's props. `extrude: { depth, bevel, rotX, rotY, rotZ }` makes it a solid (`svgExtrude3D`) that ray-marching effects light on its sides.
- `shape.text(x, y)` is what the shape says, for the layer's `text` prop: `check` then reads the word (reading time, size, safe area, contrast) as it reads DOM text. A layer without `text` is left out of the reading checks.
- The field is 512 × 512 (the library's size). A word 2,000 px wide stays clean at 1:1 under Chrome, Obsidian and Glass bevels; bevel widths are fractions of the field, so a wide word wants small ones (0.01 to 0.02).
- **Close-ups bake what is in view.** At 3× a whole word's field is 10 px a texel and its bevels step. For a cut in close, bake only the part of the word in frame (a `draw` source of that crop, with room for its drift: the cut edges stay off screen), at `scale` = the zoom, and multiply the props measured against the field (bevel width, edge softness, glass thickness) by the whole word's `side` over the crop's, so the material keeps its widths and reads as the same object, closer.
- **Crystal warps round its shape** (its "outer warp": a band about 0.03 of the field wide where the ground bends), unless `cutout`. To keep the ground still, put the Crystal, cut out, over its own copy of the ground in a `Group`, laid on the ground.

## Pictures, words and footage as input

- `usePictures([{ key, width, height, fonts, draw(ctx) }])` draws pictures on a canvas once (at 2× by default) and gives their URLs for `{ type: "ImageTexture", props: { url } }`: masks, a word for a filter or a distortion to work on, a shadow.
- `textPicture({ text, font, x, y, align, letterSpacing, color })` is a line of text as a full-layer picture, with `.picture` for `usePictures` and `.text()` for the layer's `text`.
- `shift(dx, dy, { scale, rotation, anchor })` is a node's `transform` in pixels: draw a picture once and move it every frame (a wake behind a cursor, a shadow under it).
- `clipTexture(src, seconds)` is a video file's frame as an `ImageTexture`, frame exact (the frames `<Clip>` plays), for glass, crystal or halftone over footage: `clipTexture("/videos/x/media/clip.mp4", 2 + f / 60)`. Downscale 4K footage to the video's size first: every frame is extracted as a JPEG.

## A pointer from the frame

`pointer={(f) => ({ x, y, down })}` gives the layer a pointer, in its CSS pixels: CursorRipples, CursorTrail, Liquify, InkFlow and `mouse`/`mouse-position` drivers follow it. Pass a kit cursor's own path and the shader answers the cursor on screen:

```tsx
<Shaders pointer={(f) => cursorAt(keys, f)} components={[ …word, { type: "CursorRipples", props: { intensity: 9, decay: 4 } } ]} />
<Cursor keys={keys} look="frosted" />
```

Trees that follow a pointer are stepped from the start of the shot like simulations, with the library's clock set to the video's (its fluid and ripple solvers read the wall clock otherwise), so they render the same every time: frame 40 of a CursorRipples and of a Liquify shot rendered straight and after the frames before it are identical. One pointer-driven layer on screen at a time (the library reads one pointer for the page).

## Paper's shaders

`PaperShader` runs any of Paper's fragment shaders frame-locked (`fragment={meshGradientFragmentShader}` with the uniforms Paper's React component would pass; image uniforms by URL in `images`). `LiquidMetal` is ready to use: polished metal whose reflections flow as bands through a shape and bend round its edges, splitting colour where they bend.

- `shape`: a picture (white on transparent, the layer's size) of what the metal fills: a pill, a ring round a button (the pill less its face), a logo, a word. Paper's solver prepares it once (a few hundred milliseconds; the frame waits).
- `matte` 0 (mirror chrome, rainbow along the bends) to 1 (satin bands, no colour split); `repetition`, `softness`, `shiftRed`, `shiftBlue`, `distortion`, `contour` override it one by one.
- `speed` scales the flow; `flow` adds seconds of it (a surge on a click: a spring from 0 to 1.4).
- The canvas draws at 2×, so a slow push of a few percent stays sharp.
- `still={frame}` draws it once, as it is at that frame, as a picture every copy shares (`PaperShader`'s `still`): for a shot a page curl or a page flip carries off, which draws it once per strip.

## What is different in a video

- **Time is the frame.** The library's bindings run on the wall clock; `Shaders` drives its renderer frame-locked, so any frame renders alone, in any order, the same every time (measured over the whole catalogue). Props that change are set in place each frame, without recompiling.
- **A change in how a node is composed rebuilds the layer.** A node's transform starting or stopping, its opacity crossing 1, its blend mode, mask or visibility, a new shape field: the library recompiles for these on its own time, so the layer starts a fresh renderer instead and the frame waits for it. Their values then change in place. Keep such flips rare inside a shot (a fresh renderer costs about 0.2 s).
- **Animate with a function of the frame, not drivers.** `auto-animate` drivers throw; `mouse` drivers need a `pointer`. `map` drivers (one layer reading another) work.
- **Simulations are stepped.** Boids, DataMosh, FloatingParticles, InkFlow, KeyFrames, Liquify, MagneticFilings, ParticleField, ParticleFlow, Particles, PixelSort, ReactionDiffusion, Smoke, SmokeFill, SmokeFlow, Surface3D and TimeTrail (and CursorRipples and CursorTrail with a pointer) compute each frame from the one before, so they run one whole frame at a time from the start of the shot. A frame late in a long shot replays the frames before it (a still at +600 takes a few seconds; a render's chunks each replay from the shot's start), and fractional frames show the whole frame before them, so they do not motion-blur. Keep simulation shots short. ParticleFlow and SmokeFill differ by a few levels on under 0.1% of pixels between runs (GPU order), invisible in motion.
- **Images and shapes wait.** Every read of an `ImageTexture` URL or a baked shape is counted from the fetch until the library has written it to the GPU, and the frame waits for it, after a fresh renderer and whenever a URL changes (each frame of a `clipTexture`). Simulations over images work.
- **Refused, with what to use instead:** `CursorTrail`, `CursorRipples` without a `pointer`, `WebcamTexture`, `ObjectTracker` (no camera), `VideoTexture` (wall clock: use `clipTexture`), `Text` (fetches a Google font: use `useShapes` or `textPicture` in the video's own font), `HTMLInCanvas`, `DOMTexture` (not wired yet), `Fog` (its solver differs on every run, so render chunks would not join: use `Smoke` or a noise field).
- **WebGPU.** The renderer's Chromium has it (Metal on macOS). In the studio, use a browser with WebGPU (current Chrome). Paper's shaders are WebGL 2.
- **Beside 3D, not in it.** A `Shaders` layer is its own canvas, outside a `Stage3D`'s lens and light: put it behind or in front of a stage, not inside one.
- **DOM over shaders.** A layer is a canvas, so DOM above it can blur or refract it with `backdrop-filter`: the kit `Cursor`'s `look="frosted"` (blur) and `look="glass"` (an SVG displacement), and `MiddleCard` do, exact in stills and renders.

## Taste, from review

- **No outer glows on type.** A neon glow or halo round a word read as cheap; materials that live inside the letters (chrome, black glass, liquid metal, foil, ice, crystal over footage) read as premium.
- **Big type, cropped.** A material word drifting slowly across the frame reads best larger than the frame (about 800 px at 1080p), cut by its edges: the material fills the frame instead of sitting in it. One material per beat, the word and its drift continuous through the swaps.
- **Neutral, smooth grounds.** A grid behind type looked busy; use soft radial or linear gradients in neutral greys (or a studio sweep), dark for glass and neon materials.
- **Strong colour on light grounds.** Pastels (light cyan, butter) wash out on grey; a plasma or fill on a light ground wants deep purple with cyan in it (`Plasma` two-colour, purple on a near-black violet, with a cyan `Plasma` screened over it).
- **Make it move, not just fill.** Plasma appearing inside still letters read as a fill; letters that go fluid as the cursor slices through (CursorRipples on a `pointer`) read as an effect. A hot seam along the cut, masked to the letters, says "cut". Ripples alone read as too light: for a word that comes apart, split it into RGB behind the cursor, erode the split copies with `NoiseDissolve` (in a `Group` masked to the wake), and smear the ink after the cursor with `Liquify` (intensity 16, stiffness 2) under stronger ripples; finish the erosion before the cursor stops, or Liquify stretches what is left into a crescent.
- **Glass lenses: round, and strong.** A round lens (`ellipseSDF`, radius = height) with refraction 1.7, thickness 0.6 and inner zoom 1.45 swells the letters under it into new shapes; the rounded square at refraction 1 read as too polite.
- **Black metal** on a dark sweep: `Chrome` with a grey tint (`#6a6f78`), shadows 0.92, environment 2. Gold or brown liquid metal on a brown ground read as chocolate; gold reads as gold on white (`Chrome` tinted `#f6c45e` over a light `StudioBackground`).
- **Footage under glass in black and white**, graded in the file (`ffmpeg -vf hue=s=0`): glass and crystal refract the stack under them, and read adjustment effects there as white.
- **UI materials close up.** A liquid-metal button reads as worth touching only big: a macro close-up (the button 1,200 px wide or more) with a slow push to about 1.3, never a small button on a big ground.

## Writing your own shader

For a look neither library has, write a fragment shader for core's `Shader` (kit): WebGL 1, `void main()` writing premultiplied `gl_FragColor`, with the prelude's `u_time`, `u_frame`, `u_progress`, `u_seed`, `u_resolution`, `v_uv` and its helpers (`hash11`, `hash12`, `noise`, `fbm`, `toLinear`, `toSrgb`, `dither8`).

For the craft (signed distance functions, noise, colour spaces, tonemapping, debug views), the `shader-art-coding` skill from [gokayfem/shader-skills](https://github.com/gokayfem/shader-skills) (MIT) is a sound reference. We reviewed it at commit `e09bc99` (19 October 2026): markdown, a GLSL library and one standard-library Python helper, with no hooks, no network access and nothing that touches credentials. Its marketplace install follows `main`, so copy the reviewed commit instead, from the product repo's root:

```sh
git clone https://github.com/gokayfem/shader-skills .shader-skills
git -C .shader-skills checkout e09bc993bf04201f26c03c87c89210e9b472f526
cp -R .shader-skills/skills/shader-art-coding .claude/skills/ && rm -rf .shader-skills
```

Port its code; do not paste it:

- **It writes Shadertoy shaders for WebGL 2** (GLSL ES 3.00: `uint`, bit shifts, `texture()`, `mainImage`, `iTime`, `iResolution`). Rewrite for WebGL 1 and the prelude's uniforms. Its integer hashes need WebGL 2: use the prelude's `hash12` and `noise`, and rename its functions where they clash with the prelude's.
- **Nothing per frame that is meant to hold still.** Its dither, grain and ray jitter on `iFrame` change every frame and compress into blocks; use `dither8()`, which is seeded by `u_seed` and holds still.
- **Not its links.** Its references point to Shadertoy examples, which are CC BY-NC-SA unless they say otherwise: do not copy from them.
- **This guide first.** The skill loads on any "procedural texture or generative visual"; inside a video, the rules here and in core's guide (time from the frame, `waitFor`, cost) win where they differ.

## Cost

Each `Shaders` layer is a WebGPU context and a compile when its shot mounts (about 0.2 s), so keep a few per shot. A layer renders twice per frame (effects with compute passes would otherwise show the frame before), and motion blur multiplies that by its samples. Measured: a 660-frame test video with four layers and 120 blurred frames rendered at 1080p60 in 50 s.
