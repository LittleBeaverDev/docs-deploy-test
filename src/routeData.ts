import { defineRouteMiddleware, type StarlightRouteData } from "@astrojs/starlight/route-data";

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

export const onRequest = defineRouteMiddleware((context) => {
  const { sidebar, pagination } = context.locals.starlightRoute;
  const links = flattenLinks(sidebar);
  const currentIndex = links.findIndex((entry) => entry.isCurrent);
  if (currentIndex === -1) return;

  if (pagination.next && isExternalHref(pagination.next.href)) {
    pagination.next = links
      .slice(currentIndex + 1)
      .find((entry) => !isExternalHref(entry.href));
  }

  if (pagination.prev && isExternalHref(pagination.prev.href)) {
    pagination.prev = links
      .slice(0, currentIndex)
      .findLast((entry) => !isExternalHref(entry.href));
  }
});
