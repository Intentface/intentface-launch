import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Locator, Page } from "playwright";
import sharp from "sharp";
import { type ProductLook, readLook } from "../kit/look.js";
import { launchBrowser } from "./browser.js";
import { tileImage } from "./review.js";
import { root, timer } from "./util.js";

type Step = { action: string; arg: string; wait?: number };

export type LookOptions = {
  url: string;
  colorScheme?: "dark" | "light";
  width: number;
  height: number;
  /** Device scale of the screenshots (1 keeps them small). */
  scale: number;
  /** Tile width in the image. */
  tile: number;
  columns?: number;
  /** localStorage entries set before the page loads. */
  storage: Record<string, string>;
  /** Seconds to wait after the load, before the first picture. */
  wait?: number;
  steps: Step[];
  tokens: boolean;
  name?: string;
};

const USAGE = `Usage: look <url> [--dark|--light] [--size 1440x900] [--storage key=value]
       [--wait S] [--do "click:Run all" [--wait S]]… [--tile 480] [--cols N] [--tokens] [--name n]`;

/** `look`'s arguments, in order: each --wait belongs to the --do before it (or to the load). */
export function parseLook(argv: string[]): LookOptions {
  const o: LookOptions = {
    url: "",
    width: 1440,
    height: 900,
    scale: 1,
    tile: 480,
    storage: {},
    steps: [],
    tokens: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value\n${USAGE}`);
      return v;
    };
    if (arg === "--dark") o.colorScheme = "dark";
    else if (arg === "--light") o.colorScheme = "light";
    else if (arg === "--tokens") o.tokens = true;
    else if (arg === "--size") {
      const [w, h] = value().split("x").map(Number);
      if (!(w > 0 && h > 0)) throw new Error("--size WIDTHxHEIGHT, e.g. 1440x900");
      o.width = w;
      o.height = h;
    } else if (arg === "--scale") o.scale = Number(value());
    else if (arg === "--tile" || arg === "--width") o.tile = Number(value());
    else if (arg === "--cols") o.columns = Number(value());
    else if (arg === "--name") o.name = value();
    else if (arg === "--storage") {
      const [k, ...v] = value().split("=");
      o.storage[k] = v.join("=");
    } else if (arg === "--wait") {
      const s = Number(value());
      const last = o.steps.at(-1);
      if (last) last.wait = (last.wait ?? 0) + s;
      else o.wait = (o.wait ?? 0) + s;
    } else if (arg === "--do") {
      const v = value();
      const colon = v.indexOf(":");
      o.steps.push(
        colon < 0 ? { action: v, arg: "" } : { action: v.slice(0, colon).trim(), arg: v.slice(colon + 1).trim() },
      );
    } else if (arg.startsWith("--")) throw new Error(`Unknown flag ${arg}\n${USAGE}`);
    else if (!o.url) o.url = arg;
  }
  if (!o.url) throw new Error(USAGE);
  return o;
}

/**
 * The element a step names: a Playwright selector (`css=`, `text=`, `role=`,
 * `#id`, `.class`, `[attr]`), else the accessible name of a control, else
 * visible text.
 */
function target(page: Page, name: string): Locator {
  if (/^(css|text|role|xpath|id|data-testid)=|^[#.[]/.test(name)) return page.locator(name).first();
  const roles = [
    "button",
    "menuitem",
    "menuitemradio",
    "menuitemcheckbox",
    "tab",
    "link",
    "option",
    "checkbox",
    "switch",
  ];
  let any: Locator = page.getByRole("button", { name });
  for (const role of roles.slice(1)) any = any.or(page.getByRole(role as "button", { name }));
  return any
    .or(page.getByLabel(name))
    .or(page.getByText(name, { exact: true }))
    .first();
}

async function controls(page: Page) {
  const names = await page
    .getByRole("button")
    .or(page.getByRole("tab"))
    .or(page.getByRole("menuitem"))
    .or(page.getByRole("link"))
    .evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0)
        .map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " "))
        .filter((n) => n && n.length < 40),
    );
  return [...new Set(names)].slice(0, 30);
}

async function perform(page: Page, { action, arg }: Step) {
  const find = async () => {
    const el = target(page, arg);
    try {
      await el.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      throw new Error(`Nothing on the page matches "${arg}". Controls: ${(await controls(page)).join(" · ")}`);
    }
    return el;
  };
  switch (action) {
    case "click":
      return (await find()).click();
    case "dblclick":
      return (await find()).dblclick();
    case "hover":
      return (await find()).hover();
    case "focus":
      return (await find()).focus();
    case "fill": {
      // fill:Label=text
      const eq = arg.indexOf("=");
      if (eq < 0) throw new Error('fill takes "fill:<label>=<text>"');
      const field = target(page, arg.slice(0, eq).trim());
      return field.fill(arg.slice(eq + 1));
    }
    case "type":
      return page.keyboard.type(arg);
    case "press":
      return page.keyboard.press(arg);
    case "scroll":
      return page.mouse.wheel(0, Number(arg) || 0);
    case "goto":
      return page.goto(new URL(arg, page.url()).href, { waitUntil: "networkidle" });
    case "shot":
      return;
    default:
      throw new Error(
        `Unknown action "${action}". Actions: click, dblclick, hover, focus, fill:<label>=<text>, type, press, scroll, goto, shot`,
      );
  }
}

const seconds = (s: number) => `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
const slug = (url: string) => {
  const u = new URL(url);
  return `${u.hostname}${u.port ? `-${u.port}` : ""}${u.pathname}${u.search}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
};

/**
 * Look at the running product without a capture script: open `url`, take a
 * small picture after the load and after each step, and read the page's
 * fonts, colours and radii. Writes one tiled image and a JSON next to it.
 */
export async function look(o: LookOptions) {
  const elapsed = timer();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: o.width, height: o.height },
      deviceScaleFactor: o.scale,
      ...(o.colorScheme ? { colorScheme: o.colorScheme } : {}),
    });
    // tsx compiles with keepNames, so functions passed to page.evaluate call __name().
    await context.addInitScript("globalThis.__name = (f) => f");
    if (Object.keys(o.storage).length > 0)
      await context.addInitScript((entries) => {
        for (const [k, v] of entries) localStorage.setItem(k, v);
      }, Object.entries(o.storage));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(o.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout((o.wait ?? 0.5) * 1000);

    const tiles: { src: string; caption: string }[] = [];
    const shoot = async (caption: string) => {
      const png = await page.screenshot({ animations: "allow" });
      const jpg = await sharp(png).resize(o.tile).jpeg({ quality: 82 }).toBuffer();
      tiles.push({
        src: `data:image/jpeg;base64,${jpg.toString("base64")}`,
        caption: `${tiles.length + 1} · ${caption}`,
      });
    };
    await shoot(o.wait ? `load · +${seconds(o.wait)}` : "load");
    const found: ProductLook = await page.evaluate(readLook, { tokens: true });
    for (const step of o.steps) {
      await perform(page, step);
      await page.waitForTimeout((step.wait ?? 0.6) * 1000);
      await shoot(`${step.action}${step.arg ? ` ${step.arg}` : ""}${step.wait ? ` · +${seconds(step.wait)}` : ""}`);
    }

    const dir = join(root(), "out", "look");
    mkdirSync(dir, { recursive: true });
    const name = o.name ?? slug(o.url);
    const image = await tileImage(browser, tiles, {
      columns: o.columns ?? Math.min(3, tiles.length),
      width: o.tile,
      height: Math.round((o.tile * o.height) / o.width),
    });
    writeFileSync(join(dir, `${name}.png`), image);
    writeFileSync(join(dir, `${name}.json`), `${JSON.stringify({ url: o.url, ...found }, null, 2)}\n`);

    const at = (p: string) => relative(process.cwd(), join(dir, p));
    console.log(`  ${tiles.length} pictures → ${at(`${name}.png`)} · ${elapsed()}`);
    for (const line of describeLook(found, o.tokens)) console.log(`  ${line}`);
    console.log(`  → ${at(`${name}.json`)}`);
    if (errors.length > 0) console.log(`  ${errors.length} page error${errors.length > 1 ? "s" : ""}: ${errors[0]}`);
  } finally {
    await browser.close();
  }
}

/** The look as a few lines for the terminal. */
export function describeLook(l: ProductLook, allTokens = false): string[] {
  const c = l.colors;
  const pairs = (o: Record<string, string | undefined>) =>
    Object.entries(o)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v}`)
      .join("  ");
  const lines = [
    `scheme   ${l.colorScheme}`,
    `fonts    body ${l.fonts.body}`,
    ...(l.fonts.heading !== l.fonts.body ? [`         heading ${l.fonts.heading}`] : []),
    ...(l.fonts.mono ? [`         mono ${l.fonts.mono}`] : []),
    `         @font-face: ${l.fonts.faces.join(", ") || "none (system fonts)"}`,
    `colours  ${pairs({ background: c.background, surface: c.surface, text: c.text, muted: c.muted })}`,
    `         ${pairs({ accent: c.accent ?? "none found", border: c.border })}`,
    `radii    ${l.radii.length ? `${l.radii.join(", ")} px` : "none"}`,
  ];
  const tokens = Object.entries(l.tokens ?? {});
  if (tokens.length > 0) {
    // The tokens a look is made of; the rest are in the JSON (or all with --tokens).
    const wanted =
      /^--(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|radius|font|brand)/;
    const shown = allTokens ? tokens : tokens.filter(([k]) => wanted.test(k)).slice(0, 24);
    lines.push(`tokens   ${tokens.length} on :root${shown.length < tokens.length ? ` (${shown.length} shown)` : ""}`);
    for (const [k, v] of shown) lines.push(`         ${k}: ${v}`);
  }
  return lines;
}
