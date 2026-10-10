"use client";

import { Check, Copy } from "@keyline-icons/react";
import type { ReactNode } from "react";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

/**
 * The dark code chrome shared by every block in the docs: a header of file (or
 * package-manager) tabs with a copy button, over an inset code panel. Dark in
 * both themes, tinted by the theme's seeds (see --code-bg in globals.css).
 */
export const CodeFrame = ({
  tabs,
  code,
  className,
  children,
}: {
  tabs: ReactNode;
  /** What the copy button copies. */
  code: string;
  className?: string;
  children: ReactNode;
}) => (
  <div
    data-code-block=""
    className={cn("not-prose flex flex-col rounded-xl bg-code-bg px-[5px] pb-[5px] shadow-code", className)}
  >
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 pr-0.5 pl-[11px]">
      <div className="flex h-full min-w-0 items-center gap-4 overflow-x-auto">{tabs}</div>
      <CodeCopyButton code={code} />
    </div>
    <div className="overflow-hidden rounded-md bg-code-panel shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
      {children}
    </div>
  </div>
);

/** A header tab. Without `onClick` it is a plain label (a single file's name). */
export const CodeTab = ({
  active = true,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) => {
  const className = cn(
    "flex h-full shrink-0 items-center font-medium font-mono text-xs transition-colors",
    active ? "text-white/92 shadow-[inset_0_-1px_0_rgb(255_255_255/0.92)]" : "text-white/50 hover:text-white/80",
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(className, "cursor-pointer outline-none focus-visible:text-white")}
    >
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
};

const CodeCopyButton = ({ code }: { code: string }) => {
  const { copy, copied } = useCopy();
  const isCopied = copied === code;

  return (
    <button
      type="button"
      onClick={() => copy(code)}
      aria-label={isCopied ? "Copied" : "Copy code"}
      className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/56 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-white/60"
    >
      {isCopied ? <Check className="size-[15px]" /> : <Copy className="size-[15px]" />}
    </button>
  );
};
