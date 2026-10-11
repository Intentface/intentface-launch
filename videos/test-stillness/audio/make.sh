#!/bin/sh
# Synthetic audio for the stillness test, made with ffmpeg alone (no third-party sound):
# a two-note pad that swells on every beat at 120 BPM, 20 s, about -14 LUFS.
# Run from this folder: sh make.sh
set -e
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.25*(sin(2*PI*220*t)+sin(2*PI*330*t))*(0.7+0.3*exp(-mod(t,0.5)*6))':s=48000:d=20" -ac 1 -c:a pcm_s16le test.wav
