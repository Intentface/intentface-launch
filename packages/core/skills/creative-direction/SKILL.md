---
name: creative-direction
description: The creative direction of a launch video before and above the animation - the one claim, the register, the concept and its recurring visual device, the script spine and hook, the beat sheet with an energy curve, the reveal plan, how to show software UI, and the tightness cut. Use when writing a brief or script, storyboarding, choosing how to reveal the product, when a cut feels flat, monotonous or like a feature list, or when reviewing a board for story rather than polish.
---

# Creative direction

How studios that make good launch films decide what to make, before anyone animates. Most of a video's quality is settled at the brief, the script and the board, where changes are cheap. The sourced research behind every rule, with quotes and links, is in [research.md](research.md); read it when you need the reasoning or an example to show the person.

This skill sits on the product-launch-video workflow: it gives the story its shape (claim, register, spine, energy, reveals), and that skill decides how the product is shown: one journey through the real UI, show don't tell, the look taken from the product, and a flat sketch agreed before the build. Where the two seem to differ, showing the product wins. Every claim on screen comes from the brief or the product.

## 1. Brief: the one thing

Answer these in `brief.md` before any concept:

- Who is it for, and why should they care?
- What should they feel?
- What should they associate with the brand?
- What should they do after watching?
- **The claim: one sentence.** It should match the product's homepage headline. The video is the most memorable form of a claim the launch already makes, not a tour of features. Test: the target viewer should think "I can't believe this didn't exist before".
- **The register, chosen on purpose:** raw demo (clarity, the product's output is the wow), crafted film (taste and feeling are the differentiator), or manifesto (a worldview, for a company launch or a raise). Never average two.
- **Length and cuts:** 6 to 15 s teaser (one claim, one visual, logo), 30 s (claim plus 2 to 3 proofs), 60 to 90 s hero film, about 2 min only for demo-heavy launches. Plan the cutdowns (vertical, sound-off loop) now, since they change the framing.

Ask the person only what the product and its code cannot tell you.

## 2. Concept: a device, not a style

- Write the claim as a verb: "makes work flow", "is less", "is fast at spreadsheets".
- List 10 to 20 physical or graphic analogues for the verb (flow: liquid, a line that never breaks; less: subtraction, whitespace, a dimming light; control: a dial, grids snapping into place).
- Pick **one recurring graphic device** that can carry the whole piece, and let the look follow from what the product looks and feels like to use: its own type, colours and shapes, not a template or another brand. The best devices come from the UI itself (the product's pill, its cursor, its grid, its accent). Start from the feeling and work back to the technique, never from a reference someone liked.
- **Keep the motif all the way to the name.** When the video repeats one action many times (labels sweeping into rows, words typed in, items blurring into place), animate the headline, the product's name and the end card with that same motif, so the title reads as the product's work rather than a template's (in one video: the name is built from horizontal rows sweeping in left to right, as the labels do in the cells).
- Offer the person 2 or 3 genuinely different concepts, each as a logline, one key frame described, and the hook line. Not a dozen moods.

## 3. Script: picture and words together

Write the script in two columns (picture | words) before any shot. Pick the spine that fits the claim:

| Spine | Beats | Use when |
|---|---|---|
| Problem → Reveal → Proof → Payoff | hook, name the tension, reveal, 2 to 3 proofs, end card | the category needs explaining, a new behaviour |
| Manifesto | worldview line, "so we built", glimpses, vision line, logo | company launches, raises, recruiting |
| Pure demo | the product at once, escalating uses, "and it can also…", end card | the output itself is the wow |

- **Hook in the first 3 seconds:** a provocation, an understatement, or a hard number from the product's data.
- On-screen lines of 1 to 4 words, a single line, one idea per beat, verbs over adjectives. A longer thought is split over several cuts, a phrase each. Delete any words the picture already says.
- Sound off is the default in a feed: the picture must carry the story alone, the product visibly doing each thing. Words name what was just shown, a few at a time, held long enough to read (`readingTimeOnBeats`); they never replace the showing.
- Order of introduction: the world or tension, then the one most magical interaction in full at readable speed, then 2 or 3 quick variations proving breadth, then logo, claim and call to action. Hold the name and logo until the viewer wants them.

## 4. Beat sheet with an energy curve

Every shot in `video.tsx` carries its beat: `says`, `copy`, `camera`, `sound`, `notes`. Give each an energy from 1 to 5 in `notes` ("energy 4: …") and read the curve down the list. A launch curve:

1. a spike in the first 1 to 3 s (the hook),
2. a dip into the tension,
3. a ramp,
4. **a breath**: near-silence and stillness just before the reveal (`findBreaths` in the track, or ask for one in the music brief),
5. the peak at the reveal,
6. small oscillations through the proofs,
7. a settled, confident end card (logo-animation skill).

A flat curve feels monotonous however polished the frames are. Invest most in three moments: the first 3 seconds, the reveal with its breath, and the end card; everything else can be simpler.

## 5. Board the hand-offs

The board is the last cheap place to move a beat. Design how each shot hands off to the next, not just the shots: in `pnpm launch board`, look at the last frame of each shot next to the first of the next. That pair is where match cuts and eye-trace transitions are made.

## 6. The reveal plan

One hero reveal and 2 to 4 supporting ones, each named in the shot's `notes`:

| Reveal | In this engine |
|---|---|
| Tease → reveal (fragments first: an edge, a sliver of UI, a sound) | `Camera` on a tight crop of a `Snapshot`, `api.isolate(el)` for one element alone |
| Mask or wipe (through a shape, text counters, the last shot's geometry) | a `clip-path` or mask computed from the frame |
| Light sweep, rim light | `Stage3D`'s `light` animated across `Panel`s |
| Push-in, zoom-through (into a detail that opens the next scene) | `Camera` keys in log zoom, `transitions.zoom`, cut at the fastest frame inside `MotionBlur` |
| Pull-back (a detail becomes the system) | `Camera` from a mark's rect to `fit()` |
| Match cut (shape, colour or movement carried across) | end shot A and start shot B on the same size and position; continue the momentum: cut a 12-frame move at frame 6, pick up on frame 7 |
| Morph (A's geometry becomes B's) | one element on `springTo`, content in `Swap` (ui-motion skill) |
| Assemble (parts fly in and snap on beats) | `Panel` layers landing on a base, `hide`/`isolate` |
| Before/after snap (chaos resolves to order) | `springTo` positions from scattered to laid out, on a downbeat |
| Type-driven (words push or become UI) | `Slam` on the beat, then the UI takes its place |

Cuts land on the beat, so the viewer can predict them; the hero reveal lands where the pattern breaks: after a drop-out, or on the one moment that resists the beat (`offBeat: true`).

## 7. Showing software

- **Rebuild, do not record.** Reduce the UI to the hero path, enlarge what matters, clean the data (short, believable, on-brand, from the product's seed or demo mode), remove notifications and overlays. A `Snapshot` with `hide` and `isolate` is the tool.
- **Every effect shows something.** A 3D burst, a rotation or a sweep earns its place by revealing structure, a change or the next idea; one that only moves the UI around is decoration. After a line that claims something, the next picture pays it off.
- **One camera move per shot**, plus at most one supporting move to reveal the new state. No constant rotation or deep perspective while the viewer reads: 3D between features, flat for reading.
- **Focus the eye, one way at a time:** push in, blur everything but the active component, dim and spotlight, lift the component onto its own plane, or a short label landing beside the change.
- **The cursor is a character with intent:** large enough to see (about 50 px on screen at 1080p), arcs, deceleration into targets, the camera settled before it arrives, a beat before the click, an accent on the click, never wandering. Often the most premium choice is no cursor at all, with the UI answering on the beat.
- **Honest cuts:** a jump cut implies the product does it instantly. When time is compressed, dissolve.
- **Abundance by acceleration.** To show something happening a lot and easily (rows labelled, files sorted, messages answered), show the first few at reading speed, then let the speed rise linearly, under motion blur, until the speed itself is the transition: at its fastest, cut to the next shot already moving the same way, which decelerates into its framing. The viewer reads three, believes thousands, and never sees a "now faster" cut. `accelerate()` and `brake()` in the kit do the maths; the ui-motion skill has the build.
- Patterns that recur: the hero loop (one interaction in full, replayed faster at the end), a grid burst of 3 to 9 tiles of the UI in action on consecutive beats after the hero (each tile a moving moment, not a feature name), a speed proof (counter, side by side), keyboard-shortcut chips for keyboard-first tools.
- **AI products:** show the outcomes and progress the AI creates. Never make orbs, neural nets or sparkles the hero.
- **The product as an object, once.** Give the hero UI one moment as a physical thing (the window as a slab in 3D, a real lens, light running across its edge), then land it flat for reading. It tells the viewer this is a made thing, worth looking at; more than one or two such moments turns it into decoration.
- **Reach is shown where it lands.** A claim about platforms, formats or audiences is shown as the same output in the places people meet it (a video site, a photo feed, a short-video app, each recognisable by layout), not as a row of aspect-ratio frames or a list of logos.

## 8. Rhythm and energy

- Contrast is the engine: fast against slow, dense against empty, loud against silent. In a montage, three fast cuts, one satisfying hold of two beats, then fast again.
- Offset, never unison: secondary elements follow the primary a few frames later; text lands a fraction after the shapes lock.
- One motion personality for the whole piece: the product's own (how its UI moves), or the MOTION.md of a brand the person asked for.
- Anticipation: a small counter-move, a pause or a dip in the music before a big move.
- Continuity across cuts: what exits right enters from the left, or keeps moving the same way.
- Sound is half the pacing: a whoosh or riser on every major move, a hit on every snap, near-silence before the reveal (music-brief skill).

## 9. Tightness pass

Before the final render, and when a board review comes back:

- Cut any shot that does not advance the claim, however good it looks.
- Cut any feature that needs its own explanation; it belongs in docs or its own video.
- Two proofs of the same capability become one.
- Trim every head and tail: enter late, leave early.
- Cut words the picture says.
- Sound-off test: read the stills of the whole board (`pnpm launch board`) as if on a phone, muted. Is the claim clear by the end?
- First-3-seconds test: would the opening stop your own scroll? If not, rebuild the hook.

Hand back, with the storyboard: the claim, the register, the device, the energy curve as a line of numbers, and which shot is the hero reveal.
