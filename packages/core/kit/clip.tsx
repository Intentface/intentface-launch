import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { useFrame, useVideoInfo, waitFor } from "../engine/index.js";

const frameUrl = (src: string, t: number) => `/__launch/clip?src=${encodeURIComponent(src)}&t=${t.toFixed(5)}`;

const ahead = new Map<string, HTMLImageElement>();
function preload(url: string) {
  if (ahead.has(url)) return;
  const img = new Image();
  img.src = url;
  ahead.set(url, img);
  if (ahead.size > 300) ahead.delete(ahead.keys().next().value as string);
}

/**
 * Play a video file inside a shot, frame exact: a sting another video
 * rendered, a screen recording, stock footage. The dev server extracts its
 * frames on first use and again whenever the file changes, so stills, renders
 * and the studio all show the same frame. Holds the last frame after the end.
 * Fills the frame (`object-fit: cover`) unless `style` says otherwise. Its
 * sound is not played: add it to the video's audio (`sfx` with the same file).
 */
export function Clip({
  src,
  video,
  start = 0,
  rate = 1,
  style,
}: {
  /** A file in the launch folder, as a URL: "/videos/x/media/sting.mp4". */
  src?: string;
  /** Another video's render instead: "sting" plays videos/sting/out/sting.mp4. */
  video?: string;
  /** Seconds into the clip at the shot's first frame. */
  start?: number;
  /** Playback speed: 0.5 is half speed. */
  rate?: number;
  style?: CSSProperties;
}) {
  const frame = useFrame();
  const { fps } = useVideoInfo();
  const ref = useRef<HTMLImageElement>(null);
  const file = src ?? (video ? `/videos/${video}/out/${video}.mp4` : "");
  if (!file) throw new Error("<Clip> needs src or video");
  const t = Math.max(0, start + (frame / fps) * rate);
  const url = frameUrl(file, t);

  useLayoutEffect(() => {
    const img = ref.current;
    if (!img) return;
    waitFor(
      img.decode().catch(() => {
        console.error(
          video
            ? `<Clip video="${video}">: no render at ${file}. Run pnpm launch render ${video} first.`
            : `<Clip src="${file}">: could not load it (missing, or not a video ffmpeg can read)`,
        );
      }),
      `Clip ${file}`,
    );
    for (let i = 1; i <= 20; i++) preload(frameUrl(file, start + ((Math.round(frame) + i) / fps) * rate));
  }, [url, file, frame, fps, start, rate, video]);

  return (
    <img
      ref={ref}
      src={url}
      alt=""
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
