import { highlight } from "fumadocs-core/highlight";
import type { ReactNode } from "react";
import { codeTheme } from "@/lib/code-theme";
import { cn } from "@/lib/utils";
import { CodeFrame, CodeTab } from "./code-frame";

type CodeBlockProps = {
  code: string;
  lang?: string;
  /** The tab label, usually a file path. Falls back to the language. */
  title?: ReactNode;
  className?: string;
};

/** Server-side shiki highlight into a bare <pre>, for any code chrome to wrap. */
export const highlightCode = (code: string, lang = "tsx") =>
  highlight(code, {
    lang,
    theme: codeTheme,
    components: {
      pre: ({ className, ...props }) => (
        <pre
          // Multi-line blocks get a line-number gutter (see globals.css).
          data-line-numbers={code.includes("\n") ? "" : undefined}
          className={cn(
            "scroll-mask-x overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-[22px] [scrollbar-width:thin] data-line-numbers:pl-0",
            className,
          )}
          {...props}
        />
      ),
    },
  });

export const CodeBlock = async ({ code, lang = "tsx", title, className }: CodeBlockProps) => (
  <CodeFrame tabs={<CodeTab active={Boolean(title)}>{title ?? lang}</CodeTab>} code={code} className={className}>
    {await highlightCode(code, lang)}
  </CodeFrame>
);
