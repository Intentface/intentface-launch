# @intentface-launch/three

The 3D add-on for [@intentface-launch/core](https://www.npmjs.com/package/@intentface-launch/core): the product's live UI on panels in space, shot through a real lens. `Stage3D` averages many renders through the lens's aperture and an open shutter, so depth of field has true bokeh and fast moves blur in camera. Also glass and frosted panels, devices (phone, tablet, laptop), floors with reflections, light as the subject (beams, prisms) and postprocessing effects on the video's clock.

## Install

In a repo set up with `intentface-launch init`:

```sh
pnpm launch add three     # or, in an npm repo: npx intentface-launch add three
```

`add` installs the package and its peers (`three`, `postprocessing`) and links its guide (`LAUNCH.md`) into `launch/CLAUDE.md`, so Claude knows how to use it.

Panels draw live DOM through Chrome's HTML-in-Canvas, which the CLI's browser has. In the studio, enable `chrome://flags/#canvas-draw-element`.

## Documentation

<https://launch.intentface.com/three>, the source at <https://github.com/Intentface/intentface-launch>, and `LAUNCH.md` in this package.

## Licence

MIT. Early (0.x) and experimental.
