---
name: product-launch-video
description: Make a product launch, feature or demo video in this repo, from finding what sets the product apart to the final mp4, by showing the product working instead of describing it. Interviews the person for the differentiators, writes the video as one journey through the real UI, shows a cheap flat sketch (board and animatic) so the script is agreed before anything heavy, then builds the finished shots. Use when asked to create, plan, storyboard or continue a launch, product, feature or demo video, or when a cut reads like a slideshow of text and screenshots.
---

# Product launch video

A launch video shows the product doing the thing only it does. The viewer should understand the product by watching it work, as if looking over a friend's shoulder: close up, one thing leading to the next, the interesting part large on screen. Words are few and large, and they land on what the picture has just shown.

This skill exists to prevent the slideshow: a title card, a screenshot, a feature name, another screenshot, a list of benefits, a logo. Every frame of it is legible and none of it convinces, because the viewer is told what the product does and never sees it happen.

The look comes from the product too: its UI is the video's visual language (next section).

| Stage | Output | Gate |
|---|---|---|
| 1. Discover | `brief.md`: the product's look, the claim, the hero moment, 2 or 3 supports | The person agrees the ranking |
| 2. Script | The journey as a table: picture, words, hand-off; then the music track | The person agrees the script; the track is in `audio/` |
| 3. Sketch | The whole video, flat, from real UI, on the track's beats: board and animatic | The person agrees the flow |
| 4. Build | Finished shots, 3D, motion blur, sound effects, the mp4 | `check` passes |

Do not start stage 4 until the person has seen the sketch and said the flow is right. Heavy rendering on a story nobody agreed is the most expensive mistake in this workflow. Stages 1 to 3 should take an hour or two, not a day, plus however long the person takes to make the track.

**Music comes first.** Intentface Launch does not make music. What it does is cut the video to a track: `pnpm launch beats` finds the beats, downbeats, sections and quiet breaths, and cuts, type and the logo land on them. So get the track before the sketch and build the video around it. A video cut to a real track feels written to it; a track briefed afterwards to fit a finished cut rarely lines up as well. If the person already has music (bought, licensed or made for the product), use it. If not, they generate it from a brief you write (stage 2, "The track") with a music generator such as Suno or ElevenLabs Music. Tell the person this early, in discovery, so the track is ready when the script is agreed.

## The product's look is the video's look

The video is the product's UI coming alive as a story, so the product's interface sets the visual language, not a template and not another brand. Before designing anything, look at the product running and write down its look in `brief.md`:

- **Type:** the UI's fonts, weights, the size of its headings. `pnpm launch look <url>` prints the font stacks the text is set in, the colours that cover the screen, the radii and the `:root` tokens, and writes pictures of each step you give it (`--do "click:New chart" --wait 2`).
- **Colour:** its backgrounds, surfaces, text, accent, light or dark.
- **Shape and depth:** corner radii, borders or none, shadows or none, density, icon style.
- **Motion:** how the product itself animates, if it does (springy, snappy, none).

Then design in those terms: the video's headlines in the product's own typeface, backgrounds from the product's own canvas or surface colours, the accent only where the product uses it, end card in the product's logo and colours. Text overlays should look as if the product's designer set them. Where the product leaves a gap (it has no display weight, no motion), extend its style in its own spirit rather than importing one.

An installed brand package (such as `@intentface/brand`) applies only when the person says the video is in that brand. Being installed in the repo is not a request to use it: never put another brand's fonts, gradient, logo or motion rules on a product unless told to.

## 1. Discover what sets it apart

**Read first, then ask.** Before any question, read the product: README, docs, llms.txt, the landing page copy, routes, the main components, the seed or demo data. Then run it locally (on a spare port; never reuse one another project is serving) and use it yourself. Look at it with `pnpm launch look <url> --dark --do "click:Run all" --wait 8 --do "click:Add column"`: one tiled image of the load and each step, and the page's look as text, with no throwaway script. Your questions should be informed: "Typing a sentence turns it into filters. Is that the moment people are surprised by?"

**Then ask the person what only they know**, in one round of a few questions, each with candidate answers drawn from what you found (the AskUserQuestion tool, when you have it):

- **The difference.** What does it do that the way people work today (a competitor, a spreadsheet, by hand) cannot? Why was it built?
- **The aha moment.** The first moment a new user says "oh". Which screen, which action, what appears? This is usually the hero of the video.
- **The before.** What does the task look like without the product? It gives the hook and the tension.
- **Audience and placement.** Who watches, and where: a launch post, the landing page hero, Product Hunt, a sales call, a talk; with sound or muted. This sets length and format.
- **Length.** A range in seconds (a feed post 20 to 40, a hero film 60 to 90).
- **Pacing and energy.** Calm and precise (long holds, gliding camera, few cuts) or bold and energetic (cuts every one or two beats, close-ups, big words that slam). It sets the tempo, how long each feature gets and how text moves, so ask it rather than guess.
- **Style and theme.** The product's own UI look (the default), or a palette the person names ("accent, black and white"); light or dark; how much text (a few huge words, or lines beside the UI); the typeface if not the product's. A brand only when named.
- **Bookends.** Anything the video must open or close with: an existing logo sting or intro clip (an mp4 in another video's `out/`), an end card, a URL or call to action.
- **Music.** Do they have a track already (bought, licensed, made for the product)? If not, say that Intentface Launch does not make music but cuts the video to it, so the best order is to make the track after the script and build on it, and ask whether they will generate one (Suno, ElevenLabs Music and the like) from your brief. If they want no music yet, choose a BPM anyway and time everything in beats, so a track can still be briefed to the cut later. Sound effects are separate, and are added in the build.
- **Live output.** Where the product's answers come from while capturing: the person's API key (ask where it is kept, read it only inside the capture script, never print it), a local or in-browser model, or the product's demo mode. Run it once and look at the answers before choosing: a weak answer on screen is a false claim.
- **Limits.** What is unreleased, what must not be claimed, which data may be shown (a demo account, real customers' names or not).

Ask only what the request did not already say: a person who wrote "bold, energetic, accent with black and white, start with the logo mp4, no audio yet" has answered pacing, style, bookends and sound.

**Rank the candidate features.** A feature earns a place only if it passes all three:

| Test | Question | Fails |
|---|---|---|
| Distinct | Would a competitor's video show the same thing? | Login, settings, a generic dashboard, "fast and easy" |
| Visible | Can it be seen happening in under 5 seconds: an action and the product's answer? | Security, "integrates with everything", anything that exists only as a sentence |
| On the path | Does it follow from the previous feature in one task? | A side feature that needs its own setup |

**Agree the points before going forward.** Ask the person directly which points the video must leave in a viewer's head and which it must not make: a feature, a use case, a number, pricing, the model or technology behind it. Propose the ranked list (hero, supports, cuts) with the reason for each, and get a yes before the script. A proof you find striking in the product (a cost, a speed, a token count) is still a choice for the person: Jexel's intro first showed the run's cost, and the person wanted use cases instead.

Pick **one hero** (usually the aha moment) and **two or three supports**. Everything else is cut; a feature that fails "visible" but matters can get a word on the end card. Write in `brief.md`: the product's look, the claim in one sentence (it should match the homepage headline), the audience, the length, each chosen feature with its visible moment ("type a sentence → the words become filter pills"), every fact with its source, and what was cut and why. Show the person the ranking and the cuts before writing the script.

## 2. Script: one journey, not a feature list

The video is one person doing one real task in the product, start to finish, and each feature is the next thing that happens in that task. The viewer never sees a menu of features; they see a task go well. It is the story version of the product: only what matters to the story, told in order, the way someone would retell it. Settings, dialogs and steps the product needs but the story does not are left out, or pass in a beat.

- **Pick the task** that passes through the hero and the supports in a natural order. Make it concrete with the product's demo data: a real-looking query, a real name, a real number.
- **Chain the shots.** Each shot's result is the next shot's starting point: the query's results → the row that opens → the button in the detail → what it produces. For each cut, write how it hands off: the same element carried across the cut, the camera travelling across the UI to the next part, a match cut on shape or position. If two features will not connect, the order is wrong or one of them does not belong.
- **Every feature beat has the same anatomy:** where we are (one beat at most, often carried over from the last shot), the action (the click, the typing, the drag), the product's answer (a list fills, a chart redraws, a draft streams in), held one or two beats so it is seen, then on. A feature takes 3 to 6 seconds.
- **Escalate.** Order features by surprise so the video gets better as it goes. The hero comes after one support has taught the viewer how to read the UI, a third to halfway in; never first, never last.
- **Hook from the product.** The strongest opening is usually the product itself: the most striking frame of the hero, or the "before" in the product's own world. Use a text hook only when no picture would stop a scroll. The creative-direction skill has the spines, the energy curve and the reveal plan; use it for those, and this section for how the product is shown.

### Show, don't tell

Write the script picture first, then test every row:

- **Mute test.** Cover the words. Does the picture alone say the row's `says`? If the words carry it, the row is a slide: redesign the picture until the words are optional.
- **Verb test.** Each picture is an action. "The dashboard" is not a picture; "the revenue line redraws as the date range is dragged wider" is.
- **Name test.** A feature's name on screen ("Smart filters") is a label on a box. Show the filtering being smart instead; names belong in docs.

### Words on screen

Text has four jobs, and only these:

1. **Typed into the product.** The query, the prompt, the message. It is the UI, it shows what the user does, and it is the best text a launch video has (`c.type` in a capture, `Typewriter`, or a snapshot's text set per frame).
2. **A word after the fact.** One to four words landing beside a change the viewer has just seen, naming it in the viewer's terms ("Planet to street.", "Found in 0.4 s"). It arrives after the UI answers, never before. It never announces what is about to happen.
3. **The hook or the claim**, alone on screen, at most twice in the video, six words at most.
4. **The end card**: logo, claim, where to go.

Never: bullets, lists, feature names as titles, sentences explaining the UI, "Introducing…", a number the product did not just produce on screen (a stat card), more than one line of copy at a time outside the end card.

**Budgets**, counted in the script before the sketch:

- The product's UI is on screen for at least 80% of the running time.
- Overlay copy (jobs 2 and 3) is about 20 words in 30 s, 35 in 60 s. Text typed into the product and the end card do not count.
- No two text-only shots in a row, and none between two features that connect.

**Typography.** Text is a designed moment, not a caption. This section says what text a video has and where; the kinetic-typography skill says how it moves (hold times, easing, staggers, masks, sync with the music).

- Large: 120 to 200 px alone on screen, 56 to 96 px beside UI (at 1080p). Hold it long enough to read (`readingTimeOnBeats`).
- The product's own typeface and colours (see "The product's look"), at most two sizes in the video, tight tracking at large sizes (-0.02 to -0.04 em), the product's own casing.
- Placed in the composition, never over what it names: frame the UI so the words land in space the camera leaves free (one video's use-case labels first covered the last rows of the tables they named; the tables now sit high and whole, the label below them). In the space the camera leaves beside the UI, aligned to an edge of what it names, or carried by the camera with the UI (inside the `Camera`). Not centred on an empty slide.
- Animated word by word on the beat (`Slam`, `Reveal`), leaving with a quiet fade or carried off by the camera. Words can act on the UI: the typed query lifts out of its field and becomes the headline, a label rides the card it names, a word pushes the UI aside as it lands.

### How close

The viewer should read what matters without trying.

- **Establish, then go in.** The whole app is on screen briefly (a second at most) to say where we are; then the camera is on the part that changes.
- **Three distances, varied:** wide (the app; orientation, rare), working (one panel or list fills half to two thirds of the frame; most of the video), macro (one element: a pill, a number, a line of a diff; the hero's payoff).
- Product text the viewer must read is at least 28 px on the output. Zoom until it is, and capture at `scale: 2` so it stays sharp.
- **Let the viewer read what the story needs.** Energy is in the cuts and the moves, not in rushing what must be understood. A menu the person picks from, the options of a question, the first answers: each lands, then holds still (camera settled, nothing else moving) for its reading time before the next action. Deal a list in item by item so the eye reads along. Speed up only after the viewer has understood one; the abundance comes after the first few read (a review: the JEV menu, the question's options and the first labels all went by too fast).
- **Make every action visible.** A desktop-sized cursor (about 20 px) vanishes at 1080p, and a click made while the camera pans is never seen. Keep the cursor about 48 to 56 px on screen whatever the zoom (`<Cursor>` does this by default: 52 px on screen inside any `Camera`; `screenSize` changes it), settle the camera on the target before the cursor arrives, and show the click: the control's own pressed state, held a few frames before anything moves on.
- **Plain words on screen.** Product text the viewer has to understand should need no product knowledge: a template tag like `{{Plan}}` or an internal field name makes a sentence unreadable to someone who has never used the app. Write the demo data for the viewer, then run the product on it for real so what is shown is what it answered.
- **The camera follows the action**: to where the cursor is going, to where the answer appears. One move per shot plus a small settle, and never quite still. Treat the product as one canvas the camera travels across, so a pan from one panel to the next is the transition between features.
- Remove everything that is not the story: `api.hide`, `api.isolate`, dimming, clean demo data (creative-direction skill, "Showing software").
- **Give the frame depth around the focus.** UI flat and sharp to every edge looks like a screenshot. In 3D, a shallow depth of field puts the rest of the screen into bokeh. In 2D, wrap the shot in `<Focus>` (kit): outside a feathered area that follows what matters, the UI blurs and fades towards the background, so the eye lands where the story is and the frame feels shot through a lens. Keep the in-focus area generous enough to read, and move it with the camera's subject, not on its own.
- Around the UI, use the product's own canvas: its background colour, or the UI itself bleeding off the frame. No device mockups or stock backdrops unless the person asks.

### The script, on paper

Write the script as a table in `brief.md` and show it to the person in the chat:

| # | Beats | Picture: what, how close, what moves | Words | Hand-off to next |
|---|---|---|---|---|

Under it: the claim, the hero row, the running time, the share of time with UI on screen, the overlay word count, and what was cut. The person agrees or changes it; revise until they do. It is cheap here.

### The track

Once the script is agreed, get the music before building the sketch (see "Music comes first" above).

- **The person has a track.** Put it in `videos/<id>/audio/`, run `pnpm launch beats <id>`, and fit the script's rows to it: the hook on the first downbeat, the hero's reveal in or just after a breath, the payoff on a section where the energy rises, the end card on the resolve. Change row lengths to fit the music, not the music to fit the rows. Trim the track, or replay whole bars of it (music-brief skill), when its length is wrong.
- **No track yet.** Write the brief from the script with the music-brief skill: exact length, BPM, sections with timestamps from the rows, the hits, the mood. The person generates it, picks a take, and drops it in `audio/`; then as above. While they make it, start the capture run (stage 3 needs it either way), but do not time the shots until the track has arrived.
- **No music for now.** Time in beats at the BPM chosen in discovery and carry on. A track can be briefed to the locked cut later (music-brief skill).

What the difference looks like, for an imagined issue tracker that triages bugs itself:

| Slideshow (do not) | Shown |
|---|---|
| "Meet Triage" title card | A wall of 400 unread issues scrolls past, too fast to read (the before) |
| "AI-powered triage" over a dashboard screenshot | The cursor clicks Triage; the camera pushes into the list as the rows sort themselves into three groups, labels arriving as they settle |
| Bullets: "Detects duplicates · Assigns owners · Sets priority" | Macro: two near-identical rows slide together and merge into one, a "2 duplicates" chip landing on it; the camera rides the merged row to its owner's avatar |
| "Save 10 hours a week" | Pull back to the triaged board, every column filled. "400 issues. One click." beside it |
| Logo | Logo, claim, URL |

## 3. Sketch: the whole flow, cheap and real

A sketch is the whole video at its real length and timing, built from the product's real UI with flat camera moves, a cursor and the final copy, rendered as a storyboard and an animatic. It must be good enough for the person to judge the story and the flow, and cheap enough to throw shots away: one capture run and minutes of rendering, not hours.

| In the sketch | Left for the build |
|---|---|
| Real UI: snapshots of every state on the path, from one capture run | Frame-recorded captures of the product's own motion (they can be stills in the sketch) |
| Final framing and camera paths on marks (plain easing is fine) | `Stage3D`, `Panel`, depth of field, light |
| Cursor paths and click frames | `MotionBlur` |
| State changes as a switch between two snapshots on the click frame | The UI's own choreography (ui-motion skill: `Swap`, `springTo`, staggers) |
| The final copy, at its final size and place, with a simple `Reveal` or `Slam` held for its reading time | Polished kinetic type (kinetic-typography skill) |
| Timing on the track's beats (`tempo()`, or `beatGrid` when the detected BPM drifts), the track playing under the animatic | Sound effects |
| A flat stand-in, with `notes` saying what it becomes, for each planned 3D or hero effect | The hero effect itself |

[sketch.md](sketch.md) has the capture script and shot code for a sketch.

**Show it.** `pnpm launch board <id>` renders stills of every shot and the animatic (about a minute for a 30 s flat video). Start `pnpm launch dev` and give the person the board link, `http://localhost:4400/?v=<id>&board`: they see each shot's stills with its `says`, copy and notes, play the animatic, and leave notes per shot, saved to `videos/<id>/comments.json`. For someone without the repo: `pnpm launch board <id> --html`, then share `out/board/index.html` with `animatic.mp4`. Before handing it over, look at the board yourself and run the tests from stage 2 on the stills (motion-review skill, rhythm with `sheet --beats`). `board` also prints check's text pass per shot (and the Board view shows it under the stills): fix every reading shortfall before the person approves the timing, or the cut gets retimed after sign-off (a review: jexel-intro's hook lines and labels were 0.2 to 0.5 s short, found only at `check`).

Tell the person what to judge: does the story read with the sound off, is every feature shown rather than said, does each shot lead to the next, is the pace right. Not the polish; that comes next.

**Iterate.** Read `comments.json`, revise the shots, set `reply` (and `resolved` when done) on each note you handled, and rebuild the board. Repeat until the person says the flow is agreed. Then the timing, framing and copy are locked: the build replaces how shots look, not what they show or when.

## 4. Build

Replace the sketch's shots one at a time with finished ones, keeping their timing, framing and copy.

- **Captures.** Where the product's own motion is the point (a map flight, a streaming answer, a loading state), record frames. One capture script per flow; `setup` waits for data and hides dev overlays (`nextjs-portal { display: none }` for Next.js); generous holds before and after each action, since trimming is free and recapturing is slow. Check a few frames with the Read tool before building on a capture.
- **UI changes** take their timing from the ui-motion skill: the sketch's hard switches become one element changing state.
- **Text** (the claim, words beside the UI, the end card) moves by the kinetic-typography skill: entrances and exits from one easing family, still while read, landing slightly before the beat.
- **3D and hero effects** where the sketch has stand-ins (the three add-on's guide): 3D for transitions and moments of awe, flat whenever the viewer reads.
- **Music** has been in since stage 2. When the build holds a shot longer, replay bars of the track rather than asking for a new one (music-brief skill); with no track yet, brief one to the locked cut now. **Sound effects** with the sound-design skill. When sound and picture share timing, keep it in a plain `timing.ts`.
- **Logo and end card** with the logo-animation skill.
- **After each shot**, stills and a contact sheet (motion-review skill). Do not call a shot done without looking at it.
- **If the build shows the story must change** (a feature does not read when finished, a hand-off fails), go back to the person with an updated sketch. Do not change the story silently.
- `pnpm launch check <id>` with no errors, `pnpm check` passing, then `pnpm launch render <id>`. Hand back the path, length, size and anything still a placeholder.

### Lessons from finished videos

- **A reveal lands on content.** When the camera pulls back to show a panel, list or board, fill it as the camera moves (rows dealt in during the pull), so it arrives on something full; a pull-back onto an empty surface reads as waiting. Deal from where the camera starts outwards, so each row lands in view as the frame widens.
- **Pull back only as far as the reveal needs, and keep product UI facing the viewer.** A far pull-back that also turns the panel away reads as losing the subject (a reviewer: "zooms unnecessarily away, the panel is awkwardly far"). Turn in 3D for transitions, not for UI the viewer is following.
- **Give a detail view time.** A card whose facts are named one by one needs about two beats per name and the card still readable after the last one; to name more facts, lengthen the music, do not shorten the names. Leave the names in place (fade) as the next shot comes in, with the camera still moving, rather than holding still and cutting.
- **Texture the subject, not the background.** Grain, dot masks and noise over a dark background are smeared away by video compression (and cost bitrate); put texture where it reads, on the lit text or object, and keep large dark areas smooth, with only a dither of about 1.5/255 so glows do not band (a reviewer's note).
- **`audio.src` is a URL from the launch folder** (`/videos/<id>/audio/…`), not a path relative to the video; a relative one renders silent with only an "audio not found" line in the log.
- **No blur (or other filter) transition into or out of a `Stage3D` shot.** `transitions.blur` and `transitions.zoom` put a CSS `filter` over the stage's WebGL canvas while it accumulates samples. Under several render workers Chromium then never delivers the screenshot: the frame stalls for 90 s, and retrying in a new browser stalls on the same frame (one video: frames 243 to 252, three retries each, in every full render). Cut straight into and out of 3D shots, or use an opacity-only `transitions.fade`. Flat shots, even with a WebGL globe, dissolve with blur fine.
- **Renders that fail keep their work.** A failed chunk is reported and the rest carry on; fix the cause, then `render <id> --resume` renders only what is missing. It reuses chunks by render settings, not by source, so after changing the video delete the chunks whose frames changed (`out/.chunks/frames-<first frame>.mkv`) or render without `--resume`.

## Hand back

At each gate, tell the person what to decide, not only what you did:

- After discovery: the claim, the hero and supports with their visible moments, what was cut.
- After the script: the table, the counts (running time, UI share, overlay words), the hero row; then the music brief to paste into a generator, with its length and BPM (or, with their own track, how the rows fit its sections).
- After the sketch: the board link, the animatic's path, what is a stand-in, what to judge.
- After the build: the mp4's path, length and size, `check`'s warnings and the decisions taken on them, anything still a placeholder.
