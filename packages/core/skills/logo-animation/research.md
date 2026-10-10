# Animating Logos and Their Sonic Logos: A Craft Guide for a Logo-Animation Agent Skill

Treat a logo animation as a short story with a single climax. It should be derived from how the mark is actually built. It should resolve on a clean, held final frame. It should usually be paired with a sonic logo of about 1.5–3 seconds that shares its tension-and-release shape. The best-documented cases (Google's dots, Netflix's "ta-dum" and ribbon ident, Intel's bong, HBO's "Static Angel") are all systems rather than single clips, and each was built through extended iteration.

## TL;DR

- **The terms:** A *logo sting / ident / logo reveal* is one short animated clip. A *motion identity* (also called motion language, motion theory or motion system) is the set of rules that makes every animation feel like the brand. A *sonic logo / audio mnemonic* is the 1.5–3 s audio signature. The best-documented brands design all three together. Koto's own framing is "Level 1: animated brand assets" and then "Level 2: motion systems".
- **How to make one:** Get the motion from the logo's geometry, construction and brand idea. Examples: Airbnb's Bélo was designed so "anyone can draw" it, which invites a line-draw. Slack's mark is built on a grid from two extractable shapes, which invites assembly. Define 3–5 motion principles, explore rough concepts, then pick one climax moment and sync the sound's "hit" to it. End on a clean hold and ship variants: short/long, light/dark, loop/"thinking" state, reduced-motion.
- **Sound:** Build tension, then release. Netflix's ta-dum is two percussive knocks (Lon Bender's wedding ring on a cabinet, layered with a slowed anvil and muted thuds) followed by a reversed-guitar "blossom" from Charlie Campagna. Timbre matters as much as melody: Intel's own @IntelTech account says that in a 60-person focus group "only 80% of participants could recognize the tune when played on violin, as opposed to 100% with the correct tone—even with wrong notes added." Deliver to the platform's loudness spec, and for short-form use EBU R128 s1 (−23 LUFS integrated, short-term ≤ −18 LUFS, ≤ −1 dBTP).

---

## 1. Terminology

| Term | What it is | Typical length | Notes |
|---|---|---|---|
| **Logo sting** | A very short animated logo moment, often with a sound "hit", used to open or close video | ~1–3 s | Broadcast and post-production slang; "sting" also means the audio hit itself |
| **Ident** | A branded clip that identifies the channel, studio or platform before content | ~3–10 s | Variety used "ident" for Netflix's 2019 animation, calling it "an 'ident' in designer lingo" |
| **Logo reveal / intro / outro / bumper / end tag** | A functional placement of an animated logo at the start or end of a video | Intro 3–6 s; outro/end tag 2–5 s | GitHub's toolkit calls its Invertocat animation the asset "for end tags and bumpers in marketing videos" |
| **Production logo** | The film-studio version (Pixar lamp, 20th Century fanfare, MGM lion) | 5–20 s | Often has theatrical "long" and home-video "short" cuts; Pixar has a short version that starts on the completed logo |
| **Animated logo / dynamic logo** | A logo whose resting state includes motion or behavior | Loop or event-driven | Google's dots are "a dynamic and perpetually moving state of the logo" |
| **Motion identity / motion language / motion theory / motion system** | The rules for how the whole brand moves: easing, speed, direction, rhythm, behaviors | n/a | DixonBaxi calls the result a "motion theory", defined as "principles that guide the animation and interaction of any part of the brand experience where motion is needed" |
| **Sonic logo / audio logo / audio mnemonic / sound mark** | The short sonic signature, the audio equivalent of the logo | ~1.3–3 s (up to 5 s) | MassiveMusic: "the typical 2-4 second sound"; Made Music's Kevin Perlmutter: "a short, two- to three second expression of the anthem" |
| **Sonic identity / sonic branding / audio branding** | The full system: anthem (30–60 s), mnemonic, UX sounds, guidelines | n/a | Sixième Son composes "a long track of 40 to 60 seconds that sets the foundation… At its heart lies the sonic logo" |

**The key distinction:** An article in PRINT Magazine puts it bluntly: "A motion identity is not an animated logo." A motion system "establishes a shared language for movement, providing the logic, behaviours and reason for why a brand moves." The agent should always produce a single sting together with the principles that generated it, so the next asset can be made consistently.

---

## 2. Process: how studios ideate a logo animation

### 2.1 Discovery (questions the agent should ask or infer)

1. **Brand idea and personality.** Collect 3–5 adjectives, then the single brand truth. Airbnb's was "belonging". Netflix's brief for its sound was "tension, release, quirky".
2. **Construction of the mark.** Is it a symbol, a wordmark, or both? Is there a grid, primitive shapes, a single stroke, negative space, a hidden letter? Is the mark a *container* (like Netflix's N, which carries all its content) or an *actor* (like Pixar's lamp)?
3. **Where it will live.** Pre-roll, app launch or splash screen, product UI state (loading/thinking), event screens, social (vertical), end tags. Google's biggest challenge was "finding a logo and identity system that worked across such a large spectrum of products, platforms and devices."
4. **Sound context.** Will it usually play with audio, muted (social autoplay), or in the product itself (UI sound)? Is there an existing sonic logo?
5. **Frequency of exposure.** Netflix knew viewers "had no patience for a long intro", so the ta-dum had to be short. Frequency drives length.
6. **Existing equity.** Colors, motion or sounds people already recognize. HBO's update kept the "Static Angel" DNA while shortening it for streaming.
7. **Constraints.** Brand-legal locks (e.g. whether letterforms may be distorted), accessibility, file size, and the team's ability to reuse complex 3D. Koto's rollout advice: flag early whether the brand "is going to be able to work with complex motion or 3D assets."

### 2.2 Define motion principles before animating the logo

- **Koto:** "First, you need to create what we call 'motion principles.' These are a set of guiding traits, inspired by your brand strategy… the moment you see a small square move in a way that embodies one of those traits, you'll know you're onto something." Koto recommends starting with "your key brand signifiers: logotype, symbol, and/or headline typography," then growing a system, because "the same assets will become repetitive very quickly!"
- **DixonBaxi:** Research and development explores "ways in which things can move with intent and purpose," refined into a "motion theory." For the UK streaming service Freely, "objects can overshoot or bounce to simulate gravity, giving them weight and life. Subtle flexes of curves help round these motions out with a relaxed softness."
- **GitHub (published toolkit):** Motion should *Facilitate* ("inform and guide"), *Engage* and *Impact* ("influential and memorable"). Its style combines "smooth eases contrasting more 'human' stepped animations" to represent "leveraging AI to empower human ingenuity."
- **Google (2015):** Dots move "along geometric arcs and following a standard set of snappy easing curves"; "while their movements might seem spontaneous, their motion is rooted in consistent paths and timing."

**Agent rule:** Write 3–5 principles as *adjective → parameter* pairs. For example: "Precise → linear-to-sharp ease-out, 90° paths, no overshoot"; "Warm → soft ease-in-out, slight overshoot, rounded arcs"; "Human-in-the-loop → stepped/typing rhythm contrasted with smooth eases" (GitHub's pattern).

### 2.3 Concept exploration → styleframes → animatic → polish

- **Concept territories.** Generate 3–5 distinct *ideas* for the transformation, not styles: what the mark *does* and *why*. Pentagram's Slack exploration spanned "connect-the-dots, complex knots, emojis and people-like shapes."
- **Prototype in motion early.** Google's Jonathan Jarvis: "Animation was almost the first part of the design process… a ton of decisions are made by keyframes." Motion is also a persuasion tool: "Animation is an amazing tool to 'jump to the end.'"
- **Styleframes.** For each concept, show 3 key frames: the start state, the climax, and the resolved logo.
- **Animatic.** A rough timing pass with a temp sound, to lock the beat structure before polish.
- **Iterate a lot, and test.** IndieWire describes Netflix's ta-dum as "the yearlong effort to create what Netflix terms the 'ta-dum' sound", and Screen Rant reports Yellin and brand design lead Tanya Kumar chose from "20-30 different sound effects." A focus group, not told what it was for, described it as "dramatic," "interesting," "beginning," "movie." The 2019 visual ident took two years, with the in-house team working alongside an agency.
- **Restraint pass.** Jarvis called restraint the second-hardest part: "keeping the motion simple… definitely took discipline. We have a pretty messy cutting room floor."

---

## 3. Technique taxonomy (mapped to construction and personality)

Choose the technique that the **mark's construction** invites, then tune it with the **brand's personality**.

| Technique | Best when the mark… | Personality fit | Watch-outs |
|---|---|---|---|
| **Construction / build-up** (primitives assemble on the grid) | Is built from geometric parts or a grid (Slack's two shapes, "a speech bubble and lozenge… that can be extracted") | Systematic, dependable, "builder" dev tools, infrastructure | Can feel like a template if parts fly in from random directions; use grid-true paths |
| **Line draw / stroke reveal** | Is monoline or drawable in one gesture (Airbnb's Bélo, designed as "a symbol that anyone can draw") | Human, friendly, crafted, community | Pick a meaningful stroke direction and order; end with the fill snapping in on the beat |
| **Morph / metamorphosis** | Relates to a product metaphor (Google dots → equalizer while you speak → spinning dots while searching → logotype) | Intelligent, fluid, AI/assistant | Keep the intermediate shapes on-brand; morphs need clear start and end silhouettes |
| **Mask / wipe / reveal** | Has strong negative space or bold letterforms | Confident, editorial, minimal | Plain masks feel generic; motivate the wipe with a brand shape |
| **Fold / unfold / ribbon** | Has a folded or ribbon logic (Netflix N) | Cinematic, premium | Physics must feel plausible; lighting sells the fold |
| **Container / portal / zoom-through** | Can act as a window onto the brand's world (Netflix 2019: camera flies *into* the N and its ribbons become spectrum beams) | Platform/aggregator brands, marketplaces | Must return cleanly to the static mark |
| **Kinetic logotype** (per-letter timing, weight/width shifts, typing, cursor) | Is a wordmark; the typeface has variable axes | Dev tools (terminal typing: GitHub animates Mona Sans Mono "with more of a mechanical rhythm, drawing from the behavior of terminals"), media, editorial | Keep letters legible at the hold; never distort the approved lettering in the final frame |
| **Character / anthropomorphic** | Contains or can host a character (Pixar's Luxo Jr. squashes the "I"; Koto made Animade's loop into "an inquisitive pair of eyes") | Playful, consumer, creative | Needs real acting: anticipation, squash and stretch, a "look to camera" button |
| **Particles / assembly from many** | Stands for *many things becoming one* (a community, data, a content catalog) | Scale, network, data/AI | The most clichéd template; justify it conceptually (Netflix's beams are the catalog's colors: "we took the colors from Netflix's vast array of content") |
| **3D extrusion / light sweep / glint** | Is premium or physical, or needs cinematic theatrical use | Luxury, entertainment, hardware | Easy to look like 2008 broadcast; use one light event, synced to the hit |
| **State-based / behavioral** (listening, thinking, success, error) | Lives inside a product (loading or AI "thinking") | AI and SaaS assistants | Google designed "listening, thinking, replying, incomprehension, and confirmation"; Gemini extends the dots into softened, "ethereal" shapes |

### 3.1 Symbol + wordmark lockups

- **Sequence, don't simultaneously animate.** The usual pattern is *symbol performs → wordmark resolves*. The symbol carries the idea; the wordmark is the payoff and legibility moment. Pixar is the textbook case: the lamp performs on the letters, then "Animation Studios" fades in afterward (and "a little later" in the closing variant since 2008).
- **Stagger.** Bring the wordmark in 150–400 ms after the symbol settles, with a simpler motion (fade or short slide or mask) so it doesn't compete.
- **Wordmark-only brands.** Put the performance into one letter or a detail (Pixar's "I", Google's tilted "e", Netflix's N distilled from the wordmark) rather than animating every letter equally.

### 3.2 The final frame and the hold

- The last frame must be the approved static logo, pixel-exact, with correct clear-space and color. Everything before it is optional; this frame is not.
- **Hold the resolved logo for about 1–2 s** in stings and intros (longer in outros/end tags, where it carries a URL or CTA). Let the sound's tail carry the hold.
- **Settle, don't stop dead.** A tiny overshoot or ease-out into rest (if the principles allow it) makes the end feel alive. GitHub warns that for text, no "slapping, rolling, or bouncing" unless it is a character's movement.

---

## 4. Timing, pacing and variants

These are practitioner heuristics drawn from the cases above; they are not industry standards.

| Variant | Duration | Use |
|---|---|---|
| **Micro / sting** | 1–2 s | App launch, social end-card, pre-roll bumper; the sonic logo alone is often ~1.5–3 s |
| **Standard ident / intro** | 3–5 s | Video openers; Netflix's ta-dum was "always meant to be only three or four seconds"; HBO's Static Angel is about 5 s with "a beginning, middle and end" |
| **Long / theatrical / hero** | 6–15 s | Premieres, keynotes, cinema. Netflix's theatrical version premiered before *Roma* at Venice, and Hans Zimmer extended the sound because in a theatre the short ta-dum felt "so short and so abrupt." |
| **Outro / end tag** | 3–6 s incl. hold | Logo + URL/CTA; longer hold |
| **Loop / ambient** | 2–8 s seamless | Event screens, livestream holding, website hero |
| **Product states** | 300 ms–1.5 s per state; loops for "thinking" | Loading, AI thinking, success/error |

**Beat structure for a 3 s sting at 24–30 fps (template):**

1. **0–0.4 s — Anticipation / setup.** A seed element, a gather, or a riser starting.
2. **0.4–1.4 s — Action / transformation.** The technique from §3 plays out.
3. **~1.4–1.8 s — Climax ("hit").** The logo locks. This is the main audio sync point.
4. **1.8–3.0 s — Resolve + hold.** Wordmark settles, secondary details land, the sound tail decays.

**Easing and pacing rules:**
- Use one family of easing curves per brand (Google: "a standard set of snappy easing curves").
- Put the fastest motion just before the lock and the stillest moment at the lock, so the contrast makes the logo "land."
- Keep it "quick, but legible" (GitHub): no single state should flash by so fast that it can't be read.
- Match the context: "Event promos should inspire and delight. Technical demos should be precise. A glitchy effect used during a live-stream may appear broken, not artful." (GitHub)

**Deliverable variant matrix:** short/long × light/dark × 16:9 / 9:16 / 1:1 × with/without sound × loop × reduced-motion (static or cross-fade) × transparent-background overlay.

---

## 5. Case studies

### Netflix — the "ta-dum" and the ribbon N
- **Sound:** VP of Product Todd Yellin led the project. He wanted viewers to think "Wow, I'm going to get a treat". The sound had to be short and "more cinematic than electronic." He hired Oscar-winning sound editor Lon Bender (*Braveheart*, *Drive*) and gave him descriptors: tension, release, quirky. Screen Rant, drawing on Twenty Thousand Hertz, reports the team chose from "20-30 different sound effects", including a door opening, strange instruments and filmmaking sounds. For a while the finalist ended with a goat bleat. The final two knocks are Bender tapping his wedding ring on a bedroom cabinet, layered with a slowed anvil and muted thuds. The closing tonal swell (the "blossom"/"flower") is a reversed-guitar fragment Charlie Campagna had recorded in the 1990s through a Digitech GSP2101 and a Lexicon JamMan, used without further processing. IndieWire calls it "the yearlong effort to create what Netflix terms the 'ta-dum' sound." **Lesson:** two percussive "tension" hits followed by one tonal "release" swell. The sound is organic rather than synthetic, and it is short because viewers hear it every time.
- **Visual (2019):** The first rework in five years. The red ribbon N folds up, then the camera flies into it and the ribbons become spectrum beams, "inspired by the spectrum of stories, emotions, languages, fans and creators" and by "turning Netflix's own show thumbnails sideways, like records on a shelf." The background changed from white to dark "to better set the mood." The sound stayed the same. It was made by **Imaginary Forces** (creative director Michelle Dougherty; producer Keith Bryant; CG supervisor Meng-Yang Lu; lead animator Evan Sexton). The theatrical logo came first and premiered before *Roma* at Venice; the scope then expanded to the platform. The official Clios site lists a Bronze award for Imaginary Forces' "Netflix Originals Identity 2020" in Clio Entertainment 2019, in the "Network/Series Identity Package" category. **Lessons:** keep the sonic equity while evolving the visual, and make the particles or beams *mean* something (the catalog).

### Google — dots as a behavioral logo (2015)
- A week-long New York sprint with Creative Lab and Material Design. The brief included "dynamic, intelligent motion that responded to users at all stages of an interaction." The system has three parts: logotype, G, and dots "for interactive, assistive, and transitional moments." The dots have expressions for "listening, thinking, replying, incomprehension, and confirmation" and become an equalizer while you speak. Motion designer Adam Grabowski was a lead. Jarvis's goal: "fast, simple, clear what was happening and have a charming moment or two." **Lesson for AI/SaaS:** your logo can be a UI state. Design a thinking/processing behavior, not just an intro.

### Intel — the bong
- Walter Werzowa composed it in 1994 for the "Intel Inside" campaign, and the rhythm follows the tagline's syllables. Intel's support page describes "a simple five-note tune… and 20 sounds from those notes." Audiospheric describes the opening as "an audio 'spark' consisting of more than 20 sounds, including a tambourine, an anvil, an electric spark, and a hammer striking a pipe," and the tones blend synths with xylophone and marimba. **Timbre beat melody:** Intel's own @IntelTech account says "in a 60-person focus group, only 80% of participants could recognize the tune when played on violin, as opposed to 100% with the correct tone—even with wrong notes added." Werzowa updates the arrangement every 2–3 years while keeping the five-note core. (Sources disagree on the exact notes: "D♭, D♭, G♭, D♭, A♭" per the Werzowa account vs. "D♭, G♭, D♭, A♭, B♭" elsewhere.) **Lesson:** own a timbre, and evolve the production without changing the core.

### Apple — the Mac startup chord
- Jim Reekes made the startup sound "in my home studio on a Korg Wavestation… a C Major chord, played with both hands stretched out as wide as possible (with 3rd at the top)." It was a "palette cleanser" after the old tritone chimes had become associated with crashes. He was inspired by the final chord of the Beatles' "A Day in the Life" and added chorus and reverb. It was later pitch-shifted to F-sharp major (from the Quadra 840AV). It has been a US registered trademark since 2012. **Lesson:** one rich, open-voiced consonant chord with a bright top note reads as "lifting up," which suits power-on and app-launch moments. (We did not source detailed accounts of the iPhone boot animation; treat any claims about it as unverified.)

### HBO — "Static Angel"
- HBO's original shows (e.g. *The Larry Sanders Show*) opened silently. Bruce Richmond's team built a roughly 5-second "turning on a television" sound: TV static → a transitional drone → a synthesized choral swell → a final click in the closing variant. It has "a beginning, middle and end." According to Twenty Thousand Hertz's HBO series (via a Shore Fire Media release), "generating graphics for the five-second clip took three whole days of digital processing." In the streaming era, HBO worked with Made Music Studio to update its sonic brand without losing the nostalgia. **Lesson:** a sonic logo can be *sound design* (texture → tone) rather than melody, and needs open and close variants (the closing plays the choir reversed).

### Pixar — Luxo Jr.
- The lamp from the 1986 short hops in, squashes the "I" as it did the ball in the film, then looks at camera; "Animation Studios" appears afterward. The closing variant dims to dark with a light-switch click. Designing Sound's 2011 interview notes that Gary Rydstrom "did his first work for Pixar on the short film Luxo Jr.," and Lasseter credits him with "creating the lamp's voice from the squeak of a lightbulb being screwed in"; only fan wikis credit him with the logo's sound specifically. **Lesson:** character acting and a punchline, with sound effects (metallic hops, squeaks, clunk) instead of music.

### Mastercard — a layered sonic architecture
- CMO Raja Rajamannar worked with neurology, psychology and musicology experts on "a 30-second melody that became the DNA," plus a 3-second signature at the end of ads and a short "acceptance" sound at checkout. Durations conflict: Marketing Brew (2022) reports a "1.3-second 'sonic acceptance' sound… made up of six notes"; Mastercard's own newsroom (2024) says "a 1.6-second burst." Reach figures differ too: Marketing Brew (Oct 2022) says it "plays at more than 235 million touchpoints around the world, according to Rajamannar," and Mastercard's 2024 newsroom says it has expanded to "more than 500 million points of interaction." **Lesson:** design one melody, then derive a long form, a signature and a micro form from it.

### Airbnb — the Bélo (DesignStudio, 2014)
- Built on the principle "belong anywhere." DesignStudio's James Greenfield: "we also wanted to create a symbol that anyone can draw… a great logo is one that you can draw in the sand with your big toe." **Lesson:** a mark designed as one gesture begs for a line-draw reveal. That animation is part of the concept, not decoration.

### Slack — Pentagram (2019)
- Michael Bierut's team found the old hashtag (11 colors at a precise 18° rotation) "extremely easy to get wrong." The new octothorpe is "built on a grid" from "a speech bubble and lozenge… that can be extracted and used as graphic elements." **Lesson:** a modular mark suggests construction/assembly motion and supplies shapes for a wider motion system.

### Koto — Deezer, Bolt, Animade
- Deezer: a "motion-first visual identity," where the heart logo "pulsates and reacts in a characterful way to reflect the vibe of each genre." Bolt: "motion and sonic branding echo the speed of a click." Animade: its infinite-loop logo was redrawn as "an inquisitive pair of eyes." **Lesson:** the brand promise (music, speed, character) becomes the motion verb.

### GitHub — a public motion toolkit
- Principles (Facilitate / Engage / Impact), explicit don'ts, and one canonical Invertocat animation "for end tags and bumpers." **Lesson:** this is a ready template for writing brand motion rules.

*Not covered with primary sources in this research:* 20th Century Fox, McDonald's, Spotify, Dropbox, Stripe, ManvsMachine, Collins, Instrument, Wolff Olins, Moving Brands, Sid Lee, Buck. Before a skill cites them, a follow-up pass should gather their case-study pages.

---

## 6. Sound design for logo animations

### 6.1 Composition
- **Length:** 1.3–3 s for the mnemonic. MassiveMusic says 2–4 s, Made Music 2–3 s, SoundOut "typically 1–3 seconds," and Joel Beckerman: "The best Sonic Logos are quite short — usually no more than two seconds." Tostitos' logo by Made Music is "just 1.5 seconds."
- **Shape = tension → release.** Beckerman: "How do you get a story across in two and a half seconds…? A lot of it was about tension and release… a beginning, a middle, and an end." He also suggests pentatonic melodies for cross-cultural appeal.
- **Melody:** 2–6 notes. Use a rhythm tied to the brand name or tagline (Intel: "In-tel In-side") and an interval that resolves upward or to the tonic for optimism, or deliberately stays open for "to be continued."
- **Timbre is identity.** The Intel test shows the sound matters as much as the notes. Choose one signature source: a wedding ring (Netflix), a breath (Audiobrain's Xbox 360 logo), TV static (HBO), a wide synth chord (Mac).
- **Organic vs. electronic.** Netflix deliberately avoided sounding "too electronic—like the Xbox sound or the Mac startup chime." For AI/SaaS brands the default is synthetic; an organic or human element is a way to stand out.

### 6.2 Layering stack (for the sting's sound design, around the mnemonic)
1. **Pre-roll / riser** (0–0.8 s): a reversed swell, filtered noise or air whoosh that tracks the anticipation motion.
2. **Transient / impact** at the lock: a click, knock or percussive hit. It gives the sync point its precision.
3. **Sub / body**: a low thump or sine drop under the impact for weight. Keep it short and high-pass-safe for phone speakers.
4. **Tonal element**: the mnemonic notes or chord. This is the part people remember.
5. **Shimmer / air**: bells, reversed guitar (the Netflix "blossom"), a high pad. It carries the hold.
6. **Tail**: reverb or delay decay across the hold. Fade before the cut, not after.

### 6.3 Sync patterns (motion ↔ sound)

| Pattern | Motion | Sound | Example |
|---|---|---|---|
| **Hit-on-lock** | Fast build → logo locks | Impact exactly on the lock frame; tone blooms after | Standard sting |
| **Call-and-response** | Two beats of motion (e.g. fold, fold) → reveal | Two hits → tonal release | Netflix ta-dum ("creating tension and then resolving it really quickly") |
| **Note-per-element** | Each part assembles in sequence | One note per part; last note on the final part | Modular marks (Slack-like), multi-dot logos |
| **Texture-to-tone** | Noise/particles resolve into a clean form | Noise/static crossfades into a pure tone or choir | HBO Static Angel; particle assemblies |
| **Foley acting** | Character performs | Sound effects follow the physical action (hops, squeaks, click) | Pixar |
| **Swell-and-hold** | Slow reveal or light sweep | One rich chord that swells then decays | Mac chime; premium/hardware |
| **State sounds** | Listening/thinking/success loops | Short UI earcons derived from the mnemonic's notes/timbre | Google dots; amp's and Inkbot's advice to derive UX sounds from the logo's "DNA" |

**Sync craft:** A hit placed 1–2 frames *before* the visual lock usually feels tighter than one placed exactly on it (a common editing heuristic, not a sourced rule). Never let the first loud transient land during a blur; land it on a readable frame.

### 6.4 Adaptability
- Build a family from one core: an anthem (30–60 s), a signature (~3 s), a micro/acceptance version (~1.5 s), UX sounds, and "stems" for remixing (Mastercard; Sixième Son: "The music adapts, but the DNA stays intact").
- Antfood's Freevee mnemonic uses "a two-part structure" with "a modular swelling element that can flex" while "the core… will always stay the same." This is a good pattern for sounds that users hear back-to-back.
- WPP-owned amp notes the shift from "the last three seconds of a commercial" to using sonic branding "during the first five seconds." Where muted autoplay isn't the norm, consider putting the mnemonic up front.

### 6.5 Agency process (sonic)
Processes converge on: **audit & strategy → sonic mood board / palette → brand-to-sound mapping → composition of anthem + mnemonic (multiple directions) → testing → adaptation to touchpoints → guidelines & guardianship.**
- **MassiveMusic:** research/strategy with "collaborative sonic mood board sessions" → creative with MassiveBASS testing ("how well a sound is remembered, how distinctive it is, whether it's appropriate") → adaptations → guidelines and workshops.
- **Sixième Son:** audit of touchpoints and competitors → audio mood board → 40–60 s foundation track + sonic logo → adaptation → quantitative testing ("attribution, recall, brand personality alignment, attention, and likeability") → guidelines.
- **amp:** "Brand-to-Sound Mapping" via a "proprietary taxonomy" mapping brand attributes to audio characteristics; "48-hour melodic recall tests"; musicologist plagiarism review.
- **Made Music:** find "where sound and music make the biggest impact," set the brief, develop core elements, activate them across touchpoints; tested with "SonicPulse® Research."
- **Studio Resonate (SiriusXM):** Steve Keller: "Distinctive sonic assets aren't distinctive 'right out of the box'… It's crucial to create guidelines for how and when your brand is heard."

### 6.6 Mixing and loudness for short stings
- **Short-form broadcast (best fit for stings): EBU R128 s1.** Integrated −23.0 LUFS; "Short-term Loudness Level… shall not exceed −18.0 LUFS"; true peak ≤ −1 dBTP; "Loudness Range is not useful for short-form content."
- **US broadcast:** ATSC A/85 / CALM Act, −24 LKFS; short-form is "measured over their whole program mix." The CALM Act "does not apply to… commercials aired on the internet or via streaming services."
- **Streaming music platforms:** Spotify normalizes to −14 LUFS and advises leaving "1 dB headroom for lossy encodings." YouTube's ~−14 LUFS is widely cited but not officially documented.
- **Netflix deliverables:** "-27LKFS +/- 2 LU 1770-1 dialog-gated", with true-peak limiters "at -2.3 or lower." A dialogue-free sting doesn't map neatly onto this, so match the program it precedes.
- **Practical:** Master the mnemonic so it survives laptop and phone speakers: check it mono-summed, keep the sub content supportive rather than essential, and set a true-peak ceiling of −1 to −2 dBTP. Deliver stems and loudness-normalized versions per platform. Because short stings are loud-for-duration, check the short-term (3 s) loudness, not only the integrated value.

---

## 7. Principles, clichés and accessibility

**Principles for memorable, on-brand logo motion**
1. **One idea, one climax.** The motion should express a single brand verb (belong, connect, spark, think, build).
2. **Motion comes from the mark.** Use its construction, strokes, grid and negative space. If the animation would work on any logo, it isn't this brand's.
3. **Mean the effect.** Particles, beams and glints need a story reason (Netflix: the catalog's colors).
4. **Sound and motion share one shape** (tension → release) and one sync point.
5. **Design the system, not the clip.** Principles, variants, states, and short/long versions.
6. **Consistency over time builds equity.** PRINT: "Consistency and time are the two pillars." Netflix and Intel evolved production but kept the core.
7. **Restraint.** GitHub: "If you don't have time to get it right, then you should simplify your approach."

**Common mistakes and clichés**
- Stock particle-explosion, glitch, liquid-splash, or 3D-chrome-with-lens-flare templates unrelated to the brand. GitHub: motion "should never feel like an out-of the box presentation effect."
- Too long for how often people see it (HBO's 90-second Feature Presentation vs. streaming patience).
- Too many effects; every letter animating differently; no clear hold.
- The final frame isn't the exact approved logo (distorted letters, wrong color, off-center).
- A sound that is generic stock "whoosh + boom" with no ownable tone or timbre, or a sound mixed so loud it is clipped or fatiguing.
- No muted-autoplay version (the idea should read without sound).
- Motion that contradicts the personality: bouncy for a security or finance brand, sluggish for a speed brand (Bolt's motion must "echo the speed of a click"). GitHub also bans mascot-style playfulness for "money, security… apologies."

**Accessibility**
- **Flashing:** WCAG 2.3.1 (Level A) prohibits more than three flashes in any one-second period unless below the general/red flash thresholds. Avoid strobe glitches and rapid light flicker in stings.
- **Reduced motion:** Honor `prefers-reduced-motion` in web/app contexts by providing a static logo or a gentle cross-fade. WCAG 2.3.3 (AAA) asks that interaction-triggered motion can be disabled.
- **Autoplay >5 s:** WCAG 2.2.2 requires pause/stop/hide for auto-starting motion lasting more than five seconds alongside other content, so web loops need controls.
- **Sound:** Don't autoplay sound on web. Keep the meaning in the visual, and provide captions such as "[Netflix ta-dum]" in video where appropriate.

---

## 8. Existing frameworks, and a ready-to-use agent skill

**What exists publicly:** brand motion toolkits (GitHub's Motion identity pages; Google Design's "Evolving the Google Identity"; International's motion principles with "Easing Curves, Duration and Core Dynamics" primitives), agency explainers (Koto's OFF Brand issue on motion; DixonBaxi's "motion theory"), and sonic-agency process pages (MassiveMusic, Sixième Son, amp). This research found no established, widely adopted AI-agent skill for logo animation, so the skill below is synthesized from these sources.

### Skill: `logo-animation`

**Inputs to gather:** logo files (SVG, layered), a construction/grid if available, brand adjectives and the core idea, color/type rules, placements, any existing sonic logo, audio-on vs. muted context, and exposure frequency.

**Step 1 — Analyze the mark.** List its primitives (strokes, shapes, letters), how it was constructed, any hidden meaning, symbol/wordmark relationships, and negative space. Output: "What does this mark invite?" (draw / assemble / fold / morph / act / contain).

**Step 2 — Write motion principles.** 3–5 adjective → parameter pairs (easing family, speed, path geometry, overshoot yes/no, rhythm smooth vs. stepped), plus 3 don'ts.

**Step 3 — Concepts.** 3 distinct concepts, each as: the brand verb, the technique (from §3), a one-sentence story, 3 styleframe descriptions (start / climax / hold), and a sound pattern (from §6.3).

**Step 4 — Beat sheet.** Timecoded beats (anticipation → action → hit → resolve/hold) for the chosen concept, with the audio sync point marked. Default is 3 s; also produce a 1.5 s cut and a 6 s cut.

**Step 5 — Sonic logo.** Define: note count and rhythm (tied to name syllables if possible), interval direction, signature timbre, layer stack (riser / transient / sub / tone / shimmer / tail), duration (1.5–3 s), and an adaptation plan (micro, signature, anthem seed, UX earcons).

**Step 6 — Build and restraint pass.** Remove any effect that doesn't serve the brand verb. Check that the final frame is the exact approved logo and that the hold is at least 1 s.

**Step 7 — Variants.** Short/long, light/dark, 16:9 / 9:16 / 1:1, loop, product states (thinking/success/error, if an AI or SaaS product), a reduced-motion alternative, and silent and with-sound versions.

**Step 8 — QA checklist.**
- [ ] Motion derives from the mark's construction; wouldn't work on another logo
- [ ] One clear climax; sound hit aligned (±1–2 frames)
- [ ] Final frame = approved static logo; hold ≥ 1 s (≥ 2 s for outros)
- [ ] Symbol/wordmark sequenced, not competing
- [ ] Reads without sound; sound reads without picture
- [ ] Duration fits exposure frequency (frequent → shorter)
- [ ] Easing consistent with written principles; no template "presentation effects"
- [ ] No more than 3 flashes/sec; reduced-motion variant supplied
- [ ] Audio: mono-compatible, true peak ≤ −1 dBTP, loudness per target platform (R128 s1 / A/85 / platform spec)
- [ ] Variants delivered; principles documented so the next asset matches

---

## Caveats

- Timing ranges for *visual* stings are synthesized heuristics; no standards body defines them. The sonic-logo lengths come directly from the named agencies and cases.
- Some case details come from secondary or fan sources: the Pixar logo's sound credit (Rydstrom's Luxo Jr. work is documented by Designing Sound, but his credit on the logo itself rests on fan wikis) and Intel's note sequence (which sources disagree on); the Netflix Clio Bronze is confirmed on the official Clios site. Mastercard's acceptance-sound duration is reported as both 1.3 s and 1.6 s.
- YouTube's −14 LUFS is unofficial. Netflix's −27 LKFS spec is dialogue-gated and applies imperfectly to dialogue-free stings.
- Several brands you asked about (20th Century Fox, McDonald's, Spotify, Dropbox, Stripe, iPhone boot) and several agencies (ManvsMachine, Collins, Instrument, Wolff Olins, Moving Brands, Sid Lee, Buck) were not researched from primary sources here. Add them in a follow-up before the skill cites them.