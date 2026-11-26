import { getCollection, type CollectionEntry } from "astro:content";

export const SITE_NAME = "도뉴 사용 가이드";
export const SITE_DESCRIPTION =
  "전자계약의 원스톱 솔루션 도뉴(DONUE)를 쉽게 사용하기 위한 공식 가이드입니다.";

export const CATEGORY_ORDER = [
  "도뉴 사용 가이드",
  "계약 생성",
  "계약서 열람 및 서명",
  "기업회원 기능",
  "계약 관리",
  "요금제",
  "기타 기능",
  "설정",
] as const;

export const EXTERNAL_LINKS = [
  { label: "도뉴 서비스", url: "https://donue.co.kr/" },
  {
    label: "서비스 소개서",
    url: "https://s3.ap-northeast-2.amazonaws.com/donue/introduce/DONUE+Service+Introduction.pdf",
  },
  { label: "공식 블로그", url: "https://blog.naver.com/donue_solution" },
] as const;

export function getSiteUrl(site?: URL): string {
  const raw =
    site?.toString() ||
    process.env.SITE_URL ||
    process.env.CF_PAGES_URL ||
    "https://guide.donue.co.kr";
  return raw.replace(/\/+$/, "");
}

export function docUrl(siteUrl: string, id: string): string {
  const cleanId = id.replace(/^\/+|\/+$/g, "");
  if (!cleanId) return `${siteUrl}/`;
  const encoded = cleanId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${siteUrl}/${encoded}/`;
}

export function extractPlainDescription(
  body: string | undefined,
  fallback = SITE_DESCRIPTION,
  maxLength = 155,
): string {
  if (!body) return fallback;

  const cleaned = body
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Remove images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // Remove callout directives and markers
    .replace(/^:{3,}[a-z]*(?:\[[^\]]*\])?[ \t]*$/gm, " ")
    .replace(/@@success@@/g, "")
    // Keep link text only
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown headings, blockquotes, lists, emphasis, highlights
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/==/g, "")
    .replace(/[*_`~\\]/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

export function cleanMarkdownForLlm(body: string | undefined, siteUrl: string): string {
  if (!body) return "";

  return (
    body
      // Remove auto-generated screenshot image lines
      .replace(/^[ \t]*!\[img-[^\]]*\]\([^)]*\)[ \t]*$/gm, "")
      // Remove remaining relative image embeds
      .replace(/!\[([^\]]*)\]\((?!https?:\/\/)[^)]*\)/g, (_, alt: string) =>
        alt && !alt.startsWith("img-") ? `[이미지: ${alt}]` : "",
      )
      // Convert Starlight directives into readable Markdown blockquotes
      .replace(/^:{3,}note\[@@success@@([^\]]*)\][ \t]*$/gm, (_, title: string) =>
        title.trim() ? `> **[성공: ${title.trim()}]**` : `> **[성공]**`,
      )
      .replace(/^:{3,}note\[([^\]]+)\][ \t]*$/gm, (_, title: string) => `> **[${title.trim()}]**`)
      .replace(/^:{3,}note[ \t]*$/gm, `> **[참고]**`)
      .replace(/^:{3,}tip\[([^\]]+)\][ \t]*$/gm, (_, title: string) => `> **[${title.trim()}]**`)
      .replace(/^:{3,}tip[ \t]*$/gm, `> **[팁]**`)
      .replace(/^:{3,}caution\[([^\]]+)\][ \t]*$/gm, (_, title: string) => `> **[주의: ${title.trim()}]**`)
      .replace(/^:{3,}caution[ \t]*$/gm, `> **[주의]**`)
      .replace(/^:{3,}danger\[([^\]]+)\][ \t]*$/gm, (_, title: string) => `> **[경고: ${title.trim()}]**`)
      .replace(/^:{3,}danger[ \t]*$/gm, `> **[경고]**`)
      .replace(/^:{3,}[ \t]*$/gm, "")
      // Strip Obsidian highlights and HTML mark tags while keeping text
      .replace(/==([^=\n]+)==/g, "$1")
      .replace(/<\/?mark[^>]*>/gi, "")
      // Convert internal relative links to absolute URLs
      .replace(/\]\((\/guide\/[^)\s]+)\)/g, (_, relPath: string) => {
        const normalized = relPath.endsWith("/") ? relPath : `${relPath}/`;
        return `](${siteUrl}${normalized})`;
      })
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function getDocCategory(entry: CollectionEntry<"docs">): string {
  const rel = entry.filePath
    ? entry.filePath.replace(/^.*src\/content\/docs\/guide\//, "")
    : entry.id.replace(/^guide\//, "");
  const parts = rel.split("/");
  if (parts.length <= 1) return "도뉴 사용 가이드";
  return parts[0];
}

export function getDocBreadcrumbs(entry: CollectionEntry<"docs">): string[] {
  const rel = entry.filePath
    ? entry.filePath.replace(/^.*src\/content\/docs\/guide\//, "")
    : entry.id.replace(/^guide\//, "");
  const parts = rel.split("/");
  // Drop the filename itself; title is appended separately
  return parts.slice(0, -1);
}

export async function getOrderedGuideDocs(): Promise<
  Array<{ category: string; docs: CollectionEntry<"docs">[] }>
> {
  const allDocs = await getCollection(
    "docs",
    (entry) => entry.id.startsWith("guide/") && !entry.data.draft,
  );

  const grouped = new Map<string, CollectionEntry<"docs">[]>();
  for (const doc of allDocs) {
    const category = getDocCategory(doc);
    const list = grouped.get(category) ?? [];
    list.push(doc);
    grouped.set(category, list);
  }

  const sortDocs = (docs: CollectionEntry<"docs">[]) =>
    docs.sort((a, b) => {
      const orderA = a.data.sidebar?.order ?? 999;
      const orderB = b.data.sidebar?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.data.title.localeCompare(b.data.title, "ko");
    });

  const sections: Array<{ category: string; docs: CollectionEntry<"docs">[] }> = [];
  for (const category of CATEGORY_ORDER) {
    const docs = grouped.get(category);
    if (docs?.length) {
      sections.push({ category, docs: sortDocs(docs) });
      grouped.delete(category);
    }
  }
  for (const [category, docs] of grouped.entries()) {
    if (docs.length) {
      sections.push({ category, docs: sortDocs(docs) });
    }
  }

  return sections;
}
