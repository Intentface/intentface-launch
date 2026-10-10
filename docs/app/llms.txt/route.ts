import { getSections, SITE, slugOf } from "@/lib/source";

// The index agents read first (llmstxt.org): what this is, how to fetch a page,
// then every page in sidebar order with a one-line summary.
const SUMMARY = [
  "# Intentface Launch",
  "",
  "> Product launch videos written as code: React scenes rendered frame by frame in headless Chromium and encoded with ffmpeg, made together with an agent.",
  "",
  "Every page below is markdown: append `.md` to any docs URL for the same content. `/llms-full.txt` is every page in one file.",
  "In a product repo, `launch/CLAUDE.md` and the skills in `.claude/skills/` are the working guide; these docs explain the system around them.",
].join("\n");

export function GET() {
  const sections = getSections().map((section) => {
    const lines = section.pages.map((page) => {
      const description = page.data.description ? `: ${page.data.description}` : "";
      return `- [${page.data.title}](${SITE}/${slugOf(page.url)}.md)${description}`;
    });
    return [`## ${section.title ?? "Docs"}`, "", ...lines].join("\n");
  });

  return new Response(`${[SUMMARY, ...sections].join("\n\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const dynamic = "force-static";
