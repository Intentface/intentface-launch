// List the pill elements after a search, to pick selectors.
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
await p.goto("http://localhost:3210/", { waitUntil: "networkidle" });
await p.getByLabel("Search events").fill("AI events in Helsinki");
await p.keyboard.press("Enter");
await p.waitForTimeout(4000);
console.log(
  await p.evaluate(() =>
    [...document.querySelectorAll("[id^=pill], .pill-in")]
      .map((e) => `${e.tagName} #${e.id} .${e.className.toString().slice(0, 40)} "${e.textContent}"`)
      .join("\n"),
  ),
);
await b.close();
