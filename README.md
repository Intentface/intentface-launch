<img src=".github/icon.svg" width="96" height="96" alt="Intentface Launch">

# Intentface Launch

Product launch videos written as code. A video is a React component made of shots; a renderer plays it frame by frame in headless Chromium and encodes it to a 1080p60 (or 4K) mp4.

It is built to be driven by [Claude Code](https://claude.com/claude-code). You describe the video; Claude reads your product, captures its real UI from the running app, sketches a storyboard you comment on, then builds and renders the final cut.

- **Your real product, not a mockup.** Videos import your app's own components and data, and captures record the running app as sharp, zoomable snapshots of its DOM.
- **Every frame is exact.** A frame is a pure function of its number, so any frame renders alone, in any order, in parallel, the same every time.
- **Checked like code.** `check` measures every piece of text on screen for reading time, size, safe area and contrast against the pixels behind it, and flags dead stretches, cuts off the beat and loudness.
- **Cut to music.** Beats, sections and quiet stretches are detected from the track, and shots are timed in beats.
- **3D when it earns it.** An add-on puts live UI on panels in space, shot through a real lens with depth of field and motion blur.

> **Status:** early (0.x) and experimental; see [Use at your own risk](#use-at-your-own-risk). Developed and tested on an Apple M2 Pro Mac with Claude Opus 5.5 at High effort in Claude Code; other machines, operating systems and models are not guaranteed to work. See [requirements](docs/content/docs/requirements.mdx).

## Quick start

You need Node 22 or later, ffmpeg and Claude Code. [uv](https://docs.astral.sh/uv/) is only needed for beat detection.

Start your product locally (its dev server, in demo or seeded mode) with its source on the same machine: Claude reads the source, looks at the running app and captures its real UI from it. Then, from the product repo's root:

```sh
brew install ffmpeg uv
npx @intentface-launch/core init    # or: pnpm dlx @intentface-launch/core init
pnpm launch setup                   # downloads the browser renders use, once per machine
pnpm launch dev                     # the studio, at http://localhost:4400
```

`init` adds the package as a dev dependency, a `launch/` folder (a config, `videos/`, and a `CLAUDE.md` for Claude), a `launch` script in your `package.json`, and the skills in `.claude/skills/`. It works with pnpm, npm, yarn and bun; in an npm repo, run the CLI as `npx intentface-launch <command>`.

To change the skills or the engine for your team, fork this repo: a checkout is a launch folder itself (link the product in `launch.config.ts` with `product: { path: "../my-app" }`), and a product repo can install from it. The [quick start](docs/content/docs/quick-start.mdx) covers both.

Now open Claude Code in your repo and ask for a video:

> Look at my app and make a feature release video about our scheduling feature, 30 seconds.

The `product-launch-video` skill takes it from there, and each step is agreed with you before the next one starts:

1. **Discover.** Claude reads and runs your product, then asks what only you know: what sets it apart and who it is for.
2. **Script.** One person doing one real task, each feature the next thing that happens in it.
3. **Music.** Intentface Launch does not make music; it cuts the video to a track. Use one you have, or generate one (Suno, ElevenLabs Music and the like) from the brief Claude writes.
4. **Sketch.** Every shot built flat and cheap on the track's beats, as a storyboard and an animatic you leave notes on in the studio.
5. **Build.** Shots are finished one at a time, and Claude checks each in stills and contact sheets.
6. **Check and render.** `pnpm launch check`, then `pnpm launch render` for the mp4.

You can also start from screenshots of what to highlight, your own clips and music, or a recipe your team writes down once, such as a weekly update. See [recipes](docs/content/docs/recipes.mdx).

To update later, update `@intentface-launch/core` (and any add-ons) like other dev dependencies, then run `pnpm launch update` to refresh the skills.

## A video in code

You can also write videos yourself: `pnpm launch new hello` scaffolds `launch/videos/hello/video.tsx`. A small one looks like this:

```tsx
import { defineVideo, spring, tempo, useFrame, useVideoInfo } from "@intentface-launch/core";
import { Slam } from "@intentface-launch/core/kit";

const t = tempo(120, 60); // 120 BPM at 60 fps: 30 frames a beat

function Hook() {
  const frame = useFrame(); // frames since this shot began: the only clock a scene reads
  const { fps } = useVideoInfo();
  const line = spring(frame - t.beats(2), fps, { duration: t.beats(1), bounce: 0.2 });
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#0b0b0f" }}>
      <div style={{ font: "600 120px system-ui", color: "white" }}>
        <Slam at={t.beats(1)}>Ship it.</Slam>
        <div style={{ height: 8, marginTop: 16, background: "#7c5cff", transformOrigin: "left", scale: `${line} 1` }} />
      </div>
    </div>
  );
}

export default defineVideo({
  id: "hello",
  title: "Hello",
  bpm: t.bpm,
  shots: [{ id: "hook", duration: t.bars(1), component: Hook }],
});
```

The headline slams in on the first beat and the line springs in on the second. `pnpm launch still hello --at hook:end` renders a frame to look at; `pnpm launch render hello` makes the mp4.

## Packages

| Package | What it is |
| --- | --- |
| `@intentface-launch/core` | Engine, kit (camera, cursor, captures, kinetic type, transitions), CLI, studio, and the skills Claude uses. |
| `@intentface-launch/three` | The 3D add-on: `pnpm launch add three`. |
| `@intentface-launch/shaders` | 200 WebGPU effects from the [Shaders library](https://github.com/shader-effects-inc/shaders), on the video's clock: `pnpm launch add shaders`. |

A brand is an add-on too: a package with your fonts, logos and design, motion and copy rules, which `pnpm launch add <package>` installs and links into Claude's guide. Core itself is brand-neutral, so a video takes its look from your product.

## Documentation

The docs are in [`docs/content/docs/`](docs/content/docs/): [requirements](docs/content/docs/requirements.mdx), [quick start](docs/content/docs/quick-start.mdx), [how it works](docs/content/docs/how-it-works.mdx), [commands](docs/content/docs/commands.mdx), [engine](docs/content/docs/engine.mdx), [kit](docs/content/docs/kit.mdx), [3D](docs/content/docs/three.mdx), [shader effects](docs/content/docs/shaders.mdx) and [skills](docs/content/docs/skills.mdx). `pnpm docs` serves them at <http://localhost:4410>.

## Contributing

```sh
pnpm install
pnpm launch setup
pnpm dev          # this repo is a launch folder too, for its own videos in videos/
pnpm check        # types, lint and video checks
```

[CLAUDE.md](CLAUDE.md) explains how the packages fit together. The `videos/test-*` folders are the tests: each says at its top what it exercises, the command to run and what a correct result is. Ideas for tools are issues labelled [`wishlist`](https://github.com/Intentface/intentface-launch/issues?q=is%3Aissue+is%3Aopen+label%3Awishlist).

## Use at your own risk

Intentface Launch is experimental software under active development, provided as is, without warranty of any kind (see [LICENSE](LICENSE)). Making a video means an agent runs commands, starts your product, drives a browser through it and writes files in your repos. Review what it does, work in version control, and keep secrets out of what gets rendered: use a demo account or seeded data.

## License

MIT for the software. The Intentface and Intentface Launch names and logos, including the Launch mark, are trademarks of Intentface and not covered by it. See [LICENSE](LICENSE).
