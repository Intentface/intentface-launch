import type { Video } from "../engine/index.js";

const modules = import.meta.glob<{ default: Video }>("/videos/*/video.tsx");

/** Folder name → loader. The folder name is the video's id on the command line. */
export const videos = Object.fromEntries(Object.entries(modules).map(([path, load]) => [path.split("/")[2], load]));

export async function loadVideo(id: string): Promise<Video> {
  const load = videos[id];
  if (!load) throw new Error(`No video "${id}". Known: ${Object.keys(videos).join(", ") || "none"}`);
  return (await load()).default;
}
