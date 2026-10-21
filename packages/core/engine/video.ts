import type { ComponentType, CSSProperties, ReactNode } from "react";
import { type Caption, type CaptionCue, type CaptionStyle, resolveCaptions } from "./captions.js";
import { type FormatSize, shapeName } from "./formats.js";
import type { ReadingOptions } from "./reading.js";

/** The frame's size in pixels, handed to transitions that place things on it (a point, a rect). */
export type TransitionFrame = { width: number; height: number };

/** Styles for the outgoing and incoming shot at transition progress p (0 → 1). */
export type TransitionStyle = (p: number, frame: TransitionFrame) => { out: CSSProperties; in: CSSProperties };

export type Transition = {
  /** Shown on the storyboard. */
  name: string;
  /** Overlap with the previous shot, in frames. 0 is a cut whose incoming style still runs for `span`. */
  frames: number;
  /**
   * Frames the transition runs for from the start of the incoming shot, when
   * that differs from the overlap (default `frames`). `p` runs 0 → 1 over it.
   * A match cut overlaps nothing (`frames: 0`) and settles over `span`; the
   * outgoing style only applies while the shots overlap.
   */
  span?: number;
  style: TransitionStyle;
  /**
   * Drawn above both shots while the transition runs: a band of light, or the
   * SVG `<filter>` defs the styles point at with `url(#id)`. It renders inside
   * the video's clock, with the frame counted from the incoming shot's start.
   */
  overlay?: (p: number, frame: TransitionFrame) => ReactNode;
  /** How the overlay composites over the shots: `plus-lighter` adds it as light. */
  blend?: CSSProperties["mixBlendMode"];
  /**
   * Draws the outgoing shot itself, for a transition that needs more than CSS
   * on its wrapper (a page curl draws it once per strip of the curl). Gets
   * both shots' content, each on its own clock, and returns what the outgoing
   * shot's wrapper shows while they overlap; the outgoing shot then stays
   * above the incoming one.
   */
  compose?: (p: number, frame: TransitionFrame, shots: { out: ReactNode; in: ReactNode }) => ReactNode;
  /**
   * The styles put a CSS or SVG filter on the shots. Over a `Stage3D` shot a
   * filter stalls the renderer under several workers: cut, or use a transition
   * without one.
   */
  filters?: boolean;
};

/**
 * A sound effect on the video's timeline. `render` mixes every one into the
 * music and masters the result to the loudness target; the studio plays the
 * same mix.
 */
export type Sound = {
  /**
   * The file: relative to the video's folder ("audio/sfx/click.mp3"), a URL in
   * the launch folder ("/videos/x/out/x.mp4"), or a sound from the library by
   * id ("sfx:whoosh-soft-03": the launch folder's `sfx/` first, then the pack
   * core ships; `pnpm launch sfx find` lists them).
   */
  src: string;
  /** Frame it lands on: from the shot's start on a shot, from the video's start on the video. Fractional is fine. */
  at: number;
  /** Which point of the sound lands on `at`: where it is heard to start ("onset", the default), its loudest moment ("peak", for a whoosh at the fastest frame), the file's first sample ("start"), or seconds into it. */
  align?: "onset" | "peak" | "start" | number;
  /** Level as its peak in dBFS, before the master (a hero click about -12, ticks about -20). */
  peak?: number;
  /** Or a gain in dB on the file as it is (default 0). */
  gain?: number;
  /** Use only this stretch of the file, in seconds. */
  from?: number;
  to?: number;
  /** Fade out over the last seconds used (default 0.01, against clicks). */
  fade?: number;
  /**
   * Use the nth hit of a recording instead of the whole file: hits are found
   * by onset (a keystroke, a tap) and cut to the next one. Counts wrap, so
   * `hit: i * 7 + 3` varies them through a typing recording.
   */
  hit?: number;
};

/** One stem of the music (`audio.stems`). */
export type AudioStem = {
  /** Relative to the video's folder ("audio/stems/drums.wav"), or a URL in the launch folder. */
  src: string;
  /** Gain on this stem, as a factor (default 1), on top of `audio.volume`. */
  volume?: number;
  /** Frame ranges `[from, to)` where the stem is silent, with 5 ms ramps at each edge. */
  mute?: [number, number][];
};

/** A voice-over file (`audio.voice`). */
export type VoiceLine = {
  /** Relative to the video's folder ("audio/voice/line-1.wav"), or a URL in the launch folder. */
  src: string;
  /** Frame the file's first sample lands on (default 0). */
  at?: number;
  /** Gain as a factor (default 1). */
  volume?: number;
};

/** Ducking of the music under the voice (`audio.duck`). */
export type AudioDuck = {
  /** dB the music drops by while the voice speaks (default -8; 0 turns ducking off). */
  amount?: number;
  /** Seconds to go down, finished as the voice starts (default 0.15). */
  attack?: number;
  /** Seconds to come back up after it stops (default 0.5). */
  release?: number;
  /** Seconds of quiet inside a voice line that still count as speaking, so the music does not pump between words (default 0.3). */
  hold?: number;
};

export type Shot = {
  /** Stable id: used for file names, comment anchors and `--shot`. */
  id: string;
  /** Short name on the storyboard panel. */
  title: string;
  /** Length in frames, before any overlap with the next shot. */
  duration: number;
  component: ComponentType;
  /** What the viewer should understand when the shot ends. */
  says?: string;
  /** On-screen text, verbatim. */
  copy?: string[];
  /** Camera direction in plain words: "push in on the search field". */
  camera?: string;
  /** Music or sound cue. */
  sound?: string;
  notes?: string;
  /** Where to take storyboard stills, as fractions of the shot (default: [0.15, 0.85]). */
  board?: number[];
  /**
   * Named frames in the shot, counted from its start (`{ click: 140, lands: 210 }`),
   * so stills and sheets can ask for `shot:click+6` and survive a retime.
   */
  moments?: Record<string, number>;
  /** The cut into this shot is off the beat on purpose; `check` does not flag it. */
  offBeat?: boolean;
  /** How this shot arrives over the previous one. Default: hard cut. */
  transition?: Transition;
  /**
   * Run on an earlier shot's clock: `useFrame()` in this shot counts from the
   * start of that shot, so a scene both shots render (one 3D stage, its
   * camera, lights, handheld sway, a drifting backdrop) carries on across
   * the cut instead of restarting. Moments, `sfx` and `--shot` frames still
   * count from this shot's own start.
   */
  continues?: string;
  /** Sound effects, `at` counted from the shot's start. */
  sfx?: Sound[];
  /**
   * Picture that must land on a sound: `{ at: 144, sound: "boom" }`. `check`
   * finds the sound in the video's audio and fails when the two are more than
   * `tolerance` frames apart (default 2).
   */
  hits?: Hit[];
  /**
   * A frame that must equal a static reference rendered alone: the end
   * card's held frame against the approved logo (a brand's static lockup
   * component), or a handoff against the layer it hands off to. `check`
   * renders both and fails when they differ.
   */
  matches?: Match | Match[];
};

/** A held frame checked against a reference picture (`Shot.matches`). */
export type Match = {
  /** The frame, named as `still --at` names frames within the shot: `"end"` (default), `"end-10"`, `120`, `"lock+6"`. */
  at?: number | string;
  /**
   * What the frame must look like, rendered alone on the video's background,
   * on the shot's clock at that frame. Position and size it as the shot does:
   * `() => <Logo style={{ position: "absolute", left: 660, top: 440, width: 600 }} />`.
   */
  reference: ComponentType;
  /** Fraction of pixels allowed to differ by more than 16 levels (default from the checks, else 0.001). */
  tolerance?: number;
  /** A name for messages and the difference image ("lockup"). */
  label?: string;
};

/** A picture lock declared against the audio (`Shot.hits`). */
export type Hit = {
  /** The frame of the lock, from the shot's start, or a name from the shot's `moments`. */
  at: number | string;
  /**
   * The sound it lands on: seconds into the video's audio as heard, or an
   * event `pnpm launch sound` names ("boom", "impact", "cut", "onset",
   * "riser" for a riser's end), the one nearest the lock.
   */
  sound: number | string;
  /** Frames the two may be apart (default 2). */
  tolerance?: number;
};

/** A passage of the music played again (`audio.edit`). */
export type AudioEdit = {
  /** Beats `[from, to)` of audio/beats.json (0-based), replayed straight after `to`. Whole bars: `from` on a downbeat, `to - from` a multiple of 4. */
  replay: [number, number];
  /** Extra times the passage plays (default 1). */
  times?: number;
  /** Seconds of equal-power crossfade, ending on the seam just before the beat (default 0.03; 0.012 across drums, 0.1 to 0.2 across a pad; `beats --seams` suggests one). */
  crossfade?: number;
};

/** Named loudness targets for `audio.loudness` (see cli/loudness.ts for the numbers). */
export type LoudnessPreset = "web" | "podcast" | "broadcast" | "sting" | "atsc";

export type VideoConfig = {
  id: string;
  title: string;
  /** One line for the storyboard header: who it is for, what it shows. */
  logline?: string;
  width?: number;
  height?: number;
  fps?: number;
  bpm?: number;
  audio?: {
    /** The music: a URL in the launch folder ("/videos/x/audio/track.mp3"). With `stems`, still the full track: `beats` and `levels` read it. */
    src: string;
    /** Seconds into the track at frame 0 (and into each stem). */
    offset?: number;
    volume?: number;
    /** Seconds the music fades in over from frame 0, and out over to the last frame (quadratic: even to the ear). */
    fadeIn?: number;
    fadeOut?: number;
    /**
     * The track as stems, played together in place of `src` in the mix:
     * `{ drums: { src: "audio/stems/drums.wav", mute: [[480, 600]] }, bass: "audio/stems/bass.wav" }`.
     * `mute` silences a stem over frame ranges (drop the drums for the breath), `volume` scales it.
     */
    stems?: Record<string, string | AudioStem>;
    /**
     * A voice-over, as one file or one per line, placed on frames; the music
     * ducks under it. Mixed at its own level; the master then sets the whole
     * mix's loudness (unless `loudness` is "as-delivered").
     */
    voice?: VoiceLine | VoiceLine[];
    /** How far and how fast the music ducks under the voice. Default `{ amount: -8, attack: 0.15, release: 0.5, hold: 0.3 }`. */
    duck?: AudioDuck;
    /**
     * What `check` holds this video's audio to, over the project's rules: a
     * different target (`{ lufs: -23 }`), a delivery spec by name ("web",
     * "podcast", "broadcast" for EBU R128, "sting" for R128 s1 with its
     * short-term maximum, "atsc"; `mix` masters to it too), or "as-delivered" for
     * audio that must not be processed (an approved narration). As delivered,
     * `check` reports the numbers and only warns if the true peak clips (above 0 dBTP).
     */
    loudness?:
      | { lufs?: number; tolerance?: number; peak?: number; shortTerm?: number }
      | LoudnessPreset
      | "as-delivered";
    /**
     * Lengthen the music by whole bars: `[{ replay: [16, 24], times: 1 }]`
     * plays beats 16 to 24 once more straight after beat 24. Applied to the
     * track (and every stem) before `offset`, by `render`, `mix`, `check` and
     * the studio; `beatGrid(beats, fps, offset, edit)` follows it.
     * `pnpm launch beats <id> --seams` lists the passages that replay cleanly.
     */
    edit?: AudioEdit[];
  };
  /** Colour behind everything, and what transitions fade through. */
  background?: string;
  /**
   * What is transparent in `render --alpha` (a ProRes 4444 .mov with alpha, to lay over other
   * footage in an editor). `"page"` (the default): the background is left out and everything the
   * shots draw keeps its own opacity, for type and UI over someone else's picture. `"black"`: the
   * video is light on a black background (a sting, glows, 3D light, which has no opacity of its
   * own), keyed by brightness: each pixel's alpha is its brightest channel and its colour is
   * divided by it (After Effects' Unmult), so it lays over other footage as light.
   */
  alpha?: "page" | "black";
  /**
   * What `check` holds this video's text to, over the project's rules (core,
   * installed add-ons, launch.config.ts). For a video outside a brand whose
   * stricter rules are installed in the repo: `{ reading: { min: 1, cps: 14 } }`.
   */
  checks?: { reading?: ReadingOptions };
  /** Sound effects on the whole video's timeline. Shots can carry their own. */
  sfx?: Sound[];
  /**
   * Other frame shapes this video is laid out for, beside its own `width` ×
   * `height`: `{ vertical: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } }`.
   * Scenes reflow by reading `useVideoInfo().format`; the CLI takes `--format vertical`.
   */
  formats?: Record<string, FormatSize>;
  /**
   * Captions, exported as SRT and VTT (`pnpm launch captions`, and by `render`):
   * `{ text, at, until? }` in frames from the video's start, or with `shot` from
   * that shot's start. Without `until` a cue holds for its reading time.
   */
  captions?: Caption[];
  /** Draw the captions into the picture, over every shot: `true`, or a style for them. */
  burnCaptions?: boolean | CaptionStyle;
  shots: Shot[];
  /**
   * Versions of this video that differ in a few things: an episode's last
   * line, a language. Each is rendered and checked on its own
   * (`render <id> --variant ep02`, or `--variant all` for the video and every
   * variant) into files named with it (`<id>-ep02.mp4`, `check-ep02.json`).
   * Scenes read the one on screen with `useVariant()`.
   */
  variants?: Record<string, Variant>;
};

/** What a variant changes (`VideoConfig.variants`). Everything else is the video's own. */
export type Variant = {
  title?: string;
  /** Merged over the video's `audio` (a new `src`, `voice` or `offset`). */
  audio?: Partial<NonNullable<VideoConfig["audio"]>>;
  /** Replace the video's own sound effects and captions. */
  sfx?: Sound[];
  captions?: Caption[];
  /** Per shot, by id: a new length, copy, direction, moments or sound effects. */
  shots?: Record<string, Partial<Pick<Shot, "duration" | "copy" | "says" | "notes" | "moments" | "sfx" | "matches">>>;
  /** Anything the scenes need, read with `useVariant().data`: the episode's line, an imported levels file. */
  data?: Record<string, unknown>;
};

export type PlacedShot = Shot & {
  from: number;
  /** Where this shot's clock starts: `from`, or the start of the shot it `continues`. */
  clock: number;
};

export type Video = Required<Pick<VideoConfig, "width" | "height" | "fps" | "background">> &
  Omit<VideoConfig, "width" | "height" | "fps" | "background" | "shots"> & {
    shots: PlacedShot[];
    durationInFrames: number;
    /** The format on screen: the video's own shape name (landscape, vertical, portrait, square) or a key of `formats`. */
    format: string;
    /** Every format, the video's own included, by name. */
    formats: Record<string, FormatSize>;
    /** Captions resolved to frames, wrapped and split (see engine/captions.ts). */
    captionCues: CaptionCue[];
    /** The variant on screen (a key of `variants`), or null for the video itself. */
    variant: string | null;
    /** The variant's `data` (empty for the video itself). */
    variantData: Record<string, unknown>;
    /** The config it was defined from, for `withVariant`. */
    source: VideoConfig;
  };

/** Lay shots end to end, overlapping each by its transition. */
export function defineVideo(config: VideoConfig): Video {
  return layout(config, null);
}

/**
 * The video as variant `name` (a key of its `variants`): the variant's
 * changes merged over the video's config and the shots laid out again.
 * `null`, or no name, is the video itself. Throws on a name it does not declare.
 */
export function withVariant(video: Video, name?: string | null): Video {
  if (!name || name === video.variant) return video;
  const config = video.source;
  const v = config.variants?.[name];
  if (!v) {
    const known = Object.keys(config.variants ?? {});
    throw new Error(
      `Video "${video.id}" has no variant "${name}"${known.length ? `. Variants: ${known.join(", ")}` : ""}`,
    );
  }
  for (const id of Object.keys(v.shots ?? {}))
    if (!config.shots.some((s) => s.id === id))
      throw new Error(`Variant "${name}" changes shot "${id}", which the video does not have`);
  return layout(
    {
      ...config,
      title: v.title ?? config.title,
      audio:
        v.audio && config.audio ? { ...config.audio, ...v.audio } : ((v.audio as VideoConfig["audio"]) ?? config.audio),
      sfx: v.sfx ?? config.sfx,
      captions: v.captions ?? config.captions,
      shots: config.shots.map((s) => ({ ...s, ...v.shots?.[s.id] })),
    },
    { name, data: v.data ?? {}, source: config },
  );
}

function layout(
  config: VideoConfig,
  variant: { name: string; data: Record<string, unknown>; source: VideoConfig } | null,
): Video {
  const { width = 1920, height = 1080, fps = 60, background = "#18181c", ...rest } = config;
  const ids = new Set<string>();
  let cursor = 0;
  const shots = config.shots.map((shot, i) => {
    if (ids.has(shot.id)) throw new Error(`Duplicate shot id "${shot.id}"`);
    ids.add(shot.id);
    const overlap = i === 0 ? 0 : Math.min(shot.transition?.frames ?? 0, config.shots[i - 1].duration);
    const from = cursor - overlap;
    cursor = from + shot.duration;
    return { ...shot, from, clock: from };
  });
  for (const shot of shots) {
    if (!shot.continues) continue;
    const earlier = shots.find((s) => s.id === shot.continues);
    if (!earlier || earlier.from >= shot.from)
      throw new Error(`Shot "${shot.id}" continues "${shot.continues}", which is not an earlier shot`);
    // Shots are in order, so the earlier one's own `continues` is resolved already.
    shot.clock = earlier.clock;
  }
  const format = shapeName({ width, height });
  const formats = { [format]: { width, height }, ...config.formats };
  const captionCues = resolveCaptions(config.captions ?? [], {
    fps,
    shots,
    duration: cursor,
    reading: config.checks?.reading,
  });
  return {
    ...rest,
    width,
    height,
    fps,
    background,
    shots,
    durationInFrames: cursor,
    format,
    formats,
    captionCues,
    variant: variant?.name ?? null,
    variantData: variant?.data ?? {},
    source: variant?.source ?? config,
  };
}
