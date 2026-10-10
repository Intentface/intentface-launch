# Intentface Launch

Product launch videos written as code and rendered frame by frame to 1080p60 (or 4K) mp4. Built to be driven by Claude Code: you describe the video, Claude captures the running product, sketches a storyboard you comment on, then builds and renders the final cut.

This repo holds the packages. A product's videos live in that product's own repo; `videos/` here holds this project's own videos.

| Package | What it is |
| --- | --- |
| `@intentface-launch/core` | Engine, kit, CLI, studio and the skills Claude uses. Brand-neutral. |
| `@intentface-launch/three` | 3D add-on: live UI on panels in space, real lens depth of field, soft light. |
| `@intentface/brand` | The Intentface brand (published from intentface-com-v3): fonts, logos, gradient, and design, motion and copy rules. Any team's brand package plugs in the same way. |

The full documentation is in [`docs/content/docs/`](docs/content/docs/) (`pnpm docs` serves it at http://localhost:4410): [quick start](docs/content/docs/quick-start.mdx), [how it works](docs/content/docs/how-it-works.mdx), [commands](docs/content/docs/commands.mdx), [engine](docs/content/docs/engine.mdx), [kit](docs/content/docs/kit.mdx), [3D](docs/content/docs/three.mdx) and [skills](docs/content/docs/skills.mdx).

## In a product repo

The packages are not published yet, so install them from a checkout of this repo. You need Node 22 or later, pnpm and ffmpeg; uv is only needed for beat detection.

```sh
brew install ffmpeg uv
git clone git@github.com:Intentface/intentface-launch.git ~/Work/intentface-launch
(cd ~/Work/intentface-launch && pnpm install)              # once, and after pulling

# then, in the product repo:
node ~/Work/intentface-launch/packages/core/bin/launch.mjs init
pnpm launch setup                                          # the browser renders use, once per machine
pnpm launch dev                                            # studio at http://localhost:4400
pnpm launch add three                                      # when a video needs 3D
pnpm launch add @intentface/brand                          # only for videos in the Intentface brand
```

`init` creates `launch/` (config, `videos/`, a `CLAUDE.md` for Claude), adds a `launch` script, and installs the skills into `.claude/skills/`. Then open Claude Code in the product repo and ask for a video, for example: "Make a 30 second launch video for this product." The `product-launch-video` skill takes it from there, and each step is agreed with you before the next one starts:

1. **Discover**: Claude reads the product and runs it, then asks what only you know: what sets it apart and who it is for. The result is `brief.md`.
2. **Script**: one person doing one real task, each feature the next thing that happens in it.
3. **Music**: Intentface Launch does not make music, but it cuts the video to a track, so the track comes before the sketch. Use music you have, or generate one (Suno, ElevenLabs Music and the like) from the brief Claude writes from the script, and drop it in `audio/`.
4. **Sketch**: Claude captures the product and builds every shot flat and cheap, on the track's beats. `pnpm launch board` makes a storyboard and an animatic; you leave notes per shot in the studio.
5. **Build**: shots are finished one at a time, and Claude checks each in stills and contact sheets.
6. **Check and render**: `pnpm launch check` measures every piece of text on screen for reading time, size and contrast; `pnpm launch render` makes the mp4.

Along the way Claude loads the other skills as they apply: `creative-direction`, `kinetic-typography`, `ui-motion`, `micro-animations`, `logo-animation`, `motion-review`, `music-brief` and `sound-design` ([what each is for](docs/content/docs/skills.mdx)).

The studio shows every video with a scrubber, shot blocks, beat ticks and the waveform. Keys: space, arrow keys (shift for seconds), `[` `]` for shots. For 3D UI textures in the studio, enable `chrome://flags/#canvas-draw-element` (renders always have it).

## Developing the packages

```sh
pnpm install
pnpm launch setup
pnpm dev          # this repo is also a launch folder, for its own videos in videos/
pnpm check        # types, lint, video checks
```

Because a product repo links the packages from this checkout, pulling here updates every product repo that uses them; `pnpm launch update` there refreshes the skills and guides.

See CLAUDE.md for how the packages fit together. Tools we have wanted while making videos are issues labelled [`wishlist`](https://github.com/Intentface/intentface-launch/issues?q=is%3Aissue+is%3Aopen+label%3Awishlist).

## What goes in git

Video source (`video.tsx`, `brief.md`, capture scripts and their `.json` manifests, audio, `comments.json`) is committed. Images and video files are not: capture frames, stills, renders and everything in `out/` are regenerated, and clips a video uses are shared outside git.

## License

MIT. See [LICENSE](LICENSE).
