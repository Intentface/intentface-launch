import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { type ComponentProps, isValidElement, type ReactNode } from "react";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

// Slugify heading text into an id so the TOC anchors resolve. Mirrors the
// slugs fumadocs generates for the toc entries.
const slug = (children: ReactNode): string | undefined => {
  if (typeof children !== "string") return undefined;
  return children
    .toLowerCase()
    .replace(/[^\da-z]+/g, "-")
    .replace(/^-|-$/g, "");
};

const youtubeId = (href: unknown): string | undefined => {
  if (typeof href !== "string") return undefined;
  return (
    href.match(/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/)?.[1] ??
    href.match(/^https:\/\/youtu\.be\/([\w-]{11})/)?.[1]
  );
};

// A paragraph that is only a YouTube link plays the video in place, captioned
// with the link's text. The markdown agents read keeps the plain link.
const Video = ({ id, title }: { id: string; title: ReactNode }) => (
  <figure className="my-6">
    <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-card">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        title={typeof title === "string" ? title : "Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
        className="size-full"
      />
    </div>
    <figcaption className="mt-2.5 text-ink-secondary text-sm">{title}</figcaption>
  </figure>
);

const heading =
  (Tag: "h2" | "h3" | "h4", className: string) =>
  ({ children, ...props }: ComponentProps<"h2">) => (
    <Tag id={slug(children)} className={cn("scroll-mt-20", className)} {...props}>
      {children}
    </Tag>
  );

const proseComponents: MDXComponents = {
  h1: (props) => (
    <h1 className="font-semibold text-[32px] text-ink-primary leading-[38px] tracking-[-0.02em]" {...props} />
  ),
  // Every section opens on a hairline rule, like the Paper sheets.
  h2: heading(
    "h2",
    "mt-12 mb-3.5 border-ink-primary/6 border-t pt-8 font-semibold text-[20px] text-ink-primary leading-7 tracking-[-0.01em]",
  ),
  h3: heading("h3", "mt-8 mb-2 font-semibold text-ink-primary text-xl tracking-[-0.01em]"),
  h4: heading("h4", "mt-6 mb-2 font-semibold text-ink-primary text-lg"),
  p: ({ children, ...props }: ComponentProps<"p">) => {
    if (isValidElement<{ href?: string; children?: ReactNode }>(children)) {
      const id = youtubeId(children.props.href);
      if (id) return <Video id={id} title={children.props.children} />;
    }
    return (
      <p className="my-4 text-ink-body text-lg leading-6" {...props}>
        {children}
      </p>
    );
  },
  ul: (props) => (
    <ul
      className="my-4 ml-5 flex list-disc flex-col gap-1.5 text-ink-body text-lg marker:text-ink-tertiary"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="my-4 ml-5 flex list-decimal flex-col gap-1.5 text-ink-body text-lg marker:text-ink-tertiary"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1 text-lg leading-6" {...props} />,
  strong: (props) => <strong className="font-semibold text-ink-primary" {...props} />,
  b: (props) => <b className="font-semibold text-ink-primary" {...props} />,
  a: ({ href, ...props }: ComponentProps<"a">) => (
    <Link
      href={href ?? "#"}
      // A link that is only a code badge (a commit hash) drops the underline; the
      // badge darkens on hover instead.
      className="font-medium text-accent-bg underline decoration-accent-bg/30 underline-offset-4 transition-colors hover:decoration-accent-bg has-[>code]:no-underline [&>code]:transition-colors hover:[&>code]:bg-ink-primary/10"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote className="my-5 border-ink-primary/10 border-l-2 pl-4 text-ink-body [&>p]:my-2" {...props} />
  ),
  hr: (props) => <hr className="my-10 border-ink-primary/6" {...props} />,
  // The ReferenceTable frame in one table: the header sits in the tray and the
  // rows form the inset panel, its edge and corners drawn by the outer cells.
  table: (props) => (
    <div className="my-6 overflow-x-auto rounded-xl bg-table-tray p-[5px] shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="h-[31px] px-4 pb-[5px] text-left align-middle font-medium text-ink-secondary text-xs" {...props} />
  ),
  td: (props) => (
    <td
      className={cn(
        "bg-table-panel px-4 py-3 align-top text-ink-body [&>code]:whitespace-nowrap",
        "border-black/6 first:border-l last:border-r dark:border-white/7",
        "[tr:first-child>&]:border-t [tr:last-child>&]:border-b",
        "[tr+tr>&]:border-t [tr+tr>&]:border-t-ink-primary/6",
        "[tr:first-child>&:first-child]:rounded-tl-md [tr:first-child>&:last-child]:rounded-tr-md",
        "[tr:last-child>&:first-child]:rounded-bl-md [tr:last-child>&:last-child]:rounded-br-md",
      )}
      {...props}
    />
  ),
  // Inline code; fenced blocks arrive as <pre><code> and are handled by `pre`.
  code: (props) => (
    <code className="rounded-[4px] bg-ink-primary/6 px-1.5 py-px font-mono text-[0.85em] text-ink-primary" {...props} />
  ),
  pre: async ({ children }: ComponentProps<"pre">) => {
    // Built-in rehype highlighting is disabled (source.config.ts), so the code
    // element carries the raw source as its children — a string, or an array of
    // strings when MDX splits it. Flatten to a single string for CodeBlock.
    const child = children as { props?: { children?: unknown; className?: string } } | undefined;
    const rawChildren = child?.props?.children;
    const code = (Array.isArray(rawChildren) ? rawChildren.join("") : (rawChildren ?? ""))
      .toString()
      .replace(/\n$/, "");
    const lang = child?.props?.className?.replace(/^language-/, "") ?? "tsx";
    return <CodeBlock code={code} lang={lang} className="my-4" />;
  },
};

export const getMDXComponents = (components?: MDXComponents): MDXComponents => ({
  ...proseComponents,
  ...components,
});
