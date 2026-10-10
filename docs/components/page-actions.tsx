"use client";

import { Check } from "@keyline-icons/react";
import { IconBrandGithub, IconMarkdown } from "@tabler/icons-react";
import { useCopy } from "@/hooks/use-copy";
import { iconButton } from "./site-shell";

const REPO = "https://github.com/Intentface/intentface-launch";

// "Copy page" puts the page's markdown on the clipboard (the same text the
// `.md` route serves), for pasting into an agent. The GitHub link goes to the
// code the page documents when it names one, and to the repo otherwise.
export const PageActions = ({ slug, source }: { slug: string; source?: string }) => {
  const { copy, isCopied } = useCopy();

  const copyPage = async () => {
    const response = await fetch(`/${slug}.md`);
    if (response.ok) await copy(await response.text());
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={copyPage}
        className="inline-flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full bg-raised pr-2.5 pl-2 font-medium text-ink-primary text-sm shadow-raised transition-[color,background-color,box-shadow,scale] hover:bg-raised-hover focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2 active:scale-[0.98] [&_svg]:size-3.5"
      >
        {isCopied ? <Check /> : <IconMarkdown />}
        {isCopied ? "Copied" : "Copy page"}
      </button>
      <a
        href={source ? `${REPO}/tree/main/${source}` : REPO}
        target="_blank"
        rel="noreferrer"
        aria-label={source ? "Source on GitHub" : "GitHub repository"}
        className={iconButton}
      >
        <IconBrandGithub />
      </a>
    </div>
  );
};
