---
name: social-formats
description: Which shapes to deliver a video in for each social platform (9:16, 4:5, 16:9, 1:1, 2:3), the safe zones that keep text and UI clear of TikTok, Instagram, Facebook and YouTube's own overlays in a vertical cut, how to lay a vertical or portrait cut out instead of cropping, and the export settings. Figures dated October 2026. Use when a video is going to social media, when declaring `formats` on a video, when laying out a 9:16 or 4:5 version, when text or UI sits too close to the edges of a vertical cut, or when asked which sizes to export.
---

# Social formats

**As of October 2026.** Platforms move their UI and change their specs often. Every number here was collected on 2026-10-13 (sources in [research.md](research.md)); before a big release, check the platform's own spec page, and when a number here proves wrong on a real upload, correct it here with the new date.

A video for social media is one film laid out several times, not one film cropped several ways. The engine reflows each shape (`formats` on the video, `useVideoInfo().format` in scenes); this skill says which shapes to make and where things may go in each.

## Which shapes to deliver

Make two by default, add the third when the video also lives on desktop:

| Deliverable | Size | Shape | When |
|---|---|---|---|
| Social vertical | 1080 × 1920 | 9:16 | Always: TikTok, Reels, Stories, Shorts, Snapchat |
| Social feed | 1080 × 1350 | 4:5 | Always: LinkedIn, Facebook, Instagram and X feeds |
| Landscape | 1920 × 1080 | 16:9 | YouTube, the website, presentations, long-form |
| Square | 1080 × 1080 | 1:1 | Only when a placement asks for it: 4:5 takes more of a phone's feed |
| Pinterest | 1000 × 1500 | 2:3 | Only for Pinterest |

Supported is not the same as best: a 9:16 cut uploads to LinkedIn and X, but in a scrolling feed a 4:5 cut made for it reads better.

By platform and placement:

| Platform | Placement | Make | Also accepted |
|---|---|---|---|
| Instagram | Reels, Stories | 9:16 | |
| Instagram | Feed | 4:5 | 1:1 |
| Facebook | Reels, Stories | 9:16 | |
| Facebook | Feed | 4:5 | 1:1 |
| TikTok | Videos | 9:16 | |
| LinkedIn | Feed | 4:5 | 1:1, 16:9 |
| LinkedIn | Vertical video | 9:16 | 4:5 |
| X | Feed | 1:1 or 4:5 | 16:9 |
| X | Immersive viewer | 9:16 | 1:1 |
| YouTube | Shorts | 9:16 | |
| YouTube | Videos | 16:9 | 3840 × 2160 |
| Snapchat | Stories, Spotlight | 9:16 | |
| Pinterest | Video Pins | 2:3 | 1:1 |

X added 4:5 for ad creatives in 2026; how organic timeline previews show 4:5 can differ.

## Safe zones in a vertical cut

The apps draw their UI over a 9:16 video: a top bar, the caption, sound and call to action at the bottom, and a column of buttons on the right (TikTok's is the widest). Everything that matters (headlines, the product's key UI, captions, the logo, the call to action) goes inside one rectangle that clears all of them; footage, backgrounds and decoration still fill the whole frame.

| At 1080 × 1920 | Top | Bottom | Left | Right | Safe area |
|---|---:|---:|---:|---:|---|
| **Organic** (the default) | 270 | 450 | 90 | 200 | 790 × 1200: x 90 to 880, y 270 to 1470 |
| **Organic and paid ad** | 270 | 670 | 120 | 300 | 660 × 980: x 120 to 780, y 270 to 1250 |

`safeZone(format)` returns the organic rectangle in the frame's own pixels, `safeZone(format, "ads")` the stricter one (both from `@intentface-launch/core`). These are a conservative practice, not a standard any platform publishes. Per platform, the areas to avoid are about:

| Platform | Avoid |
|---|---|
| Instagram Stories | top 250, bottom 340 |
| Instagram Reels, Facebook Reels | the bottom caption area and the right-hand buttons |
| TikTok | bottom 350 to 450, right 160 to 200 |
| YouTube Shorts | bottom 350 to 400, right 150 to 200 |

The organic rectangle is narrower on the right than on the left: the button column is on the right. Do not centre the content in the frame; centre it in the safe area (its middle is x 485), or let the layout lean left.

Inside the safe area, by band:

- **0 to 270:** background only.
- **270 to 950:** the hook, headlines, the logo, the product's most important UI.
- **950 to 1470:** supporting text and captions; captions sit best around y 1100 to 1350.
- **1470 to 1920:** reserved for the apps. Background and footage only.

`check` warns about text in a 9:16 cut that falls under each app's UI (its own per-platform map, `platformZones`, and `clearArea` for the rectangle clear of all of them); it does not know about the product UI inside a snapshot or a screen, so look at the stills.

## Laying a cut out for its shape

- **Reflow, never crop.** Declare the shapes on the video (`formats: { vertical: { width: 1080, height: 1920 }, portrait: { width: 1080, height: 1350 } }`) and lay each scene out for `useVideoInfo().format`: the product's UI in its own narrow layout (a phone layout, a stacked card), not the desktop layout scaled down or cut at the sides.
- **Put the layout inside the safe zone.** In a vertical cut, give the scene's content box `safeZone(format)` and let the ground fill the frame behind it: `const box = safeZone(useVideoInfo().format)`. A product UI that runs edge to edge in 9:16 ends up under the like button and the caption.
- **The same goes for a video shown inside the film.** A phone in a device shot showing a vertical video with the platform's own chrome should show a vertical cut laid out in the safe zone, or the film shows the mistake it is selling against.
- **Text that moves stays in the safe area for its whole move**, not only where it lands.
- **Captions:** `burnCaptions` draws them above the apps' UI in 9:16; keep their block around y 1100 to 1350.
- **When a crop is the only option** (footage, not a scene), a centred 4:5 from a 9:16 source keeps y 285 to 1635 of 1920: keep headlines and faces inside that band.

## Export

- One shape per run: `pnpm launch render <id> --format vertical`, `--format portrait`; the files are `<id>-vertical.mp4` and so on, beside the video's own. `still`, `sheet` and `check` take `--format` too; check every shape, not only the first.
- `render` writes H.264 (CRF 16), yuv420p, Rec.709, AAC at 320 kb/s, 1080p at 60 fps. The platforms re-encode every upload; a common recommendation for broad compatibility is 30 fps at 8 to 12 Mb/s, AAC 48 kHz, and YouTube suggests about 8 Mb/s for 1080p SDR. There is no 30 fps option for the final render today (`--preview` is 30 fps but 960 × 540); if a placement rejects 60 fps, re-encode the final with ffmpeg.
- Captions: `render` writes `.srt` and `.vtt` beside the mp4; upload them as well as, or instead of, burning them in.

## Before delivery

- [ ] The shapes the placements need, from the tables above, declared in `formats`.
- [ ] Each shape laid out again, none cropped from another.
- [ ] In 9:16, headlines, key UI, captions, logo and call to action inside `safeZone` (organic, or `"ads"` when it also runs as an ad); stills of every shot checked against it.
- [ ] `check --format <name>` for every shape.
- [ ] The numbers above still current (dated October 2026).
