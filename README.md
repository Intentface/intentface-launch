# Intentface Launch

Launch videos for Intentface products, written as code and rendered frame by frame to 1080p60 (or 4K) mp4. Built to be driven by Claude Code: you describe the video, Claude captures the running product, drafts a visual storyboard you comment on, then builds and renders the final cut.

This repo holds the packages. A product's videos live in that product's own repo; `videos/` here holds this project's own videos.

| Package | What it is |
| --- | --- |
| `@intentface-launch/core` | Engine, kit, CLI, studio, and the skills Claude uses. Brand-neutral. |
| `@intentface-launch/three` | 3D: live UI on panels in space, real lens depth of field, soft light. |

## In a product repo

The packages are not published yet, so install them from a checkout of this repo:

```sh
brew install ffmpeg uv                                     # uv is only needed for beat detection
git clone git@github.com:Intentface/intentface-launch.git ~/Work/intentface-launch
(cd ~/Work/intentface-launch && pnpm install)              # once, and after pulling

# then, in the product repo:
node ~/Work/intentface-launch/packages/core/bin/launch.mjs init
pnpm launch add three                                      # when a video needs 3D
pnpm launch setup                                          # the browser renders use, once per machine
pnpm launch dev                                            # studio at http://localhost:4400
```

`init` creates `launch/` (config, `videos/`, a `CLAUDE.md` for Claude), adds a `launch` script, and installs the skills into `.claude/skills/`. Then open Claude Code in the product repo and ask for a video, for example: "Make a 30 second launch video for this product." The `product-launch-video` skill takes it from there:

1. **Brief**: Claude reads the product and writes `launch/videos/<id>/brief.md` with you.
2. **Music**: Intentface Launch does not make music, but it cuts the video to a track, so the track comes first. Use one you have, or generate one (Suno, ElevenLabs Music and the like) from the brief Claude writes from the script (length, BPM, sections, hit points). Drop the file in `launch/videos/<id>/audio/`.
3. **Capture**: Claude drives the running product in a headless browser, one exact frame at a time.
4. **Storyboard**: real 16:9 panels for every shot, timed to the track's beats, and an animatic. Comment on shots in the studio; Claude revises.
5. **Build and render**: finished shots, synced to the beat, rendered to `launch/videos/<id>/out/<id>.mp4`.

The studio shows every video with a scrubber, shot blocks, beat ticks and the waveform. Keys: space, arrow keys (shift for seconds), `[` `]` for shots. For 3D UI textures in the studio, enable `chrome://flags/#canvas-draw-element` (renders always have it).

## Developing the packages

```sh
pnpm install
pnpm launch setup
pnpm dev          # this repo is also a launch folder, for its own videos in videos/
pnpm check        # types, lint, video checks
```

Because a product repo links the packages from this checkout, pulling here updates every product repo that uses them; `pnpm launch update` there refreshes the skills and guides.

See CLAUDE.md for how the packages fit together. Also here: `WISHLIST.md`, tools we have wanted while making videos; `motion-agent-shopping-list.md`, the capability roadmap.

## What goes in git

Video source (`video.tsx`, `brief.md`, capture scripts and their `.json` manifests, audio, `comments.json`) is committed. Images and video files are not: capture frames, stills, renders and everything in `out/` are regenerated, and clips a video uses are shared outside git.

## License

MIT. See [LICENSE](LICENSE).
