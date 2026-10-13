# Docs

The documentation site for Intentface Launch: Next.js + Fumadocs, styled with intentface-chat's token system (`app/globals.css`). Pages are in `content/docs/`.

```sh
pnpm --filter @intentface-launch/docs dev     # http://localhost:4410
pnpm --filter @intentface-launch/docs build
```

## Writing a page

- One `.mdx` file per page, with `title` and `description` in the frontmatter. The description is one sentence: it shows under the title, in `llms.txt` and in search results. Add `source: <path in this repo>` when the page documents one file or folder; the header links to it on GitHub.
- Add the page to `meta.json` in sidebar order. `---Label---` starts a group.
- **Plain markdown only**: headings, paragraphs, lists, tables, fenced code with a language, links. No JSX or custom components. The file is what agents read (`/<page>.md`, `/llms-full.txt`), so it must say everything on its own. A YouTube link alone in its paragraph plays in place on the site, captioned with the link's text (`mdx-components.tsx`).
- Short and direct, in the voice of `packages/core/LAUNCH.md`: say what a thing does and when to use it. No em dashes.
- `##` sections appear in the page's table of contents; keep them few and named for what the reader wants.
- When the code changes, change the page in the same commit. Facts come from the code and the guides (`LAUNCH.md`, the skills), not from memory.

## For agents

- `/<page>.md`: any page as markdown (`/index.md` for the introduction). A request for a page with `Accept: text/markdown` gets the same (`next.config.ts`).
- `/llms.txt`: the index, every page with its description.
- `/llms-full.txt`: every page in one file.
- `/.well-known/agent-skills/index.json`: core's skills (Agent Skills Discovery RFC v0.2.0), each `SKILL.md` and the pages it links to served from `packages/core/skills/` as they are.
- `/robots.txt` (every crawler, AI ones named, may read and train on everything), `/sitemap.xml` (every page, from `meta.json`), and `Link` headers on `/` pointing to the above.
