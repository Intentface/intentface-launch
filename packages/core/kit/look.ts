/**
 * A product's look as the browser drew it: the font stacks its text uses and
 * the colours and radii that cover the screen. Read from the live page by
 * `capture` (each snapshot's look goes in the manifest) and by `look`.
 */
export type ProductLook = {
  colorScheme: "light" | "dark";
  /** Computed `font-family` stacks, ready for CSS. */
  fonts: {
    /** The face most of the text is set in. */
    body: string;
    /** Headings (h1 to h3), else the largest text. */
    heading: string;
    /** Code, numbers in tables, anything set in a monospace stack. */
    mono?: string;
    /** Families the page declares with @font-face (its own files). */
    faces: string[];
  };
  /** Hex colours (#rrggbb, or #rrggbbaa when translucent). */
  colors: {
    /** What covers most of the viewport. */
    background: string;
    /** The next most common opaque surface (cards, sidebars, headers). */
    surface?: string;
    /** The colour most text is in. */
    text: string;
    /** The second text colour, quieter than `text`. */
    muted?: string;
    /** The most used saturated colour on buttons, links, tabs and focus. */
    accent?: string;
    border?: string;
  };
  /** Corner radii in CSS pixels, most used first (pills and circles left out). */
  radii: number[];
  /** Custom properties declared on :root, html or a theme class (`--background`, `--radius`…). */
  tokens?: Record<string, string>;
};

/**
 * Read the look of the document it runs in. Self-contained: it is passed to
 * `page.evaluate`, so it must not reference anything outside its body.
 */
export function readLook(options?: { tokens?: boolean }): ProductLook {
  const view = document.defaultView as Window;
  const W = view.innerWidth;
  const H = view.innerHeight;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  const parsed = new Map<string, [number, number, number, number]>();
  // Any CSS colour (oklch, color-mix, named) to sRGB bytes, by painting a pixel.
  const rgba = (css: string): [number, number, number, number] => {
    const hit = parsed.get(css);
    if (hit) return hit;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out: [number, number, number, number] = [r, g, b, a / 255];
    parsed.set(css, out);
    return out;
  };
  const hex = ([r, g, b, a]: [number, number, number, number]) =>
    `#${[r, g, b, ...(a < 0.99 ? [Math.round(a * 255)] : [])].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  const lum = ([r, g, b]: number[]) => {
    const c = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
  };
  const saturation = ([r, g, b]: number[]) => {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  };
  const tally = <K>(m: Map<K, number>, k: K, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  const ranked = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) return null;
    const s = view.getComputedStyle(el);
    if (s.visibility !== "visible" || s.display === "none" || Number(s.opacity) < 0.05) return null;
    return { r, s };
  };

  // Backgrounds: sample a grid and walk up to the first opaque fill under each point.
  const fills = new Map<string, number>();
  for (let gy = 0; gy < 10; gy++)
    for (let gx = 0; gx < 16; gx++) {
      let el = document.elementFromPoint(((gx + 0.5) * W) / 16, ((gy + 0.5) * H) / 10);
      while (el) {
        const c = rgba(view.getComputedStyle(el).backgroundColor);
        if (c[3] > 0.6) {
          tally(fills, hex([c[0], c[1], c[2], 1]), 1);
          break;
        }
        el = el.parentElement;
      }
      if (!el) {
        for (const root of [document.body, document.documentElement]) {
          const c = rgba(view.getComputedStyle(root).backgroundColor);
          if (c[3] > 0.6) {
            tally(fills, hex([c[0], c[1], c[2], 1]), 1);
            break;
          }
        }
      }
    }
  const surfaces = ranked(fills);
  const background = surfaces[0] ?? (view.matchMedia("(prefers-color-scheme: dark)").matches ? "#000000" : "#ffffff");
  const bgRgb = rgba(background);
  const scheme = lum(bgRgb) < 0.2 ? "dark" : "light";
  const surface = surfaces.find((c, i) => i > 0 && (fills.get(c) ?? 0) >= 4);

  const texts = new Map<string, number>();
  const families = new Map<string, number>();
  const monos = new Map<string, number>();
  const borders = new Map<string, number>();
  const radii = new Map<number, number>();
  const accents = new Map<string, number>();
  let largest = { size: 0, family: "" };
  const interactive = "button, a, [role=tab], [role=switch], [role=checkbox], [role=menuitem], input, select";
  const all = document.body.querySelectorAll("*");
  for (let i = 0; i < all.length && i < 8000; i++) {
    const el = all[i];
    const v = visible(el);
    if (!v) continue;
    const { r, s } = v;
    let chars = 0;
    for (const node of el.childNodes) if (node.nodeType === 3) chars += (node.textContent ?? "").trim().length;
    if (chars > 0) {
      const c = rgba(s.color);
      tally(texts, hex(c), chars);
      const mono = /mono|courier|consolas|menlo/i.test(s.fontFamily);
      tally(mono ? monos : families, s.fontFamily, chars);
      const size = Number.parseFloat(s.fontSize);
      if (size > largest.size && !mono) largest = { size, family: s.fontFamily };
    }
    const area = Math.min(r.width, W) * Math.min(r.height, H);
    const bg = rgba(s.backgroundColor);
    const bordered = Number.parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none";
    if (bordered) {
      const b = rgba(s.borderTopColor);
      if (b[3] > 0.05) tally(borders, hex(b), r.width + r.height);
    }
    if (bg[3] > 0.05 || bordered) {
      const radius = Number.parseFloat(s.borderTopLeftRadius);
      if (radius > 0 && radius < Math.min(r.width, r.height) / 2 - 0.5) tally(radii, Math.round(radius * 2) / 2, 1);
    }
    if (el.matches(interactive) || el.closest(interactive)) {
      for (const c of [bg, rgba(s.color), rgba(s.outlineColor)]) {
        if (c[3] < 0.5 || saturation(c) < 0.35) continue;
        const l = lum(c);
        if (l < 0.02 || l > 0.9) continue;
        tally(accents, hex([c[0], c[1], c[2], 1]), c === bg ? Math.sqrt(area) : 4);
      }
    }
  }
  const contrast = (c: string) => {
    const a = lum(rgba(c));
    const b = lum(bgRgb);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  // `text` is the strongest of the common text colours, `muted` the most used quieter one.
  const textRanked = ranked(texts);
  const common = textRanked.filter((c) => (texts.get(c) ?? 0) >= 0.15 * (texts.get(textRanked[0]) ?? 0));
  const text = common.sort((a, b) => contrast(b) - contrast(a))[0] ?? (scheme === "dark" ? "#ffffff" : "#000000");
  const muted = textRanked.find((c) => c !== text && contrast(c) < contrast(text) && contrast(c) > 1.5);
  const body = ranked(families)[0] ?? view.getComputedStyle(document.body).fontFamily;
  const headingEl = [...document.querySelectorAll("h1, h2, h3")].find((h) => visible(h));
  const heading = headingEl ? view.getComputedStyle(headingEl).fontFamily : largest.family || body;
  const faces = new Set<string>();
  for (const face of document.fonts) faces.add(face.family.replace(/^["']|["']$/g, ""));

  let tokens: Record<string, string> | undefined;
  if (options?.tokens) {
    tokens = {};
    const names = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && /^(:root|html|\.dark|\.light|\[data-theme[^\]]*\])/.test(rule.selectorText))
          for (const prop of rule.style) if (prop.startsWith("--") && !prop.startsWith("--tw-")) names.add(prop);
        if ("cssRules" in rule && !(rule instanceof CSSStyleRule)) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        // Cross-origin sheet.
      }
    }
    const rootStyle = view.getComputedStyle(document.documentElement);
    for (const name of names) {
      const value = rootStyle.getPropertyValue(name).trim();
      if (value) tokens[name] = value;
    }
  }

  return {
    colorScheme: scheme,
    fonts: { body, heading, mono: ranked(monos)[0], faces: [...faces].sort() },
    colors: {
      background,
      surface,
      text,
      muted,
      accent: ranked(accents)[0],
      border: ranked(borders)[0],
    },
    radii: ranked(radii).slice(0, 4),
    ...(tokens ? { tokens } : {}),
  };
}
