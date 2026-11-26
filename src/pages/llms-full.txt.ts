import type { APIRoute } from "astro";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  cleanMarkdownForLlm,
  docUrl,
  getOrderedGuideDocs,
  getSiteUrl,
} from "../lib/seo";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const sections = await getOrderedGuideDocs();

  const parts: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    `> Source: ${siteUrl}/`,
    "",
  ];

  for (const { category, docs } of sections) {
    for (const doc of docs) {
      const url = docUrl(siteUrl, doc.id);
      const body = cleanMarkdownForLlm(doc.body, siteUrl);
      parts.push(
        "---",
        "",
        `# ${doc.data.title}`,
        "",
        `- Category: ${category}`,
        `- URL: ${url}`,
        "",
        body,
        "",
      );
    }
  }

  return new Response(parts.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
