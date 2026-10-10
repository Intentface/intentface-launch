// How capture throughput scales: N pages in one browser vs N browsers.
import { launchBrowser, openRenderer, startServer, stopServer } from "../../cli/browser.js";

const { url } = await startServer();
async function run(workers: number, separate: boolean) {
  const shared = separate ? null : await launchBrowser();
  const browsers = await Promise.all(Array.from({ length: workers }, async () => shared ?? (await launchBrowser())));
  const renderers = await Promise.all(browsers.map((b) => openRenderer(b, url, "motion-gallery", 1)));
  const start = performance.now();
  const per = 12;
  await Promise.all(
    renderers.map(async (r, w) => {
      for (let i = 0; i < per; i++) {
        await r.seek(40 + w * per + i);
        await r.shoot("png");
      }
    }),
  );
  const s = (performance.now() - start) / 1000;
  console.log(`${workers} ${separate ? "browsers" : "pages"}: ${((workers * per) / s).toFixed(1)} frames/s`);
  await Promise.all([...new Set(browsers)].map((b) => b.close()));
}
for (const n of [1, 3, 6]) {
  await run(n, false);
  await run(n, true);
}
await stopServer();
