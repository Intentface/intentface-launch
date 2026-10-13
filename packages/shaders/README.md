# @intentface-launch/shaders

The shader effects add-on for [@intentface-launch/core](https://www.npmjs.com/package/@intentface-launch/core): the 200 WebGPU components of the [Shaders library](https://shaders.com) (gradients, light, glass, distortions, particles) driven frame by frame, so every frame renders the same, alone and in any order.

## Install

In a repo set up with `intentface-launch init`:

```sh
pnpm launch add shaders   # or, in an npm repo: npx intentface-launch add shaders
```

`add` installs the package and links its guide (`LAUNCH.md`) into `launch/CLAUDE.md`, so Claude knows how to use it. The CLI's browser has WebGPU on.

## Documentation

<https://launch.intentface.com/shaders>, the source at <https://github.com/Intentface/intentface-launch>, and `LAUNCH.md` in this package.

## Licence

MIT, as is the Shaders library it depends on.
