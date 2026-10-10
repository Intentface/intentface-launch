---
name: micro-animations
description: The principles behind small transitions and micro-animations in a launch video - which easing curve a motion needs (ease.out, ease.swap, ease.soft, overshootEase, springs, linear) and why, how much overshoot, separate clocks per property, short travel with blur, origin and direction, opens against closes, delays, staggers, falloff, shakes and loops - all as functions of the frame in the core engine. Use when choosing an easing curve, an overshoot or a spring for any motion, when designing a small motion that no ui-motion recipe covers (an icon, a label, a loader, a logo detail), or when motion looks mechanical, floaty, jittery or late.
---

# Micro-animations

A micro-animation is a small motion that answers something: a click, a change of state, an arrival. Done well it goes unnoticed, and the UI simply feels made. Done badly it reads as a slideshow (everything on one clock), as floaty (too long, wrong curve) or as jittery (overshoot on something big).

This skill gives the principles and the curves. The ui-motion skill applies them to product UI, with the values per component and the recipes; kinetic-typography covers text that has to be read; logo-animation covers the mark. Everything here is a function of the frame, built from the engine: `progress`, `interpolate`, `springTo`, `ease`, `overshootEase`, `bezier`, and from the kit: `Swap`, `edges`, `stretch`, `rubberband`, `dragValue`, `MotionBlur`. Frames are at 60 fps; at 30 fps, halve them.

## 1. Choose the curve by what the motion is

The curve carries the meaning; the duration only scales it. Decide what the motion is, then take its curve.

| The motion | Curve | Why |
|---|---|---|
| Arrives, opens, grows, slides, resizes, lands, follows | `ease.out` | The workhorse. 40% of the way after a tenth of the time, 96% at half: it answers at once and spends the rest settling. Nearly every micro-animation is this curve. |
| A large travel or a hero arrival that should glide in | `ease.expo` | The same shape with a longer tail; feels expensive. Too slow for small UI. |
| An exchange in place, where nothing travels (icon or label cross-fade, skeleton to content, a pulse in a loop) | `ease.swap` (`<Swap easing={ease.swap}>`) | Symmetric and gentle. With no direction of arrival, neither end should be favoured. |
| Opacity or colour alone | `ease.soft` | A fade reads evenly on it; on `ease.out` it snaps on and lingers. |
| A pop: a small thing arriving with life (a dot, a knob, digits, a check settling) | `overshootEase(amount)` | Passes the target once and comes back, landing exactly at the end. Section 2. |
| A value that changes target more than once, or that should feel physical | `springTo`, `spring` | A change mid-flight keeps its speed. `springEase(bounce)` when a Camera or Cursor key must land on its frame. `springToVelocity` for the speed to hand on at a cut or to size a stretch by; `settleFrames` for when it is at rest. A point is one call (`to: [x, y]`), a colour `springColor` (OKLCH, low bounce). |
| Leaving frame with no cause on screen (a word after its read, a card flying off) | `ease.in` | Accelerates away. Never for a close the viewer just caused: it holds still before it moves, and the UI looks late. |
| Crossing the frame from rest to rest (camera, cursor) | `ease.inOut` | Both ends at rest. Wrong for a response, which must start moving at once. |
| A constant process: shimmer sweep, spinner, a ticker's travel | `ease.linear` | Constant speed is what makes it read as ongoing. Never on a one-off move. |
| The product's own motion | `bezier(…)` | Copy its curves once per video (from its CSS) and use only those; its own feel beats any default here. |

Never put overshoot on opacity, blur or colour (a value past 1 means nothing, or flashes). Never use `ease.linear` for position, scale or rotation in a one-off move.

The tokens name these in one vocabulary, so a video's moves feel like one hand made them: `ease.settle` (= `expo`), `ease.glide` (= `out`), `ease.exit` (a steeper `in`, for leaving frame); `durations(fps)` (`xs` 6, `s` 12, `m` 18, `l` 30, `xl` 48 frames at 30 fps, scaled; given a `tempo()`, also `beat(n)`); `staggers(fps)` (`tight` for words and letters, `default` and `loose` for rows and cards; given a tempo, `onBeat` and `halfBeat`); and `springsAt(fps)`, the named springs as `{ duration, bounce }`. A video can pick one personality and take everything from it: `motion("premium" | "energetic" | "playful", t)` gives its `enter`, `move` and `exit` curves, `spring`, `duration`, `stagger` (inside an element) and `step` (between elements, on the beat). A brand's MOTION.md still overrides them. `videos/motion-gallery` in the packages' repo shows every token side by side.

## 2. Overshoot is a dial, not a style

`overshootEase(amount)` takes the peak as a fraction of the distance. The bigger the overshoot, the earlier it peaks (2% at 70% of the move, 25% at half), so a big overshoot needs a longer duration for the settle to be seen.

| `amount` | Feels | For |
|---|---|---|
| 0 | settled | surfaces, panels, anything carrying text, every close |
| 0.02 | barely there, a little give | a container growing into a larger one (a button opening into a panel) |
| 0.04 | a settle | a toggle knob landing, a check bobbing into place |
| 0.07 | alive | digits re-entering, a counter's last digits |
| 0.1 (`ease.pop`) | playful | a badge or dot appearing |
| 0.25 | a celebration | an icon popping on a positive action, once, small |

- **Overshoot shrinks as size grows.** A 12 px dot can pass its target by a quarter; a panel cannot pass it by 2% without wobbling.
- **Only toward the positive state.** Opening, turning on, succeeding. Closing, turning off and dismissing land flat.
- **On the property that is physical:** position and scale. The fade beside it stays on `ease.soft`.
- **A brand's limit wins** over this table (an Intentface-brand video overshoots 0.05 at most).
- `springEase(bounce)` overshoots far less than its number suggests: `bounce` 0.3 peaks at about 4%. Use `overshootEase` when you mean a visible pop, and a spring when you mean physics.

## 3. Every property gets its own clock

A micro-animation is several motions that happen to start together. Give position, scale, opacity, blur and colour their own duration and curve.

- **Position lands first, the pop runs longest.** Typical: the travel on `ease.out` in about half the time, the scale on `overshootEase` over the whole, the fade in between on `ease.soft`. The thing arrives, then visibly settles.
- **Secondary detail follows the primary.** A box fills, then its mark draws; a container changes shape, then its content swaps 2 to 4 frames later (`Swap`'s `delay`). Lockstep looks pasted on.
- **Colour runs on its own curve** beside a move (a toggle's track fades while its knob travels).
- One `progress()` shared by everything is the slideshow look. If a motion looks mechanical, split its clocks first.

## 4. Travel little, let blur sell the rest

- **Distances are small.** A swap moves 4 px, an arrival 8 to 16; a surface starts at 0.96 to 0.99 scale, never below 0.9. Small icons may start much smaller (0.25 to 0.75): they are small enough to read as one shape. (Exact values per component: ui-motion.)
- **A short travel with a cross-blur reads as a full one.** 1 to 3 px of CSS blur on the leaving and the arriving element, settling to exactly 0, lets a panel slide half its height and still feel like a full open, in less time. 1 px for many small items (streamed words), 2 for most swaps, 3 for page slides, up to 10 for a ceremonial arrival.
- **Blur belongs to movement and swaps.** A plain fade or a colour change is never blurred.
- CSS blur is a look; `MotionBlur` is speed. Fast travel (a spinning digit reel, a flick) gets `<MotionBlur when={…}>` over the frames it moves, which streaks along the motion where CSS blur smears in every direction.
- Squash and stretch from speed (`stretch()`), and a selection's leading edge outrunning its trailing one (`edges()`), are the quiet versions of the same idea: the shape shows the motion.

## 5. Origin and direction say where things come from

- **Grow from the cause.** A menu scales from the corner of what opened it (`transformOrigin` at the trigger), a badge slides in from the side of what it sits on, an overlay grows from the centre because nothing on screen caused it.
- **Swaps run one way, like a conveyor.** The old label leaves upward as the new one rises from below; a cleared field's text drops out as the placeholder drops in. Never mirror them toward each other.
- **Direction carries hierarchy.** Deeper pages come in from the reading direction and leave back the way they came.
- **What caused it stays still; animate the pieces, not the container.** The bell does not move when its badge appears; the page does not shift when a toast arrives; a page's sections slide, not the page. Hold the box's size through a text swap (size it to the longest state) and swap content in the same slot, so nothing reflows.
- **Turn a shape over instead of morphing it** when the two states are mirror images: a chevron scaled from 1 to -1 on one axis passes through a flat line and reads as a morph.

## 6. In and out are different motions

- **Opens invite; closes get out of the way.** A close takes 60 to 90% of its open's time, on `ease.out` (it answers at once), with less travel (a menu shrinks back to 0.99, not 0.97) and no overshoot. A close is never delayed.
- **Each direction can have its own curve.** A hover lifts on a clean `ease.out` and returns on a springy one; a button opening into a panel overshoots a little, and closes flat. In `springTo`, give each target its own `spring`.
- **Celebrations play only on the way in.** Liking bursts; unliking just empties. Checking draws the mark; unchecking clears it.
- **Follow fast, return slow.** Something that tracks the cursor (a tilt, a glare, a magnetic button) follows in about 24 frames and drifts home over about 60.
- **Never replay an entrance backwards to exit**; fade in place. The exception is a reversible pair (tabs, toggles, accordions, icon swaps), which is one motion run both ways, with the same time and curve.

## 7. Rhythm: delays, staggers, groups, loops

- **Delays sequence; they never pad.** An intent delay before something appears (a tooltip after the cursor rests), a short gap before a secondary detail (a check draws after its box fills). If a motion feels late, shorten it instead.
- **Stagger only what changed.** When a number updates, only the digits that changed re-enter, the last ones a few frames behind. Keep a whole stagger under about 18 frames; in a long list, stagger the first few and let the rest arrive together.
- **Neighbours answer with falloff.** When one item in a row reacts, its neighbours react by a geometric falloff with distance (each step about half the last), not equally and not at all.
- **Depth in a stack is a uniform step.** Each layer back is a fixed step smaller and dimmer, peeking out by a fixed amount: the viewer reads the queue without reading the items.
- **A shake decays.** Alternating legs, the first swings longest and slowest, the recovery legs shorter and faster, each on `ease.out`: `interpolate` with one segment per leg.
- **A loop is one cycle with phase offsets.** A grid of dots pulsing on one cycle, offset by column, by ring, from the centre out or in a scattered order, give four different loaders from one motion. Pulses on `ease.swap`, sweeps on `ease.linear`, a cycle of 70 to 120 frames. The phase comes from the frame (`(frame - start) % cycle`), and the shot shows at least one whole cycle.
- **Stepped motion reads as reading.** A stream of lines that holds, steps up on `ease.out`, and holds again feels like something thinking at reading pace; a constant scroll feels like credits. Duplicate the content so a loop wraps without a jump.

## 8. In a video, nobody clicked

The principles come from interfaces, where the person caused the change and is watching for it. A viewer is not: the ui-motion skill's "The viewer did not click" says where to put a change, how much to lengthen it and why one at a time. Two more for micro-animations:

- **It is only seen close.** A 4 px move is invisible at a wide framing. Check micro-animations at the shot's zoom, and push in (or cut closer) for the ones that matter.
- **Retargeting is real.** When a state changes again before the last change has landed, `springTo` keeps the speed it had; chained `progress()` calls each start from rest and stall.

## 9. Checking it

- `pnpm launch sheet <id> --shot <shot> --every 2` around each micro-animation. The spacing between tiles is the curve: `ease.out` bunches at the end, an overshoot shows one tile past the target and back, `ease.swap` bunches at both ends. Even spacing on a one-off move means `ease.linear` slipped in.
- `pnpm launch still <id> --at <shot>:<moment>+N --crop x,y,w,h` to magnify a 16 px detail at the frame after it settles: no blur left over, content centred in its box, nothing reflowed.

| Looks | Usually | Fix |
|---|---|---|
| Mechanical | one clock for every property, or `ease.linear` | split the clocks (section 3), `ease.out` on the move |
| Floaty | too long, or `ease.inOut` on a response | shorten; `ease.out` |
| Late | `ease.in` on a close, or a delay as padding | `ease.out`, remove the delay |
| Jittery | overshoot on something large, or on a close | lower `amount` or 0 |
| Mushy | blur not settled to 0, or blur on a plain fade | end blur at exactly 0; drop it from fades |
| Pasted on | container and content in lockstep | content trails by 2 to 4 frames |
| Busy | two micro-animations at once, or a long stagger | one at a time; stagger under 18 frames |
