// One-off: screenshot a local HTML page for a visual check.
import { chromium } from "playwright";

const [file, out, width = "1280"] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 } });
await p.goto(`file://${file}`);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: false, clip: { x: 0, y: 0, width: Number(width), height: 1900 } });
await b.close();
