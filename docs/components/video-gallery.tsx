"use client";

import { Play } from "@keyline-icons/react/fill";
import { type ReactNode, useState } from "react";

export type GalleryVideo = { id: string; start?: number; title: ReactNode; description: ReactNode };

/**
 * A list of YouTube links as a grid of cards: the video's thumbnail with a play
 * button, its title and description. Clicking plays it in place.
 */
export const VideoGallery = ({ videos }: { videos: GalleryVideo[] }) => (
  <div className="not-prose my-6 grid gap-x-5 gap-y-7 sm:grid-cols-2">
    {videos.map((video) => (
      <VideoCard key={video.id} {...video} />
    ))}
  </div>
);

const VideoCard = ({ id, start, title, description }: GalleryVideo) => {
  const [playing, setPlaying] = useState(false);
  // Not every upload has a 1280 px thumbnail; YouTube serves a 120 px grey
  // placeholder then, so fall back to the 480 px one, which always exists.
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  const label = typeof title === "string" ? title : "Video";
  return (
    <figure className="flex flex-col">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-card">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1${start ? `&start=${start}` : ""}`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${label}`}
            className="group size-full cursor-pointer"
          >
            <img
              src={thumb}
              alt=""
              loading="lazy"
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth <= 120) setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
              }}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
                <Play className="ml-0.5 size-6" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 flex flex-col gap-1">
        <span className="font-medium text-ink-primary">{title}</span>
        <span className="text-ink-secondary text-sm leading-5">{description}</span>
      </figcaption>
    </figure>
  );
};
