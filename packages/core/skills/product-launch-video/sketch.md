# Building the sketch

The sketch is the agreed script made visible: every shot at its real length, from the product's real UI, with flat camera moves, a cursor and the final copy. It is built to be cheap to change. Most of it should be reusable in the build: the capture's snapshots and marks, the camera keys, the copy and the timing.

## 1. One capture run, a snapshot per state

Walk the script's task once in a single capture script and take a `snapshot` at every state the video shows, with a mark on everything the camera frames or the cursor touches. Snapshots are vectors, so one capture serves every distance from wide to macro. Do not record long holds for the sketch; frames are only needed where the product's own motion is the point, and even those can be one snapshot of the end state for now.

```ts
// videos/<id>/captures/path.capture.ts
import { defineCapture } from "@intentface-launch/core/capture";

export default defineCapture({
  url: "http://localhost:3210/",
  viewport: { width: 1440, height: 900 },
  scale: 2,
  async setup(page) {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("searchbox").waitFor();
  },
  async run(c) {
    const { page } = c;
    const search = page.getByRole("searchbox");
    await c.hold(1);
    await c.snapshot("start", { marks: { app: "main", search } });

    // Act between snapshots: no frames are recorded, the page just changes.
    await c.act(async () => {
      await search.fill("AI events in Helsinki");
      await page.keyboard.press("Enter");
      await page.locator("aside li").first().waitFor();
    });
    await c.snapshot("results", {
      marks: { search, list: "aside ul", first: page.locator("aside li").first() },
    });

    await c.act(() => page.locator("aside li").first().click());
    await c.snapshot("detail", { marks: { card: "aside li .details", share: page.getByRole("button", { name: "Share" }) } });
  },
});
```

`pnpm launch capture <id> path`, then look at each snapshot once: `pnpm launch still` of a shot that shows it, or a still from a throwaway shot. A mark missing later is cheaper to add with `pnpm launch marks <id> path <snapshot> --select "<css>" --name <name>` than by recapturing.

Each snapshot records the product's look in the manifest. In the video, `useProductLook(capture)` returns it (`fonts.body`, `fonts.heading`, `fonts.mono`, `colors.background`, `surface`, `text`, `muted`, `accent`, `border`, `radii`) and registers the snapshot's own `@font-face` rules on the page, so overlays are set in the product's face without hunting for its font files. Check one still shows that face, not a fallback.

Seed the state the script needs through the app's own code rather than clicking for minutes: `const store = await app.module<typeof import("@/lib/store")>("/src/lib/store.ts")` in `setup(page, app)` (or `c.module` in `run`) is the module the app runs, and `store.evaluate((m) => m.useStore.getState().addRows(70))` calls it. `c.read({ indexedDB: [db, store, key] })` or `{ localStorage: key }` returns what the app saved, to check the seed or to save it.

A canvas UI (a data grid, a chart) is only a picture in a snapshot. Take its snapshot with `canvasScale: 4` so a push-in stays sharp. If single cells must change, save the data with `c.data("grid", () => …)` (or a value from `store.evaluate`) and rebuild the table as DOM in the product's look: the video imports `./captures/path/data/grid.json`.

After a recapture, read the list of marks that moved: a framing on a moved mark follows it if the camera key names the mark, and needs a look if it was written as numbers.

## 2. A sketch shot

Each shot is a `Camera` over the shot's snapshots, keys on the marks, a `Cursor` in the same content coordinates, and the copy. A state change is a switch from one snapshot to the next on the click frame; the build turns it into real UI motion.

```tsx
import { tempo, useFrame } from "@intentface-launch/core";
import {
  Camera,
  type CameraKey,
  type CaptureManifest,
  Cursor,
  mark,
  Reveal,
  Snapshot,
  useProductLook,
} from "@intentface-launch/core/kit";
import path from "./captures/path.json";

const t = tempo(120, 60);
const ui = path as CaptureManifest;
const at = (name: string) => mark(ui, name).rect;
const UI = { width: ui.width, height: ui.height };

const QUERY = "AI events in Helsinki";
const click = t.beats(3);

export function Search() {
  const f = useFrame();
  // The product's canvas colour, typeface and text colour, with its fonts loaded on this page.
  const look = useProductLook(ui);
  const typed = QUERY.slice(0, Math.max(0, Math.floor((f - t.beats(1)) / 3)));
  const keys: CameraKey[] = [
    { at: 0, view: at("start:app"), padding: 0 }, // establish, briefly
    { at: t.beats(1), view: at("start:search"), padding: 0.25 }, // go in where the action is
    { at: t.beats(5), view: at("results:list"), padding: 0.08, travel: t.beats(2) }, // follow the answer
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: look.colors.background }}>
      <Camera keys={keys} contentWidth={UI.width} contentHeight={UI.height}>
        {f < click ? (
          <Snapshot capture={ui} name="start" animate={(api) => api.text(api.one("input[type=search]"), typed)} />
        ) : (
          <Snapshot capture={ui} name="results" />
        )}
        <Cursor
          keys={[
            { at: t.beats(1), to: at("start:search") },
            { at: click, to: at("start:search"), click: true },
          ]}
        />
      </Camera>
      {/* A word after the fact: lands once the results are on screen, in the product's own type. */}
      <div style={{ position: "absolute", left: 120, bottom: 140, font: `600 88px ${look.fonts.heading}`, color: look.colors.text, letterSpacing: "-0.03em" }}>
        <Reveal at={t.beats(5)}>Planet to street.</Reveal>
      </div>
    </div>
  );
}
```

In `video.tsx`, the shot carries the script's row, so the board shows the script next to the pictures:

```tsx
{
  id: "search",
  title: "Ask",
  duration: t.beats(8),
  component: Search,
  says: "You ask the way you would say it, and the map answers.",
  copy: ["Planet to street."],
  camera: "From the whole app into the search field, then along the results as they fill.",
  notes: "energy 3. Build: the words become filter pills (ui-motion), rows dealt in during the move.",
  board: [0.1, 0.4, 0.9], // before the click, the typing, the answer
},
```

Set `board` so the stills catch the before, the action and the answer: a story told in three frames per shot.

## 3. Stand-ins for what the build adds

The sketch shows where every heavy moment goes and how long it lasts, at a fraction of the cost:

| In the build | In the sketch |
|---|---|
| UI parts assembling in 3D, a light sweep, depth of field | The same snapshot in CSS perspective (a tilt, layers at different `translateZ`), the camera making the same move; `notes` says what it becomes |
| A cross-cut morph or a match cut | Hard cut on the same frame, both shots framed on the same rect |
| The product's own motion (a map flight, streamed text) | The end-state snapshot, or a few seconds of `Capture` at `scale: 1` |
| A logo animation | The product's logo, static, in its place on the end card |
| Sound effects | The track playing, shots timed to its beats; `sound` on each shot says the cue |

Keep the sketch cheap: no `Stage3D`. But not plain: a board of flat, straight-on UI reads as dull and gets judged as the finished look (one launch film's first board was rejected as "not cool, no motion blur, no fade, no perspective"). Show the planned look with cheap means: CSS perspective on the UI, `<Focus>` fading the UI into the background around what matters, and `MotionBlur` on the few frames of a fast move. Then `pnpm launch board <id>` stays around a minute and every revision is cheap.

## 4. Before showing it

- `pnpm launch board <id>` and read the board's stills yourself: can you follow the story from the pictures alone? Is the product's UI on screen almost all the time, at a size where its text reads?
- `pnpm launch sheet <id> --beats`: something happens on every beat; no run of identical tiles.
- Count the overlay words against the budget and check none of them names a feature.
- Then give the person the board link and what to judge (SKILL.md, stage 3).
