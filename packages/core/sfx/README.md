# Starter sound pack

Twenty-two short effects for basic product videos: whooshes, a whip, soft whoomps and impacts, UI clicks, ticks and blips, a typing recording, and a shimmer, swell, riser and reverse. Use one in a shot's `sfx` by its id: `{ src: "sfx:whoosh", at, align: "peak" }`. `pnpm launch sfx find` lists them; a launch folder's own `sfx/index.json` adds to them and overrides an id.

- `generate.sh` holds the ElevenLabs prompts each was generated from, and `finish.mjs` the cut, fades and levelling (every file at -3 dBTP, so `peak` on an `sfx` entry means the same for each). To add one: a `gen` line, `./generate.sh <raw dir> <name>`, `node finish.mjs <raw dir>`, then `pnpm launch sfx index --dir packages/core/sfx` and fill in its tags.
- `typing` and `ticks` are several hits in one file: use them with `hit` (`hit: i * 7 + 3`), one per keystroke or counter step.

## Licence

Generated with ElevenLabs text-to-sound-effects for Intentface. ElevenLabs allows commercial use of what a paid plan generates; videos made with these packages use them under its terms of service. They are not licensed for redistribution as a sound library on their own.
