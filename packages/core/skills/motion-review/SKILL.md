---
name: motion-review
description: Review a shot's composition and motion by rendering stills and contact sheets and looking at them. Use after building or changing any shot, before saying it is done.
---

# Reviewing a shot

You cannot watch video, but you can read frames. Use both views:

1. **Composition**: `pnpm launch still <id> --at <shot>,<shot>:<mid>,<shot>:end --grid`. Read the image; `--crop x,y,w,h` for a detail at full resolution. Give shots `moments` for the frames you keep returning to (a click, a landing), and ask for those by name.
   - Type: 28 px minimum, a headline alone on screen 120 to 200 px, beside UI 56 to 96 px, nothing inside 96 px of an edge.
   - Look: the product's own type, colours and shapes, as written in the brief; overlays should look set by the product's designer. A brand package's guide applies only when the person asked for that brand (for Intentface: translucent surfaces, no shadows, gradient as atmosphere behind content, logo only from `@intentface/brand`).
   - Type in motion: still while read, entrances in one easing family, staggers in reading order (the kinetic-typography skill's checks).
   - Showing, not telling: the product's UI on screen, large enough to read, doing something; no frame that is only a sentence about a feature.
   - Captured UI sharp: the camera must not zoom past the capture's `scale`.
   - 3D shots: iterate on composition with `--samples 8` (stills and sheets), then look once at full samples. When glass reads grey, a layer is missing or a reflection looks wrong, `--stage-debug` shows the stage's passes (one sample, what glass sees, reflection, alpha, backdrop) in one image. Two shots on one stage with `continues`: `--at a:end,b:+0 --grid` should show no jump.
2. **Motion**: `pnpm launch sheet <id> --shot <shot> --every 3` (every 2 for fast moves). Read the sheet.
   - Neighbouring tiles should change by smoothly growing then shrinking steps (ease in, ease out). A constant step is linear (wrong for UI); a single big jump is a missing frame, a stale capture frame, or a readiness bug.
   - Motion that should flow must not stop: tiles bunching up at a waypoint in the middle of a camera path, a cursor path or a UI change mean it comes to rest there. Overlap the moves (`travel` on Camera and Cursor keys) or drive the value with `springTo`.
   - Content changing inside a changing container (`Swap`): the old content is gone before the new is readable, and neither overlaps the other at full opacity.
   - Entrances settle before the next thing starts. Two camera moves at once read as a mistake.
   - Cursor arrives on its target on the click frame (check the `Capture` behind it).
   - Motion-blurred frames show a smooth smear, not separate ghost copies; if copies are visible, raise `samples`.
   - A handoff that must land exactly (3D to SVG, capture to snapshot, one shot to the next): `pnpm launch diff <id> --frame <shot>:end --against <next>` prints how much differs and where; crop to that box to see it.
3. **Rhythm**: `pnpm launch sheet <id> --beats` for the whole video, one tile per beat. Each tile should differ from the one before; a run of identical tiles is dead time.
4. **Timing and legibility**: `pnpm launch check <id>`. It reports text held too briefly for its reading time, text too small, outside the safe area or low in contrast, frozen stretches, off-beat cuts, layers whose own edge cuts what they draw (`crop`), and frames that differ from their `matches` reference, each with the shot and frame. Text a canvas draws counts only if the scene declares it (`declareText`). Look at the flagged frames with `still` before changing anything: fix the shot, or mark text that is not meant to be read with `data-launch-check="off"` and say why.

Fix what you find and look again. Report what you checked, not just that it looks good.
