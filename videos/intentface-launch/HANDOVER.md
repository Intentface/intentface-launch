# Handover: the Intentface Launch film

State on 2026-10-13. Read `brief.md` (the script and look), `timing.ts` (every frame) and `video.tsx`.

## Where it stands

Rebuilt from Joni's new outline on 2026-10-13: chat, terminal, board, render, the video in 3D, the file, "Create ___ video.", the mark. 51.5 s, 16:9 and 4:5 (`--format portrait`, 1080 × 1350), cut to `audio/clean-ringing-chord.wav` (Joni's new track). `check`: 0 errors. Preview cuts are `out/preview.mp4` and `out/preview-portrait.mp4` (rendered with `--samples 64` so the bokeh reads; at the default 8 it looks stepped); the final has not been rendered (Joni has not signed off the preview).

## Decisions by Joni (do not re-ask)

- The story above, in that order; open on a chat asking for a screenshot ("something cooler"); no music until `claude` is entered.
- The terminal gets a very subtle CRT texture with a bit of glow, no power-on; the effect is in the library (`Crt`, `CrtEffect` in `@intentface-launch/three`).
- `npx @intentface-launch/core init`, not the plugin.
- The product in the video is a to-do app, not a launch app.
- Skip "Any style". Black ground and Intent Sans for the film's own type; the Launch mark's own intro.
- No 3D devices and no three files playing (neither fitted the look): the video shrinks into one file, then straight to "Create ___ video." with 14 kinds cycling.
- Delivered in 16:9 (YouTube) and 4:5. Every scene reflows: the terminal stands further back, the board window fills the frame, the 3D scene and the file use the app's 4:5 layout, the line stacks on three lines.
- Heavy bokeh (50 px from 30°) is the look; its stepped, spiky quality was fixed in `Stage3D` (bokeh smoothing, on for every video). The CRT has no grain and no dot mask (compression). The board holds on the changed panels before the reply.
- The end group sits 50 px lower than centre-plus-rise (it read high).
- Whooshes heavier and lower: `sfx:whoosh-deep` (the launch folder's `sfx/`, derived from core's whoosh), not the light ones.

## Decided here, open to change

- No countdown: the new track goes from a short breakdown (34.6 s) to the final hits (37.92, 38.39) and the tail; the mark flies in through the breakdown and parks on the first hit.
- Two questions (audience, feel); Claude's reply under the note is "Done."; the board holds on the changed panels before it
- Warnings kept: the chat's lines are over 42 characters (chat messages, wrapped); the chat holds 2.7 s with only the typing dots moving (a read hold); the board is small for 1.8 s while its window grows out of the link.

## Files

`chat.tsx` (cold open), `terminal.tsx` (install, Claude Code, the render; one component on the film's clock), `board-view.tsx` + `board.css` (the studio's board), `todo-app.tsx` (the product in the video, with its square and vertical layouts), `hero3d.tsx` (the 3D close-up and pull-back), `file.tsx` (the file), `launch-intro.tsx` (the mark's intro), `timing.ts`.

The shots chat to file `continue` the first shot, so they run on film frames; create and end count from their own start.

## Open

- The old track `audio/the-launch.wav` is no longer used; `beats` picks the first audio file in the folder alphabetically, which is the new one. Delete it once the new cut is signed off.
- Final renders: `pnpm launch render intentface-launch` and `--format portrait`, about 10 minutes each (3D at up to 256 samples, motion blur on the word changes). Render once after sign-off.
