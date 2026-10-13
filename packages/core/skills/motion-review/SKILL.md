---
name: motion-review
description: Review a shot's composition and motion by rendering stills and contact sheets and looking at them. Use after building or changing any shot, before saying it is done.
---

# Reviewing a shot

You cannot watch video, but you can read frames. Use both views:

1. **Composition**: `pnpm launch still <id> --at <shot>,<shot>:<mid>,<shot>:end --grid`. Read the image; `--crop x,y,w,h` for a detail at full resolution. Give shots `moments` for the frames you keep returning to (a click, a landing), and ask for those by name.
   - Type: 28 px minimum, a headline alone on screen 120 to 200 px, beside UI 56 to 96 px, nothing inside 96 px of an edge.
   - Look: the product's own type, colours and shapes, as written in the brief; overlays should look set by the product's designer. A brand package's guide applies only when the person asked for that brand.
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
   - Numbers when the eye is unsure: `pnpm launch measure <id> --shot <shot>` (`--crop x,y,w,h` for one element) prints the frame the motion visibly lands, the hold after it, and judder in pixels. Judder over 0.1 px on motion slower than a pixel a frame shakes; type that scales about its centre is the usual cause (scale it about its baseline). A hold after landing longer than the reading time needs is dead time.
3. **Rhythm**: `pnpm launch sheet <id> --beats` for the whole video, one tile per beat. Each tile should differ from the one before; a run of identical tiles is dead time.
4. **Timing and legibility**: `pnpm launch check <id>`. It reports text held too briefly for its reading time, text too small, outside the safe area or low in contrast, the product's UI shown too far away (`ui`: most of its text, in `Snapshot`s and marked `off`, under 20 px for a second or more), frozen stretches, off-beat cuts, layers whose own edge cuts what they draw (`crop`), and frames that differ from their `matches` reference, each with the shot and frame. Text a canvas draws counts only if the scene declares it (`declareText`). Look at the flagged frames with `still` before changing anything: fix the shot, or mark text that is not meant to be read with `data-launch-check="off"` (UI) or `"decor"` (decoration, not UI) and say why. A `ui` warning is fixed by going closer, not by marking: push in on the part the story is about.
5. **The cut as a whole**: read a rendered file, the preview cut (`render <id> --preview`, minutes) while iterating and the final only once at the end, one frame every two beats in one image: `ffmpeg -i out/preview.mp4 -vf "fps=1/<seconds per two beats>,scale=320:-1,tile=6x11:padding=4" -frames:v 1 sheet.png`. Sampling on the beat catches what happens on every beat (a word change, a whip) and that draft stills between beats miss. Crop a dark, out-of-focus area and push its contrast to look for banding or blocking.

## Defects to hunt in every still

Look at each frame as the person will, as if it were the finished film, and ask whether a motion designer would ship it. These were all missed once and pointed out by a reviewer:

- UI cropped badly: a header cut in half at the frame or tile edge, a shape (9:16, 1:1) that crops the 16:9 layout instead of reflowing it, empty slabs of background where content should be.
- UI floating: cards or panels loose on the video's background with no app window around them, light UI dropped onto a dark film.
- Effects with no purpose: a rotation, a burst or a 3D move that shows nothing new.
- Motion that is linear or static: constant steps on the sheet, a UI change that switches instead of moving, type that appears instead of entering.
- Gimmicks that read as broken: shaking, jitter, glitch.
- Jargon on screen that a viewer cannot read in a second.
- The same copy twice: a line over UI or a tile that shows the same words ("Any style." over a preview of "Any style."), a label repeating what the line beside it says.
- Composition off balance: a lockup or a line sitting high with an empty bottom (or the reverse). A group alone on screen sits at the optical centre, measured from what is drawn (a logo's mark, not its viewBox), slightly above the middle.
- Pacing that drags: a two-word card held 3 s, a camera drifting with nothing changing, a run of tiles on `sheet --beats` that look alike.
- Repeats: the same style, layout or line shown twice in a montage or a sequence.
- The camera framing past the edge of the UI it shows.
- The edge of a tilted plane inside the frame: a wedge of background in a corner of a perspective shot. Overscan the plane (scale it past the frame) or frame tighter, so the UI fills to every edge.
- A fade or vignette that muddies: light UI faded towards a dark background goes grey, with a bright blob in the middle. Fade dark UI into a dark background (or light into light), keep `Focus` subtle, and check that text inside the sharp area is crisp, not smeared.
- A cursor too small to see or off its target on the click: about 52 px on screen, its tip on the control.
- A jump at a cut where the same UI continues: the outgoing shot's last frame and the incoming shot's first must diff as identical (`diff --frame a:end --against b`). The usual causes: a Camera rect key's default `padding` (0.12) on a rect that is already the framing, a border the outgoing layout has and the incoming one does not (a 1.5 px border draws as 1 device pixel), or a 3D slab's face at z = depth/2 instead of 0.
- A changing word in a fixed line that touches the next word, or leaves a gap before it, for a few frames on each change.
- In a 3D shot of devices or panels, the hero screen softer than the rest: the focus is on the object's origin, not its screen (a laptop's screen stands at the back hinge), or the screen's cover glass reflects too much (`reflection` about 0.1).
- Type that shakes while it scales: about its centre, it climbs the pixel grid a pixel at a time (`measure` shows judder over 0.1 px and many turns). Scale it about its baseline.
- Text that steps: a line pushed or drifted slowly moves a whole pixel every few frames. Compare two frames of a held line from the mp4 (`ffmpeg -ss … -frames:v 1`, then `diff`): they should be identical.
- Bokeh that is grainy, streaked or ragged at its edge: too few samples for the blur (256 for about 80 px), or something that moves (a cursor) out of the focus plane, blurring into a disc.
- A camera that stops in the middle of a move: on `sheet --every 2`, neighbouring tiles bunch up mid-path. Look for a key in the middle of the move.
- An empty product: unticked boxes, zero counts, empty cards on the hero UI.
- An effect that fades in just after a hard cut (a Spotlight's dim, a vignette, a scrim): the first frames show the undimmed picture and it reads as a glitch. Start it already in place on the cut (`at` before 0) and let only its travel play.
- Content off its optical centre: text in a field or a loader in a button a few pixels low. Judge it at 1:1 (`still --crop`), from the glyphs, not the box; an inline SVG sits on the text baseline inside a grid cell, so give it `display: block`.
- Streaks under objects on a reflective floor: the floor's roughness smears small UI text; use about 0.03 with a short fade.

Fix what you find and look again. Report what you checked and what you fixed, not just that it looks good.
