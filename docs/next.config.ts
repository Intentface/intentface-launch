import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Any page is readable as markdown by appending `.md`, the convention agents
  // expect. It maps onto the same handler "Copy page" uses.
  rewrites: async () => [{ source: "/:slug*.md", destination: "/docs-markdown/:slug*" }],
  // These routes read content files at request time; the bundler can't trace
  // runtime paths, so include them in the server output explicitly.
  outputFileTracingIncludes: {
    "/docs-markdown/[...slug]": ["./content/docs/**/*"],
    "/llms-full.txt": ["./content/docs/**/*"],
  },
};

export default createMDX()(nextConfig);
