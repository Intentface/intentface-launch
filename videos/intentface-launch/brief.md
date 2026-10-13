# Intentface Launch: the launch film

The film for this repo and the hero of launch.intentface.com, made with Intentface Launch. It tells one task start to finish: a team wants to share a new feature, and instead of a screenshot, one prompt in the product's folder turns into a finished video for every platform.

## Claim

Ask Claude for a launch video in your product's repo, and get one made from your real UI.

## Look

- **Chat:** a plain dark chat, the film's type (Intent Sans), two made-up people.
- **Terminal:** IBM Plex Mono on near-black, close up, on a subtle CRT with a soft glow (`Crt` from `@intentface-launch/three`): texture, not a costume. Claude Code's own layout (welcome box, input box, tool calls, the question panel), in its colours.
- **Board:** the studio's real board view in dark mode, rebuilt in the film with the studio's tokens and fonts (`board.css`).
- **The video:** a made-up to-do app (`todo-app.tsx`, "Example app"), dark, in its own window, as a 3D slab with real depth of field, then flat.
- **Type of the film's own:** Intent Sans 400, 120 px, `#fafafa` on black, for "Create ___ video." and the end card. The Launch mark's own intro on black.

## Script

Delivered in 16:9 (YouTube, the site) and 4:5 (1080 × 1350, the social feeds); every scene is laid out again for 4:5, not cropped. Cut to `audio/clean-ringing-chord.wav` (39.9 s, about 125 BPM; `beats.json`, `out/sound-clean-ringing-chord.json`). The track starts on the frame `claude` is entered: film time = 10.1 s + track time. Every frame is in `timing.ts`.

| # | Film (s) | Track (s) | Picture | Words | Hand-off |
|---|---|---|---|---|---|
| 1 chat | 0–5.9 | silent | Sara: "The task feature is done! Can we take a screenshot for our socials?" You: "I think we can do something cooler." Sara starts typing again. | The messages | Cut |
| 2 install | 5.9–10.1 | silent | Close on the terminal in `~/code/productivity-app`: `npx @intentface-launch/core init` typed (the camera rides the caret), three lines of output, `claude` ⏎ | Typed | The music starts on ⏎ |
| 3 prompt | 10.1–13.6 | 0–3.5 | Claude Code opens; "Create a 30 second video about our task feature" typed and sent on the first big hit | Typed | Lines below |
| 4 ask | 13.6–20.6 | 3.5–10.5 | Tool calls on the beats (Skill, Read, Bash: look); two questions answered on the hits (Our current users; Bold and energetic); the board link; the pointer clicks it on the hit at 10.52 | Claude's | The window grows out of the link |
| 5 board | 20.7–27.6 | 10.5–17.5 | The board lands on the boom (11.74); a note on shot 1, "Make this a closeup", typed and added; the camera holds on its panels as they turn into closeups, then finds "Done." under the note | Typed | Cut back |
| 6 render | 27.6–29.1 | 17.5–19.0 | The render bar fills; "Done: out/task-feature.mp4 · 0:30" on the hit before the drop | | Cut on the drop |
| 7 video | 29.1–33.9 | 19.0–23.8 | Drop: the to-do app in 3D, opening on the closeup the note asked for; the task checked on the downbeat; the week fills in as the camera pulls back to straight on | | Pixel-identical cut to flat |
| 8 file | 33.9–35.8 | 23.8–25.7 | Player controls, then the frame shrinks into `task-feature.mp4` (`task-feature-portrait.mp4` in the 4:5 cut) | File name | Cut on the downbeat |
| 9 create | 35.8–46.1 | 25.7–36.0 | "Create [product, feature, release, update, demo, tutorial, onboarding, teaser, ad, intro, recap, changelog, social, launch] video.": a bar for the first word, then every two beats (one on the boom at 27.18), then every beat, landing on "launch" | The line | Cut |
| 10 end | 46.1–51.5 | 36.0–end | The Launch mark flies in through the breakdown and parks on the final hit (37.92); "Intentface Launch"; launch.intentface.com on the second hit | Name, URL | Fades with the tail |

## Facts and limits

- The install command is the real one (README quick start); its output is simplified. The plugin was considered and not shown: it carries only the skills, while `init` brings the studio, board and render the film goes on to show.
- Claude Code's screens are simplified: the music question and the script approval are left out; the reply to the note appears without a prompt.
- The board, its note and reply, the render's file names (`-square`, `-vertical`) and the formats are what the tool does.
- The to-do app, its data and the people in the chat are made up.

## Cut from the previous film

The device family and the three files playing side by side (neither fitted the flat look), the Orbit launch planner, "Written as code", the code shot, the reel, "Any style", "From real product UI", "Install it / Or fork it / Open source", the countdown (the new track has no room for one).
