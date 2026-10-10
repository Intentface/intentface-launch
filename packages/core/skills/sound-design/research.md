# Sound Design for Launch Videos, Logo Animations and Audio Logos: A Practical Playbook (with an ElevenLabs SFX Workflow)

Great marketing sound comes from a small, consistent palette placed with discipline. Build every important sound in layers (transient, body, tail), tune anything with pitch to the music's key, use silence the way you use negative space, and treat ElevenLabs SFX output as raw material to curate and process, not as finished assets. If you only follow one rule, make it restraint. Joel Beckerman, founder of Man Made Music, told NPR in 2014 that "the first thing we do is we try to pull all the sound out. We start, really, with a blank slate and then add just the sounds that benefit you." Google's sound team treats silence as the audio equivalent of negative space.

## TL;DR

- **Design a system, not a pile of effects.** Choose one sonic palette (3–5 "materials", one key, one shared reverb space) and reuse it across the launch video, product demo, logo sting and UI sounds. Every hero sound should be layered from about four elements. Lon Bender, the Oscar-winning Formosa Group sound designer who built Netflix's logo, told Twenty Thousand Hertz: "Any sound is made up of four sounds, generally." Tune every tonal hit and drone to the music, because a braam a semitone off the score is the most common reason a clean edit still feels amateur.
- **An audio logo is short, simple and owned by its timbre.** Aim for 1–3 seconds and 2–5 notes with a clear tension→release shape. The distinctive *sound* (instrument or texture) matters as much as the melody. In a 60-person Intel focus group, 80% recognized the melody played on a violin and 100% recognized it with the proper sound, even with a wrong note added. Test it by asking people for word associations, not preferences. Netflix did this with a blind survey of thousands of people, each hearing a single candidate.
- **Use ElevenLabs SFX to generate one layer at a time, then finish it in a DAW.** Write short prompts naming the material, the action, the envelope/tail and the space. Generate many variants. Judge them on transient, artifacts, tail and fit. Trim, fade, EQ, tune and loudness-match them yourself. Output made on a paid plan can be used commercially, but you may not resell it as a standalone sound library. By default ElevenLabs may sublicense your outputs to other users unless you disable that, which matters a lot for a proprietary audio logo.

## Key Findings

1. **Restraint is the professional default.** Google's multisensory team asks of every sound, "Does this action need sound…and why?" Their rule is that "the more often an interaction happens, the less intrusive that sound or haptic should be."\[1\] In a 60–90 s launch video, mark only 3–6 true hero moments with a big sound. Everything else gets light touches or nothing.
2. **The best sonic logos are built from found or organic sources, then layered.** Netflix's "ta-dum" is Lon Bender's wedding ring knocking on a bedroom cabinet, sweetened with a slowed anvil and muted hits.\[2\]\[3\] The "blossom" swell is a reversed, processed electric-guitar phrase by Charlie Campagna.\[3\] It had to be short, "more cinematic than electronic," and able to create tension and resolve it "in like three seconds."\[3\]\[4\] Twenty Thousand Hertz reports the process took "an entire year of countless versions, iterations, first impressions."
3. **Timbre carries identity.** Intel's five notes (D♭–D♭–G♭–D♭–A♭) are a blend of synths, mostly xylophone and marimba.\[5\] In testing, the sound mattered as much as the melody.\[6\] Google's Super G is two piano notes an octave apart in G, "flammed" for playfulness, and under 1.5 s long.\[1\]
4. **Memorability involves a trade-off.** A 2026 study of 90 unreleased commercial sonic logos (Silas, Müllensiefen et al., n = 1,860) found that simpler melodies are easier to *sing back* (recall), while more complex ones are easier to *recognize*. Tonality was not a significant predictor of either.\[7\] For a small company whose logo will mostly be heard, not hummed, lean slightly toward distinctive over dead-simple, but keep it short.
5. **Build a family of lengths.** According to the Mastercard Newsroom (2024), Mastercard runs a 30-second melody, "a three-second version that punctuates its advertising and a 1.6-second burst that plays when shoppers pay." The acceptance sound now plays at "more than 500 million points of interaction." All of it comes from one melody, and Mastercard keeps hundreds of stylistic variations so the logo can "feel at home" at "a football match or…an opera." Netflix added a longer theatrical version by Hans Zimmer that still ends in the unchanged ta-dum.\[8\]
6. **Loudness targets are playback references, not mastering goals.** Spotify officially normalizes to −14 LUFS and asks for ≤ −1 dBTP.\[9\] YouTube publishes no LUFS figure, and engineers measure its reference level at roughly −14 LUFS. Mastering engineer Ian Shepherd's analysis of YouTube's "Stats for nerds" shows that YouTube turns loud uploads down but "doesn't turn up quieter videos," and he adds, "it's not about aiming for -14 LUFS!" For marketing video, deliver about −14 LUFS integrated with a true-peak ceiling of −1 dBTP for web and social, and follow broadcast specs (EBU R128 −23 LUFS; ATSC A/85 −24 LKFS) only for TV.\[10\]\[11\]
7. **Assume your video starts muted.** Chrome's policy states: "Muted autoplay is always allowed." Autoplay with sound requires prior user interaction or engagement.\[12\] Your first 3 seconds must work visually, and sound should reward the unmute rather than carry the message.

## Details

### 1. The sound vocabulary: what belongs where

| Category | What it does | Where it works | Watch-outs |
|---|---|---|---|
| **Whoosh / swish** | Sells movement through space | Camera moves, cards sliding, type flying in, scene transitions | The most overused sound in marketing. Use short, light whooshes for UI and type, longer sweeps for big camera moves.\[13\] Match the whoosh length to the motion's duration. |
| **Riser / build** (noise sweep, pitch rise, reverse cymbal) | Creates anticipation | 1–4 s before a reveal, drop or logo | A riser that never resolves into an impact or deliberate silence reads as unfinished.\[14\] |
| **Impact / hit** (transient + body + sub) | Lands the payoff | Title cards, product reveal, logo lock-up, beat-synced cuts | An impact with no tail sounds small however loud it is. One well-placed hit is powerful; four in a row is a parody.\[14\] |
| **Sub drop / downer** | Adds weight under a hit | Under the main reveal or logo lock | Mostly inaudible on phones (see §8), so never rely on it alone. Give it a quick fade-in so it doesn't click.\[15\] |
| **Braam** | Epic, trailer-style drama | Almost never for a B2B AI consultancy | Genre cliché. Must be in key.\[14\] |
| **Swell / shimmer / bloom** | Emotional lift, "premium air" | Logo resolve, end cards, "aha" moments | Easily washes out the mix. High-pass it and keep it short. |
| **Reverse sounds** (reverse reverb, reverse piano/guitar) | Pulls the ear *into* a moment | Leading into a logo or hit (Netflix's blossom is reversed guitar)\[8\] | Line up the peak of the reverse exactly on the hit frame. |
| **UI clicks / taps / ticks / pops** | Makes interface motion feel tactile and real | Product demos, cursor clicks, toggles, cards snapping | Keep them 50–200 ms, bright but not sharp, and quiet. Never put one on every single animation.\[16\] |
| **Glitch / digital artifacts** | "AI / tech" signaling, transitions | Sparingly, for an "AI processing" moment | The fastest way to sound generic-tech. Use once, as a motif, not as wallpaper. |
| **Stinger / sting** | Short musical punctuation | Section changes, end card | Must share key and instrument family with the music bed. |
| **Ambience / room tone / drone** | Glue and space; hides edits | Under demos, in quiet openings | Keep it low and in key if tonal. Loop seamlessly. |
| **Foley** (keyboard, paper, device handling, fabric) | Realism, human warmth | Live-action product shots, "maker" moments | Needs to match on-screen material. A mismatch feels wrong even if technically accurate. |

**Rules of thumb for each format:**

- **Launch video (30–120 s):** music bed, voiceover or supers, plus 3–6 hero impacts, whooshes on major transitions only, one riser into the reveal, and the audio logo at the end. Build in a dynamic arc: start sparse, intensify, and pay off near the end.\[17\]
- **Product/demo video:** mostly quiet UI foley (clicks, soft pops, subtle whooshes for panel transitions) under clear VO, with a light ambience bed. The product should sound tactile and calm, not like a trailer.
- **Logo animation (2–5 s):** anticipation (short riser or reverse swell), the lock-up hit (layered transient + body + tonal resolve), then a controlled tail. That is three events, maximum.
- **Social cutdowns (6–15 s):** the audio logo's short version, one impact, and music. No room for detail. Everything must read on a phone speaker.

### 2. Syncing sound to motion

- **Hit on the contact frame, not the motion start.** Place the impact's transient on the exact frame where the element lands or stops. Whooshes should *peak* at the point of maximum speed (usually mid-move), so slide the whoosh left until its loudest point lines up.
- **Anticipation → action → follow-through**, borrowed from animation principles: a small pre-sound (inhale, reverse swell, riser), the event, then a tail or settle (shimmer, small secondary tick, reverb decay) that matches the visual ease-out. If your motion uses a bouncy overshoot, add a tiny secondary tick on the settle.
- **Pick the music first, then animate or edit to its grid.** Motion designers who start from the track can put transitions on beats.\[18\] Impacts that also land on downbeats reinforce the music instead of fighting it.\[14\]\[19\]
- **Pre-lap sound across cuts.** Starting the next scene's sound a few frames early smooths transitions better than any whoosh.\[20\]
- **Silence before the logo.** A short drop-out (100–500 ms) before the final hit makes it land far harder than extra layers would.\[19\]

### 3. SFX vs music vs voiceover

- **Priority order:** VO/message > logo/hero SFX > music > detail SFX > ambience. Duck (sidechain or automate) music and design elements under VO and title cards so the message stays clear.\[15\]
- **Keep SFX out of the vocal band during speech.** Speech intelligibility lives around 1–4 kHz. During VO lines, use quieter, high-passed, less mid-heavy SFX, and save the full-bandwidth hits for gaps between lines.
- **Carve space in frequency.** The music's low end and your sub hits compete, so dip one when the other plays.\[15\] Frequency-specific ducking tools (e.g., Trackspacer, Soothe) can push the music down only in the bands your impact occupies, only while it plays.\[21\]
- **Don't double the music.** If the score already has a big drum hit on the reveal, your impact should add *texture* (a transient click, a shimmer) rather than another boom.

### 4. Audio logos: design, testing and relation to the visual logo

**What works:**
- **Length:** Melodic audio logos typically run 2–3 s and use 3–5 notes. Textural ones can be 1–2 s but risk being heard as just a sound effect.\[22\] Google's Super G is under 1.5 s.\[1\] Mastercard's in-ad signature is about 3 s.\[23\]
- **Shape:** Tension then release. Netflix asked for "call and response" that "builds up tension and then releases it, just like a story does" in about three seconds.\[2\]\[3\]\[8\] A resolved ending (landing on the tonic) feels confident. Material Design cautions that unresolved melodies can sound ambiguous.\[24\]
- **Timbre as the signature:** Choose an ownable sound source (a treated physical object, a specific instrument with processing), not a default synth preset. Lon Bender avoided any instrument "played straight up" because it "was too specific."\[8\]
- **Brand fit:** Write down 3 adjectives first. Werzowa's Intel brief was "reliability, innovation and trust"; Netflix's was "movie"-like, not "electronic and computerish."\[4\]\[8\]\[25\] For an AI/UX consultancy, a plausible direction is warm-precise: a tuned wooden or glass transient plus a soft, human tonal bloom. That avoids the sci-fi glitch clichés every AI company uses.
- **Scalability:** Design the long, short and micro versions at once: a 1–3 s logo, a 0.3–0.8 s UI/notification variant built from the same notes or timbre, and optionally a 10–30 s music bed containing the motif. Mastercard's architecture (melody → signature → acceptance sound) is the template.\[26\]\[27\]
- **Stability:** Netflix's Todd Yellin noted that visual idents "go out of style a lot more often than sounds."\[8\] Plan to keep the sound fixed while the visuals evolve.

**How to test it cheaply (the Netflix method, scaled down):**
1. Make 10–20 candidates across 3–4 aesthetic "buckets" (musical, SFX-based, hybrid). Bender's team produced 20–30 options grouped this way.\[8\]
2. Play *one* candidate to each respondent, blind, with no brand, and ask "what words come to mind?" Keep candidates whose associations match your adjectives. Netflix rejected a sound whose top word was "confused"; the winner's top word was "movie."\[8\]
3. Check recognition after a delay: can people pick it out of a lineup a day later? Check phone-speaker playback and mono.
4. Sanity-check it against competitors so you don't sound like every other AI brand's shimmer-whoosh.

**Relation to the visual logo animation:** Map sound events one-to-one onto visual events: anticipation over the build, hit on the lock-up frame, tail over the hold. The sound should also make sense *without* the picture (radio, podcast, voice interfaces). If it only works with the animation, it's a sound effect, not a logo.

### 5. Layering and coherence

- **Layer by function, not by stacking similar files.** BOOM Library's Michael advises: "think in layers (frequency, sustain, tail, transient)" and "don't use too many layers over each other."\[19\] A standard hit is:
  - **Transient** (2–5 kHz click or snap: wood knock, finger snap, metal tick)
  - **Body** (200 Hz–2 kHz character: the "material")
  - **Sub/weight** (40–100 Hz sine drop or low boom)
  - **Tail** (reverb, shimmer or ring-out that extends past the others)
- **Align transients to the sample**, then balance. Set the body first as the anchor, tuck the sub under it, and add detail on top at a lower level.\[15\]\[28\]
- **EQ slotting:** high-pass every layer that isn't the sub. Low-pass the sub. Cut overlapping mids so each layer owns a band. Mute layers one at a time; if you can't hear what a layer adds, delete it.\[28\]
- **Micro-offsets:** delaying the body or tail 5–20 ms after the transient can add size. Moving the sub a few ms later avoids phasey smearing with the transient.
- **Pitch and key matching:** anything with a pitch (impacts with ringing tails, drones, shimmers, risers, UI "dings") should be tuned to the music's key, ideally the root or fifth. Pitch-shift SFX by semitones in your DAW, and check with a tuner plugin. Duende Sounds puts it well: tonal clashes make a mix feel "slightly off" and audiences "cannot tell you what."\[14\] Google builds its whole product soundscape around the key of G so that "everything feels like it's part of the same system."\[1\]
- **Sound family:** Material Design says sounds that follow one another "should have related attributes (like timbre, melody, or envelope)."\[29\] Practically, define your palette once:
  - 1–2 core materials (e.g., glass and felt, or wood and air)
  - 1 key
  - 1 shared reverb space
  - 1 brightness level
  - 1 transient style (soft vs snappy)

  Every new sound must pass through those constraints.
- **Glue:** route all SFX to one bus with gentle bus compression (1–3 dB gain reduction), light saturation (adds harmonics so sub content becomes audible on small speakers), and a shared reverb send. Shared processing is what makes sounds from different sources (e.g., multiple AI generations) feel like they came from one world.
- **Tonal vs atonal:** Material Design's split is useful: tonal sounds communicate personality, emotion and state changes, while atonal sounds better support motion transitions and "haptic" feel.\[24\] Use tonal for logo and success moments, and atonal for whooshes, clicks and slides.

### 6. Reverb, delay and echo

- **Use one or two shared spaces, not per-sound reverbs.** Using different "rooms" for everything makes a mix feel like a collage.\[30\] A short room (0.3–0.8 s) for UI/foley plus one larger hall or plate for hero moments is enough. Your chosen space can itself be brand character (intimate and dry vs airy and spacious).
- **Pre-delay 20–60 ms** keeps transients and VO intelligible while still adding size.\[31\]
- **Filter the returns:** high-pass reverb returns around 150–250 Hz to avoid mud, and low-pass around 6–9 kHz for a less "digital" tail.\[30\]\[32\]
- **Duck the reverb:** put a sidechain compressor on the reverb return keyed from the dry source or the VO. The tail then blooms in the gaps and gets out of the way during speech.\[31\]\[33\]
- **Tempo-sync delays and decays:** a quarter note in ms is 60,000 ÷ BPM. At 120 BPM, a quarter note is 500 ms and a dotted eighth is 375 ms. Echoes that fall on the grid feel intentional; random ones feel like a mistake. Set the reverb decay so the tail is almost gone before the next strong beat.\[31\]
- **Logo endings:** the tail *is* part of the logo. End on a deliberate decay of 1–2.5 s, with a filtered dotted-eighth or quarter-note echo (2–3 repeats, each darker) for a sense of space. Fade before the video cuts to black, and never let an abrupt edit chop the tail.
- **Reverse-reverb swells:** reverse a reverb tail of the hit and place it so its peak hits the frame just before the dry hit. This is the classic lead-in for logo reveals.
- **Pitfalls:**
  - Long tails piling up and smearing the mix in fast edits\[30\]
  - Reverb low end masking VO and bass\[30\]
  - Wide stereo reverbs that collapse in mono\[30\]
  - Reverb used to hide a weak sound (fix the sound instead)

### 7. What makes sounds pleasing, premium or cheap

- **Psychoacoustics:** Fastl and Zwicker's research found sensory pleasantness generally *decreases* as sharpness (excess high-frequency energy) and roughness (fast amplitude modulation, roughly 15–300 Hz, most sensitive near 70 Hz) increase.\[34\]\[35\] Practically, tame harsh 3–8 kHz energy, avoid buzzy or beating layers, and prefer clean harmonic tones.
- **Consonance and resolution:** octaves, fifths and major-triad shapes read as stable and positive. Google's Guided Frame uses a IV→V→I progression that "feels like home" when it resolves.\[1\] Your success and logo sounds should resolve; error sounds can stay unresolved.
- **Premium cues:**
  - Controlled, tight low end
  - Clean, fast transients with a short, well-shaped decay
  - Moderate brightness
  - Real acoustic materials (glass, wood, felt, metal) with natural micro-variation
  - Space used sparingly
  - *Fewer* sounds
- **Cheap cues:**
  - Stock whoosh-plus-boom on every cut
  - Clipping or over-limiting
  - Harsh, fizzy highs
  - Detuned tonal layers
  - Obvious presets (the "trailer braam", generic riser, laser zap)
  - Tails chopped by the edit
  - Everything at the same loudness
- **"Satisfying" UI sounds** are short (50–200 ms), have a crisp transient and little tail, are tonally consistent across the set, and are quiet.\[16\] Google's own shutter sound evolved from a melodic, expressive sound to a minimal, realistic one because melodies on frequent actions were "distracting and confusing." For demos, borrow real-world "learnability": a click should sound like a click.\[1\]
- **Culture:** Mastercard spent months making a melody that "resonates globally while maintaining local relevance," and amp notes some sonic logos fail to gain traction in other cultures.\[36\]\[37\] For a Nordic consultancy selling internationally, avoid culturally loaded instruments or scales unless they are intentional brand signals, and test with listeners from your target markets.

### 8. ElevenLabs SFX: how to prompt, judge and finish

**What the tool does (official):**
- Text-to-SFX with an optional **duration from 0.1 to 30 s**. The default is automatic, and specifying a duration costs 40 credits per second.\[38\]
- **Looping** for seamless ambiences.\[38\]\[39\]
- **Prompt influence**: high means a more literal reading of the prompt, low means more creative variation.\[38\]\[40\]
- **Output:** MP3 for all effects, and WAV 48 kHz for non-looping effects.\[38\]
- SFX v2 (announced September 2025) raised the maximum length from 22 s to 30 s and the sample rate from 44.1 kHz to 48 kHz, and added looping.\[41\]\[42\]
- The official docs list terminology the model understands: *impact, whoosh, ambience, one-shot, loop, stem, braam, glitch, drone*. It also accepts musical specs like "90 BPM" or "Vintage brass stabs in F minor."\[38\]
- Each generation returns several variants, and variants can differ significantly from each other.\[43\]

**Prompting principles:**
1. **One sound per prompt.** ElevenLabs' own help center says complex multi-event prompts work, "but for the best results… generate individual sound effects and then combine them in an audio editor."\[44\]\[45\] This matches the layering method in §5: generate the transient, body, sub and tail separately.
2. **Formula:** *[quality/recording descriptor] + [source/material] + [action] + [envelope/length] + [space/distance] + [exclusions]*. ElevenLabs suggests adding phrases like "high-quality, professionally recorded… sound effects foley." Keep it brief enough for the model to follow.\[45\]
3. **Specify the envelope and tail explicitly** ("short, dry, no reverb," "quick attack, 1.5 second shimmering decay"). Ask for **dry** sounds whenever possible and add your own shared reverb, which is critical for coherence.
4. **Set the duration** for one-shots (0.3–2 s) so you don't get padding or extra events. Use auto only when exploring.
5. **Prompt influence:** start mid-to-high for precise UI and hit layers. Go lower when you want surprising textures for a signature sound.
6. **Include key or BPM for tonal elements**, but treat them as hints. Always verify with a tuner and retune in the DAW, because pitch accuracy isn't guaranteed.

**Example prompts (copy and adapt):**
- UI click: `Single soft UI click, tactile plastic button, very short and dry, close-miked, no reverb, clean transient` (duration 0.3 s)
- Toggle / snap: `Crisp glass tap, small and precise, bright but not harsh, instant decay, dry studio recording` (0.4 s)
- Card slide: `Short airy swish, soft fabric-like movement, gentle, left-to-right, no tonal content, dry` (0.6 s)
- Transition whoosh: `Smooth cinematic whoosh, medium speed, clean air movement, subtle low-mid body, peaks in the middle, no metallic ring` (1.2 s)
- Riser: `Rising filtered noise sweep with subtle tonal shimmer, builds steadily and ends abruptly, cinematic, no impact at the end` (3 s)
- Impact body: `Deep wooden impact, solid and warm, felt mallet on large wooden box, short, dry, one-shot` (1 s)
- Transient layer: `Very short sharp wooden knock, knuckle on hardwood table, close and bright, dry` (0.3 s)
- Sub layer: `Clean sub bass drop, pure sine sweeping down, smooth, no distortion, 1 second` (1 s)
- Shimmer tail: `Soft glass shimmer bloom, gentle high sparkle, slow 2 second decay, airy, in C major` (2.5 s)
- Reverse swell: `Reverse piano chord swell rising into silence, soft and warm, C major` (1.5 s)
- Logo candidate (organic, Netflix-style method): `Two quick metallic ring taps on a wooden cabinet, followed by a warm reversed electric guitar swell that blooms and resolves` (3 s). Generate many, then rebuild the best idea from separate layers.
- Room tone / ambience: `Quiet modern office room tone, soft air conditioning hum, distant muffled activity, no voices, seamless` (loop on, 20–30 s)
- Tech motif (use once): `Subtle digital data flutter, soft granular glitch, short, clean, not harsh, dry` (0.8 s)

**Iteration workflow:**
1. **Brief:** write the palette constraints (materials, key, brightness, transient style) at the top of your prompt doc and reuse the same descriptors in every prompt. Consistent wording gives more consistent outputs.
2. **Explore:** run 3–5 generations (each gives several variants) at varied prompt influence. Favorite and download the WAVs, not MP3s.
3. **Shortlist:** audition against picture and music, not in isolation.
4. **Remix:** vary *one* word at a time (material, size, space) to converge.
5. **Finish in the DAW** (see checklist). Save finished assets with the prompt and settings in the filename or metadata so you can regenerate variants later.

**Evaluation checklist for generated sounds (reject if any "must" fails):**

| Check | Must / Should | How to test |
|---|---|---|
| Clean, well-defined transient (no smeared or doubled attack) | Must | Zoom the waveform. Listen at low volume; the attack should still read. |
| No artifacts: warbling, metallic "codec" ringing, phasing, garbled noise, random extra events | Must | Solo it on headphones at moderate level. Also listen pitched down an octave, which exposes artifacts. |
| No clipping; peak headroom present | Must | Peak meter below 0 dBFS, true-peak meter below −1 dBTP after your gain. |
| Clean start and end: no DC offset or click at boundaries, and the tail decays to silence rather than being chopped | Must | Check the first and last 50 ms. Add fades. |
| Noise floor acceptable (no hiss or hum bed under the sound) | Must | Listen to the tail with gain boosted. Use a spectrum analyzer. |
| Appropriate length and envelope for the motion it supports | Must | Lay it against picture. The peak should align with the motion's key frame. |
| Frequency balance fits its layer role (e.g., the transient layer has no mud; the sub is clean) | Should | Spectrum analyzer. Solo it against the other layers. |
| In key (or atonal) relative to the music | Must for tonal | Tuner plugin. Play it against the music's root chord. |
| Fits the palette (material, brightness, space match the family) | Must | A/B it against your 3–4 "reference" palette sounds. |
| Translates: still recognizable on phone and laptop speakers and in mono | Must for hero sounds | Phone playback; mono sum in the DAW. |
| Doesn't mask VO | Should | Play under the VO; if intelligibility drops, EQ it or move it. |
| Emotional read matches intent (the "what words come to mind" test) | Should | Ask one colleague cold. |

**Post-processing chain (per sound):**
1. Trim with 2–10 ms fade-in (on non-percussive sounds) and a fade-out on the natural decay
2. Remove DC offset and high-pass (e.g., 30–40 Hz for body layers, higher for detail layers)
3. Corrective EQ (notch resonances, tame 3–8 kHz harshness)
4. Denoise if needed (gently)
5. Transient shaping (more attack for UI, less for soft sounds)
6. Pitch-shift to key
7. Normalize or clip-gain so similar roles sit at similar loudness
8. Send to the shared SFX bus and reverb

**Limitations to plan around:**
- No precise pitch or tempo control
- Variable results between runs
- Occasional artifacts and extra events
- Weaker results for very specific real-world sounds (Tom's Guide reported it failed at a 1990s modem, adding too much musical tone)\[43\]
- A 30 s cap\[39\]

Treat the output as a sample source. Google's own sound team, using its in-house generative models, found generated audio most valuable "as raw material to be manipulated or as a mood board," not as the final asset.\[1\] That is the right mental model.

**Licensing (verify before a campaign):**
- **Free plan:** non-commercial only, and attribution is required when you publish.\[46\]\[47\]
- **Paid plans:** a commercial license, and content generated during a paid subscription can be used commercially indefinitely, subject to service-specific terms.\[48\] Beta services are excluded.\[49\]
- **Standalone resale is prohibited.** The Prohibited Use Policy bans "selling… distributing… or commercially using or exploiting any Output… generated using our Sound Effects product on a standalone basis," including "sound libraries."\[50\] Using SFX inside your videos is fine. Packaging them as a sound pack for clients is not.
- **Sublicensing to other users:** the Sound Effects Terms (last updated 12 February 2026) say SFX outputs may be sublicensed to third parties, "including making SFX Outputs available to other ElevenLabs users," unless you opt out with the "Disable" setting. Opt-out isn't retroactive.\[51\] **Before you generate any audio logo or signature layers, disable sharing.** Even then, rebuild the final logo from layered and processed sources so the finished mark is distinctive and defensible. Consult a lawyer if trademark registration of the sound is a goal.

### 9. Mixing and delivery

**Loudness targets:**

| Destination | Target | Source/status |
|---|---|---|
| YouTube / web / most social | ≈ −14 LUFS integrated, ≤ −1 dBTP | YouTube publishes no number. About −14 is the engineering consensus; YouTube turns loud content down but doesn't turn quiet content up.\[52\] Spotify officially: −14 LUFS, "below −1dB TP."\[9\]\[53\]\[54\] |
| Instagram / TikTok / LinkedIn | −14 LUFS is the safe default; −12 to −11 if the piece is music-driven | No official published specs. Treat louder recommendations from blogs as unverified.\[53\]\[55\]\[56\] |
| Broadcast (EU) | −23 LUFS, −1 dBTP; ads: max short-term −18 LUFS\[57\] | EBU R128 and R128 s1 (adverts & promos) |
| Broadcast (US) | −24 LKFS, true peak −2 dBTP\[11\]\[58\] | ATSC A/85:2026-07 (revised July 2026)\[59\] |
| Podcast pre-roll | about −16 LUFS, ≤ −1 dBTP\[60\] | Apple Podcasts audio requirements |

**Mix rules:**
- **Hit targets with gain, not by crushing.** Over-limiting to hit a loud target flattens the very impacts you designed. With normalization on, the more dynamic mix sounds bigger at the same playback level.\[61\]\[62\]
- **VO sits on top.** Keep VO short-term loudness consistent, duck music 3–8 dB under speech, and bring it back between lines.
- **Small-speaker translation:** phone and laptop speakers reproduce little below about 300 Hz.\[16\] Give every sub-heavy hit a mid-range "shadow" (a body layer or saturation harmonics) so it still reads. Check on a phone, on laptop speakers and on cheap earbuds before sign-off.
- **Mono compatibility:** check the mix summed to mono. Keep the sub, VO, logo and main impacts centered and mono-safe. Wide stereo whooshes and reverbs are fine as long as they don't vanish in mono.
- **Muted-first design:** muted autoplay is always allowed in Chrome, and sound only autoplays after user interaction or engagement.\[12\] Burn in captions, make the first seconds visually self-explanatory, and make the unmute moment rewarding. Starting the audio logo or a strong musical downbeat right after the hook works well for viewers who tap to unmute.
- **Stems:** export music, VO, SFX and logo stems so you can recut for 6 s, 15 s and 30 s versions without remixing from scratch.

## Recommendations

1. **This week, define your "Sonic Palette v1":** 3 adjectives, 2 core materials, 1 key, 1 reverb space, 1 transient style, and an audio logo brief. Write it as a one-page spec next to your visual brand guidelines.
2. **Build the audio logo first,** because every other asset inherits its key and timbre.
   - Generate 20–30 raw candidates in ElevenLabs with sharing disabled, across musical, SFX and hybrid buckets.
   - Rebuild the best 3 from separate layers.
   - Run a blind word-association test with 20–50 people.
   - Deliver 3 lengths: a 2–3 s logo, a 0.5 s micro version and a 10–20 s bed.
3. **Create a reusable SFX kit (15–25 sounds)** in the palette: 3 clicks, 2 pops, 3 whooshes (short, medium, long), 2 risers, 3 layered hits, 2 shimmers, 1 reverse swell, 2 ambience loops, 1 "AI moment" motif. Each should be processed, tuned, loudness-matched and named consistently. Reusing this kit across launch, demo and social videos is what creates coherence.
4. **Mix to a checklist:**
   - −14 LUFS / −1 dBTP for web
   - VO priority
   - Phone and mono checks
   - No more than 6 hero hits per minute
   - Every tonal sound in key
5. **Don't** use glitch or laser clichés as your main "AI" signifier, stack whooshes on every cut, or let a reverb tail get chopped at the end card.

## Where to learn more (curated)

- **Twenty Thousand Hertz, "Tudum! The story behind the iconic Netflix sound"**: https://www.20k.org/episodes/netflix. The best single case study. It covers the brief (short, cinematic, tension→release), 20–30 candidates grouped by aesthetic, the word-association testing, the layer breakdown and the reversed-guitar "blossom." It has a full transcript.\[8\]
- **Google Design, "Good Vibrations" (Harrison Zafrin & Conor O'Sullivan)**: https://design.google/library/ux-sound-haptic-material-design. On silence as negative space, the Super G (two flammed piano notes in G), building a whole soundscape around one key, and using generative audio as raw material.\[1\]
- **Material Design sound guidelines**: https://m2.material.io/design/sound/about-sound.html (plus the "Sound attributes" and "Sound choreography" pages). A design-system treatment of tonal vs atonal sounds, hierarchy, key relationships, EQ for devices and loudness by priority.\[24\]\[29\] Natural reading for a design engineer.
- **ElevenLabs Sound Effects docs**: https://elevenlabs.io/docs/overview/capabilities/sound-effects and the prompting help article https://elevenlabs.io/docs/help-center/product/core-capabilities/sound-effects/how-do-i-prompt-for-sound-effects. The official parameters, terminology and advice to generate single sounds and combine them.
- **ElevenLabs Sound Effects Terms**: https://elevenlabs.io/sound-effects-terms and **Prohibited Use Policy**: https://elevenlabs.io/use-policy. Read these for the sublicensing opt-out and the ban on standalone resale.
- **amp, "101 Great Minds" interview with Mastercard CMO Raja Rajamannar**: https://ampsoundbranding.com/101-great-minds/mastercard-raja-rajamannar. How a multi-layer sonic architecture was built with neurologists, musicologists and musicians.\[63\] Also see the Mastercard Newsroom retrospective: https://newsroom.mastercard.com/news/perspectives/2024/inside-the-science-and-success-of-sound/
- **amp Best Audio Brands report**: https://ampsoundbranding.com/best-audio-brands. An annual benchmark of how brands use sonic logos and custom music. The 2026 edition warns that many brands are "starting to sound the same."\[64\]\[65\]
- **Silas, Müllensiefen et al., "The recall and recognition of sonic logos" (2026, author manuscript)**: https://api.repository.cam.ac.uk/server/api/core/bitstreams/eb68da1f-6ea7-4829-be41-d7da46f26aff/content. The strongest empirical work on what makes sonic logos memorable, including the recall vs recognition trade-off.
- **Listen, "What Is Sonic Branding? Part 2"**: https://wearelisten.com/post/what-is-sonic-branding-pt-2/. A clear practitioner explanation of melodic (2–3 s, 3–5 notes) vs textural (1–2 s) logos.\[22\]
- **Intel bong history**: https://timeline.intel.com/1995/the-intel-bong and the Brand Sounds write-up https://brandsounds.soundbranding.de/wordpress/the-intel-sound-logo/. The notes, the timbre blend and the violin recognition test.
- **School of Motion podcast with Sono Sanctus (Wes Slover & Trevor)**: https://www.schoolofmotion.com/blog/sono-sanctus-podcast-podcast. A breakdown of a motion-graphics sound mix from early sketches to final, aimed squarely at motion designers.\[66\]
- **BOOM Library, "Top Tips for Trailer Sound Design"**: https://www.boomlibrary.com/blog/top-tips-for-trailer-sound-design/, and **"Sound Design, Voice Over and Music for Film Trailers"**: https://www.boomlibrary.com/blog/sound-design-voice-over-and-music-for-film-trailers/. On layering by transient, body, sustain and tail, frequency-specific ducking and transient shaping.\[19\]\[21\]
- **Duende Sounds, "Trailer Sound Design Elements Explained"**: https://duendesounds.com/trailer-sound-design-elements/. The best short explainer on key-matching and the classic mistakes (too many braams, unresolved risers, impacts with no tail).\[14\] Written by a sample vendor, so discount the sales pitch.
- **iZotope, "5 Essential Tips for Mixing Reverb"**: https://www.izotope.com/en/learn/essential-tips-for-mixing-reverb.html. On reverb ducking and tempo-synced pre-delay and decay.\[33\]
- **Hugo Fastl, "Psychoacoustics and Sound Quality"**: https://mediatum.ub.tum.de/doc/1138438/document.pdf. The academic foundation for loudness, sharpness and roughness in product sound, including brand-image effects.\[67\]
- **Spotify loudness normalization**: https://artists.spotify.com/help/article/loudness-normalization, **EBU R128**: https://tech.ebu.ch/publications/r128, **ATSC A/85**: https://www.atsc.org/atsc-documents/a85-techniques-for-establishing-and-maintaining-audio-loudness-for-digital-television/, **Ian Shepherd on YouTube "Stats for nerds"**: https://productionadvice.co.uk/stats-for-nerds/, **Chrome autoplay policy**: https://developer.chrome.com/blog/autoplay. The primary delivery specs.
- **Joel Beckerman (Man Made Music / Made Music Studio) on NPR**: https://www.npr.org/2014/10/20/357576510/from-sizzling-fajitas-to-the-super-bowl-how-sounds-help-sell. The "pull all the sound out first" philosophy, from the author of *The Sonic Boom*.\[68\]

## Caveats

- **Some statistics conflict or are secondhand.** Mastercard's acceptance sound is reported as 1.3 s in most interviews and 1.6 s in the 2024 Newsroom piece,\[23\]\[36\] and its variation count as 200+ or about 300 depending on the year.\[26\]\[69\] The Intel focus-group figures (60 people, 80% vs 100%) come from a secondary write-up, not an Intel publication.\[6\]
- **Social platform loudness targets are not officially published** for YouTube, TikTok or Instagram. The −14 LUFS figure is an industry measurement. Blogs claiming TikTok or Instagram "prefer" −10 to −12 LUFS are unverified.\[53\]\[56\]\[70\]
- **ElevenLabs terms and features change often.** The terms quoted are dated February 2026. Re-read the Sound Effects Terms and your plan's license before any paid campaign. This report is not legal advice, particularly on sound-trademark registration of an AI-assisted logo.
- **Several practical numbers are practitioner rules of thumb, not standards:** pre-delay 20–60 ms, UI sounds 50–200 ms, 3–6 hero hits per launch video, and the ~300 Hz phone-speaker floor. Treat them as starting points to adjust by ear against picture.
- **The memorability study** used piano transcriptions of unreleased logos, so real-world recognition (with timbre, repetition and visual pairing) will differ.\[7\] Intel's test suggests timbre alone can drive recognition.\[6\]

## Sources

1. [Sound & Touch: Design Beyond the Screen - Google Design](https://design.google/library/ux-sound-haptic-material-design)
2. [What Netflix's Ta-Dum Sound Logo Comes From - IndieWire](https://www.indiewire.com/features/general/what-netflix-ta-dum-sound-logo-comes-from-1234578100/)
3. [Tudum or Ta-dum: The Story Behind Netflix's Audio Logo - Audiospheric](https://www.audiospheric.com/en/tudum-ou-ta-dum-lhistoire-du-logo-audio-de-netflix/)
4. [How Netflix’s iconic “ta-dum” sound was created | by Shaunak Bhanarkar | Bootcamp | Medium](https://medium.com/design-bootcamp/how-netflixs-iconic-ta-dum-sound-was-created-96969fb4570c)
5. [The best audio logos and why they work | Creative Bloq](https://www.creativebloq.com/features/audio-logos)
6. [The Intel Sound Logo – Brand Sounds](https://brandsounds.soundbranding.de/wordpress/the-intel-sound-logo/)
7. <https://api.repository.cam.ac.uk/server/api/core/bitstreams/eb68da1f-6ea7-4829-be41-d7da46f26aff/content>
8. <https://www.20k.org/episodes/netflix>
9. [Loudness normalization](https://artists.spotify.com/help/article/loudness-normalization)
10. [EBU R 128](https://en.wikipedia.org/wiki/EBU_R_128)
11. <https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07-Annex-M.pdf>
12. [Autoplay policy in Chrome | Blog | Chrome for Developers](https://developer.chrome.com/blog/autoplay)
13. [The growing role of whooshes sound effects in modern animation and VFX -](https://www.animationxpress.com/latest-news/the-growing-role-of-whooshes-sound-effects-in-modern-animation-and-vfx/)
14. [Trailer Sound Design Elements Explained | Duende Sounds](https://duendesounds.com/trailer-sound-design-elements/)
15. [Sound Design for Trailers: Braams, Hits & Risers](https://violetrecording.com/sound-design-for-trailers/)
16. [UI Sounds: What They Are and How to Design Them | WithFeeling](https://withfeeling.com/the-sonic-glossary/ui-sounds/)
17. [A Quick Guide to Using Sound Effects In Trailers - Epikton](https://epikton.net/a-quick-guide-to-using-sound-effects-in-trailers/)
18. [Whoosh. The importance of sound design in animation & video. | by Amir Otaifa | Medium](https://medium.com/@amir.otaifa/whoosh-the-importance-of-sound-design-in-animation-video-70393f012718)
19. [TOP TIPS FOR TRAILER SOUND DESIGN | BOOM Library](https://www.boomlibrary.com/blog/top-tips-for-trailer-sound-design/)
20. [20 useful sound design tips for motion graphics](https://pitchdrift-productions.com/sound-design-tips-for-motion-graphics/)
21. [Sound Design, Voice Over and Music for Film Trailers | BOOM Library](https://www.boomlibrary.com/blog/sound-design-voice-over-and-music-for-film-trailers/)
22. [What Is Sonic Branding? Part 2: How Audio Logos Build Brand Recognition | Listen](https://wearelisten.com/post/what-is-sonic-branding-pt-2/)
23. [Lessons from Mastercard’s Sonic Branding Experience - Communicate Online](https://communicateonline.me/news/lessons-from-mastercards-sonic-branding-experience/)
24. [Sound attributes - Material Design](https://m2.material.io/design/sound/sound-attributes.html)
25. [20-Year Anniversary Of Intel 'Bong' - Innovative Marketing Drove Billions In Chip Sales](https://www.siliconvalleywatcher.com/20-year-anniversary-of-intel-bong----innovative-marketing-drove-billions-in-chip-sales/)
26. [Inside Mastercard’s ‘10-layer’ sonic branding plan](https://www.marketingbrew.com/stories/2022/10/17/inside-mastercard-s-10-layer-sonic-branding-plan)
27. [Sonic Logos: A Master Class to Designing Your Brand Soundscape | Voices | Voices](https://www.voices.com/blog/sonic-logos/)
28. [How to layer sound effects | Morphic](https://morphic.com/resources/how-to/how-to-layer-sound-effects)
29. [Sound choreography - Material Design](https://m2.material.io/design/sound/sound-choreography.html)
30. [How to Use Reverb to Fix Common Mix Issues - SonusGearFlow](https://sonusgearflow.com/musicproduction/how-to-use-reverb-to-fix-common-mix-issues)
31. [How to Use Reverb in a Mix | Pre-Delay, Decay & Sends](https://monakaiaudio.com/music-production-blog/how-to-use-reverb-in-mix.html)
32. [Achieving Depth and Space: An In-Depth Guide to Reverb and Delay in Mixing Dance Music - El Stray Mastering](https://elstraymastering.com/2024/10/05/achieving-depth-and-space-an-in-depth-guide-to-reverb-and-delay-in-mixing-dance-music/)
33. [5 Essential Tips for Mixing Reverb](https://www.izotope.com/en/learn/essential-tips-for-mixing-reverb.html)
34. [Automotive Sound Quality for EVs: Psychoacoustic Metrics with Reproducible AI/ML Baselines](https://arxiv.org/pdf/2509.16901)
35. [Psychoacoustics & Sound Quality - An Introduction](https://acoustic-research-consulting.co.uk/blog/post/psychoacoustics-sound-quality-introduction)
36. [Sonic marketing: A look back – and ahead – at Mastercard’s sonic brand | Mastercard Newsroom](https://newsroom.mastercard.com/news/perspectives/2024/inside-the-science-and-success-of-sound/)
37. [Financial services brands show strong sonic strategies: report — amp sound branding](https://ampsoundbranding.com/news/financial-services-brands-show-strong-sonic-strategies-report)
38. [Sound effects | ElevenLabs Documentation](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
39. [ElevenLabs releases version 2 of its AI sound effects model with longer clips and better audio quality](https://the-decoder.com/elevenlabs-releases-version-2-of-its-ai-sound-effects-model-with-longer-clips-and-better-audio-quality/)
40. [ai 11 labs sfx](https://ekscripts.gumroad.com/l/ai-11-labs-sfx)
41. [ElevenLabs Launches SFX Model v2: High-Quality AI Sound Effects with Seamless Looping and Extended Duration | AI News Detail | Blockchain.News](https://blockchain.news/ainews/elevenlabs-launches-sfx-model-v2-high-quality-ai-sound-effects-with-seamless-looping-and-extended-duration)
42. [ElevenLabs AI Sound Effects 2026: Complete SFX & API Guide](https://elevenlabsmagazine.com/elevenlabs-ai-sound-effects-guide-2026/)
43. [I just got early access to ElevenLabs' AI sound effect generator — here's what it can do](https://www.tomsguide.com/ai/i-just-got-early-access-to-elevenlabs-ai-sound-effect-generator-heres-what-it-can-do)
44. [Best practices | ElevenLabs Documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
45. [How do I prompt for sound effects? | ElevenLabs Documentation](https://elevenlabs.io/docs/help-center/product/core-capabilities/sound-effects/how-do-i-prompt-for-sound-effects)
46. [What Is Eleven Laboratory (ElevenLabs)? Complete 2026 Guide](https://elevenlabsmagazine.com/what-is-eleven-laboratory-elevenlabs-guide-2026/)
47. [Can I Use ElevenLabs Free Commercially? The 2026 License Answer](https://oakgen.ai/blog/elevenlabs-free-commercial-use)
48. [ElevenLabs SFX V2 & SB1 Soundboard Guide 2026: AI Sound Effects for Creators](https://elevenlabsmagazine.com/elevenlabs-sfx-v2-soundboard-guide-2026/)
49. [Can I publish the content I generate on the platform? – ElevenLabs](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)
50. [ElevenLabs Prohibited Use Policy](https://elevenlabs.io/use-policy)
51. <https://elevenlabs.io/sound-effects-terms>
52. <https://productionadvice.co.uk/stats-for-nerds/>
53. [How to Master for TikTok, Reels & Shorts (LUFS Guide 2026) | TrackGleam](https://trackgleam.com/learn/master-for-tiktok-reels-shorts)
54. [LUFS Loudness Standards for Every Platform (2026) - Complete Reference | Video Volume Booster](https://videovolumebooster.com/tools/lufs-standards)
55. [Social Media Audio Loudness — TikTok, Instagram & Facebook | Critical Listening Lab](https://www.criticallisteninglab.com/en/learn/loudness/social-media)
56. [LUFS Loudness Standards for 50+ Platforms - Free Lookup | Dan Murtagh](https://danmurtagh.com/lufs-loudness-standards)
57. [R 128 s1 LOUDNESS PARAMETERS FOR SHORT-FORM CONTENT (ADVERTS; PROMOS, ETC.)](https://tech.ebu.ch/docs/r/r128s1.pdf)
58. [ATSC A/85, US TV Loudness Target - APU Software](https://apu.software/atsc-a85-us-tv-loudness/)
59. [ATSC Modernizes Industry Audio Loudness Guidance with Revision to A/85 Recommended Practice - ATSC : NextGen TV](https://www.atsc.org/news/atsc-modernizes-industry-audio-loudness-guidance-with-revision-to-a-85-recommended-practice/)
60. [Audio requirements - Apple Podcasts for Creators](https://podcasters.apple.com/support/893-audio-requirements)
61. [Target LUFS for YouTube, TikTok, and Spotify (2025)](https://clickyapps.com/creator/video/guides/lufs-targets-2025)
62. [LUFS for Spotify, TikTok & Apple Music — Loudness Guide 2026](https://www.songbrain.ai/guides/lufs-for-spotify-and-tiktok)
63. [101 Great Minds - Conversations about Sonic Branding with Raja Rajamannar — amp sound branding](https://ampsoundbranding.com/101-great-minds/mastercard-raja-rajamannar)
64. [Best Audio Brands | Sonic branding report | amp sound branding](https://ampsoundbranding.com/best-audio-brands)
65. [amp Sound Branding Agency | Sonic Branding for Iconic Brands](https://ampsoundbranding.com/)
66. [Sound in Motion: A PODCAST with Sono Sanctus](https://www.schoolofmotion.com/blog/sono-sanctus-podcast-podcast)
67. [Psychoacoustics and Sound Quality Hugo Fastl](https://mediatum.ub.tum.de/doc/1138438/document.pdf)
68. [Interview: Joel Beckerman, Author Of 'The Sonic Boom' : NPR](https://www.npr.org/2014/10/20/357576510/from-sizzling-fajitas-to-the-super-bowl-how-sounds-help-sell)
69. [Delve into the insights of Raja Rajamannar, Chief Marketing and communications Officer of Mastercard, as he shares insights on the influence of sonic branding and Music in Brand strategies. — amp](https://www.ampsoundbranding.com/101-great-minds-home/raja-rajamannar)
70. [10 Best Loudness Normalizers for Social Video (LUFS) - OpusClip Blog](https://www.opus.pro/blog/best-loudness-normalizers)
