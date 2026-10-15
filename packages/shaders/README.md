# @intentface-launch/shaders

The shader effects add-on for [@intentface-launch/core](https://www.npmjs.com/package/@intentface-launch/core): the 200 WebGPU components of the [Shaders library](https://shaders.com) (gradients, light, glass, metal, distortions, particles) and [Paper's shaders](https://shaders.paper.design) (liquid metal, gradients, dithering) driven frame by frame, so every frame renders the same, alone and in any order. Your own type, pictures, footage and the video's cursor go in as their input: a headline in chrome, glass over a clip, letters that ripple where the cursor passes.

## Install

In a repo set up with `intentface-launch init`:

```sh
pnpm launch add shaders   # or, in an npm repo: npx intentface-launch add shaders
```

`add` installs the package and links its guide (`LAUNCH.md`) into `launch/CLAUDE.md`, so Claude knows how to use it. The CLI's browser has WebGPU on.

## Documentation

<https://launch.intentface.com/shaders>, the source at <https://github.com/Intentface/intentface-launch>, and `LAUNCH.md` in this package.

## Licence

MIT. The Shaders library it depends on is MIT; Paper's shaders are Apache-2.0 (Powered by Paper Shaders: https://shaders.paper.design).
