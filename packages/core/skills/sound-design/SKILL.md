---
name: sound-design
description: Sound effects for a launch video, product demo or logo sting - spotting which moments get a sound, a small consistent palette, generating each layer with ElevenLabs, judging them without ears, syncing them to frames, and mixing them into the video's one audio file at -14 LUFS. Use when a video needs sound effects (whooshes, UI clicks, ticks, keystrokes, swells, impacts), when a cut is locked and has music, or when the sound feels cheap, busy or out of sync.
---

# Sound design

Good sound for a launch video is a small palette used with restraint. Spot the three to six moments that deserve a sound and give the rest light touches or silence. Build hero sounds in layers. Keep anything with a pitch in the music's key. Put each transient on the frame where its motion lands. Generated effects are raw material: you trim, filter, tune and level them, then decide where they go. The sources, the Netflix, Google, Intel and Mastercard cases and the delivery specs are in [research.md](research.md).

When the video is in a brand the person asked for, its package's rules win over anything here. Its sonic logo is the only sonic logo, and its palette, if it defines one, sets the materials, key and space. The logo-animation skill covers the sonic logo's shape (anticipation, hit, tail); this skill covers generating and mixing the sounds.

**You cannot listen.** Every judgement below is made from measurements, and the person has to listen before anything is called done. Say so when you hand over, and name what to listen for.

## 1. Spot the cut

Before generating anything, list the moments from the locked cut (read `video.tsx`, or `timing.ts` if the video has one):

- **Hero moments (3 to 6 per minute):** the reveal, the payoff, the logo lock, a product moment the video is built around. They get a designed sound, layered.
- **Detail touches:** UI clicks, ticks, keystrokes, a soft blip when a label lands. Quiet, short (50 to 200 ms), atonal or in key, and consistent with each other.
- **Nothing:** everything else. The more often something happens, the quieter its sound should be; a sound on every animation is wallpaper. Ask of each: does this moment need sound, and why?
- **Set levels against the track, and measure.** A dense, loud track masks effects placed by habit: library sounds peaking at -22 to -30 dBFS vanished under one (the reviewer heard none). Short transients (clicks, ticks, keys) need to stand 8 dB or more above the music in their own band: high-pass both `out/mix.wav` and the track at about 2.5 kHz and compare 30 ms windows at each effect's frame (offset by the master's gain, measured on a stretch with no effects). On a loud track that means peaks around -3 to -12 dBFS before the master.
- **Time hits to the track alone.** `check` and `sound` read the mix, so an effect placed on a music event (a click on a riser's peak) shifts where that event measures; the shot's hit then chases its own sound. Take the time from `pnpm launch sound` before any `sfx` exist, and declare it in seconds (`hits: [{ at: 0, sound: 3.76 }]`).
- **Don't double the music.** If the track already hits on the reveal, add texture (a click, a shimmer), not another boom. Read `beats.json` (`onsets`, `sections`) and the music brief first.
- **Muted first.** Autoplay starts muted, so the picture carries the message; sound rewards the unmute and never carries a claim alone.

Write the palette down in `brief.md`, under Sound, before any prompt: 1 or 2 materials (glass and felt, wood and air), the music's key, one space (dry, or one short room), one brightness, one transient style (soft or snappy). Every prompt reuses the same words; that is what makes several generations sound like one world.

| Sound | Use it for | Watch out |
|---|---|---|
| Whoosh | Camera moves, a thing arriving through space | The most overused sound. Length matches the move; its loudest point sits on the fastest frame. |
| Riser | 1 to 4 s into a reveal or logo | Must resolve into a hit or a deliberate silence. |
| Impact | The payoff, the logo lock | Needs a tail, or it sounds small. One lands; four in a row is a parody. |
| Swell, shimmer | "Aha" moments, results arriving, end cards | Washes the mix out: high-pass it, keep it short, in key. |
| Reverse swell | Pulling the ear into a hit | Its peak on the hit frame. |
| UI click, tick, blip | Clicks, toggles, counters, labels landing | Quiet, short, one family. A click should sound like a click. |
| Keystrokes | Typing on screen | One per character, from a real recording. |
| Glitch | Once, for an "AI working" moment | The fastest way to sound generic. |
| Ambience | Glue under quiet stretches | Low, seamless (`loop`), in key if tonal. |

## 2. Start from the library

Core ships a starter pack (`packages/core/sfx`): soft, medium and hard whooshes, a whip and a swish, soft whoomps, a wooden impact, a sub drop, trackpad and button clicks, a tick (and `ticks`, four in one file), a blip, a pop, a glass tap, a success chime, a typing recording, and a shimmer, swell, riser and reverse swell. Every file is cut to one event and levelled to -3 dBTP. Look before generating:

```sh
pnpm launch sfx find whoosh --max 1     # id, category, length, where it peaks, loudness, tags
pnpm launch sfx find --category impact --tags soft
```

Use one by id: `{ src: "sfx:whoosh", at, align: "peak" }`. Sounds generated for reuse go in the launch folder's own `sfx/` (shared by every video), then `pnpm launch sfx index` measures them (duration, onset, `peakOffset`, loudness, true peak) and keeps the hand-written `category`, `tags`, `license`, `source` and `prompt`; fill those in. A project id overrides the pack's. A whoosh's `peakOffset` says how long before the fastest frame it starts. A sound made for one video only stays in its `audio/sfx/`.

## 3. Generate with ElevenLabs

The key is `ELEVENLABS_API_KEY` in the launch folder's `.env` (gitignored). Load it inside the command (`export ELEVENLABS_API_KEY=$(grep -E '^ELEVENLABS_API_KEY=' .env | cut -d= -f2-)`) and never print it. A key without the `user_read` permission gets a 401 from `/v1/user` but still generates, so test a key with one short generation.

```sh
elevenlabs text-to-sound-effects convert -q -o audio/sfx/<name>.mp3 \
  --params '{"output_format":"mp3_44100_192"}' \
  --json '{"text":"…","duration_seconds":0.5,"prompt_influence":0.7}'
```

- **One sound per prompt.** For a hero sound, generate the layers separately (transient, body, sub, tail) and combine them (section 4).
- **Prompt formula:** quality + material or source + action + envelope and length + space + exclusions. "A single soft, clean trackpad click, close and dry, subtle, quiet, no room sound." Ask for dry sounds (no reverb) and add one shared space yourself.
- **Always set `duration_seconds`** for one-shots (0.3 to 2 s), or the model pads and adds events. `prompt_influence` 0.6 to 0.7 for precise UI and hit layers; lower (0.3 to 0.4) to explore a signature texture.
- **Tonal sounds:** name the key ("in F major"), but treat it as a hint and measure the pitch (section 5).
- **Credits:** a set duration costs about 40 credits per second, so budget by seconds: six effects for a 30 s product video were 7 s in all. Generate one, measure it, then the rest; regenerate only what fails a check.
- **Keep what you generate.** Generation is not repeatable. Put the prompts in a `sfx.sh` beside the video, one `gen <name> "<prompt>" <seconds> <influence>` per sound, and commit the files in `audio/sfx/`.
- **Licensing:** commercial use needs a paid plan, and effects may not be resold as a library. By default ElevenLabs may share outputs with other users: disable sharing before generating anything for a sonic logo, and rebuild the final logo from processed layers.

Prompts that worked on a product video, to adapt to the palette:

| Moment | Prompt | s | Influence |
|---|---|---|---|
| Globe arriving | A single soft, gentle air whoosh, warm and low, like a large glass sphere gliding smoothly into place, cinematic, subtle, no impact, clean studio, no reverb tail | 1.8 | 0.6 |
| Counter step | One single tiny soft mechanical tick, like a precise watch or a split-flap counter digit flipping, very short, dry, clean, quiet, no reverb | 0.5 | 0.7 |
| Words becoming filters | A soft, airy, glassy shimmer that rises gently, two tiny bright chime notes, delicate magical UI sound, quiet, clean, short | 1.2 | 0.6 |
| Results landing | A warm, quiet analog synth pad swell with a soft plucked chord, gentle and calm, rounded, low-pass filtered, ambient, fades out smoothly | 2.6 | 0.5 |
| Click | A single soft, clean trackpad click, close and dry, subtle, quiet, no room sound | 0.5 | 0.7 |
| Label landing | A single very soft, warm, rounded glass UI blip, short sine-like tone, gentle and quiet, clean, no reverb | 0.5 | 0.7 |

More starting points (transient, sub, riser, reverse swell, room tone) are in research.md, section 8.

## 4. Finish each sound (ffmpeg, not a DAW)

Every step of a DAW chain has an ffmpeg filter. Keep the finished file beside the raw one (`click.mp3` → `click.wav`) and point `sfx` at the finished one; the raw file stays the source.

| Step | Filter |
|---|---|
| Trim and fade (2 to 10 ms in on soft sounds, out on the natural decay) | `atrim=start=0.02:end=0.4,afade=t=in:d=0.005,afade=t=out:st=0.3:d=0.1` |
| DC offset and rumble | `dcshift=0,highpass=f=40` (higher, 150 to 300 Hz, for detail layers) |
| Harshness | `equalizer=f=5000:t=q:w=1.5:g=-4` |
| Noise under the tail | `afftdn=nr=10` (gently) |
| Tune by n semitones (resample to 48 kHz first: generated MP3s are 44.1) | `aresample=48000,asetrate=48000*2^(n/12),aresample=48000,atempo=1/2^(n/12)` |
| Reverse swell | `areverse` |
| Tempo-synced echo (a quarter note is 60000 / BPM ms) | `aecho=0.8:0.5:423:0.3` at 142 BPM |
| Shared space | `afir` with one impulse response for every effect, or one `aecho` setting for all |
| Layer a hero hit | `adelay` each layer (body 5 to 20 ms after the transient, sub a few ms later) and `amix=normalize=0`; high-pass everything but the sub, low-pass the sub |

For sub-heavy hits, add a mid-range "shadow" (the body layer, or light saturation): phone speakers play little below about 300 Hz.

## 5. Judge without ears

Reject a sound that fails a must. `pnpm launch sound <id> audio/sfx/<file>` measures most of it in one call (events with times, onsets per band, the pitch of a hit, centroid, loudness with true peak and short-term maximum; `--png` for a spectrogram); the rest is ffmpeg:

- **Peak and loudness:** `ffmpeg -i f -af volumedetect -f null -` (max under 0 dBFS; a mean far below the others in its role means it needs gain, not that it is quiet by design).
- **Where it is heard to start:** the first sample within 20 dB of the peak. **Where it peaks:** the loudest 10 ms window. These are what get synced.
- **Clean ends:** the first and last 50 ms near silence (no click, no chopped tail); a tail that is cut at the file's end needs a fade.
- **Extra events:** count onsets (energy jumps of 10 dB or more). A "single click" with three onsets is three clicks.
- **Pitch (tonal sounds):** the strongest partial of an FFT over the sustained part, as a note; it should be the music's root or fifth, or be retuned.
- **Brightness:** `aspectralstats` centroid. Within one family the centroids should be close; one far brighter than the rest is the one that sounds cheap.
- **Mono:** sum L and R and check the level drops by no more than about 3 dB.

Then list for the person what only ears can judge: artifacts (warble, metallic ringing), whether it fits the picture and the palette, whether it sounds cheap.

## 6. Sync and mix

Effects are data on the timeline: `sfx` on a shot (frames from its start) or on the video. `render` mixes them into the music (`audio`, at its offset and volume) and masters the result; the studio plays the same mix, and `pnpm launch mix <id>` writes it alone to `out/mix.wav` to measure. Nothing to rerun after a retime: the sounds move with the shots.

```tsx
sfx: [
  { src: "audio/sfx/whoosh.mp3", at: 40, align: "peak", peak: -13 },   // loudest moment on the fastest frame
  { src: "audio/sfx/click.mp3", at: CLICK, peak: -12 },                // heard start (onset) on the contact frame
  ...typed.map((at, i) => ({ src: "audio/sfx/typing.wav", at, hit: i * 7 + 3, peak: -15 })),
],
```

- `src` is relative to the video's folder, or a URL in the launch folder (`/videos/sting/out/sting.mp4` brings a rendered sting's own sound).
- `align` is the point of the sound that lands on `at`: `"onset"` (default, where it is heard to start), `"peak"`, `"start"`, or seconds into the file.
- `peak` sets the level as a peak in dBFS before the master; `gain` adds dB to the file as it is. `from`, `to` and `fade` trim it.
- `hit: n` uses the nth separate hit of a recording (keystrokes, taps), found by onset and cut to the next; counts wrap. A different hit on every key, chosen the same way each render, sounds like real typing.
- Frames that the picture and the sound share (typed key times, counter ticks) come from one place: compute them in the module the shot uses and build `sfx` from the same list.

Syncing:

- **A transient lands on the contact frame:** align the clip's start-of-sound (onset) to the frame the thing lands, clicks or appears, not to where its motion begins.
- **A whoosh peaks at the fastest frame:** align its loudest moment, not its start. With `ease.expo` or `ease.out`, that is in the first third of the move.
- **Sound follows the motion's own curve.** A counter's ticks come from the same easing `Count` uses, one per step, getting quieter as it slows. A keystroke on every typed character, from the same seeded times. A bounce on screen gets a second, quieter tick on its settle.
- **Pre-lap** the next shot's sound a few frames before the cut; a 100 to 500 ms drop-out before the logo's hit makes it land harder than another layer would.

Levels. These are peaks before the master, with music at its own level, from a finished product video. Starting points, to be confirmed by ear:

| Role | Peak (dBFS) |
|---|---|
| Click on a hero UI moment | -12 |
| Whoosh on a hero move | -13 |
| Keystrokes | -15 |
| Swell or pad under a reveal | -17 |
| Shimmer | -18 |
| Ticks (fading as they slow) | -19 to -25 |
| Blips on labels | -21 |

Priority when things overlap: voice-over, then the logo and hero sounds, then music, then detail sounds, then ambience. Keep detail sounds out of 1 to 4 kHz under a voice.

The music around a voice and a breath is set on `audio`, not built by hand:

- **Voice-over:** `audio.voice: { src: "audio/voice/vo.wav", at }` (or one entry per line, each at its frame). The music ducks under it, -8 dB by default, down before the voice starts and back up after it stops, bridging pauses shorter than `hold` so it does not pump between words; tune with `audio.duck: { amount, attack, release, hold }`. `mix` prints the ducked frames: check them against the picture.
- **Stems:** with stems from the generator, `audio.stems: { drums: { src: "audio/stems/drums.wav", mute: [[from, to]] }, … }` plays them together in place of the track; muting the drums over a breath is one line. Keep `audio.src` as the full track, so `beats` still reads it, and keep voice and stems in `audio/voice/` and `audio/stems/` (`beats` takes the first audio file at the top of `audio/`).
- **Fades:** `audio.fadeIn` and `audio.fadeOut`, in seconds, on the music.

A finished narration on its own (a generated voice-over, a podcast intro) is not mastered: place it as it is (`audio.loudness: "as-delivered"`, effects at `gain: 0`) and add only silence, for the lead-in, the tail and pauses the voice did not make. Loudness normalisation, limiting, resampling and stereo conversion all changed a voice the person had approved (a podcast intro: "don't mess with the narration audio, it was good already"). Leave the loudness check as a warning unless they ask for a target.

The master is automatic: integrated loudness gained to the target (-14 LUFS, or the video's `audio.loudness`), then an oversampled limiter keeps the true peak under the ceiling. Reach the target with levels, not by limiting harder: if a hit flattens, lower the music (`audio.volume`) rather than raising the effect. With `audio.loudness: "as-delivered"` nothing is processed: the music and effects are summed as they are. For another delivery, name its spec on the video: `audio.loudness: "broadcast"` (EBU R128, -23 LUFS), `"sting"` (R128 s1 for spots and idents: also the loudest 3 s at most -18 LUFS), `"podcast"` (-16) or `"atsc"` (-24, -2 dBTP); the master and `check` both follow it, and `mix` prints the short-term maximum beside integrated loudness and true peak.

`beats` reads the music alone, so effects never add false onsets; `check` measures the mix, and `sound <id>` reads it as heard (effects included), to confirm each effect lands on its frame. Detection stops where the drums stop, so a cut on a final hit after the drums may need `offBeat: true` with the reason.

## 7. Hand over

Give the person: the list of sounds with the frame each one lands on, the measured loudness and true peak, the prompts file, and what to listen for (each effect's level against the music, any artifacts, seams in an edited track). Revise this skill with what they say: a level that was wrong, a prompt that produced something usable, a sound that read as cheap.
