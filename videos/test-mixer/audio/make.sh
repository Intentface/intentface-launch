#!/bin/sh
# Synthetic audio for the mixer test, made with ffmpeg alone (no third-party sound).
# Run from this folder: sh make.sh
set -e
gen() { ffmpeg -v error -y -f lavfi -i "aevalsrc='$2':s=48000:d=$3" -ac 1 -c:a pcm_s16le "$1"; }
mkdir -p stems voice
# A chord pad, 12 s.
gen track.wav "0.12*(sin(2*PI*220*t)+sin(2*PI*277.2*t)+sin(2*PI*329.6*t))*(0.8+0.2*sin(2*PI*0.25*t))" 12
# Drums: a kick on every beat at 120 BPM.
gen stems/drums.wav "0.8*sin(2*PI*(50+90*exp(-mod(t,0.5)*30))*t)*exp(-mod(t,0.5)*9)" 12
# Bass: a low note pulsing on the beat.
gen stems/bass.wav "0.4*sin(2*PI*55*t)*(0.5+0.5*exp(-mod(t,0.5)*4))" 12
# A voice-like line, 2 s: a vibrato tone in three syllables.
gen voice/line.wav "0.5*sin(2*PI*(180+15*sin(2*PI*5*t))*t)*abs(sin(2*PI*1.5*t))" 2
