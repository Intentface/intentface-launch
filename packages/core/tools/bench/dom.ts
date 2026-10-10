// Print a compact outline of a page region, to find selectors for capture scripts.
import { chromium } from "playwright";

const [url, query] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await p.addInitScript("globalThis.__name = (f) => f");
await p.goto(url, { waitUntil: "networkidle" });
await p.getByLabel("Search events").fill(query);
await p.keyboard.press("Enter");
await p.waitForTimeout(3000);
const out = await p.evaluate(() => {
  const lines: string[] = [];
  const walk = (el: Element, depth: number) => {
    if (depth > 9 || lines.length > 160) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const cls = (el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".");
    const aria = el.getAttribute("aria-label");
    const text = el.children.length === 0 ? (el.textContent ?? "").trim().slice(0, 40) : "";
    lines.push(
      `${"  ".repeat(depth)}${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${aria ? ` [${aria}]` : ""} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${text}`,
    );
    for (const c of el.children) walk(c, depth + 1);
  };
  const panel =
    document.querySelector("form") ??
    document.querySelector('[aria-label="Search events"]')?.closest("div")?.parentElement?.parentElement ??
    document.body;
  walk(panel, 0);
  return lines.join("\n");
});
console.log(out);
await b.close();
