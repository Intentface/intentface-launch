import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { loader, type Page } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import { docs } from "@/.source/server";

export const REPO = "https://github.com/Intentface/intentface-launch";
// The deployed origin, for absolute links in llms.txt. Unset, links are relative.
export const SITE = process.env.DOCS_URL?.replace(/\/$/, "") ?? "";

/** The share image (public/og.png, 1200×630, made from the dark Launch tile), on every page. */
export const SHARE = {
  openGraph: {
    siteName: "Intentface Launch",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "Intentface Launch: product launch videos written as code" },
    ],
  },
  twitter: { card: "summary_large_image" as const, images: ["/og.png"] },
};

export const source = loader(docs.toFumadocsSource(), { baseUrl: "/" });

// fumadocs-core's `loader` collapses the page data generic to its base type, so
// the runtime shape (frontmatter plus the compiled MDX) is retyped here once.
export type DocPageData = {
  title: string;
  description?: string;
  /** A path in this repo the page documents, linked as "View source". */
  source?: string;
  body: MDXContent;
  toc: TOCItemType[];
  structuredData: StructuredData;
};

export type DocPage = Page<undefined, DocPageData>;

export const getPage = (slug: string[] | undefined): DocPage | undefined => source.getPage(slug) as DocPage | undefined;

/** "/" is "index"; "/guides/capture" is "guides/capture". */
export const slugOf = (url: string) => url.replace(/^\//, "") || "index";

/**
 * A page as an agent reads it: the title and description as a heading and a
 * lead, then the file's markdown without its frontmatter. Pages are plain
 * markdown (see docs/CLAUDE.md), so nothing else needs expanding.
 */
export const readMarkdown = async (slug: string): Promise<string | null> => {
  const page = getPage(slug === "index" ? [] : slug.split("/"));
  if (!page) return null;
  const raw = await readFile(path.join(process.cwd(), "content", "docs", page.path), "utf8");
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  const lead = page.data.description ? `\n\n${page.data.description}` : "";
  return `# ${page.data.title}${lead}\n\n${body}\n`;
};

/**
 * The sidebar group a page sits in: its folder, or the separator above it for
 * root pages. The breadcrumb's first segment.
 */
export const getSectionLabel = (url: string): string | undefined => {
  let separator: string | undefined;

  for (const node of source.pageTree.children) {
    switch (node.type) {
      case "separator":
        separator = typeof node.name === "string" ? node.name : undefined;
        break;
      case "folder":
        if (node.children.some((child) => child.type === "page" && child.url === url)) {
          return typeof node.name === "string" ? node.name : undefined;
        }
        break;
      case "page":
        if (node.url === url) return separator;
        break;
    }
  }

  return undefined;
};

/** Every page in sidebar order, grouped as the sidebar groups them. */
export const getSections = (): { title?: string; pages: DocPage[] }[] => {
  const sections: { title?: string; pages: DocPage[] }[] = [];
  let open: { title?: string; pages: DocPage[] } | null = null;
  const pageAt = (url: string) => getPage(slugOf(url) === "index" ? [] : slugOf(url).split("/"));

  for (const node of source.pageTree.children) {
    if (node.type === "separator") {
      open = { title: typeof node.name === "string" ? node.name : undefined, pages: [] };
      sections.push(open);
    } else if (node.type === "folder") {
      const pages = node.children.flatMap((child) => (child.type === "page" ? (pageAt(child.url) ?? []) : []));
      sections.push({ title: typeof node.name === "string" ? node.name : undefined, pages });
      open = null;
    } else {
      if (!open) {
        open = { pages: [] };
        sections.push(open);
      }
      const page = pageAt(node.url);
      if (page) open.pages.push(page);
    }
  }

  return sections;
};
