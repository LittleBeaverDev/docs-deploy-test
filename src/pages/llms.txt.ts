import type { APIRoute } from "astro";
import {
  EXTERNAL_LINKS,
  SITE_DESCRIPTION,
  SITE_NAME,
  docUrl,
  extractPlainDescription,
  getOrderedGuideDocs,
  getSiteUrl,
} from "../lib/seo";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = getSiteUrl(site);
  const sections = await getOrderedGuideDocs();

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `- [전체 문서 텍스트 (llms-full.txt)](${siteUrl}/llms-full.txt): 모든 가이드 문서를 하나의 마크다운 파일로 제공합니다.`,
    `- [사이트맵 (sitemap-index.xml)](${siteUrl}/sitemap-index.xml)`,
    "",
  ];

  for (const { category, docs } of sections) {
    lines.push(`## ${category}`, "");
    for (const doc of docs) {
      const url = docUrl(siteUrl, doc.id);
      const desc =
        doc.data.description?.trim() || extractPlainDescription(doc.body, "", 120);
      lines.push(desc ? `- [${doc.data.title}](${url}): ${desc}` : `- [${doc.data.title}](${url})`);
    }
    lines.push("");
  }

  lines.push("## 더 알아보기", "");
  for (const link of EXTERNAL_LINKS) {
    lines.push(`- [${link.label}](${link.url})`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
