---
name: ui-motion
description: The values and recipes for animating a piece of product UI inside a launch video, frame by frame - a button becoming a loader, text or icon swaps, tabs, toggles, dropdowns, modals, toasts, badges, success checks, counters, skeletons, streaming text. Gives the scale per component (durations in frames, distances, scales, blur, curves) and what changes because the viewer did not click. Use when a shot shows a specific piece of UI changing state, or when writing a Snapshot's animate().
---

# UI motion in a launch video

The values for product UI motion, per component, in this engine. The numbers are a scale tuned for interfaces, converted to frames at 60 fps; the micro-animations skill has the principles behind them (which curve, how much overshoot, opens against closes, clocks per property). No CSS motion applies here: scenes cannot use CSS transitions, timers or `will-change`, so every recipe below is a function of the frame, built from `progress`, `springTo`, `Swap`, `edges`, `Reveal` and `interpolate`.

## Match on usage, not on the nearest number

Decide what the motion *is* (a dropdown opening, a text swap, a toast leaving), then take that row's values. A 20-frame dropdown close is not "close enough" to a 15-frame one; it is wrong because closes are quicker than opens. If a moment matches no row, design it with the micro-animations skill rather than borrowing the nearest number.

## The scale

Durations at 60 fps (at 30 fps, halve them). Distances, scales and blur are in the UI's own CSS pixels: inside a `Camera` or on a `Snapshot` they zoom with the UI, which is right.

| Duration | Frames | Use |
|---|---|---|
| stagger | 2 to 3 | offset per item in a list or per word |
| micro | 5 | intent delay (tooltip), gap before a check draws, a shake segment |
| quick | 9 | any close, a text swap, a tooltip appearing |
| fast | 15 | icon swap, dropdown or modal open, tab indicator, page slide |
| medium | 21 | panel or toast close, a morph closing |
| slow | 24 | panel open, skeleton to content, input clear |
| very slow | 30 | emphasis: success check, badge, headline reveal |

| Distance | px | Use |
|---|---|---|
| micro | 4 | text swap |
| small | 6 | shake |
| base | 8 | page slide, number pop-in |
| medium | 12 | text reveal |
| toast | 16 | toast rising |
| large | 30 to 40 | a one-off celebration (check bob), menu items in a morph |

Distance goes down with frequency and up with ceremony. Anything travelling more than about 40 px that is not a whole panel reads as sluggish.

| Start scale | Use |
|---|---|
| 0.96 | modal |
| 0.97 | dropdown, toast, menu in a morph |
| 0.98 | tooltip |
| 0.99 | dropdown closing |
| 0.25 to 0.75 | icon swap (icons may scale a lot; surfaces never below 0.9) |

Blur softens a swap or a slide and settles to 0: 1 px for streaming words, 2 px for text, icon, panel and skeleton swaps, 3 px for page slides and text reveals, 8 to 10 px for a success check's arrival. Never blur a plain fade or a colour change.

Curves are named in each recipe; the micro-animations skill says how to choose one for a moment no recipe covers. In short: `ease.out` for surfaces (open, close, slide, resize, position), `ease.swap` for exchanges in place, `ease.soft` for opacity and colour, `ease.linear` for shimmer and spinners, `springTo` for anything physical, `overshootEase(amount)` for the few entrances that pop. The product's own motion and a requested brand's bounce limit win over any value here.

## Opens and closes

The principles (closes quicker and quieter than opens, reversible pairs symmetric, delays only to sequence, one clock per property) are in the micro-animations skill. The pairs, in frames:

| Component | Open | Close |
|---|---|---|
| dropdown, modal | 15 | 9 |
| tooltip | 9 (after 5) | 3 |
| toast | 21 | 15 |
| panel | 24 | 21 |
| button into menu (morph) | 21 | 15 |
| checkbox | 9 fill + 21 draw | 9, no draw |
| tabs, page slide, accordion, icon or text swap | one motion | the same, reversed |

## The viewer did not click

Web timings assume the person caused the change and is looking at it. A viewer is not.

- Put the change where the eye already is: on the cursor, at the camera's centre, on the beat.
- The click lands on the beat and the UI answers on that frame. Do not delay the response to "let the click read".
- The web scale is the floor. If a change flickers past on the contact sheet (`sheet --every 2`), lengthen it by up to 1.5×, not more; a slow UI looks broken.
- One change at a time in frame. Two components animating at once is the UI equivalent of two camera moves.
- Hand-drawn UI does not hand over to the real one. When a scene draws a piece of product UI itself (a pill grown out of a typed word), keep the drawn one to the end and hide the snapshot's own. Cross-fading the two dips the translucent backgrounds (two 50% layers do not make one 100% layer), and every detail that differs pops in and shifts: another icon, a remove button, a different width (a reviewer saw the pill background vanish and come back, the Helsinki pill jump, and sparkles fade in). Leave out details that only matter to someone using the app (a remove ×).
- A choice the viewer must follow (a menu, a set of options) is dealt in item by item, 4 to 6 frames apart, then held still for its reading time before the cursor picks from it. The web's 15-frame menu is for someone who already knows what is in it.
- The camera waits for the change. Hold close until the UI has landed in its new state and been seen for about a beat; only then move away. A pull-back that starts while the change is still happening loses it to motion blur (the events video's query pills rose into the filter row as the camera left, and the reviewer never saw them become filters).

## Recipes

Frames are relative to the triggering event (usually the cursor's click frame, `c`). Whole patterns built from these (a status pill, state spreading through a list, a task finishing, a chat filling in, a streaming answer) are in the product-launch-video skill's [patterns.md](../product-launch-video/patterns.md), with their code.

| Moment | Build it with |
|---|---|
| Text changes in place ("Save" → "Saved") | `<Swap items={…} exit={9} enter={9} delay={0} blur={2} rise={4} scale={0} easing={ease.swap} />`: out upward, in from below. |
| Icon swap (play ↔ pause, menu ↔ close) | `<Swap exit={9} enter={15} delay={3} blur={2} scale={0.5} easing={ease.swap} />`: both icons in one cell. |
| Shape changes state (button → loader → check, + → menu) | One element: width, height, radius and colour on `springTo` with one target per state; content in a `Swap` (default easing) that trails the shape by 2 to 4 frames. + → menu: the container grows on `overshootEase(0.02)` over 21 frames and closes flat on `ease.out` in 15; the plus rotates 45° and fades in 12 while menu items slide 40 px and unblur from 0.97. |
| Card resize | `springTo` on width or height, about `{ duration: 18 }` (no bounce); the content re-lays out inside, never scales. |
| Dropdown | Grows from its trigger's corner (`transformOrigin` at the trigger): scale 0.97 → 1 over 15 frames `ease.out`, fade on `ease.soft`; close to 0.99 in 9, `ease.out`. |
| Modal | From the centre: scale 0.96 → 1 and fade over 15 `ease.out`, close in 9. Dim what is behind it on `ease.soft`. |
| Panel reveal | Slides into its region with fade and 2 px blur over 24 frames `ease.out`, closes in 21; travel can be half its height, the blur sells the rest. |
| Page slide (list ↔ detail) | Old page 8 px out and fading, new page 8 px in with 3 px blur, 15 frames `ease.out`, both at once. |
| Tabs, segmented control | `edges()` for the indicator; label colours cross-fade by distance to the indicator's centre. |
| Toggle | Knob over ~21 frames on `overshootEase(0.04)`, or `edges()` so it stretches as it goes; the track colour on its own `progress(…, 12, ease.soft)`. |
| Tooltip | Appears at `c + 5`: scale 0.98 → 1 and fade in 9 frames `ease.out`; leaves in 3. Moving to the next trigger, it travels (10 frames `ease.out`) instead of closing and reopening. |
| Toast | Rises 16 px with fade, 0.97 → 1 and 2 px blur, 21 frames `ease.out`; leaves in 15. Stacked: each older toast steps back 0.06 in scale and 40% in opacity, peeking 12 px. |
| Badge appears | Slides in from its trigger's side over 15 frames `ease.out` while its dot pops on `ease.pop` over 30 and fades in on `ease.soft` over 24; the trigger never moves. Leaves in 11, `ease.out`, no pop. |
| Success check | Over 30 frames `ease.out`: fade in, rotate 80° → 0, unblur from 10 px, and rise 40 px on `overshootEase(0.04)` for the settle; the path draws from `c + 5` over 30 frames. Draw with `pathLength={1}` and `strokeDasharray={1}`, `strokeDashoffset={1 - p}`: no path measuring. |
| Checkbox | Fill in 9 frames, then the mark draws in 21, both `ease.out`; unchecking is 9 frames with no draw. |
| Words become filter pills (a query understood) | The words it did not need fade and blur out in 14 frames. The kept ones grow their pill in place: background, padding and icon on a `spring` (`{ duration: 22 }`, no bounce: it carries text), text 16 → 14 px, a joiner word ("in") kept as the pill's own. They set off for the filter row 12 frames into the grow, on `{ duration: 32, bounce: 0.05 }`, 3 frames apart: one move, not grow-then-travel from rest. |
| Number update | Each changed digit re-enters 8 px from below on `overshootEase(0.07)` with 2 px blur over 30 frames; the last two digits 4 and 8 frames later. For a big moment, digit reels spinning over ~84 frames `ease.expo`, 5 frames apart per column, inside a vertical `MotionBlur`; `Count` for a plain count-up. |
| Skeleton → content | `<Skeleton ready={content} at={c} lines={3} />`: a linear shimmer every 90 frames, then a cross-fade with a 2 px cross-blur over 24 frames `ease.swap`, content 3 frames behind, both in one grid cell so nothing shifts. |
| Headline and supporting line | `Reveal`: 12 px rise, 3 px blur, 30 frames, lines 2 to 3 frames apart; leaves as one quiet fade. |
| Keyboard shortcut | `<KeyChip keys={["⌘", "K"]} at={c - 20} press={c} />`: modifiers go down first, the last key on the click beat, all up together after `hold` (10). Shown where the action happens, never as a caption. |
| Typing into a field | `Typewriter` with `cadence`: uneven keystrokes from `typingCadence(text, fps, { seed })`, longer after spaces and punctuation. In the product's own field (a `Snapshot`), `api.type(input, text.slice(0, n), { blinkFrom })` with `n` from the same keys: the value, the end kept in view and a caret in the field's colour. Anything grown from the typed words (pills, highlights) takes its boxes from `api.textRects(input, text)`, never from a canvas measure. Build the keystroke `sfx` from the same `times` (`sfx:typing` with `hit`), so every key has its sound. Hide the cursor while typing (`hidden` ranges). |
| Streamed text | A word every 4 frames, each fading in over 21 `ease.out` with 1 px blur. Reads as text condensing into place, where `Typewriter` reads as keystrokes. |
| A list at scale (abundance by acceleration) | The first 2 to 4 items land at reading speed, each held about a beat. Then the list scrolls in the direction of reading with a velocity that ramps linearly (`v = v0 + a·(f - f0)`, so the offset is `v0·t + a·t²/2`; never an eased offset, which slows again) over 1 to 2 s to several screen heights a second. `<MotionBlur when={[[f0, cut]]}>` over the ramp: the smear grows with the speed by itself; raise `samples` if copies show. Cut at the peak to a shot that enters at the same speed and direction and decelerates into place. `accelerate({ start, every, rampAt, total, length })` gives each item's landing frame (`landsAt(i)`, strictly in order), the front for the camera to follow with a soft start (`follow(f, { after })`) and the speed at the cut (`speed(length)` × item size × zoom); `brake({ speed, frames, cruise, to })` is the next shot's position, from that speed to its framing with no bump. Items keep arriving during the ramp (labels landing as rows pass) so the speed reads as work, not scrolling. Needs enough real items to fill the run: generate the data, do not loop ten rows. |
| Thinking or shimmer label | A highlight band swept across the text over ~120 frames, linear, as a background position computed from the frame; change the label with the text swap above. |
| Error | A shake from `interpolate(f, [c, c+5, c+9, c+14, c+18], [0, 6, -4, 2, 0])` px with `{ easing: ease.out }` (per leg) while the border turns to the error colour on `ease.soft`; hold the message long enough to read (`readingTime`). |
| Hover along a row (avatars, chips) | The hovered item lifts 4 px and scales 1.05 over 19 frames `ease.out`, neighbours lift less with distance (× 0.45 per step); the return is springy, `overshootEase(0.25)` (a 1 px dip on a 4 px lift). |

In a `Snapshot`, the same recipes run inside `animate(api, frame)`: move the one row, swap the one label, set styles from the frame.

## Cursor, focus and proof

- **Cursor.** `hover` on a key arrives that many frames before `at` and rests (10 to 20 frames before a deliberate click), with a short press-in before the click; `at` stays on the beat. `hidden={[[from, to]]}` fades it out while it would be in the way (typing, a camera move). Its sounds come from the same keys: `sfx: cursorSounds(keys, { src: "sfx:click", peak: -14 })`.
- **Pointing at one thing.** In order of weight: a Camera push onto the rect (`frameRect`), `Focus` (depth: blur and fade outside), `Spotlight` (dims everything outside a rounded cut-out; move it between neighbours on stops, since one travelling across another element lights both), `Lift` (the element rises 10 px and scales 1.04 on a spring with a soft shadow while the rest dims; goes after the UI in the tree). One per moment.
- **Callout.** `<Callout target={rect} placement="right">Label</Callout>`: the dot pops, the leader draws on, the label slides in, at a readable size (30 px) whatever the zoom. Pass `placement`; `auto` points toward the frame's centre and can land on UI or switch sides under a moving camera.
- **Proof visuals** (`@intentface-launch/core/kit`): `Bars` (grow 4 frames apart on a 36-frame spring, values counting but never past the real value), `LineChart` (draws along x on `ease.inOut`, a monotone curve that never overshoots the data, the end dot pulses once on landing), `BeforeAfter` (a divider moved on `split` stops; each label fades with how much of its side shows), `SpeedRace` (lanes with linear bars and timers in real seconds, `frames` to compress screen time; only the winner gets the accent). Numbers use tabular figures. A number on screen needs a source in the brief.

## Checking it

- `pnpm launch sheet <id> --shot <shot> --every 2` around each change: exit gone before the entry is readable, no two pieces of content at full opacity at once, the shape settles before the next change.
- Stills at the frame after each change settles: text sharp (no leftover blur), content centred in its container.
- Everything the motion-review skill asks for, as for any shot.
