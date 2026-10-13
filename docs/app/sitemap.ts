import type { MetadataRoute } from "next";
import { getSections, SITE } from "@/lib/source";

// Every page, in sidebar order. Built from the content, so it follows meta.json.
export default function sitemap(): MetadataRoute.Sitemap {
  return getSections()
    .flatMap((section) => section.pages)
    .map((page) => ({ url: `${SITE}${page.url}` }));
}
