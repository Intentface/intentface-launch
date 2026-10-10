# /// script
# requires-python = ">=3.11"
# dependencies = ["librosa>=0.11", "soundfile"]
# ///
"""Beats, energy and sections of a music track, as JSON on stdout.

    uv run tools/beats.py videos/<id>/audio/track.wav [--seams]

With --seams, also the passages of whole bars that can replay without the
seam being heard (for `audio.edit`), best first.
"""
import json
import sys

import librosa
import numpy as np

ENERGY_RATE = 20  # energy samples per second

path = sys.argv[1]
want_seams = "--seams" in sys.argv[2:]
y, sr = librosa.load(path, sr=22050, mono=True)
hop = 256  # 11.6 ms: beat times to within a frame at 60 fps
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, units="frames", tightness=120)
onsets = librosa.onset.onset_detect(onset_envelope=onset, sr=sr, hop_length=hop, units="time", backtrack=False)

# The onset envelope lags the transient by about 20 ms (its STFT window), over
# a frame at 60 fps. Move each time to the steepest loudness rise on a 3 ms
# grid, from 60 ms before to 20 ms after. Pre-emphasis first, so the ripple of
# a bass note's cycles does not pass for a transient.
FINE = 64
env = librosa.feature.rms(y=librosa.effects.preemphasis(y), frame_length=256, hop_length=FINE)[0]
rise = np.diff(env, prepend=env[0])


def refine(times):
    out = []
    for t in times:
        i = int(t * sr / FINE)
        lo = max(0, i - int(0.06 * sr / FINE))
        hi = min(len(rise), i + int(0.02 * sr / FINE) + 1)
        out.append((lo + int(np.argmax(rise[lo:hi]))) * FINE / sr if hi > lo else t)
    return np.array(out)


beats = refine(librosa.frames_to_time(frames, sr=sr, hop_length=hop))
onsets = refine(onsets)

# BPM from a line through the beats found (not librosa's tempo estimate, which
# leans toward 120, nor a median gap, which snaps to the analysis grid).
if len(beats) >= 4:
    slope = np.polyfit(np.arange(len(beats)), beats, 1)[0]
    bpm = round(60 / float(slope), 2)
else:
    bpm = round(float(np.atleast_1d(tempo)[0]), 2)

# Downbeats: the phase of 4 whose beats carry the most onset energy.
strength = onset[np.minimum(frames, len(onset) - 1)] if len(frames) else np.array([])
phase = int(np.argmax([strength[p::4].sum() for p in range(4)])) if len(strength) >= 4 else 0

# Confidence, 0 to 1: how steady the beat spacing is, times how much stronger
# the onsets are on the beats than between them. Below 0.5, cut by ear.
if len(beats) >= 4:
    gaps = np.diff(beats)
    steady = float(np.clip(1 - np.std(gaps) / np.mean(gaps) * 4, 0, 1))
    between = onset[np.minimum((frames[:-1] + frames[1:]) // 2, len(onset) - 1)]
    contrast = float(np.clip((strength.mean() / (between.mean() + 1e-9) - 1) / 2, 0, 1))
    confidence = round(steady * 0.5 + contrast * 0.5, 2)
else:
    confidence = 0.0

# Energy: RMS loudness, smoothed over a quarter second, normalised to the loudest moment.
e_hop = sr // ENERGY_RATE
rms = librosa.feature.rms(y=y, frame_length=e_hop * 2, hop_length=e_hop)[0]
kernel = np.hanning(max(3, ENERGY_RATE // 4 * 2 + 1))
smooth = np.convolve(rms, kernel / kernel.sum(), mode="same")
energy = smooth / (smooth.max() + 1e-9)

# Sections: peaks of a checkerboard novelty curve over timbre and harmony,
# the moments the track changes character (build, drop, breakdown).
sections = []
features = np.vstack([
    librosa.util.normalize(librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13), axis=1),
    librosa.util.normalize(librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop), axis=1),
])
if len(frames) >= 8:
    sync = librosa.util.sync(features, frames, aggregate=np.median)
    sim = np.corrcoef(sync.T)
    sim = np.nan_to_num(sim)
    size = 8  # beats either side
    sign = np.ones((2 * size, 2 * size))
    sign[:size, size:] = -1
    sign[size:, :size] = -1
    taper = np.outer(np.hanning(2 * size), np.hanning(2 * size))
    kernel2 = sign * taper
    padded = np.pad(sim, size, mode="constant")
    novelty = np.array([np.sum(padded[i:i + 2 * size, i:i + 2 * size] * kernel2) for i in range(len(sim))])
    novelty = np.clip(novelty, 0, None)
    if novelty.max() > 0:
        novelty /= novelty.max()
        peaks = librosa.util.peak_pick(novelty, pre_max=8, post_max=8, pre_avg=8, post_avg=8, delta=0.1, wait=16)
        bounds = np.concatenate([[0], librosa.frames_to_time(frames, sr=sr, hop_length=hop)])
        for p in peaks:
            # Skip the edges: the kernel sees the start and end of the file as changes.
            if 0 < p < len(bounds) and novelty[p] >= 0.3 and 2 < bounds[p] < len(y) / sr - 2:
                t = float(bounds[p])
                i = min(len(energy) - 1, int(t * ENERGY_RATE))
                before = float(energy[max(0, i - ENERGY_RATE * 2):i].mean()) if i > 0 else 0.0
                after = float(energy[i:i + ENERGY_RATE * 2].mean())
                sections.append({
                    "time": round(t, 3),
                    "beat": int(p) - 1,
                    "strength": round(float(novelty[p]), 2),
                    "change": "up" if after > before * 1.2 else "down" if after < before / 1.2 else "same",
                })

# Seams: replaying beats [a, b) jumps from just before beat b back to beat a.
# It goes unheard when the music leading into b sounds like the music leading
# into a, and what follows a sounds like what follows b: the two beats either
# side of the seam (beat-averaged log-mel and chroma), and the 150 ms right at
# it. Candidates start on a downbeat and run 1, 2 or 4 bars. The grid is
# extended at the track's tempo before the first beat found and after the
# last (an ambient intro has no beats to find), so indices can be negative
# or past the end, as `audio.edit` reads them.
seams = []
if want_seams and len(beats) >= 8:
    period = 60 / bpm
    before = max(0, int((beats[0] - period / 2) // period))  # whole beats that fit before the first one found
    count = len(beats) + max(0, int((len(y) / sr - beats[-1] - period / 2) // period))
    index = np.arange(-before, count)
    grid = np.array([beats[0] + i * period if i < 0 else beats[i] if i < len(beats) else beats[-1] + (i - len(beats) + 1) * period for i in index])
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=64), ref=np.max)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    cols = np.clip((grid * sr / hop).astype(int), 0, mel.shape[1] - 1)
    ends = np.append(cols[1:], min(mel.shape[1], cols[-1] + int(period * sr / hop)))
    mel_beats = np.stack([mel[:, c:max(c + 1, e)].mean(axis=1) for c, e in zip(cols, ends)], axis=1)
    chroma_beats = np.stack([chroma[:, c:max(c + 1, e)].mean(axis=1) for c, e in zip(cols, ends)], axis=1)
    chroma_beats = librosa.util.normalize(chroma_beats, norm=2, axis=0)
    win = max(1, int(0.15 * sr / hop))

    def near(t, after):
        i = int(t * sr / hop)
        part = mel[:, i:i + win] if after else mel[:, max(0, i - win):i]
        return part.mean(axis=1) if part.shape[1] else mel[:, min(i, mel.shape[1] - 1)]

    def difference(i, j):
        """dB apart (log-mel), and how far apart in harmony (0 same chord, 1 unrelated)."""
        return float(np.mean(np.abs(mel_beats[:, i] - mel_beats[:, j]))), float(1 - chroma_beats[:, i] @ chroma_beats[:, j])

    n = len(grid)
    offset = int(index[0])
    phase_ext = (phase - offset) % 4
    quiet = np.percentile(mel_beats.max(axis=0), 98) - 40
    for a in range(n):
        for bars in (1, 2, 4):
            b = a + 4 * bars
            if a < 2 or b + 2 > n:
                continue
            # Quiet beats match anything; a seam in silence is not a finding.
            if mel_beats[:, a].max() < quiet or mel_beats[:, b].max() < quiet:
                continue
            pairs = [(b - 2, a - 2), (b - 1, a - 1), (b, a), (b + 1, a + 1)]
            diffs = [difference(i, j) for i, j in pairs]
            db = float(np.mean([d for d, _ in diffs]))
            harmony = float(np.mean([h for _, h in diffs]))
            edge = float((np.mean(np.abs(near(grid[b], False) - near(grid[a], False)))
                          + np.mean(np.abs(near(grid[a], True) - near(grid[b], True)))) / 2)
            score = float(np.exp(-(db + edge) / 8) * max(0.0, 1 - harmony))
            # An attack on the seam beat: a short crossfade keeps it crisp; a pad needs a long one.
            attack = bool(len(onsets)) and float(np.min(np.abs(onsets - grid[a]))) < 0.03
            seams.append({
                "replay": [int(a + offset), int(b + offset)],
                "bars": bars,
                "downbeat": (a - phase_ext) % 4 == 0,
                "seconds": [round(float(grid[a]), 3), round(float(grid[b]), 3)],
                "score": round(score, 3),
                "db": round((db + edge) / 2, 2),
                "harmony": round(harmony, 3),
                "crossfade": 0.012 if attack else 0.12,
            })
    seams.sort(key=lambda x: -x["score"])
    seams = seams[:24]

print(json.dumps({
    "file": path,
    "duration": round(float(len(y) / sr), 3),
    "bpm": bpm,
    "confidence": confidence,
    "beats": [round(float(t), 4) for t in beats],
    "downbeats": [round(float(t), 4) for t in beats[phase::4]],
    "onsets": [round(float(t), 4) for t in onsets],
    "sections": sections,
    "energy": {"rate": ENERGY_RATE, "values": [round(float(v), 3) for v in energy]},
    **({"seams": seams} if want_seams else {}),
}))
