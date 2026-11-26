import fs from "node:fs";
import path from "node:path";
import { slug } from "github-slugger";

const IGNORED_DIRS = new Set([".obsidian", "assets"]);
const IGNORED_FILES = new Set(["sortspec.md"]);

function normalizeFolderKey(raw) {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed === ".") return "";
  return trimmed;
}

/**
 * Parse Obsidian Custom File Explorer sorting `sortspec.md` into:
 * Map<folderRelativePath, string[] of ordered item names>
 */
export function parseSortspec(vaultDir = "vault") {
  const map = new Map();
  const filePath = path.resolve(vaultDir, "sortspec.md");
  if (!fs.existsSync(filePath)) return map;

  const content = fs.readFileSync(filePath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return map;

  const fm = fmMatch[1];
  const specMatch = fm.match(/^sorting-spec:\s*\|[ \t]*\r?\n([\s\S]*)/m);
  if (!specMatch) return map;

  const lines = specMatch[1].split(/\r?\n/);
  let currentFolder = null;

  for (const rawLine of lines) {
    // Stop if another top-level YAML key starts (column 0, non-whitespace)
    if (rawLine.length > 0 && !/^\s/.test(rawLine)) break;

    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const targetMatch = line.match(/^target-folder:\s*(.+)$/);
    if (targetMatch) {
      currentFolder = normalizeFolderKey(targetMatch[1]);
      if (!map.has(currentFolder)) map.set(currentFolder, []);
      continue;
    }

    if (currentFolder === null) continue;
    // Skip plugin directives (< a-z, > a-z, /:files, /folders, %)
    if (/^(?:[<>%]|\/:)/.test(line) || line === "/folders") continue;

    const itemName = line.replace(/\.md$/i, "").trim();
    if (itemName) {
      map.get(currentFolder).push(itemName);
    }
  }

  return map;
}

function parseNoteMeta(filePath, fallbackTitle) {
  const content = fs.readFileSync(filePath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { title: fallbackTitle, order: 999, hidden: false };
  }

  const fm = fmMatch[1];
  const hidden =
    /(?:^|\n)publish:\s*false\b/.test(fm) || /(?:^|\n)draft:\s*true\b/.test(fm);
  const titleMatch = fm.match(/(?:^|\n)title:\s*["']?(.+?)["']?[ \t]*(?:\n|$)/);
  const orderMatch = fm.match(/(?:^|\n)sidebar:\s*\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+order:\s*(\d+)/);

  return {
    title: titleMatch ? titleMatch[1].trim() : fallbackTitle,
    order: orderMatch ? Number(orderMatch[1]) : 999,
    hidden,
  };
}

function toStarlightSlug(output, relPathNoExt) {
  const segments = [output, ...relPathNoExt.split("/").filter(Boolean)];
  return segments.map((seg) => slug(seg)).join("/");
}

/**
 * Recursively build Starlight sidebar items from `vault/` using `vault/sortspec.md`
 * as the single source of truth for ordering.
 */
export function buildSidebarFromVault({ vaultDir = "vault", output = "guide" } = {}) {
  const sortMap = parseSortspec(vaultDir);
  const rootDir = path.resolve(vaultDir);

  function buildDir(relDir) {
    const absDir = relDir ? path.join(rootDir, relDir) : rootDir;
    if (!fs.existsSync(absDir)) return [];

    const dirEntries = fs.readdirSync(absDir, { withFileTypes: true });
    const items = [];

    for (const entry of dirEntries) {
      if (entry.name.startsWith(".")) continue;

      if (entry.isDirectory()) {
        if (!relDir && IGNORED_DIRS.has(entry.name)) continue;
        const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
        const childItems = buildDir(childRel);
        if (childItems.length === 0) continue;
        items.push({
          kind: "dir",
          name: entry.name,
          order: 999,
          sidebarItem: {
            label: entry.name,
            items: childItems,
          },
        });
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        if (IGNORED_FILES.has(entry.name)) continue;
        const stem = entry.name.slice(0, -3);
        const absFile = path.join(absDir, entry.name);
        const meta = parseNoteMeta(absFile, stem);
        if (meta.hidden) continue;
        const relNoExt = relDir ? `${relDir}/${stem}` : stem;
        items.push({
          kind: "file",
          name: stem,
          order: meta.order,
          sidebarItem: {
            label: meta.title,
            slug: toStarlightSlug(output, relNoExt),
          },
        });
      }
    }

    const specOrder = sortMap.get(relDir) ?? [];
    const indexOf = (name) => {
      const idx = specOrder.indexOf(name);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };

    items.sort((a, b) => {
      const ia = indexOf(a.name);
      const ib = indexOf(b.name);
      if (ia !== ib) return ia - ib;
      // When a file and a folder share the same name, place the file first
      if (a.name === b.name && a.kind !== b.kind) {
        return a.kind === "file" ? -1 : 1;
      }
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name, "ko");
    });

    return items.map((entry) => entry.sidebarItem);
  }

  return buildDir("");
}

/**
 * Astro integration that watches `vault/sortspec.md` during `astro dev`
 * so edits in Obsidian automatically reload the Starlight sidebar.
 */
export function watchSortspec(vaultDir = "vault") {
  return {
    name: "watch-sortspec",
    hooks: {
      "astro:config:setup"({ addWatchFile }) {
        addWatchFile(path.resolve(vaultDir, "sortspec.md"));
      },
    },
  };
}
