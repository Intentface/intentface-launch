---
name: kinetic-typography
description: Make on-screen text in a launch video read well and move well - hold times, entrances and exits, easing, staggers, word/line/letter levels, masks, anticipation and overshoot, motion blur, syncing type to music, and moving between text states. Gives the values in frames at 60 fps and how to build them with Slam, Reveal, springs and Camera. Use when a shot has a headline, a claim, a label beside the UI or an end card, when writing or reviewing kinetic type, or when text looks mechanical, busy, rushed or hard to read.
---

# Kinetic typography

Text in a video is judged first as reading and only second as animation. If the motion is needed to understand the words, the shot has failed. Expression belongs in the entrance, the exit and the transition; the reading window is calm.

This skill is about how text moves. Whether a shot has text at all, and what it says, comes first from the product-launch-video skill (four jobs for text, the word budget) and the creative-direction skill. The look of the type (face, colour, case) comes from the product, or from a brand the person asked for; a brand's MOTION.md overrides any value here.

The sources behind each number are in [research.md](research.md). Values are in frames at 60 fps; at 30 fps, halve them.

## 1. Every word has three phases: enter, read, exit

- **The read is the hold after the text has landed.** A 4 s title that takes 1 s to arrive and 1 s to leave is still for only 2 s, and those 2 s are what get read. `readingTimeOnBeats(text, t)` gives the hold from the moment it lands, in whole beats; place the exit after it, never inside it.
- **Hold for reading it, then move.** The hold is a floor, not a target: a short line (one to four words) reads in about a bar, and every frame past that is dead time. The engine's floor is 14 characters per second with a 1 s minimum, a ceiling of 17 cps (subtitles go to 17 to 20 cps; type that moves needs more time than subtitles). Numbers, product names and code: `audience: "technical"` (1.25×). Text over busy motion: `competingMotion: "high"` (1.2×).
- **Scale about the baseline.** Type scaled about its centre judders: its baseline lands between pixels, glyphs are not placed at fractions of a pixel vertically, and the line climbs the pixel grid a whole pixel at a time (measured on a 120 px line: 0.29 px of judder and 30 changes of direction; about the baseline 0.04 px and none). `Slam` and `Reveal`'s `scale` already pivot there; for your own type, `useBaseline()` gives the origin. Check with `pnpm launch measure <id> --shot <shot>`.
- **Still while read.** The text settles completely, then at most a secondary drift: under 2% scale or a few pixels over the hold, or the camera's own slow move. No wobble, rotation or glow cycling during the read.
- **Exits are shorter than entrances,** because the word has already been read: 12 to 18 frames on `ease.in`, a quiet fade and lift (`exit` on `Slam` and `Reveal`), or a cut on the beat. Never play the entrance backwards to exit.
- **Let the text time its own hold:** `<Reveal exit="read">` leaves once its last unit has landed and the reading time has passed (`reading` takes the same options as `readingTime`). `revealTimes(text, fps, timing)` gives the same starts and landing frame, to size a shot around its text.

## 2. Timing scale

| Move | Frames at 60 fps | Easing |
|---|---|---|
| Micro (a letter pop, an underline drawing, a caret) | 8 to 15 | `ease.out` |
| Word or line entrance | 18 to 36 (`Slam` 16, `Reveal` 48 per word with a long tail) | `ease.out`, `ease.expo` for hero words |
| Exit | 12 to 18 | `ease.in` |
| Large move or camera push through type | 30 to 60, longer with distance | `ease.inOut` |
| Anticipation before a pop | 5 to 10 | counter-move of 5 to 10% |
| Overshoot settle (hero words only) | 10 to 20 | 5 to 15% past the target |

Duration scales with distance: a word that travels half the frame takes longer than one that rises 12 px. Heavy words (the claim, the product name) take the long end; light words snap.

## 3. Easing: a small library, used consistently

- Use one family for entrances (`ease.out`, or `ease.expo` for hero moments), one for exits (`ease.in`), `ease.soft` for opacity and colour, `ease.inOut` for camera moves through type. Nothing on position, scale or rotation is ever `ease.linear`.
- Entrances are asymmetric: a short acceleration and a long deceleration. Both of the engine's entrance curves already are.
- If the product's own UI moves differently (snappier, softer), define its curves once with `bezier()` in the video and use only those. A reference given as After Effects influence (out a%, in b%) is `bezier(a, 0, 1 - b, 1)`: Carbon's productive curve (20%, 62%) is about `bezier(0.2, 0, 0.38, 1)`. Influence above about 95% on both sides makes the middle of the move so fast it seems to teleport.
- Springs (`spring`, `springTo`, `springEase`) for type that should feel physical. A spring need not overshoot: `bounce: 0` is the default for text.
- At most two recurring motion motifs in a piece (say, words rising out of a mask, and a camera push from one line to the next), plus one special move kept for the hero moment.

## 4. Word, line or letter

| Level | Reads | Use for | Build |
|---|---|---|---|
| Line or phrase | best | supporting lines, anything over 4 words | `<Reveal by="line">` |
| Word | well | headlines, the claim, text in time with music | `<Reveal>` (by word), one `Slam` per word |
| Letter | least | one short display word, mono labels, URLs | `<Reveal by="char">` |

Choose one primary level for the piece and mix at most two. Never animate letters, words and lines in one text block. Letter-level motion is for short words only.

## 5. Stagger and staging

- **Stagger in reading order**, left to right and top to bottom: 1 to 2 frames per character, 2 to 4 per word (`Reveal`'s 0.05 s is 3; `every` sets it in frames, and `staggers(fps).tight` is 4), 4 to 6 per line, about 18 between separate groups. Keep a whole block's stagger under about 18 frames. On the music, `times` gives each word its own frame (`times={[t.beat(8), t.beat(9), t.beat(10)]}`).
- **One focal point per beat.** When two things move, one is clearly secondary: smaller, dimmer, later. Supporting text arrives a few frames after the hero word and moves less.
- **Follow-through:** what belongs to a word (an underline, a highlight, a chip around it) settles 2 to 6 frames after the word, never in lockstep.
- **A beat of nothing before the key word** makes it land harder: an empty frame, or the previous text gone half a beat before the next arrives.

## 6. Hierarchy and the hero word

- The word that carries the meaning gets the biggest move, the longest duration and any exaggeration; everything else gets a short, subtle move. Exaggerate one thing per beat.
- Emphasis by colour goes on the stressed word only, in the product's accent. Do not use colour as decoration.
- Overshoot and anticipation only on hero words, and only where the product's motion or the brand allows it. Clean `ease.out` on everything else.

## 7. Sync with the music

- Text lands with the beat, the stressed syllable or the drop: `t.beats(n)` from `tempo()`, or `beatGrid(beats, fps)` from `beats.json`.
- **Land slightly early.** A visual hit that lands exactly on the transient looks late. Put a word's first readable frame 2 to 6 frames before the beat (`Slam` reaches most of its size in its first frames, so `at: beat - 3` reads as on the beat).
- Cuts, scale changes and camera pushes through type go on downbeats and section changes. A breath in the track is a breath in the type.
- Without music or voice, `wordTimings(text, { fps })` times words to a reader's pace.

## 8. Masks, reveals and transitions between text states

Built type patterns (a line that stays centred as it builds, a word on a reel, a wordmark with a hard cut to its last letters, statement cards on the beat) are in the product-launch-video skill's [patterns.md](../product-launch-video/patterns.md), with their numbers and code.

- **Borrow the video's motif for its title.** A name or headline that arrives the way the product's own content arrives (sliced into rows that sweep in like table cells being filled, typed like a query, condensing out of blur like streamed text) ties the type to the story. Build it from the same timing and easing as the UI motif; the hold still follows the rules above.

- **Fade up out of a blur, by default.** Words come in from nothing: `<Reveal rise={0.25} blur={0.08}>` (no `mask`), each rising a quarter of an em, sharpening out of a slight blur and fading up from 0. A masked rise (`<Reveal mask>`, words wiped up through a clip) reads as a crop when used on every line (a reviewer: "you use too much of the cropped"); keep it for one deliberate moment, if any. Under a mask, `clip-path` padded 0.15 em for descenders, never `overflow: hidden` on an inline-block.
- **Carry the eye from one text state to the next** rather than fading to an empty frame:
  - the camera pushes through a word (or the counter of a letter) into the next shot;
  - the last word stays as the next line hangs off its baseline;
  - in a run of short lines across cuts ("Install it." / "Or fork it."), each line lifts out over its last 12 frames (rising 0.3 em, blurring to 8 px, fading, `ease.in`) and the next fades up out of a blur on the cut, so the eye travels up through the run instead of through an empty frame;
  - a word becomes the next scene's UI, or the text typed into the product lifts out of its field and becomes the headline (product-launch-video skill);
  - the same word shrinks into its place in the next layout (springTo on size and position).
- **A word changing in a fixed line** ("Create [word] video."): a handful of options, one per change on the beats (a bar for the first, then every two beats, then every beat), landing on the last. Each change is a swap, as `Swap` does it: the old word rises away, blurring and fading out in 6 frames; the new one arrives 4 frames later, rising from a little below out of 0 opacity and a slight blur; they never share the space at half opacity. `MotionBlur` on the frames of each change, and a tick on each. The rest of the line glides on a spring of the word's width (`{ duration: 12, bounce: 0 }`): it grows at once for a longer word and shrinks for a shorter one only once the old word has gone, so nothing touches. Let every position land on whole pixels with `landed(x, target)`: rounding every frame makes the spring's slow tail step a pixel at a time. Do not follow the options with a fast scroller of more words; a reviewer found that weird. Land the last option with at least its reading time before the cut (a word needs about 1 s): `check` times every word it can see, so mark the passing options `data-launch-check="off"` (the line around them is what is read) and keep the line and the landing word checked.
- Leave room in the composition for words to move into and out of. Negative space is part of the motion.

## 9. Type for motion

- Sturdy, even strokes and open shapes survive motion blur and video compression; hairlines, thin serifs and scripts break up. Within the product's typeface, use its medium to bold weights for anything that moves.
- Large: text alone on screen 120 to 200 px at 1080p, beside UI 56 to 96 px, nothing under 28 px. Tighten tracking at large sizes (-0.02 to -0.04 em) and loosen it slightly for small labels and all caps.
- Moving text needs more contrast than static text, because blur and compression soften edges. `check` measures contrast against the actual pixels behind it.
- Variable fonts can animate an axis per unit: `<Reveal by="char" axes={{ wght: [300, 820] }}>` runs each letter's axis from the first value to the second as it enters, with the stagger, for a weight ripple through one hero word. Hold the weight still once it has landed. `Slam` takes `axes` too, letter by letter with `axesEvery` (0.6 frames is a quick ripple); masked words rising in caps while each letter's `wght` climbs is `<Reveal by="word" mask axes={…} axesEvery={0.6}>`: each word rises as one, its letters gaining weight in turn.
- A line the next cut interrupts ("Hold my b"): give the line `<Reveal cutOff>` (its last unit is left out of `landed`, `exit="read"` and the reading check) or set the last word as its own `<Slam cutOff>`, landing just before the cut. `cutOff` leaves it out of the reading check, which would otherwise ask for a hold nobody is meant to get.
- `Sweep` builds a title in horizontal slices that sweep in left to right with a glint ahead of each edge: the motif for a product that fills rows or cells. It takes its font and colour from its parent.
- Anything laid out from a measurement (an underline as wide as a word, a caret after it) waits for the font: `useFontsReady(font)`, or the measuring hooks in `kit/fonts.ts`; measured in the fallback font, it is wrong on the first frame each render worker draws.
- Squash and stretch (`stretch()`) is for objects with real velocity, rarely for type; if a playful product calls for it, keep it to one fast word and roughly constant area.

## 10. Motion blur

- Wrap fast type moves in `<MotionBlur when={[[from, to]]}>`, limited to the frames where they move. Its defaults are the film shutter (180°, phase −90°).
- Blur only appears while a word moves, so a properly eased settle comes out sharp. If the text smears during the read, the move has not finished: shorten the move or lower `angle`.
- Slow drifts need no blur. A fast whip with no blur strobes.

## Mistakes and fixes

| Mistake | Fix |
|---|---|
| Linear motion | `ease.out` in, `ease.in` out, springs for physical moves |
| Each element eased differently | The small library in section 3, applied everywhere |
| Everything moving at once | Stagger in reading order; one hero element per beat |
| Text leaves before it is read | `readingTimeOnBeats` hold after it lands; `board` and `check` flag short holds |
| Every word rotating, wiggling, glowing | Two motifs at most; big moves only on stressed words |
| Moving during the read | Settle fully and hold still. No slow drift on DOM text: glyphs snap to whole pixels and a slow push steps a pixel at a time. Let the picture behind move instead |
| Hits that feel random | Land on beats and stressed syllables, 2 to 6 frames early |
| Thin or decorative face breaking up | Heavier weight, more tracking, more contrast |
| Fast moves strobing, or slow ones smeared | `MotionBlur` only on the fast frames |
| Fading to empty between lines | A transition that carries the eye (section 8) |
| Flashing text | Never more than 3 flashes in any second |

## Checking it

1. **Rest frames:** `pnpm launch still <id> --at <shot>:<moment>,… --grid` at the middle of each hold. Sharp (no leftover blur), inside the 96 px safe area, readable at phone size, one focal point.
2. **Entrances and exits:** `pnpm launch sheet <id> --shot <shot> --every 2` around each one. Steps grow then shrink (eased, no linear stretch); no single-frame jump in the middle of a curve; staggers follow reading order and are even; the old text is gone before the new is read.
3. **Rhythm:** `pnpm launch sheet <id> --beats --offset 3`: words land with the beats, and a beat of space comes before the key word.
4. **Reading:** `pnpm launch board <id>` already prints holds, sizes and margins per shot at the sketch, before the timing is agreed; `pnpm launch check <id>` adds contrast as the viewer sees it. Type drawn in a canvas or WebGL (a CRT line, a shader title) is checked only once declared with `declareText(canvas, [{ text, x, y, width, height, size }])` in the paint effect.
5. **Muted:** read the board's stills as if on a phone with the sound off. Can every word be read in one pass?
6. **Consistency:** every entrance uses the same easing family and every exit the other; two motifs at most.
