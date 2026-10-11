# Intentface Launch

The packages that turn product launch videos into code, and a launch folder of their own for this project's own videos. Product repos install the packages and keep their videos in `launch/`; this repo develops the packages.

## Layout

- `packages/core/` (`@intentface-launch/core`): brand-neutral. `engine/` (frame clock, shots, transitions, easing and springs, the seek bridge the renderer drives), `kit/` (Camera, Cursor, Capture, Snapshot, MotionBlur, kinetic type), `cli/` (the `intentface-launch` bin, renderer, capture, board, the project loader and Vite config, `init`/`add`), `studio/` (the preview app), `skills/` (installed into product repos' `.claude/skills/`), `LAUNCH.md` (the guide agents read in product repos).
- `packages/three/` (`@intentface-launch/three`): the 3D add-on. `Stage3D` (thin-lens accumulation renderer), `Panel` (live DOM on slabs via Chrome's HTML-in-Canvas), lens maths.
- Brands are add-ons published elsewhere: the Intentface brand is `@intentface/brand`, built in the intentface-com-v3 repo (its fonts, logos, tokens, gradient, `Atmosphere` for videos, checks and LAUNCH.md). Nothing here depends on it.
- `launch.config.ts` + `videos/`: this repo as a launch folder, for its own videos (`motion-gallery`, which `packages/core/tools/bench` renders). Videos about Intentface products live in the marketing-material repo, and each product's own videos in its repo. `videos/test-*` are the tests: each names at its top what it exercises, the command to run and what a correct result is; run the ones a change touches, and when a change alters a result, update its header in the same change. Their audio is synthetic (`audio/make.sh`), and nothing in them comes from a real product. `videos/_*` are scratch experiments (ignored).
- `.claude/skills/` links to `packages/core/skills/`, so this repo uses the same skills product repos get.
- `docs/`: the documentation site (`pnpm docs`, <http://localhost:4410>). Pages are plain markdown in `docs/content/docs/`; `docs/CLAUDE.md` has the rules for writing them. When a change alters what a page says, update the page in the same change.

## How the packages work in a product repo

- `intentface-launch init` (from a checkout: `node <this repo>/packages/core/bin/launch.mjs init`) adds `@intentface-launch/core` as a dev dependency, writes `launch/` (`launch.config.ts` with `product: { path: ".." }`, `tsconfig.json` with the product's paths, `CLAUDE.md`, `.gitignore`), excludes `launch/` from the product's own tsconfig, adds a `launch` script, and copies the skills.
- `intentface-launch add <name>` installs an add-on from `cli/addons.ts`'s `ADDONS` and links its `LAUNCH.md` into `launch/CLAUDE.md`. Run from a checkout of this repo (or with `LAUNCH_SOURCE=<this repo>`), it installs `link:` packages, so product repos can use unreleased work.
- Packages ship TypeScript source. The bin registers tsx; Vite serves the source, with our packages excluded from pre-bundling (one copy of the engine) and their browser dependencies declared in each `package.json` under `"intentface-launch".optimizeDeps` so the startup scan pre-bundles them. A new browser-side import from a package needs adding there, or the page reloads mid-render.
- The studio's `index.html` lives in core and is served at `/` by a plugin; Vite's root is the launch folder, so `/videos/…` URLs are files in it.
- New add-on: a package under `packages/`, a `LAUNCH.md`, peer dependency on core, an entry in `ADDONS`, and its name in `PACKAGES` in `cli/project.ts`.

## Commands (this repo)

```sh
pnpm launch <command>                      # the CLI, on this repo's launch folder (see LAUNCH.md below)
pnpm check                                 # types, lint, video checks
pnpm fix [files…]                          # biome --write on the given files (default: every git-changed file; name your own when others are working in the tree)
pnpm -r --filter './packages/*' exec pnpm pack --pack-destination <dir>   # tarballs, to test a registry-style install
```

Test packaging changes in a scratch product repo outside this one: `init`, `add three`, `new demo`, `still demo`.

## Skills are revised as we learn

The skills in `packages/core/skills/` (product-launch-video, creative-direction, kinetic-typography, ui-motion, micro-animations, logo-animation, motion-review, music-brief, sound-design) are our current best practice, not finished documents. Revise them whenever we learn something: a rule that produced a bad shot, a number that proved wrong on a real render, a recipe that worked, a reviewer's note that keeps coming back. Change the skill in the same change as the code or video that taught it, and keep the SKILL.md the current practice; a skill's `research.md` holds the sources behind it and changes only when the research does. When a skill's advice depends on the engine (an API, a default, a check), update it when the engine changes.

## Wishlist

Tools that would have made past work faster, easier or cheaper in tokens are GitHub issues labelled `wishlist` (public, readable without a login: <https://api.github.com/repos/Intentface/intentface-launch/issues?labels=wishlist>). When a missing tool costs you time or tokens (a throwaway script, several calls where one should do, an image far larger than needed), draft an issue for the person to file: what happened, what would have helped, and what it would save. Before writing a one-off helper, check whether it is already wished for; building it properly may be the better use of the time. When one is built, say which issue it closes.

## Rules for package code

- Core stays brand-neutral: nothing in `packages/core` imports the brand. Brand-specific rules go in the brand's LAUNCH.md.
- Inside a package, import its own files relatively; import other packages by name (`@intentface-launch/core`, `@intentface-launch/core/timeline` for engine internals).
- Everything the CLI reads from the project goes through `cli/project.ts` (`root()`), never a path relative to the package.
- The studio, the standalone board page and the docs share one look: intentface-chat's token system (four seeds, surfaces and text derived in OKLCH, light and dark), Inter and Ioskeley Mono bundled as "Studio Sans" and "Studio Mono". It lives in `studio/studio.css`, the `<style>` in `cli/board.ts` and `docs/app/globals.css`; change them together. Only the studio's chrome is themed: what scenes inherit (`html[data-mode="render"] body` and `.frame`) stays fixed, so renders never depend on it. The Launch mark (`LaunchMark`, and `LaunchTile` for the app icon) is `studio/launch-mark.tsx`; the docs import that file as `@core/studio/launch-mark`. The favicon (`docs/app/icon.svg`, and the same SVG inlined as a data URI in core's `index.html`) is the tile at rest: regenerate both when the mark changes.

@packages/core/LAUNCH.md
@packages/three/LAUNCH.md
