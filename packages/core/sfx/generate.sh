#!/usr/bin/env bash
# The prompts behind core's starter sound pack, generated with ElevenLabs
# text-to-sound-effects. Generation is not repeatable: this file records what
# was asked for, so a sound can be regenerated in the same family.
#
#   ELEVENLABS_API_KEY=… ./generate.sh <raw dir> [name…]
#
# Writes raw MP3s to <raw dir>; finish.sh trims, fades and levels them into
# this folder. With names, only those are generated.
set -euo pipefail
out=${1:?raw output dir}
shift
only=" $* "
mkdir -p "$out"

gen() {
  local name=$1 prompt=$2 seconds=$3 influence=$4
  if [[ "$only" != "  " && "$only" != *" $name "* ]]; then return; fi
  [[ -f "$out/$name.mp3" ]] && return
  elevenlabs text-to-sound-effects convert -q -o "$out/$name.mp3" \
    --params '{"output_format":"mp3_44100_192"}' \
    --json "$(printf '{"text":"%s","duration_seconds":%s,"prompt_influence":%s}' "$prompt" "$seconds" "$influence")"
  echo "$name"
}

# Air: moves, transitions, things arriving.
gen whoosh-soft "A single soft, smooth air whoosh, gentle and warm, clean air movement, peaks in the middle, no tonal content, no impact, dry, no reverb" 1.0 0.6
gen whoosh "Smooth cinematic whoosh, medium speed, clean air movement, subtle low-mid body, peaks in the middle, no metallic ring, dry" 1.2 0.6
gen whoosh-hard "A fast, powerful whoosh, strong air rush passing close, deep body, tight, peaks in the middle, no impact, dry" 0.9 0.6
gen whip "A very quick whip swish, sharp thin air cut, fast pan, very short, dry, no impact" 0.5 0.7
gen swish "Short airy swish, soft fabric-like movement, gentle, left-to-right, no tonal content, dry" 0.6 0.6

# Weight: landings, reveals, the hit.
gen whoomp-soft "A single soft, deep, pleasing whoomp, rounded low thump with a gentle air body, warm and satisfying, short decay, dry, no reverb" 0.8 0.6
gen whoomp "A deep cinematic whoomp impact, warm sub bass thud with a soft airy body, satisfying and clean, short tail, no distortion" 1.2 0.6
gen impact "Deep wooden impact, solid and warm, felt mallet on a large wooden box, short, dry, one-shot" 1.0 0.65
gen sub-drop "Clean sub bass drop, pure sine sweeping down, smooth, no distortion" 1.2 0.7

# UI: clicks, toggles, labels, counters.
gen click "A single soft, clean trackpad click, close and dry, subtle, quiet, no room sound" 0.5 0.7
gen click-button "Single soft UI click, tactile plastic button, very short and dry, close-miked, no reverb, clean transient" 0.5 0.7
gen tick "One single tiny soft mechanical tick, like a precise watch, very short, dry, clean, quiet, no reverb" 0.5 0.7
gen blip "A single very soft, warm, rounded glass UI blip, short sine-like tone, gentle and quiet, clean, no reverb" 0.5 0.7
gen pop "A single satisfying soft pop, round and clear, like a small bubble bursting, UI notification sound, close, clean, dry" 0.5 0.6
gen tap-glass "A single crisp tap on a drinking glass, small, precise and bright, one hit with a short clean ring, close and dry" 0.5 0.6
gen success "A gentle, pleasant two-note success chime, soft rounded marimba, rising, short, clean, dry, in C major" 0.8 0.6

# Typing: one recording, used a keystroke at a time with `hit`.
gen typing "Typing on a quiet modern laptop keyboard, steady natural pace, individual soft keystrokes clearly separated, close and dry, no room sound" 4.0 0.6

# Tone and builds: aha moments, end cards, pulling into a hit.
gen shimmer "Soft glass shimmer bloom, gentle high sparkle, airy, delicate, quiet, 1.5 second decay, in C major" 1.8 0.6
gen swell "A warm, quiet analog synth pad swell, gentle and calm, rounded, low-pass filtered, rises and fades out smoothly, in C major" 2.5 0.5
gen riser "Rising filtered noise sweep with subtle tonal shimmer, builds steadily and ends abruptly, cinematic, no impact at the end" 2.5 0.6
gen reverse "Soft reverse cymbal swell rising into silence, smooth and airy, ends abruptly" 1.5 0.6
