import { getSections, readMarkdown, slugOf } from "@/lib/source";

// Every page in sidebar order, in one file, for an agent that wants it all.
export async function GET() {
  const pages = getSections().flatMap((section) => section.pages);
  const texts = await Promise.all(pages.map((page) => readMarkdown(slugOf(page.url))));

  return new Response(`${texts.filter(Boolean).join("\n---\n\n")}`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const dynamic = "force-static";
