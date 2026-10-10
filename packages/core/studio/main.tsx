import { createRoot } from "react-dom/client";
import { withFormat } from "../engine/formats.js";
import { mountRenderer } from "../engine/runtime.js";
import { setActiveVariant } from "../engine/timeline.js";
import { withVariant } from "../engine/video.js";
import "./studio.css";
import { Board } from "./board.js";
import { Studio, VideoList } from "./studio.js";
import { loadVideo } from "./videos.js";

const params = new URLSearchParams(location.search);
const id = params.get("v");
const root = document.getElementById("root") as HTMLElement;
/**
 * `?format=vertical`: the video in another of its formats; `?variant=ep02`:
 * one of its variants. Both applied before it mounts.
 */
const load = (v: string) =>
  loadVideo(v).then((loaded) => {
    const video = withFormat(withVariant(loaded, params.get("variant")), params.get("format"));
    setActiveVariant(video);
    return video;
  });

if (id && params.has("render")) {
  // The CLI drives this page. No studio chrome, just the stage.
  document.documentElement.dataset.mode = "render";
  load(id).then((video) => mountRenderer(video, root));
} else if (id && params.has("board")) {
  load(id).then((video) => createRoot(root).render(<Board video={video} folder={id} />));
} else if (id) {
  load(id).then((video) => createRoot(root).render(<Studio video={video} folder={id} />));
} else {
  createRoot(root).render(<VideoList />);
}
