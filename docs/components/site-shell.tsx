"use client";

import { LaunchTile } from "@core/studio/launch-mark";
import { Moon, PanelLeft, Sun } from "@keyline-icons/react";
import { IconBrandGithub } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Structural mirror of fumadocs' page-tree nodes. Only the shapes these docs
// use: pages, separators and one level of folder.
type TreeItem = { type: "page"; name: ReactNode; url: string };
type TreeFolder = { type: "folder"; name: ReactNode; children: TreeNode[] };
type TreeSeparator = { type: "separator"; name?: ReactNode };
type TreeNode = TreeItem | TreeFolder | TreeSeparator;

type NavGroup = { label?: ReactNode; items: TreeItem[] };

// A separator opens a labelled group for the root pages after it; a folder is a
// group of its own.
const toGroups = (nodes: TreeNode[]): NavGroup[] => {
  const groups: NavGroup[] = [];
  let open: NavGroup | null = null;

  for (const node of nodes) {
    if (node.type === "separator") {
      open = { label: node.name, items: [] };
      groups.push(open);
    } else if (node.type === "folder") {
      groups.push({
        label: node.name,
        items: node.children.filter((child): child is TreeItem => child.type === "page"),
      });
      open = null;
    } else {
      if (!open) {
        open = { items: [] };
        groups.push(open);
      }
      open.items.push(node);
    }
  }

  return groups;
};

const MenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

/**
 * The whole site: a sidebar of pages beside one inset card that scrolls. Below
 * `md` the sidebar becomes a sheet that the top bar's button opens. Unlike
 * intentface-chat's shell there is no collapse or hover hotspot: the docs are
 * one view, so the sidebar always shows on wide screens.
 */
export const SiteShell = ({
  tree,
  version,
  children,
}: {
  tree: { children: TreeNode[] };
  version: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A page change closes the mobile sheet.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <MenuContext.Provider value={{ open, setOpen }}>
      <div className="flex min-h-svh w-full bg-base-bg">
        <div className="hidden w-(--sidebar-width) shrink-0 md:block" />
        {open && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-(--sidebar-width) flex-col gap-4 bg-base-bg pt-2 pr-1 pb-3 pl-3",
            "transition-transform duration-150 ease-out motion-reduce:transition-none md:translate-x-0",
            open ? "translate-x-0 shadow-overlay" : "-translate-x-full",
          )}
        >
          {/* Centred on the viewport's top bar: both start 8px down, and the bar
              (52px) sits under the viewport's 1px edge, hence 54px. */}
          <div className="-mb-2 flex h-[54px] shrink-0 items-center pl-1">
            <Link href="/" className="flex items-center gap-2.5 text-ink-primary">
              <LaunchTile size={24} />
              <span className="font-semibold text-md tracking-[-0.01em]">intentface/launch</span>
            </Link>
          </div>
          <DocsNav groups={toGroups(tree.children)} />
          <div className="flex items-center justify-between border-ink-primary/8 border-t pt-2 pr-1 pl-0.5">
            <a
              href="https://www.npmjs.com/package/@intentface-launch/core"
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center rounded-md px-1.5 font-mono text-ink-secondary text-xs transition-colors hover:bg-ink-primary/5 hover:text-ink-primary"
            >
              v{version}
            </a>
            <div className="flex items-center gap-0.5">
              <a
                href="/llms.txt"
                className="flex h-7 items-center rounded-md px-1.5 font-mono text-ink-secondary text-xs transition-colors hover:bg-ink-primary/5 hover:text-ink-primary"
              >
                llms.txt
              </a>
              <a
                href="https://github.com/Intentface/intentface-launch"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className={iconButton}
              >
                <IconBrandGithub />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <main className="flex h-dvh min-w-0 flex-1 flex-col md:p-2 md:pl-0">
          <div className="relative flex h-full min-h-0 flex-1 overflow-clip bg-secondary-bg md:rounded-xl md:shadow-card dark:md:border dark:md:border-white/6 dark:md:border-t-white/11">
            {children}
          </div>
        </main>
      </div>
    </MenuContext.Provider>
  );
};

export const iconButton =
  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-ink-secondary transition-colors hover:bg-ink-primary/5 hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent-bg/60 [&>svg]:size-3.5";

const DocsNav = ({ groups }: { groups: NavGroup[] }) => {
  const pathname = usePathname();

  return (
    <nav className="scroll-mask-y -mx-1 flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-1 pb-1">
      {groups.map((group, index) => (
        <div key={typeof group.label === "string" ? group.label : index} className="flex flex-col">
          {group.label && (
            <div className="flex h-7 items-center px-2 font-medium text-ink-secondary text-xs">{group.label}</div>
          )}
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => (
              <li key={item.url}>
                <Link
                  href={item.url}
                  data-active={pathname === item.url ? "" : undefined}
                  aria-current={pathname === item.url ? "page" : undefined}
                  className={cn(
                    "flex h-[30px] w-full items-center gap-2 overflow-hidden rounded-md px-2 font-medium text-ink-body text-sm/none",
                    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:-outline-offset-2",
                    // Hover is a faint wash; the active row rises like a button.
                    "hover:bg-ink-primary/5 hover:text-ink-primary",
                    "data-active:bg-raised-selected data-active:text-ink-primary data-active:shadow-raised",
                  )}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};

/** Flips whichever mode is showing, so the first press always changes it. */
const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={iconButton}
    >
      <Moon className="hidden dark:block" />
      <Sun className="dark:hidden" />
    </button>
  );
};

/** Opens the sidebar sheet on narrow screens; hidden where the sidebar shows. */
export const MenuButton = () => {
  const { setOpen } = useContext(MenuContext);

  return (
    <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className={cn(iconButton, "md:hidden")}>
      <PanelLeft />
    </button>
  );
};
