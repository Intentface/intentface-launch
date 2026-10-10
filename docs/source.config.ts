import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // `source` is a path in this repo (a file or a folder) that the page
    // documents; the page header links "View source" to it on GitHub.
    schema: frontmatterSchema.extend({
      source: z.string().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    // Fenced code reaches our `pre` handler as raw text and is highlighted in
    // one place, the CodeBlock component.
    rehypeCodeOptions: false,
  },
});
