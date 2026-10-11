# Intentface Launch

Product launch videos written as code. A video is a React component made of shots; a renderer plays it frame by frame in headless Chromium and encodes it to a 1080p60 (or 4K) mp4.

It is built to be driven by [Claude Code](https://claude.com/claude-code). You describe the video; Claude reads your product, captures its real UI from the running app, sketches a storyboard you comment on, then builds and renders the final cut.

- **Your real product, not a mockup.** Videos import your app's own components and data, and captures record the running app as sharp, zoomable snapshots of its DOM.
- **Every frame is exact.** A frame is a pure function of its number, so any frame renders alone, in any order, in parallel, the same every time.
- **Checked like code.** `check` measures every piece of text on screen for reading time, size, safe area and contrast against the pixels behind it, and flags dead stretches, cuts off the beat and loudness.
- **Cut to music.** Beats, sections and quiet stretches are detected from the track, and shots are timed in beats.
- **3D when it earns it.** An add-on puts live UI on panels in space, shot through a real lens with depth of field and motion blur.

> **Status:** early (0.x). The packages are not on npm yet, so you install them from a clone of this repo. Developed on macOS.

## Quick start

You need Node 22 or later, pnpm, ffmpeg and Claude Code. [uv](https://docs.astral.sh/uv/) is only needed for beat detection.

```sh
brew install ffmpeg uv
git clone https://github.com/Intentface/intentface-launch.git
cd intentface-launch && pnpm install
```

Then, from the root of your product's repo:

```sh
node /path/to/intentface-launch/packages/core/bin/launch.mjs init
pnpm launch setup     # downloads the browser renders use, once per machine
pnpm launch dev       # the studio, at http://localhost:4400
```

`init` adds a `launch/` folder (a config, `videos/`, and a `CLAUDE.md` for Claude), a `launch` script in your `package.json`, and the skills in `.claude/skills/`. It works with pnpm, npm, yarn and bun.

Now open Claude Code in your repo and ask for a video:

> Make a 30 second launch video for this product.

The `product-launch-video` skill takes it from there, and each step is agreed with you before the next one starts:

1. **Discover.** Claude reads and runs your product, then asks what only you know: what sets it apart and who it is for.
2. **Script.** One person doing one real task, each feature the next thing that happens in it.
3. **Music.** Intentface Launch does not make music; it cuts the video to a track. Use one you have, or generate one (Suno, ElevenLabs Music and the like) from the brief Claude writes.
4. **Sketch.** Every shot built flat and cheap on the track's beats, as a storyboard and an animatic you leave notes on in the studio.
5. **Build.** Shots are finished one at a time, and Claude checks each in stills and contact sheets.
6. **Check and render.** `pnpm launch check`, then `pnpm launch render` for the mp4.

To update later, `git pull` in your clone (your repo links the packages from it), then `pnpm launch update` in your repo to refresh the skills.

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

A brand is an add-on too: a package with your fonts, logos and design, motion and copy rules, which `pnpm launch add <package>` installs and links into Claude's guide. Core itself is brand-neutral, so a video takes its look from your product.

## Documentation

The docs are in [`docs/content/docs/`](docs/content/docs/): [quick start](docs/content/docs/quick-start.mdx), [how it works](docs/content/docs/how-it-works.mdx), [commands](docs/content/docs/commands.mdx), [engine](docs/content/docs/engine.mdx), [kit](docs/content/docs/kit.mdx), [3D](docs/content/docs/three.mdx) and [skills](docs/content/docs/skills.mdx). `pnpm docs` serves them at <http://localhost:4410>.

## Contributing

```sh
pnpm install
pnpm launch setup
pnpm dev          # this repo is a launch folder too, for its own videos in videos/
pnpm check        # types, lint and video checks
```

[CLAUDE.md](CLAUDE.md) explains how the packages fit together. Ideas for tools are issues labelled [`wishlist`](https://github.com/Intentface/intentface-launch/issues?q=is%3Aissue+is%3Aopen+label%3Awishlist).

## License

MIT. See [LICENSE](LICENSE).
