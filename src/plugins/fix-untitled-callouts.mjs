import fs from "node:fs/promises";
import path from "node:path";

const brokenAside = /^(:::(?:note|tip|caution|danger))\][ \t]*$/gm;

export function fixUntitledCallouts() {
  return {
    name: "fix-untitled-callouts",
    hooks: {
      async "astro:config:setup"({ command }) {
        if (command !== "dev" && command !== "build") return;
        await rewriteUntitledCallouts(path.resolve("src/content/docs"));
      },
    },
  };
}

export async function rewriteUntitledCallouts(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await rewriteUntitledCallouts(full);
        return;
      }
      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) return;
      const text = await fs.readFile(full, "utf8");
      const next = text.replace(brokenAside, "$1");
      if (next !== text) await fs.writeFile(full, next);
    }),
  );
}
