# Social formats: sources

The figures behind SKILL.md, collected on 2026-10-13. They came from a research summary the person brought (written with an AI assistant that cited the pages below); they have not been checked here against each platform's own spec page. Treat them as dated practice: when a real upload or a platform's page says otherwise, correct SKILL.md and note the date here.

## Shapes per platform

- TikTok recommends 9:16 for video ads and posts. [TikTok For Business, video advertising guide](https://ads.tiktok.com/business/en/guides/video-advertising-guide)
- Meta recommends 9:16 for Facebook and Instagram Reels. [Meta, Reels ads](https://www.facebook.com/business/ads/facebook-instagram-reels-ads)
- LinkedIn recommends 4:5 for vertical video ads; 1:1 and 16:9 are also supported. [LinkedIn video ad specs](https://business.linkedin.com/advertise/ads/sponsored-content/video-ads/specs), [LinkedIn Help a424737](https://www.linkedin.com/help/linkedin/answer/a424737)
- X names square video as a good choice across the timeline and the immersive viewer, and added 4:5 for ad creatives (alongside 9:16, 1:1, 16:9); the announcement concerns ads, organic previews can differ. [X creative specs](https://business.x.com/en/help/campaign-setup/creative-ad-specifications-old), [X expands aspect ratio support](https://business.x.com/en/blog/x-expands-aspect-ratio-support-for-ad-creatives-replacement)
- YouTube: Shorts 9:16; regular uploads 16:9; encoding guidance of H.264, AAC and about 8 Mb/s for standard-frame-rate 1080p SDR. [YouTube Help 6375112](https://support.google.com/youtube/answer/6375112), [YouTube recommended upload encoding settings](https://support.google.com/youtube/answer/1722171)
- Snapchat Stories and Spotlight ads 9:16. [Snapchat ad formats](https://forbusiness.snapchat.com/advertising/ad-formats)
- Pinterest standard video Pins 2:3 (1000 × 1500), 1:1 accepted. [Pinterest creative best practices](https://business.pinterest.com/en-gb/creative-best-practices/)
- Meta feed sizes as summarised by Hootsuite. [Hootsuite, Facebook ad sizes](https://blog.hootsuite.com/facebook-ad-sizes/)

## Safe zones in 9:16

- The universal organic rectangle (top 270, bottom 450, left 90, right 200 at 1080 × 1920; 790 × 1200) and the per-platform figures (Instagram Stories top 250 and bottom 340; TikTok bottom 350 to 450 and right 160 to 200; YouTube Shorts bottom 350 to 400 and right 150 to 200): a conservative practice for organic posts, not an official standard. [CapQA, TikTok safe zone](https://capqa.app/guides/tiktok-safe-zone), [CapQA, social media safe zones](https://capqa.app/guides/social-media-safe-zones)
- The organic-and-ad rectangle (top 270, bottom 670, left 120, right 300; 660 × 980), to allow for TikTok's ad overlays and Meta's Reels ad guidance. [AdCheckLab, TikTok safe zone dimensions 2026](https://adchecklab.com/articles/tiktok-safe-zone-dimensions-2026)
- For Reels ads: keep important content out of about the top 14%, the bottom 35% and 6% at each side. [Captain Hook AI, video specs](https://captain-hook.ai/video-specs)

## What the engine uses

`check` and `clearArea` use per-platform zones of their own (`packages/core/engine/formats.ts`, with their sources there): TikTok's top 160 and bottom 480 with a 120 px rail on the right, Reels' top 14% and bottom 35%, Shorts' 380 px top and bottom with a 120 px rail. Their union (x 96 to 960, y 380 to 1248) is stricter at the top and bottom than the organic rectangle and looser on the right. `safeZone` (`SAFE_ZONES` in the same file) holds the two rectangles above.

## Export

- A general-purpose set for social uploads: MP4, H.264, 30 fps, Rec.709 SDR, AAC 48 kHz, 8 to 12 Mb/s at 1080p, captions included or burned in. Sensible defaults rather than requirements; see YouTube's settings above.
