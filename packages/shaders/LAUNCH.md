# Shader effects (@intentface-launch/shaders)

`import { Shaders } from "@intentface-launch/shaders"`

The 200 WebGPU components of the Shaders library (shaders.com, MIT): gradients, noise, light, glass, metal, distortions, blurs, wipes, particles, fluids. Use them for backdrops, transitions and texture around the product, and as examples when writing your own `Shader` (core kit). The product's UI stays in `Snapshot`s; type stays in the DOM.

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

## What is different in a video

- **Time is the frame.** The library's bindings run on the wall clock; `Shaders` drives its renderer frame-locked, so any frame renders alone, in any order, the same every time (measured over the whole catalogue). Props that change are set in place each frame, without recompiling.
- **Animate with a function of the frame, not drivers.** `auto-animate`, `mouse` and `mouse-position` prop drivers throw: write `components={(f) => …}` with `interpolate`, `spring` and the rest. `map` drivers (one layer reading another) work.
- **Simulations are stepped.** Boids, DataMosh, FloatingParticles, InkFlow, KeyFrames, Liquify, MagneticFilings, ParticleField, ParticleFlow, Particles, PixelSort, ReactionDiffusion, Smoke, SmokeFill, SmokeFlow, Surface3D and TimeTrail compute each frame from the one before, so they run one whole frame at a time from the start of the shot. A frame late in a long shot replays the frames before it (a still at +600 takes a few seconds; a render's chunks each replay from the shot's start), and fractional frames show the whole frame before them, so they do not motion-blur. Keep simulation shots short. ParticleFlow and SmokeFill differ by a few levels on under 0.1% of pixels between runs (GPU order), invisible in motion.
- **Images wait.** `ImageTexture` with a `url` in the launch folder (`/videos/<id>/photo.png`) is loaded before the frame is let go. A simulation over an image is refused.
- **Refused, with what to use instead:** `CursorTrail`, `CursorRipples` (no pointer), `WebcamTexture`, `ObjectTracker` (no camera), `VideoTexture` (wall clock: use `<Clip>`), `Text` (fetches a Google font, invisible to `check`: set type in the DOM), `HTMLInCanvas`, `DOMTexture` (not wired yet), `Fog` (its solver differs on every run, so render chunks would not join: use `Smoke` or a noise field).
- **WebGPU.** The renderer's Chromium has it (Metal on macOS). In the studio, use a browser with WebGPU (current Chrome).
- **Beside 3D, not in it.** A `Shaders` layer is its own canvas, outside a `Stage3D`'s lens and light: put it behind or in front of a stage, not inside one.
- **Checks.** The layer is `data-launch-check="off"`: put no text that must be read in it.

## Cost

Each `Shaders` layer is a WebGPU context and a compile when its shot mounts (about 0.2 s), so keep a few per shot. A layer renders twice per frame (effects with compute passes would otherwise show the frame before), and motion blur multiplies that by its samples. Measured: a 660-frame test video with four layers and 120 blurred frames rendered at 1080p60 in 50 s.
