---
name: logo-animation
description: Animate a logo - an end card, a sting, an intro or outro, an ident, a looping or "thinking" state - together with its sonic logo. Derives the motion from how the mark is built, times it as anticipation, action, hit and hold, syncs the sound's hit to the lock, and makes sure the held frame is the exact approved logo. Use when a video needs a logo reveal or end card, when making a standalone logo sting, or when a logo moment feels like a template.
---

# Logo animation

A logo animation is a short story with one climax: the moment the mark locks. The motion comes from how the mark is built, the sound shares its tension-and-release shape and hits with it, and it ends on a clean hold of the exact approved logo. The research behind these rules, with the Netflix, Google, Intel, HBO, Pixar and other cases, is in [research.md](research.md).

The logo is the product's own (from its repo), unless the person asked for a video in a brand. When a brand package applies, its rules win over anything here: its logos are the only logos (never redraw or retype a mark), and its MOTION.md sets the curves and the bounce limit.

## 1. Read the mark

Before any concept, write down:

- **Its parts:** strokes, primitive shapes, letters, the grid it was drawn on, negative space, any hidden letter or meaning. Symbol, wordmark, or a lockup of both.
- **What it invites:** draw (a single gesture), assemble (modular parts on a grid), fold, morph (it relates to a product metaphor), act (it can host a character), contain (it can be a window onto the brand's world).
- **Where it will live:** the end card of this video, a standalone sting, an intro, a loop on an event screen, a product state (loading, thinking). How often people will see it: the more often, the shorter.
- **What must not change:** existing colours, motion or sound people already recognise; whether letterforms may be distorted at all.

To animate parts, the parts must be addressable. If the brand package exports the mark only as a whole, add a version with its paths exposed to the brand package (from the same SVG); never approximate the mark.

## 2. Motion principles, then concepts

- Write 3 to 5 principles as adjective → parameter pairs, plus 3 don'ts. "Precise → `ease.out` with a sharp settle, 90° paths, no overshoot." "Warm → soft in and out, rounded arcs." "Human in the loop → stepped typing rhythm against smooth eases." Keep them next to the video (in `brief.md`), so the next logo asset moves the same way.
- Offer 3 distinct concepts, each: the brand verb (belong, connect, think, build), the technique, a one-sentence story, 3 key frames (start, climax, hold), and a sound pattern.
- **If the animation would work on any logo, it is not this brand's.** Particles, beams, glints and light sweeps need a story reason.

## 3. Techniques in this engine

| Technique | When the mark… | Build it with |
|---|---|---|
| Construction | is built from parts on a grid | each part on `springTo` along grid-true paths (not from random directions), parts arriving on beats |
| Line draw | is drawable in one gesture | `pathLength={1}`, `strokeDasharray={1}`, `strokeDashoffset={1 - p}`, in a meaningful stroke order; the fill snaps in on the hit |
| Morph | relates to a product metaphor | one element's size, radius and colour on `springTo`, or `Swap` between clear start and end silhouettes |
| Mask or wipe | has strong negative space or bold letters | a `clip-path` computed from the frame, shaped by the mark itself |
| Fold, ribbon | has a folded logic | `Panel`s on `Stage3D` rotating about their edges, lit so the fold reads |
| Container, zoom-through | can be a window onto the brand's world | `Camera` pushing into a counter or shape in log zoom; return cleanly to the static mark |
| Kinetic logotype | is a wordmark, ideally on a variable font | per-letter timing (`Slam`, `Reveal`), weight or width from `fontVariationSettings` computed from the frame; performance in one letter or detail, not every letter equally |
| Character | can host a character | anticipation, `stretch()` on real velocity, a look to camera |
| Particles, many into one | stands for many things becoming one | `random(seed)` for placement; only with a reason (the catalogue, the community) |
| Light sweep, glint | is premium or physical | one light event (`Stage3D`'s `light`), synced to the hit |
| States (listening, thinking, success) | lives inside the product | loops on `frame % period`, 300 ms to 1.5 s per state |
| Point of view (anamorphic) | is made of lines or rays from a point | parts scattered in 3D that are the mark from exactly one camera angle; see below |

**Symbol, then wordmark.** The symbol performs; the wordmark resolves 9 to 24 frames after the symbol settles, with a simpler motion (fade, short slide or mask) so it does not compete.

**Point of view, as built for the Intentface sting.** Put each stroke in the plane spanned by its 2D direction and the camera's final axis. From the side the strokes fan out in depth; from the front each one projects onto its stroke. A disk or hoop in a plane facing the camera's side view is a straight bar when seen edge-on. The build:

- The light module in `@intentface-launch/three` (`Beam`, `Ring`, `Wave`, `Glow`, `Cone`, `Prism`, `Smear`, `useStageItem`, or the `<Light.*>` components for a handful of lights; see its LAUNCH.md) on a black stage.
- When the concept is a prism, use the real thing: a `Cone` with a little `haze` for the incoming light through air, a `Prism` (or `spectrumBands`) for the split, so the angles and the order of colours are physical; `dispersion` 3 to 5 makes the fan wide enough to read. A soft `Ring` (`soft: 1`) is a glowing rim where the hard torus reads as a neon tube.
- Lens effects come from the light itself: `post.halation` (0.3 to 0.5) for a warm bleed round the brightest strokes, and at most faint `post.ghosts` (0.2) in the flight. Switch ghosts off before the lock, so the held frame is the exact logo.
- Fold the tilts to 0 by the lock, because perspective stretches tilted strokes past their length.
- Soft light first, the crisp stroke last. Beams stay soft (`hard` 0), thin, and split into the logo's colours (`spectrum`, `spread`) while they scatter. Over the end of the fold they gather to the stroke's width, recombine (`spectrumMix` 0) and turn crisp (`hard` 1).
- Colour by the logo's own gradient laid over the world (`gradient`), so the colours are exact when the camera faces it.
- Brightness stacks wherever strokes converge. Start strokes at the hub's edge, and fade the redundant ones as they merge, or the centre washes to white.
- Keep the mood calm. The reviewer's words on the first cut were "too bright, too thick", and "we are not welding the logo". Neon tubes, a white-hot hub and flying sparks read as welding. Soft laser-like streams, gentle bloom and shallow depth of field read as intent guided through a prism. The references were prism photographs and out-of-focus rainbow light leaks.
- Depth is mood. The second review asked for more bokeh, a wider lens at the start, and soft light waves instead of 2D rings. It also asked for ambient light, because the streams looked flat without air around them. Open close, on a wide lens (around 60°), looking down the incoming line so it rises from the bottom of the frame to the centre. Let the beam run all the way in, so its tail clears the frame, and start the turn straight away: a drift or a pause before the turn leaves the beam lingering in a corner. Put the turn's fastest point late enough that the mark resolves into the lock rather than waiting for it.

**Handing off from 3D to the exact logo at the lock.** Seen straight on from `fillDistance(1080, fov) / zoom`, one world unit is `zoom` pixels. With world units set to logo pixels, an SVG layer at the same zoom and centre takes over pixel for pixel. Put the SVG above the stage, fade it in over the lock, and fade the stage out underneath it, so the bloom decays as a halo around the flat logo. Verify with `pnpm launch diff <id> --frame <shot>:<flash>-1 --against <shot>:<flash>`: both frames side by side with the difference in magenta, and where it is. Only brightness may differ, never position; a ring of magenta round every edge is an offset.

**Black to black: giving the mark back to the light.** The audio-logo cut of the Intentface sting shows only the mark and starts and ends on black, so it can sit anywhere: before a talk, after a clip, under a social post. It is the same flight, impact and turn into the lock, then:

- **Hold the exact mark through the tonal tail**, about 1 s. Let the bloom decay to a clean flat hold, then fade the stage back in under the SVG over about 10 frames before the release. The halo returning reads as the mark gathering itself. The stage popping in under an opaque SVG shows as a halo pop.
- **Hand back the way you handed off.** One zoom function after the lock (`markZoom`), used by both the SVG and the 3D camera (`distance = fillDistance(1080, fov) / zoom`). It starts at zero speed on the lock and never stops: slow under the hold (1.15× by the release), fast into the light. The lock stays the stillest frame, and the push flows on into the release without a new start.
- **Release as the fold played backwards, one part at a time.** Drive each arm with its own unfold (0 locked, 1 scattered), started in a seeded order 3 frames apart, and feed `1 - unfold` into the same fold functions (hardness, thickness, spectrum recombination, tilt). Each arm flickers as it lets go: two quick soft dips on that arm alone, never the whole frame (which would be strobing). The line's tail runs on into the wall: the intent is taken back.
- **Push straight on through the hub.** Widen the lens (24° → 40°) at constant zoom, so the tilted streams open out in depth and pass the lens, and open the focus back into bokeh. Do not turn the camera here: a 16° drift swung every stream to one side of the frame.
- **Fade the light, not the page.** Scale every gain by one fade (`ease.inOut` to 0) as the streams fly past; close to the lens they stack, so the fans come back at about 60% of the level they left at. The streams return to black about 20 frames before the end.
- **Cut the length to the sound.** Measure the tail (`ffmpeg -ss <t> -t 0.1 -af volumedetect`) and end where it is inaudible (-57 dB at 4.4 s here): shorter than the full sting (5 s) on the same track, with the lock still on the boom.

**Revealing a wordmark from the real component.** Clip a copy of the logo component per letter cell with `clip-path: inset(…)` computed from the frame, for example opening each letter vertically out of a line. Once every letter has settled, swap all the copies for one unclipped component.

## 4. Timing

At 60 fps. On a beat grid, lock on a downbeat.

| Variant | Length |
|---|---|
| Sting, micro | 1 to 2 s |
| Intro, ident, end card | 3 to 5 s |
| Long, theatrical | 6 to 15 s |
| Outro with URL or call to action | 3 to 6 s including the hold |
| Loop | 2 to 8 s, seamless |

A 3 s sting (180 frames; 6 beats at 120 BPM):

1. **Anticipation**, 0 to 24: a seed element, a gather, a riser starting.
2. **Action**, 24 to 84: the technique plays out.
3. **Hit**, about 84 to 108: the mark locks. The main sync point.
4. **Resolve and hold**, 108 to 180: the wordmark settles, details land, the sound's tail decays.

- The fastest motion is just before the lock and the stillest moment is the lock: the contrast is what makes it land. Wrap the fast part in `<MotionBlur when={[[start, lock]]}>` so the blur ends before the lock frame and the lock is sharp.
- Quick but legible: no state flashes past too fast to read (`sheet --every 2` around the action).
- Settle, do not stop dead: an ease-out into rest, or a small overshoot only if the principles and the brand allow it. Never bounce text.
- **Hold at least 1 s** on the resolved logo (2 s in an outro), longer with a URL or call to action (`readingTime` for its text).

## 5. The final frame is the approved logo

Everything before the lock is optional; the held frame is not. It must be the brand's logo component, unmodified: exact colours, proportions, clear space, centred.

- `spring()` and `springTo()` approach their target and never exactly reach it, and a blur of 0.001 px is still a filter. From the lock on, render the logo with no transform, filter or opacity at all (a condition on the frame), or lock with `progress` or `springEase`, which end exactly on 1.
- Make `check` prove it: `matches: { at: "end", reference: () => <Logo …same position and size… />, label: "lockup" }` on the end card's shot. `check` renders the held frame and the reference alone on the video's background, and fails when more than 0.1% of pixels differ (the three pictures go to `out/check/`). Use the brand's static lockup component as the reference when the brand ships one, and the same component as the animation's final state, so the check catches a spring that never quite arrives or a filter left on. Against an approved PNG: `pnpm launch diff <id> --frame <shot>:end --against approved-logo.png`.

## 6. The sonic logo

- **1.5 to 3 s, shaped as tension then release:** a beginning, a middle and an end. Two percussive hits then a tonal release (Netflix), texture resolving into tone (HBO), one rich open chord that swells and decays (Mac startup).
- 2 to 6 notes, a rhythm from the name's syllables if possible, an interval resolving upward for optimism. **Timbre is identity**: one signature source is worth more than the melody.
- Layers, in order: a riser under the anticipation, a transient (click, knock) on the lock, a short sub under it for weight, the tonal element people remember, shimmer or air carrying the hold, a tail that decays before the cut.
- **Sync:** the transient lands on the lock or 1 to 2 frames before it, on a sharp frame, never during a blur. Parts assembling can each take a note, the last note on the last part.
- **A delivered sonic logo has no beat grid** (`beats` reports low confidence on a 4 s sting). Time the picture to its events instead: `pnpm launch sound <id> --png` lists them with frames (on the Intentface sting: impact f20.5 in sub, low and mid; a pulse every 0.131 s; the riser to f144; cut to boom f143, the high band cut and a +10 dB low rise peaking at 2.48 s; the tail from f153.5). The boom at a riser's cut is a band-limited rise, not an onset, which is why `beats` misses it. Declare the lock: `hits: [{ at: 0, sound: "boom" }]` on the lock shot, and `check` fails if the picture drifts more than 2 frames from it.
- In this pipeline the sound comes in the video's track: put the logo's lock time and its sound pattern in the music brief's hits (music-brief skill). Mix it for phone speakers: mono-safe, the sub supporting rather than essential. `pnpm launch check` measures -14 LUFS integrated and -1 dBTP by default (social); broadcast delivery of a sting wants EBU R128 s1: `audio.loudness: "sting"` (-23 LUFS, true peak -1 dBTP, and the loudest 3 s at most -18 LUFS). `mix` masters to it and `check` measures all three: a loud-for-its-length sting can pass integrated and still break the short-term cap.
- It must read without sound, and the sound must read without the picture.

## 7. Variants

Plan them before building, since each changes the framing:

- short and long cuts (separate video ids sharing the logo component),
- symbol only, black to black: the audio logo, usable before or after anything. The held frame is then a hold in the middle, not the last frame, and the rules of section 5 apply to the hold. Check the brand's rules for the standalone symbol (Intentface: `IntentfaceAsterisk` only where Intentface is named elsewhere in the same context),
- 16:9, 9:16 and 1:1 (`width`/`height` in `defineVideo`),
- light and dark,
- with and without sound,
- a loop, whose last frame equals its first, motion included,
- product states (thinking, success) if the logo lives in an AI or SaaS product.

## 8. Restraint and checks

Remove every effect that does not serve the brand verb. Then:

- [ ] The motion comes from this mark's construction; it would not work on another logo.
- [ ] One climax; the sound's hit on the lock (±1 to 2 frames), on a downbeat.
- [ ] The held frame is the approved static logo; hold at least 1 s (2 s in an outro).
- [ ] Symbol and wordmark are sequenced, not competing.
- [ ] The length fits how often people will see it.
- [ ] The easing follows the written principles; no template effects (stock particle bursts, glitch, lens flares, chrome).
- [ ] No more than 3 flashes in any second.
- [ ] Loudness per the target platform; mono-compatible.
- [ ] The principles are written down, so the next logo asset matches.

Look at it as for any shot (motion-review skill): stills at the start, the lock and the hold, and a contact sheet across the action.
