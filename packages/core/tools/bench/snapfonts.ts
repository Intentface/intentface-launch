// Inspect font loading inside a Snapshot iframe on the render page.
import { launchBrowser, openRenderer, startServer, stopServer } from "../../cli/browser.js";

const { url } = await startServer();
const b = await launchBrowser();
const r = await openRenderer(b, url, "_snaptest", 1);
await r.seek(5);
console.log(
  await r.page.evaluate(() => {
    const d = document.querySelector("iframe")?.contentDocument;
    if (!d) return "no iframe";
    const url = d.URL;
    const faces = [...d.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
    const p = d.querySelector("aside p");
    const cs = p ? getComputedStyle(p) : null;
    return JSON.stringify(
      {
        url,
        faces,
        family: cs?.fontFamily,
        htmlClass: d.documentElement.className,
        v: getComputedStyle(d.documentElement).getPropertyValue("--font-intent-sans"),
      },
      null,
      1,
    );
  }),
);
console.log(
  await r.page.evaluate(async () => {
    const d = document.querySelector("iframe")?.contentDocument;
    const face = [...(d?.fonts ?? [])][0];
    try {
      await face?.load();
      return `loaded: ${face?.status}`;
    } catch (e) {
      return `error: ${e}`;
    }
  }),
);
await b.close();
await stopServer();
