import { defineRouteMiddleware, type StarlightRouteData } from "@astrojs/starlight/route-data";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  extractPlainDescription,
  getDocBreadcrumbs,
  getSiteUrl,
} from "./lib/seo";

type SidebarEntry = StarlightRouteData["sidebar"][number];
type SidebarLink = Extract<SidebarEntry, { type: "link" }>;

function isExternalHref(href: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function flattenLinks(entries: SidebarEntry[]): SidebarLink[] {
  const links: SidebarLink[] = [];
  for (const entry of entries) {
    if (entry.type === "group") links.push(...flattenLinks(entry.entries));
    else links.push(entry);
  }
  return links;
}

function upsertMeta(
  head: StarlightRouteData["head"],
  keyAttr: "name" | "property",
  keyValue: string,
  content: string,
) {
  const existing = head.find(
    (item) => item.tag === "meta" && item.attrs?.[keyAttr] === keyValue,
  );
  if (existing) {
    existing.attrs = { ...existing.attrs, content };
  } else {
    head.push({
      tag: "meta",
      attrs: { [keyAttr]: keyValue, content },
    });
  }
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { sidebar, pagination, entry, head } = route;

  // 1. Skip external links in prev/next pagination
  const links = flattenLinks(sidebar);
  const currentIndex = links.findIndex((item) => item.isCurrent);
  if (currentIndex !== -1) {
    if (pagination.next && isExternalHref(pagination.next.href)) {
      pagination.next = links
        .slice(currentIndex + 1)
        .find((item) => !isExternalHref(item.href));
    }

    if (pagination.prev && isExternalHref(pagination.prev.href)) {
      pagination.prev = links
        .slice(0, currentIndex)
        .findLast((item) => !isExternalHref(item.href));
    }
  }

  // 2. Per-page SEO metadata & JSON-LD structured data
  const siteUrl = getSiteUrl(context.site);
  const pageUrl = new URL(context.url.pathname, `${siteUrl}/`).toString();
  const title = entry.data.title || SITE_NAME;
  const description =
    entry.data.description?.trim() || extractPlainDescription(entry.body, SITE_DESCRIPTION);

  upsertMeta(head, "name", "description", description);
  upsertMeta(head, "property", "og:description", description);
  upsertMeta(head, "name", "twitter:title", title);
  upsertMeta(head, "name", "twitter:description", description);

  const isHome = entry.id === "" || entry.id === "index";
  const publisher = {
    "@type": "Organization",
    name: "도뉴 (DONUE)",
    url: "https://donue.co.kr/",
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/favicon.png`,
    },
  };

  const jsonLd = isHome
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        description,
        url: `${siteUrl}/`,
        inLanguage: "ko",
        publisher,
      }
    : {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "TechArticle",
            headline: title,
            description,
            url: pageUrl,
            inLanguage: "ko",
            image: `${siteUrl}/og-image.png`,
            publisher,
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: SITE_NAME,
                item: `${siteUrl}/`,
              },
              ...getDocBreadcrumbs(entry).map((segment, index) => ({
                "@type": "ListItem",
                position: index + 2,
                name: segment,
              })),
              {
                "@type": "ListItem",
                position: getDocBreadcrumbs(entry).length + 2,
                name: title,
                item: pageUrl,
              },
            ],
          },
        ],
      };

  head.push({
    tag: "script",
    attrs: { type: "application/ld+json" },
    content: JSON.stringify(jsonLd),
  });
});
