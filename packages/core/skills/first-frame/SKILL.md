---
name: first-frame
description: Make a video's first frame and first three seconds work in a feed - LinkedIn, X, Facebook, Instagram, YouTube, TikTok, Bluesky - where frame 0 is often the picture people see before (or instead of) playback, autoplay is muted or off, and the scroll is decided in about three seconds. Frame 0 as an interesting picture (one striking subject, lit, already moving; dark is fine, empty is not; information is not the point), still striking small and after a square or 4:5 crop, the first seconds without sound, the poster to upload where a platform takes one, and how to check it. Platform facts dated 21 October 2026. Use when planning the opening of any video that goes to social media, when a film fades up from black or opens on a logo, when choosing a poster or cover, or when reviewing a board's first shot.
---

# The first frame

**Put the eye candy in the first frame.** Whenever the film can, it opens on its most striking picture, so it looks worth watching to anyone scrolling past.

In a feed, a video is first a still. Before it plays, when autoplay is off (data saver, Wi‑Fi only, an accessibility setting, a slow connection), and wherever nobody uploaded a cover, people see one frame of it. Which frame a platform picks when no cover is set is undocumented everywhere we checked (research.md, 21 October 2026), so the only safe frame is all of them: frame 0 is a finished picture, and so is every frame of the first second. Then, once it plays, it plays muted on most feeds, and the platforms' own numbers put the decision at about three seconds.

So the eye candy comes first. Frame 0 has one job: to be interesting enough that someone stops. It does not have to explain anything, name the product or carry the claim; a frame packed with information reads as an ad and gets scrolled past. The explaining comes after the viewer has stopped.

## Rules

1. **Frame 0 is interesting, not informative.** What makes a frame stop someone: one clear subject, nothing competing with it; light on it (a glow, a highlight, a lit edge) and contrast round it; a material or texture worth looking at (glass, metal, paper, grain); a close or unusual view (a macro of a detail, a low angle, a crop that leaves the rest to imagine); room round the subject; a sense of motion (a streak, a trail, something mid-move). A little mystery helps: a viewer who wonders what it is keeps watching.
2. **Dark is fine; empty is not.** A single lit thing on black is one of the strongest first frames there is. What fails is nothing to look at: black before a fade, a blank UI before it loads, a logo not yet built, a title card that is mostly ground. Whatever frame 0 shows is already there and already happening: a frame from the middle of a move, not the rest before it.
3. **Words are optional, and few.** Frame 0 may have no words at all. If it has some, they are part of the picture (a few, large, set as carefully as the rest: 72 px or more at 1080p is still about 24 px on a phone), never a paragraph, a feature list or a URL. Fine UI text is texture there, not message.
4. **The first three seconds work without sound.** LinkedIn, Facebook's feed, YouTube's home and X play muted, so the picture carries those seconds; when words are needed to follow it, they are on screen. Reels and TikTok play with sound, so a sound on frame 0 (a hit, a voice) is worth having there too.
5. **Still striking small and cropped.** A 1080p frame is seen in a feed at about a third of its size, so the subject reads by shape, light and colour, not detail. Facebook's desktop feed shows video at 1:1, feeds favour 4:5, and YouTube swaps a vertical video's thumbnail for its own 4:5 frame on Home. Keep frame 0's subject inside the centred square of a 16:9 frame (x 420 to 1500 at 1080p), and inside the centred 4:5 (x 528 to 1392) when it matters most. A 9:16 cut also keeps clear of the apps' overlays (social-formats skill).
6. **Motion from the first frame.** Nothing waits to start: no hold on a still, no effect that fades in over the first frames (it reads as a glitch, and frame 0 shows the picture without it). A 3D stage is fully lit on frame 0; a camera move is already under way.
7. **Hook inside three seconds.** Instagram measures who keeps watching past 3 s, TikTok asks for the proposition in 3 s, Meta found two thirds of people who watch 3 s go on to 10. Frame 0 earns the first second; what the product is can follow within the next two (creative-direction skill: the hook).
8. **Upload a cover wherever a platform takes one**, from the same render at the video's own aspect: LinkedIn (desktop), a Facebook Page, YouTube (verified accounts), Instagram (at sharing only), TikTok, X Media Studio. `pnpm launch render <id> --poster <frame>` writes the frame as a PNG and, for a landscape video, a 1200×630 JPEG for link previews. Frame 0 still matters: many places take no cover (LinkedIn on mobile, X's composer, Bluesky, Threads, link previews).
9. **Never share a bare .mp4 link.** Put it on a page with `og:video`, `og:image` (the poster) and their sizes: Discord needs `og:image` to show a player, Messages plays an `og:video` mp4 under its size limits, Slack expands video only from hosts it knows.

## The logo can be the first frame

A logo makes a strong opening when it looks great on frame 0: already lit, already in motion, seen close (a macro of the mark, light running along its edge, the mark in a material), not a flat mark on a plain ground and not one still building from nothing. Then the film can open on it and leave it there for the end card too.

## When a slow opening is right

A fade up from black, light arriving out of the dark, a logo building from nothing: these work where a cover or the context does the first-impression work, so frame 0 is never seen as a still. A YouTube video with a custom thumbnail, a keynote, a site's hero that shows a poster until it plays. Decide it per delivery: a film that goes both to YouTube and to LinkedIn gets the feed opening, or a variant (`variants`) with a different first shot.

## In the engine

- The hook shot is the first shot, and its frame 0 is composed: check it with `pnpm launch still <id> --at <first shot>:+0`.
- Small and cropped, before the person sees the board: `still <id> --at <shot>:+0 --scale 0.25` (feed size), and `--crop 420,0,1080,1080` (the 1:1 crop) or `--crop 528,0,864,1080` (4:5).
- No transition on the first shot, no `progress` starting at 0 on what frame 0 must show; start effects before the shot (`at` below 0) so their travel is already under way.
- On the board, frame 0 is the first tile: point the person at it and ask whether it would stop their scroll.

## Example

Before: a 30 s film for an analytics product opens with 40 frames fading up from black onto a flat logo, then an empty dashboard that fills in; the finished dashboard on its 3D slab, its best shot, comes at 0:18. In a feed, frame 0 is a black tile.

After, either way:

- **A cold open from the best shot.** 90 frames from the 0:18 shot first: close on one chart's line on the slab, lit along its edge, the rest in soft focus, the camera already pushing in. No words. Then the story starts as before.
- **The logo, made worth looking at.** The mark seen close in the product's material, a highlight already running across it, on dark. No tagline yet; it arrives with the end card.

```tsx
shots: [
  // Frame 0: the best shot, from its frame 240, already moving. No text on it.
  { id: "cold-open", duration: 90, component: () => <Hero from={240} /> },
  { id: "empty", duration: 150, component: Empty },
  // …the film as it was.
]
```

`Hero` reads its own clock as `useFrame() + from`, so the cold open shows the same moment of the same shot. Look at frame 0 at feed size (`still <id> --at cold-open:+0 --scale 0.25`) and ask one question: would it make you stop?
