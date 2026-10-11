#!/bin/sh
# Synthetic audio for the mastering test, made with ffmpeg alone (no third-party sound).
# chirp.wav: each second is a tone of (second + 1) × 110 Hz, so a frequency names the
# source second after audio.edit has replayed a passage. Run from this folder: sh make.sh
set -e
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.5*sin(2*PI*110*(1+floor(t))*t)*(0.6+0.4*exp(-mod(t,0.5)*6))':s=48000:d=8" -ac 1 -c:a pcm_s16le chirp.wav
