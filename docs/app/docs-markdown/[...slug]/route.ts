import { readMarkdown, slugOf, source } from "@/lib/source";

// Serves a page as markdown, reached by appending `.md` to its URL (see the
// rewrite in next.config.ts). "Copy page" fetches the same text.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const markdown = await readMarkdown(slug.join("/"));
  if (!markdown) return new Response("Not found", { status: 404 });
  return new Response(markdown, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}

export const dynamic = "force-static";

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: slugOf(page.url).split("/") }));
}
