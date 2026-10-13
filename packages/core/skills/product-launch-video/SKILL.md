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

An installed brand package applies only when the person says the video is in that brand. Being installed in the repo is not a request to use it: never put another brand's fonts, gradient, logo or motion rules on a product unless told to.

## The quality bar, from the first board

The person judges every board as if it were the film. A sketch that is flat, linear and loosely framed gets rejected as "not cool" however good the story, and the person should never have to ask for good motion design. So from the first board:

- **Motion design, not slides.** Every UI change uses its ui-motion recipe (a button becoming its next state on `springTo` with a `Swap` inside, checkboxes that fill then draw, counters that roll, lists dealt in with a stagger). Camera keys use `springEase` or `ease.inOut` and `travel` so moves overlap, `MotionBlur` on the fast ones, `Focus` around what matters, perspective where the build will have depth. Type enters with `Reveal` or `Slam`, never just appears. `interpolate` with no easing on a position, scale or camera is a bug.
- **Every shot earns its place.** An effect must show something: a 3D move that only rotates the UI is decoration, and was cut at review ("what is the point of that?"). After a line that makes a claim ("Written as code."), the next shot pays it off.
- **UI that looks designed in the film's world.** On a dark film, the product in dark mode where it has one. The app sits in its own window with rounded corners, never as loose cards floating on the background. Other shapes (9:16, 1:1) get a real reflowed layout of the UI, never a crop that cuts its header in half or leaves empty slabs.
- **Words anyone understands.** Labels, buttons and data on screen read at a glance to someone who has never used the product: "Launch", not "Ship v2.4".
- **A list of kinds is one line, not a screen each.** Use cases, formats and audiences cycle through one line ("Create [product / update / intro / ad] video"), the changing word rolling in place; no UI is needed to name them.
- **The logo plays its own animation.** When the logo has an intro animation (a brand's animated mark), the end card uses it, driven by the frame, on the brand's specified background, not a generic fade or lift.
- **Pacing follows the track's sections.** A two-word line holds one bar, two at most. A shot that has finished saying its thing ends. Use the breaks and lifts for changes of idea, the drop for the payoff.
- **Pacing that keeps moving.** Something new every one or two beats; no card, hold or drift longer than its content earns. Short lines get a bar, the claim at most two.
- **Review before you show, and say what you fixed.** Before any board goes to the person, read stills of every shot (motion-review skill's list of defects) and fix what you find. A board that needs the person to point out a cropped header, a floating card or a shaking effect was not reviewed.

## 1. Discover what sets it apart

**Start from what the person gave you.** A request can be one sentence ("look at my app in ../app and make a 30 second release video about scheduling") or come with material. Use all of it before asking anything:

- **A path or URL to the product:** read it and run it, as below.
- **Screenshots in `videos/<id>/reference/`:** the moments the person wants shown. Read each one, find the same state in the running product, and build the shot from the product (a snapshot stays sharp at any zoom; a screenshot does not). They are references, not footage: put one in frame only when asked. `licences` and `check` skip this folder.
- **Media in `videos/<id>/media/`:** images, footage, a screen recording, an intro or logo sting, a track. Each goes in where the person said (a `Clip` for video, an `<img>` registered with `waitFor` for a picture); when they did not say, ask what each one is for. Record each file's licence (`<file>.license.json` or `licences.json`); the person's own product and brand files are theirs, so say so in the licence.
- **A team's approach in `launch/CLAUDE.md`** (or a file it points to): a fixed structure, a length, a sound, steps to always or never take. Follow it, and ask only what it leaves open.
- **No way to run the product locally:** say what that costs before building (no close-ups past the screenshots' resolution, no live state changes), then build from what is in `media/`.

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

**Agree the points before going forward.** Ask the person directly which points the video must leave in a viewer's head and which it must not make: a feature, a use case, a number, pricing, the model or technology behind it. Propose the ranked list (hero, supports, cuts) with the reason for each, and get a yes before the script. A proof you find striking in the product (a cost, a speed, a token count) is still a choice for the person: one intro first showed a run's cost, and the person wanted use cases instead.

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

Never: bullets, lists, feature names as titles, long sentences, sentences explaining the UI, "Introducing…", a number the product did not just produce on screen (a stat card), more than one line of copy at a time outside the end card.

**Quick to read, one line.** Every piece of overlay text is a single line of one to four words that reads at a glance; it never wraps. A thought that needs more words is split across consecutive frames, one phrase per beat or cut, each read alone: "To make every" / "new ways" / "it's also how they're made." The messages the person asks the video to convey are what the viewer should come away with, not the copy: find the picture that shows each one and the fewest words that name it (one launch film's "programmatic videos for launches, version updates and multiple sizes" became "One video." / "Every size." / "Every update.", each over the render it names).

**Budgets**, counted in the script before the sketch:

- The product's UI is on screen for at least 80% of the running time.
- Overlay copy (jobs 2 and 3) is about 20 words in 30 s, 35 in 60 s. Text typed into the product and the end card do not count.
- No two text-only shots in a row, and none between two features that connect.

**Typography.** Text is a designed moment, not a caption. This section says what text a video has and where; the kinetic-typography skill says how it moves (hold times, easing, staggers, masks, sync with the music).

- Large: 120 to 200 px alone on screen, 56 to 96 px beside UI (at 1080p). Hold it long enough to read (`readingTimeOnBeats`).
- The product's own typeface and colours (see "The product's look"), at most two sizes in the video, tight tracking at large sizes (-0.02 to -0.04 em), the product's own casing.
- One typographic style for the whole video: the same face, weights, sizes, colour and placement from the first line to the last. Break it only when the break is the point, once or twice: one word hand-lettered for emphasis in an otherwise plain line, the claim set glowing in colour on black. A style that changes from shot to shot without a reason reads as a template.
- Placed in the composition, never over what it names: frame the UI so the words land in space the camera leaves free (one video's use-case labels first covered the last rows of the tables they named; the tables now sit high and whole, the label below them). In the space the camera leaves beside the UI, aligned to an edge of what it names, or carried by the camera with the UI (inside the `Camera`). Not centred on an empty slide.
- Animated word by word on the beat (`Slam`, `Reveal`), leaving with a quiet fade or carried off by the camera. Words can act on the UI: the typed query lifts out of its field and becomes the headline, a label rides the card it names, a word pushes the UI aside as it lands.

### How close

The viewer should read what matters without trying.

- **Establish, then go in.** The whole app is on screen briefly (a second at most) to say where we are; then the camera is on the part that changes.
- **Three distances, varied:** wide (the app; orientation, rare), working (one panel or list fills half to two thirds of the frame; most of the video), macro (one element: a pill, a number, a line of a diff; the hero's payoff).
- Product text the viewer must read is at least 28 px on the output. Zoom until it is, and capture at `scale: 2` so it stays sharp.
- **Never show the UI too far away.** Even where nothing needs reading, the UI's own text should not drop under 20 px on screen: a whole 1440 px app on a 1920 frame sets 14 px body text at about 19 px, and on a phone that is a texture, not a product. A view that wide is the establishing second at most; most of the film is working distance (one panel or list filling half to two thirds of the frame) or closer. Lay type beside a UI only once the UI is close enough to read; a headline over a distant window turns the product into a backdrop. `check` warns (`ui`) when the UI's text is mostly under 20 px for a second or more.
- **Let the viewer read what the story needs, and not a frame more.** Energy is in the cuts and the moves, not in rushing what must be understood. A menu the person picks from, the options of a question, the first answers: each lands, then holds still (camera settled, nothing else moving) for its reading time before the next action. Reading time is a floor, not a target: a line of one to four words reads in about a bar (1.5 to 2 s), and holding it longer makes the film sluggish (one launch film's line cards held 2 to 4 s each and the review called the pacing sluggish). Cut on the next beat after a line has read; something new should happen every one or two beats. Deal a list in item by item so the eye reads along. Speed up only after the viewer has understood one; the abundance comes after the first few read (a review: the JEV menu, the question's options and the first labels all went by too fast).
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

A sketch is the whole video at its real length and timing, built from the product's real UI with its camera moves, cursor, UI motion and final copy, rendered as a storyboard and an animatic. It must be good enough for the person to judge the story and the flow, and cheap enough to throw shots away: one capture run and minutes of rendering, not hours.

| In the sketch | Left for the build |
|---|---|
| Real UI: snapshots of every state on the path, from one capture run | Frame-recorded captures of the product's own motion (they can be stills in the sketch) |
| Final framing and camera paths on marks (`springEase`, `travel`), the UI in CSS perspective and `Focus` where the build will have depth | `Stage3D`, `Panel`, depth of field, light |
| Cursor paths and click frames, `MotionBlur` on the few frames of a fast move | Motion blur everywhere else it is planned |
| The hero's UI changes with their ui-motion recipes (`Swap`, `springTo`, staggers); a switch between snapshots only for minor ones | The rest of the UI's choreography |
| The final copy, at its final size and place, with a simple `Reveal` or `Slam` held for its reading time | Polished kinetic type (kinetic-typography skill) |
| Timing on the track's beats (`tempo()`, or `beatGrid` when the detected BPM drifts), the track playing under the animatic | Sound effects |
| A cheap stand-in that already looks like it (CSS perspective, layers in `translateZ`), with `notes` saying what it becomes, for each planned 3D or hero effect | The hero effect itself |

[sketch.md](sketch.md) has the capture script and shot code for a sketch. [patterns.md](patterns.md) lists moves already built and measured once (cutting in on the caret, a streaming answer, a status pill, state spreading through a list, a line that stays centred, a word on a reel, cards flicked along a rail, proof by multiplication, a wall of integrations and more), each with its numbers and its code: when a beat needs one, start from it.

**Show it.** `pnpm launch board <id>` renders stills of every shot and the animatic (about a minute for a 30 s flat video). Start `pnpm launch dev` and give the person the board link, `http://localhost:4400/?v=<id>&board`: they see each shot's stills with its `says`, copy and notes, play the animatic, and leave notes per shot, saved to `videos/<id>/comments.json`. For someone without the repo: `pnpm launch board <id> --html`, then share `out/board/index.html` with `animatic.mp4`. Before handing it over, look at the board yourself and run the tests from stage 2 on the stills (motion-review skill, rhythm with `sheet --beats`). `board` also prints check's text pass per shot (and the Board view shows it under the stills): fix every reading shortfall before the person approves the timing, or the cut gets retimed after sign-off (in one review, the hook lines and labels were 0.2 to 0.5 s short, found only at `check`).

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

### The finish: what lifts a build to a premium film

What took one launch film from a good board to a finished film that holds up beside a top-tier product launch. Do these by default in every build:

- **Show the product once as an object.** The hero UI goes on a `Panel` slab in a `Stage3D` (the window itself as the region, its corner radius, depth about 30, a lit edge) on the film's ground. Seen low across the slab (elevation about 30°), the lens focuses on the one control that matters (`blur` about 50 px) and the rest falls into heavy bokeh. Heavy bokeh is the look; what a reviewer called "horrible" and "spiky" was its quality: before `Stage3D` smoothed its samples, a defocused edge averaged into a sunflower of separate copies. Judge bokeh only at full samples, never on an 8-sample draft. Keep anything that moves (the cursor) on the focus plane, along the control's own row, or it blurs into a disc. Add a slow dolly toward it and one `sweep` light running across its edge. The film opens on light arriving out of black: fade up over 30 to 40 frames, never a fully lit first frame.
- **One move, one key pair.** A camera move that should flow has no key in its middle: a rig key arrived at on `ease.in` and left on `ease.inOut` stops the camera dead (a reviewer: "the zoom after clicking has a weird stop"). To change focus during a move, compose the lens yourself (`framingAt(keys, f)` for the path, the blur on its own curve, `frame()` to make the lens).
- **Land 3D on flat exactly.** When the 3D shot hands over to flat UI, the camera ends straight on at one unit per pixel, with the slab at z = −depth/2. It lands 14 to 20 frames early, and the flat DOM dissolves in over it. `diff <id> --frame <3d shot>:end --against <next>` must say "identical"; a 1 px jump at the cut is a defect (the three add-on's guide has the recipe).
- **The product in motion lives in the same world.** A reel of the product's parts uses the same slab. It whips to the next part every two beats with the shutter open only on the whips, and drifts between them. Each stop frames a whole card, never a crop through a number or a sliver of the control above.
- **Show reach where it lands.** "Works everywhere" is a family of devices on a black mirror floor (`Laptop`, `Tablet`, `Phone`), large in frame (the family about 85% of the width) and rising into it from below as the camera pans down onto them, each showing a different kind of platform: a video site in 16:9, a photo feed in 1:1, a short-video app in 9:16. Tell them apart by layout and theme (player and up-next column; stories row in light mode; full-bleed with an action column), never by platform names or logos. One clip plays on all of them, laid out for each, and all three react on the same frame. Keep the sample content neutral (a gray video ground, the product's one accent, gray thumbnails and avatars): coloured placeholder thumbnails and a saturated clip ground looked "horrible" at review. "Every size" alone reads as responsive devices; the point is the platforms. In a flat, type-led film, though, the device family was cut at review as not fitting the look, and so were the rendered files playing side by side in their three shapes: the video shrinking into one file, then a line cycling the kinds of video, said enough. Deliver the film itself in the shapes it is posted in instead (16:9 and 4:5 for that one; social-formats skill), each laid out again.
- **Type holds still.** Never put a slow push or drift on DOM text: Chrome snaps glyphs to whole pixels, so a 2% push over a second steps a pixel at a time and reads as shaking (a reviewer: "the texts are weirdly moving 1px at a time"). Lines come in from 0 opacity and a slight blur and leave the same way (kinetic-typography skill), and on black: a blurred product behind a line was taken out at review. Land any spring-driven text position on whole pixels with `landed()` (rounding every frame steps the slow tail a pixel at a time), and drop a transform once its spring has landed: a message bubble that popped in on `scale(0.92 + 0.08 × spring)` kept re-rasterising its text a fraction of a pixel at a time as the scale crept towards 1 ("weird one pixel movement with the fonts" in a final). Camera moves over text end exactly on eased keys, not on springs. Countdown digits land out of a blur and hold; only the last one moves, fast, punching through the lens into the hit.
- **A hold earns its motion by meaning.** When a shot has finished its action but the music has not, show the cause and effect, not a drift: light up the line of code that made the change, let the new state fill (a checklist ticking through), then leave fast (panels lift away into the next line). A held logo gets one glint along the mark, then fades with the music's tail.
- **A list of kinds is a handful of options, each one a swap.** "Create [word] video." changes its word on the beats, a bar for the first, then every two beats, then every beat, each change fading and blurring out and in with motion blur and a tick, landing on the last option (kinetic-typography skill). A reel of extra words spinning past after the options read as weird at review.
- **The hero UI is never empty.** A sample app at rest (unticked boxes, "0" sign-ups, an empty team card) reads as a broken screen. After the hero action, the app answers: the checklist ticks, the numbers count, the team arrives, during the pull-back, so the reveal lands on a full app. Name a made-up product plainly ("Example app"), or viewers wonder what product they are looking at.
- **Sound is part of the build, not a later pass, and it must be heard.** Use a sparse library pass: the hero click, keystrokes, a whip per camera whip, a tick per rolling word, a soft tap as each screen wakes, a shimmer as the logo lands. Time hits to the track alone, and set levels against the track, not by habit: effects peaking at -22 to -30 dBFS under a dense, loud track were inaudible (a reviewer: "there's no sfx used in the video"). Measure each one's lift over the music in its band (sound-design skill).
- **Review on stills, sheets and a preview cut; render the final once.** A final render with 3D and motion blur takes 10 minutes or more, and rendering the whole film after each fix wasted hours on one film (the person: "don't render any more, this takes too much time"). Iterate with `still --grid` and `sheet` (`--samples 8` on 3D shots), `diff` for handoffs, and `check`, which renders its own samples. When the whole film needs watching, `render <id> --preview` (960×540, 30 fps, 3D at 8 samples, no motion blur) is the review cut; when a 3D shot has strong bokeh, add `--samples 64`, or the person judges the blur by its 8-sample steps (a reviewer: "the bokeh is not too hot", on a draft that rendered smoothly at full samples): hand that to the person, and read it yourself one frame every two beats (motion-review skill), since defects that happen on each beat hide between draft stills. Render the final (`render <id>`) once, after the person has signed off the preview, and say how long it will take. After that, a change to one shot is `render <id> --shots <id>`: only its chunks are drawn again. Heavy bokeh is what makes 3D slow: spend samples only where the blur is (`samplesForBlur`, the three add-on's guide).

### Lessons from finished videos

- **A reveal lands on content.** When the camera pulls back to show a panel, list or board, fill it as the camera moves (rows dealt in during the pull), so it arrives on something full; a pull-back onto an empty surface reads as waiting. Deal from where the camera starts outwards, so each row lands in view as the frame widens.
- **Pull back only as far as the reveal needs, and keep product UI facing the viewer.** A far pull-back that also turns the panel away reads as losing the subject (a reviewer: "zooms unnecessarily away, the panel is awkwardly far"). Turn in 3D for transitions, not for UI the viewer is following.
- **Give a detail view time.** A card whose facts are named one by one needs about two beats per name and the card still readable after the last one; to name more facts, lengthen the music, do not shorten the names. Leave the names in place (fade) as the next shot comes in, with the camera still moving, rather than holding still and cutting.
- **Texture the subject, not the background.** Grain, dot masks and noise over a dark background are smeared away by video compression (and cost bitrate); put texture where it reads, on the lit text or object, and keep large dark areas smooth, with only a dither of about 1.5/255 so glows do not band (a reviewer's note).
- **A tool that makes things is shown by what it makes, or by one person using it start to finish.** Its chrome as decoration (studio and terminal shots shrunk into a window under a headline) was cut at review as confusing. Its chrome as the story was asked for in the next cut: a chat asking for a screenshot of a new feature, the reply "something cooler", then the terminal in the product's folder (install, the prompt, the questions answered on the track's hits), the board with a note typed on one shot and its panels changing, the render bar, and on the drop the video itself, then the file, the formats and the platforms. Each step is the next thing that happens, close enough to read (terminal text 40 px or more on screen), and the output is the payoff. The made-up product inside should be an ordinary one (a to-do app); a sample "launch planner" in a film about launch videos was confusing.
- **`audio.src` is a URL from the launch folder** (`/videos/<id>/audio/…`), not a path relative to the video; a relative one renders silent with only an "audio not found" line in the log.
- **No blur (or other filter) transition into or out of a `Stage3D` shot.** `transitions.blur` and `transitions.zoom` put a CSS `filter` over the stage's WebGL canvas while it accumulates samples. Under several render workers Chromium then never delivers the screenshot: the frame stalls for 90 s, and retrying in a new browser stalls on the same frame (one video: frames 243 to 252, three retries each, in every full render). Cut straight into and out of 3D shots, or use an opacity-only `transitions.fade`. Flat shots, even with a WebGL globe, dissolve with blur fine.
- **Renders that fail keep their work.** A failed chunk is reported and the rest carry on; fix the cause, then `render <id> --resume` renders only what is missing. It reuses chunks by render settings, not by source, so after changing the video delete the chunks whose frames changed (`out/.chunks/frames-<first frame>.mkv`) or render without `--resume`.

## Hand back

At each gate, tell the person what to decide, not only what you did:

- After discovery: the claim, the hero and supports with their visible moments, what was cut.
- After the script: the table, the counts (running time, UI share, overlay words), the hero row; then the music brief to paste into a generator, with its length and BPM (or, with their own track, how the rows fit its sections).
- After the sketch: the board link, the animatic's path, what is a stand-in, what to judge.
- After the build: the preview cut for review, `check`'s warnings and the decisions taken on them, anything still a placeholder; then, once signed off, the final mp4's path, length and size.
