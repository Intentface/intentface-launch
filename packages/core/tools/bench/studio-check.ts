// Open the studio headless on a video and screenshot it, reporting page errors.
import { chromium } from "playwright";
import { startServer, stopServer } from "../../cli/browser.js";

const [id, out] = process.argv.slice(2);
const { url } = await startServer();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(`${url}/?v=${id}${process.env.BOARD ? "&board" : "#f=560"}`);
await p.waitForTimeout(2500);
await p.screenshot({ path: out });
await b.close();
await stopServer();
