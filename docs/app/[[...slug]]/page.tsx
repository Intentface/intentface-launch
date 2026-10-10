import { LaunchTile } from "@core/studio/launch-mark";
import { ChevronRight } from "@keyline-icons/react";
import { notFound } from "next/navigation";
import { DocsTOC } from "@/components/docs-toc";
import { PageActions } from "@/components/page-actions";
import { MenuButton } from "@/components/site-shell";
import { getPage, getSectionLabel, slugOf, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DocsPage(props: PageProps) {
  const { slug } = await props.params;
  const page = getPage(slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const section = getSectionLabel(page.url);

  return (
    // The panel scrolls, not the window, so the frame stays put around it.
    <div className="h-full w-full overflow-y-auto">
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 isolate flex h-13 shrink-0 items-center justify-between gap-3 px-3">
          {/* Content dissolves under the bar instead of cutting off. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-14 bg-linear-to-b from-secondary-bg via-secondary-bg/80 to-transparent backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,#000_60%,transparent)]" />
          <div className="flex min-w-0 items-center gap-2">
            <MenuButton />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 pl-1 text-sm">
              {section && (
                <>
                  <span className="shrink-0 text-ink-secondary">{section}</span>
                  <ChevronRight className="size-3 shrink-0 text-ink-tertiary" aria-hidden />
                </>
              )}
              <span className="truncate font-medium text-ink-primary">{page.data.title}</span>
            </nav>
          </div>
          <PageActions slug={slugOf(page.url)} source={page.data.source} />
        </header>
        <div className="isolate flex flex-1">
          <div className="flex min-w-0 flex-1 justify-center px-5 pt-7 pb-24 md:px-12">
            <article className="w-full min-w-0 max-w-[680px]">
              <header id="overview" className="mb-7 flex scroll-mt-20 flex-col gap-2.5">
                {/* The introduction opens on the mark, larger, flying in once. */}
                {page.url === "/" && <LaunchTile size={64} animateIn className="mb-4" />}
                <h1 className="font-semibold text-[32px] text-ink-primary leading-[38px] tracking-[-0.02em]">
                  {page.data.title}
                </h1>
                {page.data.description && (
                  <p className="max-w-[600px] text-ink-body text-xl leading-[26px]">{page.data.description}</p>
                )}
              </header>
              <div className="[&>*:first-child]:mt-0 [&>h2:first-child]:border-0 [&>h2:first-child]:pt-0">
                <MDXContent components={getMDXComponents()} />
              </div>
            </article>
          </div>
          <DocsTOC items={page.data.toc} />
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const { slug } = await props.params;
  const page = getPage(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { types: { "text/markdown": `/${slugOf(page.url)}.md` } },
  };
}
