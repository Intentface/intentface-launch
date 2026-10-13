import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { launchCommand } from "./project.js";
import { root } from "./util.js";

const VIDEO = (id: string, title: string) => `import { defineVideo, tempo } from "@intentface-launch/core";

// Stage 3 of the product-launch-video skill: every shot is built from the
// product's real UI (snapshots from captures/), in the product's own look.
// Until the script is agreed, this placeholder only holds the timing.
const t = tempo(120, 60);

function Hook() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#111" }}>
      <div
        data-launch-check="off"
        style={{ position: "absolute", left: 96, bottom: 96, font: "400 28px ui-monospace, monospace", color: "#888" }}
      >
        Sketch: the product's UI goes here.
      </div>
    </div>
  );
}

export default defineVideo({
  id: "${id}",
  title: "${title}",
  logline: "Who it is for and what it shows, in one line.",
  bpm: t.bpm,
  shots: [
    {
      id: "hook",
      title: "Hook",
      duration: t.bars(1),
      component: Hook,
      says: "What the viewer should understand when this shot ends, shown by the product, not said.",
      camera: "What the camera frames and how it moves, on which part of the UI.",
      notes: "energy 4.",
    },
  ],
});
`;

const BRIEF = (title: string) => `# ${title}

## The product's look

Its typefaces, colours, surfaces, radii and how its UI moves. The video uses these, not another brand, unless the person asks for one.

## Audience and where it plays

## The claim

One sentence; it should match the product's homepage headline.

## What sets it apart

The hero (the moment a new user says "oh") and two or three supports, each with the moment it can be seen happening in the UI.

## Cut, and why

## Facts and sources

Only what is supplied here or visible in the product goes on screen.

## Script

One person doing one real task in the product. Agreed with the person before the sketch.

| # | Beats | Picture: what, how close, what moves | Words | Hand-off to next |
|---|---|---|---|---|

Running time · UI on screen · overlay words:

## Length and format

About 30 s, 1920×1080, 60 fps.

## Product

How to run it locally, and the URL captures use.
`;

const CAPTURE = `import { defineCapture } from "@intentface-launch/core/capture";

export default defineCapture({
  url: "http://localhost:3000/",
  viewport: { width: 1440, height: 900 },
  scale: 2,
  async setup(page) {
    await page.waitForLoadState("networkidle");
  },
  async run(c) {
    await c.hold(1);
    // A snapshot, with marks for the camera and cursor, at every state the script shows.
    await c.snapshot("start", { marks: { app: "body" } });
  },
});
`;

export function scaffold(id: string, title = id.replace(/-/g, " ")) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("Video ids are lowercase words joined by hyphens");
  const dir = join(root(), "videos", id);
  if (existsSync(dir)) throw new Error(`${relative(root(), dir)} already exists`);
  mkdirSync(join(dir, "captures"), { recursive: true });
  mkdirSync(join(dir, "audio"), { recursive: true });
  writeFileSync(join(dir, "video.tsx"), VIDEO(id, title));
  writeFileSync(join(dir, "brief.md"), BRIEF(title));
  writeFileSync(join(dir, "captures", "main.capture.ts"), CAPTURE);
  writeFileSync(join(dir, "audio", ".gitkeep"), "");
  console.log(`  ${relative(root(), dir)}/ · open http://localhost:4400/?v=${id} after ${launchCommand(root())} dev`);
}
