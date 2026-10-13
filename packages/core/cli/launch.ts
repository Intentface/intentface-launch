import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { setFormat, setVariant, startServer, stopServer } from "./browser.js";
import { loadProject } from "./project.js";
import { render, variantList } from "./render.js";
import { sheet, stills } from "./review.js";
import { parseArgs } from "./util.js";

const HELP = `intentface-launch <command>   (pnpm launch <command> in a product repo)

  init [folder]                set up launch/ in this product repo: config, CLAUDE.md, skills
  add <name…>                  install an add-on: three, shaders, or any add-on package (a brand)
  addons                       what can be added, and what is installed
  update                       refresh skills and CLAUDE.md from installed packages
  setup                        download the browser renders use (once per machine)

  dev                          studio at http://localhost:4400
  new <id> [--title "…"]       scaffold videos/<id>
  still <id> --at F[,F…]       PNG stills, each printed with its shot and any transition it is in
      F: 120 (from the start of --shot, or the video), -1 or end (the shot's last frame
      before its outgoing transition), end-10, a shot id, shot:+30, shot:end,
      shot:click+6 (a frame named in the shot's moments). --frame is the same.
      --grid [--cols N] [--size W]  one labelled image of all of them (tiles W wide, default 480)
      --crop x,y,w,h [--zoom Z]     a region in video pixels, magnified (default about 960 px wide)
      --samples N              3D stages at N samples per frame (8: a quick draft of a 96-sample stage)
      --stage-debug            per frame, the 3D stage's passes beside the frame: one sample without
                               post, what glass sees, the floor's reflection, alpha, the backdrop
  sheet <id> [--shot s]        contact sheet, every --every N frames (default 6)
      --from F --to F          range, same frame names as still
      --size W  --cols N       tile width (default 320) and columns (default 6)
      --beats [--offset N]     one tile per beat (N frames after it), labelled bar.beat
      --samples N              3D stages at N samples per frame
  measure <id> --shot s        motion as numbers, every frame: when it lands and how long it holds,
                               how fast the ink moves, and judder (px off a smooth path) → out/measure/
      --from F --to F          range, same frame names as still   --crop x,y,w,h  one element
  diff <id> --frame F --against G   two frames side by side and their difference, with how
                               much differs and where (G: a frame name, or an image file)
      --against-video v        G is a frame of video v   --crop x,y,w,h [--zoom Z]  a region
      --threshold N            levels (of 255) a pixel may differ by and count as the same (16)
  board <id> [--no-animatic]   storyboard panels + animatic for the studio's board view, and
                               check's text pass (reading time, size, safe area, storyboard copy)
                               per shot, shown under the stills
      --html                   also write a standalone page to share outside the repo
      --no-reading             skip the text pass (it renders every 0.1 s: slow on 3D stages)
  render <id>                  final mp4 (1080p60; motion blur comes from <MotionBlur> layers)
      --preview                960×540, 30 fps, jpeg frames, 3D at 8 samples, no motion blur: a fast review cut
      --samples N              3D stages at N samples per frame (default: each stage's own)
      --shots a,b              draw only these shots again; every other chunk comes from the last render
      --scale 2                4K
      --blur N                 extra global supersampling, N× per changing frame (default off)
      --angle 180 --phase -90  shutter angle and phase, in degrees
      --from F --to F          frame range
      --master                 also write a ProRes 422 HQ .mov
      --gif [W]                also a looping GIF under 8 MB, for READMEs and chat (at most W px wide)
      --poster F               also frame F as a PNG, and a 1200×630 JPEG for link previews
      --workers N              browsers in parallel (default 8); fewer stall less on 3D
      --resume                 keep the chunks a failed render finished; render only the rest
      --check                  then run check on it
  look <url>                   pictures of the running product, one tiled image, and its fonts,
                               colours, radii and :root tokens → out/look/
      --do "click:Run all" [--wait S]  a step, then a picture (click, hover, fill:Label=text,
                               type, press, scroll, goto); repeat in order
      --dark | --light  --size 1440x900  --storage key=value  --tile 480  --tokens (print all)
  capture <id> [name]          run videos/<id>/captures/<name>.capture.ts against a live app
                               (prints the marks that moved since the last capture)
  marks <id> <capture> <snap>  measure elements in a saved snapshot and add them as marks
      --select "<css>" --name n  (no recapture: snapshots hold the page's DOM and fonts)
  mix <id>                     build out/mix.wav: the music plus every sfx, mastered (render does
                               this itself; run it to listen or measure)
  beats <id>                   detect beats in the video's audio → audio/beats.json
      --seams                  also the bars that can replay (audio.edit), scored per seam
  levels <id> [file…]          loudness, band envelopes (sub to high), onsets and phrases per
                               frame, for scenes that move with the sound → <file>.levels.json
  sound <id> [file]            the audio as heard (or a file) as a timeline: impacts, booms,
                               cuts, risers, pulses, tail, with seconds and frames; loudness
                               with short-term max, key, band onsets → out/sound.json
      --png                    also a spectrogram with a frame ruler and the events marked
  sfx find [text]              the sound library (sfx/ in the launch folder, then core's pack):
      --category c --tags a,b --max S --min S [--json]   use one as src: "sfx:<id>"
  sfx index [--dir d]          measure the library's files (duration, onset, peak, loudness) →
      [--license L --source S]   index.json, keeping hand-written fields; new files get these
  check [id] [--every N]       source checks over videos/; with an id, also sample the render:
                               reading time, text size, safe area, contrast, stillness, cuts on
                               the beat, loudness, licences → out/check.json
      --samples N              3D stages at N samples per frame while checking (default 8)
  captions <id>                the video's captions → out/<id>.srt and .vtt (render writes them too)
  licences <id>                every external file the video uses and its licence →
                               out/licences.json (render writes it too)

  --format <name>              still, sheet, render, check, captions, board: the video in another
                               of its formats (defineVideo formats: vertical, square…); files get
                               -<name> (<id>-vertical.mp4, check-vertical.json)
  --variant <name>             any video command: one of the video's variants (defineVideo
                               variants: an episode, a language); files get -<name>. render and
                               check also take --variant all: the video and every variant
`;

/** Commands that set a project up, so they run without one. */
async function setupCommand(command: string | undefined, positional: string[]) {
  const addons = await import("./addons.js");
  switch (command) {
    case "init":
      addons.init(process.cwd(), positional[0]);
      return true;
    case "add":
      addons.add(process.cwd(), positional);
      return true;
    case "update":
      addons.update(process.cwd());
      return true;
    case "addons":
      addons.listAddons(process.cwd());
      return true;
    case "setup": {
      const cli = join(dirname(createRequire(import.meta.url).resolve("playwright/package.json")), "cli.js");
      execFileSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
      return true;
    }
    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      return true;
  }
  return false;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const [id] = args.positional;
  if (await setupCommand(command, args.positional)) return;
  const project = await loadProject();
  setFormat(args.str("format"));
  // "all" is expanded by render and check; anything else applies to every command.
  const variantFlag = args.str("variant");
  setVariant(variantFlag === "all" ? undefined : variantFlag);
  const need = () => {
    if (!id) throw new Error(`Usage: intentface-launch ${command} <video-id>`);
    return id;
  };

  switch (command) {
    case "dev": {
      const { url } = await startServer(args.num("port") ?? project.config.port ?? 4400);
      console.log(`\n  Studio: ${url}\n`);
      return; // keep serving
    }
    case "still": {
      const specs = String(args.flags.at ?? args.flags.frame ?? "0").split(",");
      const crop = args.str("crop")?.split(",").map(Number);
      if (crop && (crop.length !== 4 || crop.some((n) => !Number.isFinite(n))))
        throw new Error("--crop x,y,width,height (video pixels)");
      const files = await stills(need(), specs, {
        shot: args.str("shot"),
        scale: args.num("scale"),
        grid: args.flags.grid === true,
        columns: args.num("cols") ?? args.num("columns"),
        size: args.num("size"),
        crop: crop && { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
        zoom: args.num("zoom"),
        samples: args.num("samples"),
        stageDebug: args.flags["stage-debug"] === true,
      });
      for (const f of files) console.log(`  ${f.file}\n      ${f.line}`);
      break;
    }
    case "sheet": {
      const file = await sheet(need(), {
        shot: args.str("shot"),
        every: args.num("every"),
        from: args.str("from") ?? (args.flags.from === undefined ? undefined : String(args.flags.from)),
        to: args.str("to") ?? (args.flags.to === undefined ? undefined : String(args.flags.to)),
        columns: args.num("cols") ?? args.num("columns"),
        tile: args.num("size"),
        beats: args.flags.beats === true,
        offset: args.num("offset"),
        samples: args.num("samples"),
      });
      console.log(`  ${file}`);
      break;
    }
    case "measure": {
      const { measure } = await import("./measure.js");
      const crop = args.str("crop")?.split(",").map(Number);
      if (crop && (crop.length !== 4 || crop.some((n) => !Number.isFinite(n))))
        throw new Error("--crop x,y,width,height (video pixels)");
      const out = await measure(need(), {
        shot: args.str("shot"),
        from: args.str("from") ?? (args.flags.from === undefined ? undefined : String(args.flags.from)),
        to: args.str("to") ?? (args.flags.to === undefined ? undefined : String(args.flags.to)),
        crop: crop && { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
      });
      for (const l of out.lines) console.log(`  ${l}`);
      console.log(`  ${out.file}`);
      break;
    }
    case "diff": {
      const { diff } = await import("./diff.js");
      const frame = args.flags.frame ?? args.flags.at;
      const against = args.flags.against;
      if (frame === undefined || frame === true || against === undefined || against === true)
        throw new Error("Usage: diff <id> --frame F --against G [--against-video v] [--crop x,y,w,h]");
      const crop = args.str("crop")?.split(",").map(Number);
      if (crop && (crop.length !== 4 || crop.some((n) => !Number.isFinite(n))))
        throw new Error("--crop x,y,width,height (video pixels)");
      const out = await diff(need(), {
        frame: String(frame),
        against: String(against),
        againstVideo: args.str("against-video"),
        shot: args.str("shot"),
        crop: crop && { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
        zoom: args.num("zoom"),
        size: args.num("size"),
        threshold: args.num("threshold"),
      });
      console.log(`  ${out.file}\n      ${out.a}\n      ${out.b}\n      ${out.summary}`);
      break;
    }
    case "render": {
      const preview = args.flags.preview === true;
      for (const variant of await variantList(need(), variantFlag)) {
        setVariant(variant);
        await render(need(), {
          scale: args.num("scale") ?? (preview ? 0.5 : 1),
          blur: args.num("blur") ?? 1,
          angle: args.num("angle"),
          phase: args.num("phase"),
          fps: args.num("fps") ?? (preview ? 30 : undefined),
          from: args.num("from"),
          to: args.num("to"),
          workers: args.num("workers"),
          audio: args.flags.audio !== false,
          master: args.flags.master === true,
          gif: args.flags.gif === true ? true : args.num("gif"),
          poster: args.str("poster"),
          quick: preview,
          name: args.str("name"),
          resume: args.flags.resume === true,
          // A preview is a review cut: 3D stages as a quick draft unless asked otherwise.
          samples: args.num("samples") ?? (preview ? 8 : undefined),
          shots: args
            .str("shots")
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        if (args.flags.check === true) {
          const { check } = await import("./check.js");
          if (!(await check(id, { every: args.num("every"), samples: args.num("samples") }))) process.exitCode = 1;
        }
      }
      break;
    }
    case "board": {
      const { board } = await import("./board.js");
      await board(need(), {
        animatic: args.flags.animatic !== false,
        html: args.flags.html === true,
        reading: args.flags.reading !== false,
      });
      break;
    }
    case "capture": {
      const { capture } = await import("./capture.js");
      await capture(need(), args.positional[1]);
      break;
    }
    case "look": {
      // Its own parser: --do and --wait repeat, in order.
      const { look, parseLook } = await import("./look.js");
      await look(parseLook(rest));
      break;
    }
    case "marks": {
      const { marks } = await import("./marks.js");
      const [, capture, snapshot] = args.positional;
      const selector = args.str("select");
      if (!capture || !snapshot || !selector)
        throw new Error('Usage: marks <id> <capture> <snapshot> --select "<css>" [--name n]');
      await marks(need(), capture, snapshot, { selector, name: args.str("name") ?? "el" });
      break;
    }
    case "mix": {
      const { mixVideo } = await import("./mix.js");
      await mixVideo(need());
      break;
    }
    case "beats": {
      const { beats } = await import("./beats.js");
      await beats(need(), { seams: args.flags.seams === true });
      break;
    }
    case "sfx": {
      const sfx = await import("./sfx.js");
      const [action, ...words] = args.positional;
      if (action === "index")
        sfx.indexLibrary({ dir: args.str("dir"), license: args.str("license"), source: args.str("source") });
      else if (action === "find" || action === undefined)
        sfx.printSfx(
          {
            text: words.join(" ") || undefined,
            category: args.str("category"),
            tags: args.str("tags")?.split(","),
            max: args.num("max"),
            min: args.num("min"),
          },
          args.flags.json === true,
        );
      else throw new Error("Usage: sfx find [text] [--category c --tags a,b --max S] | sfx index [--dir d]");
      break;
    }
    case "sound": {
      const { sound } = await import("./sound.js");
      await sound(need(), args.positional[1], { png: args.flags.png === true, fps: args.num("fps") });
      break;
    }
    case "levels": {
      const { levels } = await import("./levels.js");
      levels(need(), args.positional.slice(1), { rate: args.num("rate") });
      break;
    }
    case "new": {
      const { scaffold } = await import("./scaffold.js");
      scaffold(need(), args.str("title"));
      break;
    }
    case "check": {
      const { check } = await import("./check.js");
      for (const variant of id ? await variantList(id, variantFlag) : [undefined]) {
        setVariant(variant);
        if (variant) console.log(`\n  variant ${variant}`);
        if (!(await check(id, { every: args.num("every"), samples: args.num("samples") }))) process.exitCode = 1;
      }
      break;
    }
    case "captions": {
      const { captions } = await import("./captions.js");
      await captions(need());
      break;
    }
    case "licences":
    case "licenses": {
      const { licences } = await import("./licences.js");
      await licences(need());
      break;
    }
    default:
      console.log(HELP);
      return;
  }
  await stopServer();
}

main().catch(async (error) => {
  console.error(`\n  ${error instanceof Error ? error.message : error}\n`);
  await stopServer();
  process.exit(1);
});
