import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const MARKDOWN = { type: "header" as const, key: "accept", value: ".*text/markdown.*" };

const nextConfig: NextConfig = {
  // Any page is readable as markdown by appending `.md`, the convention agents
  // expect, or by asking for it with `Accept: text/markdown`. Both map onto the
  // same handler "Copy page" uses. Negotiation runs before the pages match, and
  // only on page paths (no dot), so llms.txt and assets are served as they are.
  rewrites: async () => ({
    beforeFiles: [
      { source: "/", has: [MARKDOWN], destination: "/docs-markdown/index" },
      {
        source: "/:slug((?!_next/|docs-markdown/|\\.well-known/)[^.]+)",
        has: [MARKDOWN],
        destination: "/docs-markdown/:slug",
      },
    ],
    afterFiles: [
      // Not the skills' own files, which are markdown already.
      { source: "/:slug((?!\\.well-known/).+)\\.md", destination: "/docs-markdown/:slug" },
      // Plausible through our own origin (see lib/analytics.ts).
      { source: "/p/event", destination: "https://plausible.io/api/event" },
    ],
    fallback: [],
  }),
  headers: async () => [
    // Where an agent landing on the home page finds the machine-readable docs.
    {
      source: "/",
      headers: [
        {
          key: "link",
          value: [
            '</index.md>; rel="alternate"; type="text/markdown"',
            '</llms.txt>; rel="describedby"; type="text/plain"',
            '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
            '</sitemap.xml>; rel="sitemap"; type="application/xml"',
          ].join(", "),
        },
      ],
    },
  ],
  // These routes read content files at request time; the bundler can't trace
  // runtime paths, so include them in the server output explicitly.
  outputFileTracingIncludes: {
    "/docs-markdown/[...slug]": ["./content/docs/**/*"],
    "/llms-full.txt": ["./content/docs/**/*"],
  },
};

export default createMDX()(nextConfig);
