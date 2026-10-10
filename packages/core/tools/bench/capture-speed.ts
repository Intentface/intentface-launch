import { launchBrowser, openRenderer, startServer, stopServer } from "../../cli/browser.js";

const { url } = await startServer();
const b = await launchBrowser();
const r = await openRenderer(b, url, "motion-gallery", 1);
const t = (l: string, n: number, s: number) => console.log(l, ((performance.now() - s) / n).toFixed(1), "ms");
let s = performance.now();
for (let i = 0; i < 20; i++) await r.seek(40 + i);
t("seek", 20, s);
for (const f of ["png", "jpeg"] as const) {
  s = performance.now();
  for (let i = 0; i < 10; i++) await r.shoot(f, 95);
  t(f, 10, s);
}
const cdp = await r.page.context().newCDPSession(r.page);
s = performance.now();
for (let i = 0; i < 10; i++) await cdp.send("Page.captureScreenshot", { format: "webp", quality: 100 } as never);
t("webp100", 10, s);
s = performance.now();
for (let i = 0; i < 10; i++) await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
t("png-fast", 10, s);
await b.close();
await stopServer();
