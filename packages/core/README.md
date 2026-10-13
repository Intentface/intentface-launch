# @intentface-launch/core

Product launch videos written as code. A video is a React component made of shots; a renderer plays it frame by frame in headless Chromium and encodes it with ffmpeg to a 1080p60 (or 4K) mp4.

It is made to be driven by [Claude Code](https://claude.com/claude-code). You describe the video; Claude reads your product, captures its real UI from the running app, sketches a storyboard you comment on in a local studio, then builds and renders the final cut.

This package holds the engine, the kit of scene components, the `intentface-launch` CLI, the studio and the skills Claude follows.

## Install

You need Node 22 or later and ffmpeg (`brew install ffmpeg`); [uv](https://docs.astral.sh/uv/) only for beat detection. From your product repo's root:

```sh
npx @intentface-launch/core init    # or: pnpm dlx @intentface-launch/core init
pnpm launch setup                   # the browser renders use, once per machine
pnpm launch dev                     # the studio, at http://localhost:4400
```

`init` adds the package as a dev dependency, a `launch/` folder (config, `videos/`, a `CLAUDE.md` for Claude), a `launch` script, and the skills in `.claude/skills/`. In an npm, yarn or bun repo, run the CLI as `npx intentface-launch`, `yarn launch` or `bun run launch`.

Then open Claude Code in the repo and ask for a video:

> Look at the app and make a 30 second release video about our scheduling feature.

## Add-ons

```sh
pnpm launch add three               # 3D: live UI on panels in space, real depth of field
pnpm launch add shaders             # WebGPU effects from the Shaders library
```

## Documentation

The guide, recipes and reference: <https://launch.intentface.com>. The source: <https://github.com/Intentface/intentface-launch>. The guide agents read is `LAUNCH.md` in this package.

## Licence

MIT, except the bundled sound effects in `sfx/` (use them in your videos, do not redistribute them on their own) and the studio's fonts (SIL Open Font License). See `LICENSE`. Early (0.x) and experimental: APIs, commands and skills change between versions.
