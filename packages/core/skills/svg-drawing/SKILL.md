---
name: svg-drawing
description: Draw and animate vector pictures for a launch video in SVG or Canvas 2D, as functions of the frame - icons, illustrations, characters, diagrams, objects in 3D as line drawings, marks' parts. Covers taking any picture apart into its parts (shapes, strokes, layers, groups), geometry generated from code instead of typed, a small set of tones and line weights, drawing order and occlusion, solid objects in 3D (a projection, visible faces only, details in each face's plane), lines that draw themselves on and keep moving, and checking at 4×. Use when a shot needs a picture that is not the product's UI and not a logo, when SVG art looks flat, clip-art, wobbly or lifeless, or when an idea needs to be shown rather than said.
---

# Drawing in SVG and Canvas 2D

Most of a launch video is the product's own UI. When it is not (an icon that becomes a state, a diagram of how sync works, a little scene behind a headline, an object drawn in line, the parts of a mark coming together), the picture is drawn in code: SVG in the DOM, or Canvas 2D for pictures with many marks. Both are vectors, and the same rules make them good.

Numbers here are starting points, in frames at 60 fps and pixels at 1080p; change them when a still or a sheet says so.

A drawing fails in two ways. It is too abstract: floating shapes and arrows that stand for something. Or it is too flat: one shape with a gradient where a thing should be. Most of the cure comes before any path is written.

## 1. Decide what it shows, in one sentence

What is it, and what does it do in the shot: "a cassette drawing itself on, then the reels turning", "an envelope folding into a paper plane", "two files sliding together, the clashing line lit". If the sentence needs "and" twice, it is two drawings. A number the drawing shows (a count, a percentage) comes from the same values as the copy, never typed twice.

Draw a real thing whenever you can, and take the look from references (how a surface, an edge, a line weight looks), never a copy of someone's drawing.

## 2. Take it apart

Any picture is a sum of its parts. Before drawing, break it down until every part is a primitive you can make with one function: a rectangle, a rounded rectangle, a circle, an arc, a polygon, a line, a curve through a few points, a word.

- **By scale, top down.** The whole (its silhouette), the big parts (an icon's two shapes, a character's head, body and arms, a scene's ground, middle and sky), the details on them (a window in a wall, eyes in a face, the label on a box), the finishing touches (a screw, a highlight, a seam).
- **By layer, back to front.** What is behind what. This is the drawing order, and the order things can animate in.
- **By what moves.** Parts that move together are one group with one transform; a part that moves on its own is its own group.

Write the breakdown as a comment above the component (the parts in drawing order) and build it in that order. The number of parts follows what the picture is: an icon may be three; a scene or an object seen close, forty. Detail comes from parts that belong (a seam, a lip round an opening, feet under a box), never from noise sprinkled on.

## 3. Generate the geometry, never type it

Path data written by hand comes out wobbly and inconsistent. Write small functions instead and let them make the paths: `rect`, `ring(cx, cy, r)` as points, a polar array (`for (let i = 0; i < 60; i++)` round a dial), an inset copy for a bevel. Every screw is the same screw because it is one function.

- **Units are pixels.** Draw at the size it is seen at 1080p, so stroke widths and text sizes mean what they say.
- **Shapes as points.** Keep a shape as its list of points until it is drawn: then the same shape can be projected into 3D, trimmed to draw on, or morphed, with no special case.
- **Build once, move by transform.** Static parts are computed once; moving parts move by `transform`; only a shape that changes is rebuilt per frame.
- **Curves are smooth and monotone.** A spline through points overshoots between them; use arcs, Béziers placed from a few values, or an analytic curve.
- **A real mark is never redrawn.** Logos come from their own SVG (logo-animation skill), parts exposed where they must move.
- **Canvas 2D takes the same path data**: `new Path2D("M0 0 L10 10…")`.

## 4. Tones and line weights

Tones by role: the ground, the subject, the details, one accent (the thing the sentence is about). Faces of one solid differ by a few percent of lightness, top lighter than sides, not by hue. Take the tones from the product's look (`useProductLook`) or the brand, read while rendering.

Lines in two or three weights, the same everywhere: the outline a thing makes against the ground heaviest, the creases and edges inside it lighter, fine details lightest. In a line drawing that hierarchy is what makes it read as solid. Under a `Camera` zoom, the object's strokes scale with it; give `vector-effect="non-scaling-stroke"` only to guides.

## 5. Order and occlusion

SVG and canvas paint in the order you draw. Anything that wraps round another part (a ring round a globe, a strap round a box) is drawn in two halves, the back half before and the front half after, decided per segment by depth. When parts move past each other, sort by depth every frame.

Every line ends on something: a face, another line, or a deliberate end (a dot, a cap, an arrowhead). Textures stop on a real edge or fade out. No blueprint furniture (leader lines, dimension arrows, dashed hidden edges) unless the subject is a blueprint. At most one label inside the picture; the rest go beside it, set as type (kinetic-typography skill). Text inside a shape has a cap height of about half the shape and room of a tenth of its height round the widest string.

## 6. Solid things in 3D, as line or as shape

A drawing of an object reads as real when it is projected, not faked with skewed rectangles.

- **One camera.** An orthographic projection from two angles: around (`az`, 20° to 40° shows the front and one side) and down (`el`, 15° to 30° shows the top). `x' = x cos az + z sin az`, `y' = −y cos el + (z cos az − x sin az) sin el`. Every point of the drawing goes through it.
- **Visible faces only.** For a box from above and to one side, three faces face the camera (front, top, one side); draw those and nothing behind them. A line drawing then has no hidden lines to fake: the outline is the six edges round the three faces, the creases are the three where they meet.
- **Details live in their face's plane.** Lay each face's details out in that face's own 2D coordinates (u across, v up) and project them: a circle on the front comes out an ellipse, a label leans with the face, spokes turn in the face's plane. For text on a face, set the canvas transform to the face's plane (`ctx.transform` from the projected origin and unit vectors) and write normally.
- **Turn it a little.** A slow change of `az` (10° over 2 s) once the drawing is complete shows it is solid, and is cheap: everything is reprojected each frame.
- **Filled or outlined.** Outline drawings carry the hierarchy in line weight (above); filled ones in the face tones, with the line work lighter. Do not mix shaded fills and heavy outlines on the same object.

## 7. Lines that move

Everything is a function of the frame (no clocks, no `Math.random`; seeded `random()`). The kit has the common moves: `DrawOn` and `dash` (strokes drawing on, `trail` for a comet), `Morph` and `morphPath`, `MaskReveal`, `Goo`, `Glow`, `Displace`, `BlurIn`. In Canvas 2D, trim a part's points to a fraction of its length to draw it on.

- **Draw on in the breakdown's order.** The silhouette first, then the creases, then the details, the finishing touches last: the picture builds the way the eye reads it. Each part over 10 to 15 frames, the next 3 to 4 frames later, so they overlap; a stroke draws from the end that leads into the next part.
- **Then keep it alive.** Once drawn, something moves in it: wheels turn, a dashed line runs along a path (`lineDashOffset` from the frame), a needle settles, the object turns a little. A finished drawing that sits still for more than a beat reads as a slide.
- **Moves follow a target.** A part travelling rides `springTo` with low bounce.
- **One-off events are envelopes from their age.** A flash or a pop: from its frame, a smooth rise over 3 to 7 frames, then an exponential fall; two that overlap add.
- **A change of state crossfades on the quantity.** A gauge's colour follows its value, so every frame in between is right; colour changes more slowly than position (18 to 60 frames).
- **Slow moves are drawn per frame.** Pre-drawn steps show as stepping once they exceed about a quarter of a pixel.

## 8. Check it at 4×

Look before showing it (motion-review skill), closer than for UI:

- `pnpm launch still <id> --at <shot>:+30 --crop x,y,w,h` on every joint: where a line meets another, where a part passes behind, where a texture ends.
- A contact sheet of every move (`sheet --shot <shot> --every 2`): parts passing through each other, an order that flips for a frame, a line drawing on from the wrong end.
- The test: is it at once a real thing at 1×, and does it reward a look at 4×?

When a fault can be counted (lines ending in mid-air, parts outside the `viewBox`, parts overlapping that should not), count it with a small script over the shapes and fix until the count is zero.
