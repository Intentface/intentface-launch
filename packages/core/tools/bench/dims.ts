// What size does a CDP screenshot come back at for a given device scale?
import sharp from "sharp";
import { launchBrowser, openRenderer, startServer, stopServer } from "../../cli/browser.js";

const { url } = await startServer();
const b = await launchBrowser();
for (const scale of [0.5, 2 / 3, 1]) {
  const r = await openRenderer(b, url, "motion-gallery", scale);
  await r.seek(10);
  for (const f of ["jpeg", "png"] as const) {
    const m = await sharp(await r.shoot(f)).metadata();
    console.log(scale.toFixed(2), f, m.width, m.height, m.channels);
  }
  await r.close();
}
await b.close();
await stopServer();
