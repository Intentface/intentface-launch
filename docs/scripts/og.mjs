// Renders the docs' share image, public/og.png (1200×630), from the dark Launch
// tile (.github/icon.svg, on black, its ring a faint gradient) in Intent Sans (OFL, in
// fonts/) and Studio Mono.
// Run from the repo root after the mark changes: node docs/scripts/og.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const at = (path) => new URL(`../../${path}`, import.meta.url);
const font = (path) => readFileSync(at(path)).toString("base64");
const icon = readFileSync(at(".github/icon.svg"), "utf8")
  .replace(
    /<rect[^>]*class="r"[^>]*\/>/,
    '<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#FE9EFF" stop-opacity=".2"/></linearGradient><rect x="23.68" y="16.78" width="527.64" height="527.64" rx="141.1" fill="none" stroke="url(#edge)" stroke-width="6"/>',
  )
  .replace(".t{fill:#18181b}", ".t{fill:#000}");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Intent;src:url(data:font/woff2;base64,${font("docs/scripts/fonts/IntentSans-VF.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${font("packages/core/studio/fonts/IoskeleyMono-Regular.woff2")}) format("woff2")}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#0e0e10;color:#fafafa;font-family:Intent;position:relative}
.tile{position:absolute;left:108px;top:195px;width:240px;height:240px;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))}
.tile svg{width:100%;height:100%}
.text{position:absolute;left:454px;top:0;bottom:0;right:80px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:Mono;font-size:22px;letter-spacing:.02em;color:#a1a1aa;margin-bottom:22px}
h1{margin:0;font-size:84px;line-height:1;font-weight:480;letter-spacing:-.02em}
p{margin:28px 0 0;font-size:31px;line-height:1.3;color:#d4d4d8;font-weight:430;letter-spacing:-.01em;max-width:640px}
.cmd{margin-top:38px;font-family:Mono;font-size:22px;color:#e4e4e7;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 18px;align-self:flex-start}
.cmd b{color:#71717a;font-weight:400}
</style></head><body><div class="tile">${icon}</div>
<div class="text"><div class="eyebrow">launch.intentface.com</div>
<h1>Intentface<br>Launch</h1>
<p>Product launch videos written as code,<br>made with an agent.</p>
<div class="cmd"><b>$</b> npx @intentface-launch/core init</div></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../public/og.png", import.meta.url).pathname });
await browser.close();
