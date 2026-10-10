# Kinetic typography: sources

The research behind SKILL.md. Times are given as published (ms, or frames at 24 to 30 fps); SKILL.md converts them to frames at 60 fps.

## Reading comes first

- Gabriel Pulecio's kinetic typography guide: designers often combine two of the letter, word and line levels, but "using all three at once usually impairs legibility". He recommends one or two recurring motion motifs.
- Our Code World: "If a title takes 1 second to arrive and another to leave, a 4-second title only sits still for 2. That still period is the part that actually gets read."
- Renderforest calls choosing the animation before deciding how long viewers need to read "the biggest mistake".
- Kyle Cooper's *Se7en* titles (1995) sacrifice legibility on purpose. Art of the Title notes the sequence "would likely break several guild legibility rules in modern times". It works for a horror mood piece, not for a product video.

## Reading speed

- Netflix English (USA) Timed Text Style Guide: up to 20 characters per second for adult programs, 17 for children's. Netflix's Subtitle Templates guide is stricter: "up to 17 characters per second" for adults, 15 for children. Subtitle events run from 5/6 of a second to 7 seconds.
- UC Davis brand guide: leave text on screen "for at least as long as it takes to read through twice". SSW's post-production rules say the same, assuming slow readers at 200 words per minute.
- Biteable: one second of screen time for every 2 to 3 words.
- Kinetic type needs more time than subtitles, because the eye also follows the motion. The engine's `readingTime` defaults (14 cps, 3 words per second, 1 s minimum, a warning above 17 cps) sit inside these figures.

## Easing and duration

- Material's original motion spec: motion "appears more natural and delightful when acceleration and deceleration occur asymmetrically"; duration scales with distance (300 ms on mobile, 390 ms on tablet, 210 ms on wearables). Material 3 contrasts a 500 ms enter with a 200 ms exit.
- IBM Carbon publishes its curves in After Effects influence terms. Standard productive: cubic-bezier(0.2, 0, 0.38, 0.9), "outgoing 20%, incoming 62%". Standard expressive: 40% out, 70% in. Entrance expressive: cubic-bezier(0, 0, 0.3, 1). Exit productive: cubic-bezier(0.2, 0, 1, 0.9). Micro-interactions: 90 to 120 ms.
- A practitioner graph-editor guide: 60 to 75% influence for "polished, deliberate" motion, 85 to 100% for high-energy kinetic type; above about 95% on both sides, the middle of the move spikes so fast it seems to "teleport". A heuristic, not a standard.
- Common practice for video type (24 to 30 fps): micro-moves 3 to 6 frames (100 to 250 ms), word or line entrances 8 to 15 frames (300 to 600 ms), large moves and camera pushes 15 to 30 frames, exits shorter than entrances.

## Springs and overshoot

- Material 3 Expressive defines motion as springs (stiffness, damping, initial velocity); "a damping value of 1 completely removes spring bounce". Google says the older easing and duration system "is no longer maintained", though it is still documented for transitions.
- Apple, WWDC 2018 "Designing Fluid Interfaces": "A spring doesn't need to overshoot." Bounce is for motion that has momentum behind it.
- Practitioner range for overshoot on type: 5 to 15% past the target, settling over 4 to 8 frames at 24 fps. Anticipation: 2 to 4 frames, a 5 to 10% counter-move.

## Stagger

- iart.ai, "How to Animate Text": "stagger by granularity. Lines 60–100ms apart, words 40–70ms, characters 20–40ms." A vendor guide, but it matches common practice.
- A UI guide: 80 to 150 ms between related items, 200 to 300 ms between distinct groups.

## The 12 principles applied to type

From Thomas and Johnston, *The Illusion of Life* (1981), as practitioners apply them to type:

| Principle | On type | Guardrail |
|---|---|---|
| Squash and stretch | Scale on Y as a word drops and lands; stretch along fast travel | Keep volume constant; playful brands only |
| Anticipation | Pull back 5 to 10% before shooting forward | 2 to 4 frames at 24 fps; skip on dense voice-over |
| Staging | One focal word at a time; dim or shrink the rest | If two things move, one is clearly secondary |
| Pose to pose | Set the readable poses first | Block the read poses before the in-betweens |
| Follow-through | Letters, underlines and shapes settle after the word | 1 to 3 frames per element at 24 fps |
| Slow in, slow out | Ease out on entrances, ease in on exits | Never linear on position or scale |
| Arcs | Words arrive on slight curves; rotate around an offset anchor | Keep the path's shape when retiming |
| Secondary action | A subtle drift during the hold | Under a few percent |
| Timing | Heavy words longer, light words snap | Match the energy of the voice or music |
| Exaggeration | Scale contrast on the punchline word | One thing per beat |
| Solid drawing | Consistent baseline grid and perspective | Respect type metrics when scaling |
| Appeal | Typesetting and layout before any animation | Motion cannot rescue weak typesetting |

Richard Williams, *The Animator's Survival Kit*: "twos for normal actions and ones for very fast actions". For type: render every frame, and use motion blur on fast moves.

## Audio sync

- School of Motion's kinetic typography series (Joey Korenman): a marker on the audio for each word, then the visual hits nudged "back two or three frames" (at 24 to 30 fps, about 0.1 s) so they look in sync. A visual that lands slightly early is perceived as on the beat.

## Motion blur

- After Effects defaults to a 180° shutter at −90° phase, a standard film camera (about 1/48 s at 24 fps). Wider angles streak; narrower ones help if text smears. Blur appears only while a layer moves, so an eased settle comes out crisp. The engine's `MotionBlur` uses the same defaults.

## Masks, transitions, composition

- Masked reveals (text rising out of an invisible baseline) and wipes read as clean and editorial. One guide suggests line spacing of 1.2 to 1.4 on multi-line blocks so masks do not collide during vertical moves.
- Jarratt Moody's "Say What Again" (2007) set the template for dialogue-driven kinetic type with "scale and simple but effective camera movements": the camera travels from word to word instead of cutting.
- An empty frame before a key word makes it land harder.

## Type, contrast, accessibility

- Sturdy, even strokes and open apertures survive motion blur and compression; hairline serifs and scripts break up. Bold sans-serifs are the safe default.
- Variable-font axes can be animated per letter (After Effects 26.0 added Font Axis animators with a range selector), for a weight or width ripple through a word.
- Moving text needs more contrast than static text. WCAG 2.3.1: nothing flashes more than three times in any one-second period.

## Caveats

- The design-system numbers (Material, Carbon, Apple) are written for interface motion. They are the most rigorous published easing and duration specs, but type in a video can run slower and more theatrically.
- Netflix's reading-speed ceilings differ between its documents (17 or 20 cps for adults), and third-party summaries conflict. Treat 17 to 20 cps as a subtitle ceiling; kinetic type needs more time.
- The stagger values, influence percentages and hold formula come from practitioner and vendor guides, or are a synthesis; they are not formal standards.
- No published hold-time rules were found from School of Motion, Motion Design School, Ben Marriott or Jake Bartlett. The read-twice rule comes from institutional and agency guides.
