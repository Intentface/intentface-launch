import { SITE } from "@/lib/source";

// Everything here is public and written for agents as much as for people, so
// every crawler, AI search, assistants and training alike, may read all of it.
// The AI crawlers are named so the policy is explicit for each. A route rather
// than app/robots.ts, which has no way to write Content-Signal.
const AGENTS = [
  "*",
  // Search and assistants: the pages AI answers cite.
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  // Training.
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
];

export function GET() {
  const lines = [
    "# Intentface Launch documentation. Any page reads as markdown with .md",
    "# appended, or with Accept: text/markdown; /llms.txt is the index.",
    "",
    ...AGENTS.map((agent) => `User-agent: ${agent}`),
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    // The internal target of the .md rewrite: the same pages under another URL.
    "Disallow: /docs-markdown/",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
  ];
  return new Response(`${lines.join("\n")}\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const dynamic = "force-static";
