import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_LABELS = new Set(["참고", "팁", "주의", "위험", "성공"]);
const NOTE_MAPPED_CALLOUTS = new Set(["note", "info", "todo", "success", "check", "done", "quote", "cite"]);
const SUCCESS_CALLOUTS = new Set(["success", "check", "done"]);
const SUCCESS_PREFIX = "@@success@@";

function createSuccessIconSvg() {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      ariaHidden: "true",
      viewBox: "0 0 512 512",
      width: "16",
      height: "16",
      fill: "currentColor",
      className: ["starlight-aside__icon"],
    },
    children: [
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464a256 256 0 1 0 0-512 256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z",
        },
        children: [],
      },
    ],
  };
}

function transformSuccessAside(node) {
  if (node?.type !== "element" || node.tagName !== "aside") return false;
  const classes = getClasses(node);
  if (!classes.includes("starlight-aside--note")) return false;
  const label = asideLabel(node);
  if (label !== SUCCESS_PREFIX && !label.startsWith(`${SUCCESS_PREFIX}:`)) return false;

  const customTitle = label.startsWith(`${SUCCESS_PREFIX}:`) ? label.slice(SUCCESS_PREFIX.length + 1).trim() : "";
  const finalLabel = customTitle || "성공";

  node.properties.className = classes.map((c) => (c === "starlight-aside--note" ? "starlight-aside--success" : c));
  node.properties.ariaLabel = finalLabel;
  delete node.properties["aria-label"];

  const titleEl = (node.children ?? []).find(
    (c) => c.type === "element" && getClasses(c).includes("starlight-aside__title"),
  );
  if (titleEl) {
    titleEl.children = [createSuccessIconSvg(), { type: "text", value: finalLabel }];
  }
  return true;
}

export function starlightSuccessCalloutPlugin({ vault = "vault", output = "guide" } = {}) {
  async function walkMd(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkMd(full)));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
    return files;
  }

  return {
    name: "starlight-success-callout-plugin",
    hooks: {
      async "config:setup"({ command }) {
        if (command !== "build" && command !== "dev") return;
        const vaultRoot = path.resolve(vault);
        const docsRoot = path.resolve("src/content/docs", output);
        const mdFiles = await walkMd(vaultRoot);

        for (const vaultFile of mdFiles) {
          const raw = await fs.readFile(vaultFile, "utf8");
          const noteTypes = [];
          for (const m of raw.matchAll(/^>\s*\[!(\w+)\][+-]?/gm)) {
            const t = m[1].toLowerCase();
            if (NOTE_MAPPED_CALLOUTS.has(t)) {
              noteTypes.push(t);
            }
          }
          if (!noteTypes.some((t) => SUCCESS_CALLOUTS.has(t))) continue;

          const rel = path.relative(vaultRoot, vaultFile);
          const outFile = path.join(docsRoot, rel);
          let outContent;
          try {
            outContent = await fs.readFile(outFile, "utf8");
          } catch {
            continue;
          }

          let idx = 0;
          const updated = outContent.replace(/^:::note(?:\[([^\]]*)\])?/gm, (match, title) => {
            const calloutType = noteTypes[idx++];
            if (calloutType && SUCCESS_CALLOUTS.has(calloutType)) {
              return title ? `:::note[${SUCCESS_PREFIX}:${title}]` : `:::note[${SUCCESS_PREFIX}]`;
            }
            return match;
          });

          if (updated !== outContent) {
            await fs.writeFile(outFile, updated, "utf8");
          }
        }
      },
    },
  };
}

function isWhitespaceText(node) {
  return node.type === "text" && /^\s*$/.test(node.value);
}

function getClasses(node) {
  const cls = node.properties?.className;
  if (Array.isArray(cls)) return cls;
  if (typeof cls === "string") return cls.split(/\s+/);
  return [];
}

function isCustomNoteAside(node) {
  if (node?.type !== "element" || node.tagName !== "aside") return false;
  const classes = getClasses(node);
  if (!classes.includes("starlight-aside") || !classes.includes("starlight-aside--note")) {
    return false;
  }
  const label = node.properties?.ariaLabel ?? node.properties?.["aria-label"];
  return typeof label === "string" && label.trim().length > 0 && !DEFAULT_LABELS.has(label.trim());
}

function textContent(node) {
  if (node?.type === "text") return node.value ?? "";
  if (!Array.isArray(node?.children)) return "";
  return node.children.map(textContent).join("");
}

function isDanglingFence(node) {
  return node?.type === "element" && node.tagName === "p" && textContent(node).trim() === ":::";
}

function significantChildren(node) {
  return (node.children ?? []).filter((child) => !isWhitespaceText(child));
}

function asideLabel(node) {
  return String(node.properties?.ariaLabel ?? node.properties?.["aria-label"] ?? "").trim();
}

function isRelatedDocTip(node) {
  if (node?.type !== "element" || node.tagName !== "aside") return false;
  const classes = getClasses(node);
  return classes.includes("starlight-aside--tip") && asideLabel(node) === "관련 문서";
}

function soleAnchor(asideNode) {
  const content = (asideNode.children ?? []).find(
    (child) =>
      child.type === "element" && getClasses(child).includes("starlight-aside__content"),
  );
  if (!content) return null;

  const blocks = significantChildren(content);
  if (blocks.length !== 1) return null;

  let anchor = blocks[0];
  if (anchor.tagName === "p") {
    const inline = significantChildren(anchor);
    if (inline.length !== 1 || inline[0].tagName !== "a") return null;
    anchor = inline[0];
  } else if (anchor.tagName !== "a") {
    return null;
  }

  const href = anchor.properties?.href;
  const label = textContent(anchor).trim();
  if (typeof href !== "string" || href.length === 0 || label.length === 0) return null;
  return { href, label };
}

function relatedDocCard(asideNode) {
  const link = soleAnchor(asideNode);
  if (!link) return null;
  return {
    type: "element",
    tagName: "a",
    properties: { className: ["related-doc"], href: link.href },
    children: [{ type: "text", value: link.label }],
  };
}

function containsRelatedDoc(node) {
  if (node?.type !== "element") return false;
  if (getClasses(node).includes("related-doc")) return true;
  return (node.children ?? []).some((child) => containsRelatedDoc(child));
}

function extractAsideContent(asideNode) {
  const contentDiv = (asideNode.children ?? []).find(
    (child) =>
      child.type === "element" &&
      getClasses(child).includes("starlight-aside__content"),
  );
  return contentDiv ? contentDiv.children : [];
}

function buildTabsNode(asides, groupIndex) {
  const buttons = [];
  const panels = [];

  asides.forEach((aside, idx) => {
    const label = String(aside.properties?.ariaLabel ?? aside.properties?.["aria-label"] ?? "").trim();
    const isFirst = idx === 0;
    const tabId = `callout-tab-${groupIndex}-${idx}`;
    const panelId = `callout-panel-${groupIndex}-${idx}`;

    buttons.push({
      type: "element",
      tagName: "button",
      properties: {
        type: "button",
        id: tabId,
        role: "tab",
        className: ["callout-tabs__tab"],
        ariaSelected: isFirst ? "true" : "false",
        ariaControls: panelId,
        tabIndex: isFirst ? 0 : -1,
      },
      children: [{ type: "text", value: label }],
    });

    panels.push({
      type: "element",
      tagName: "div",
      properties: {
        id: panelId,
        role: "tabpanel",
        className: ["callout-tabs__panel"],
        ariaLabelledby: tabId,
        ...(isFirst ? {} : { hidden: true }),
      },
      children: extractAsideContent(aside),
    });
  });

  return {
    type: "element",
    tagName: "div",
    properties: { className: ["callout-tabs"] },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-tabs__list", "not-content"], role: "tablist" },
        children: buttons,
      },
      {
        type: "element",
        tagName: "div",
        properties: { className: ["callout-tabs__panels", "sl-markdown-content"] },
        children: panels,
      },
    ],
  };
}

function getNonWhitespaceChildren(node) {
  return (node?.children ?? []).filter((c) => !isWhitespaceText(c));
}

function getSingleImageFromParagraph(node) {
  if (node?.type !== "element" || node.tagName !== "p") return null;
  const kids = getNonWhitespaceChildren(node);
  if (kids.length === 1 && kids[0].type === "element" && kids[0].tagName === "img") {
    return kids[0];
  }
  return null;
}

function getCaptionFromParagraph(node) {
  if (node?.type !== "element" || node.tagName !== "p") return null;
  const kids = getNonWhitespaceChildren(node);
  if (kids.length === 1 && kids[0].type === "element" && kids[0].tagName === "em") {
    return kids[0].children ?? [];
  }
  return null;
}

function buildImageRowNode(items) {
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["image-row"],
      dataCols: String(items.length),
    },
    children: items.map(({ img, caption }) => ({
      type: "element",
      tagName: "figure",
      properties: { className: ["image-row__item"] },
      children: [
        img,
        ...(caption
          ? [
              {
                type: "element",
                tagName: "figcaption",
                properties: { className: ["image-row__caption"] },
                children: caption,
              },
            ]
          : []),
      ],
    })),
  };
}

const SKIP_HIGHLIGHT_TAGS = new Set(["code", "pre", "script", "style"]);

function transformObsidianHighlights(node) {
  if (!Array.isArray(node.children)) return;
  if (node.type === "element" && SKIP_HIGHLIGHT_TAGS.has(node.tagName)) return;

  // Tokenize text nodes around "==" markers
  const tokens = [];
  let markerCount = 0;
  for (const child of node.children) {
    if (child.type === "text" && child.value.includes("==")) {
      const parts = child.value.split("==");
      parts.forEach((part, idx) => {
        if (part.length > 0) {
          tokens.push({ type: "text", value: part });
        }
        if (idx < parts.length - 1) {
          tokens.push({ type: "__eq_marker__" });
          markerCount += 1;
        }
      });
    } else {
      tokens.push(child);
    }
  }

  if (markerCount >= 2) {
    const rebuilt = [];
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i].type === "__eq_marker__") {
        let closeIdx = -1;
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === "__eq_marker__") {
            closeIdx = j;
            break;
          }
        }
        if (closeIdx !== -1 && closeIdx > i + 1) {
          rebuilt.push({
            type: "element",
            tagName: "mark",
            properties: { className: ["obsidian-highlight"] },
            children: tokens.slice(i + 1, closeIdx),
          });
          i = closeIdx + 1;
          continue;
        }
        rebuilt.push({ type: "text", value: "==" });
        i += 1;
      } else {
        rebuilt.push(tokens[i]);
        i += 1;
      }
    }
    node.children = rebuilt;
  }

  for (const child of node.children) {
    transformObsidianHighlights(child);
  }
}

export function rehypeCalloutTabs() {
  return (tree) => {
    let groupCounter = 0;

    function visit(node) {
      if (!Array.isArray(node.children)) return;

      const nextChildren = [];
      let i = 0;

      while (i < node.children.length) {
        const child = node.children[i];
        if (isDanglingFence(child)) {
          i += 1;
          continue;
        }

        const card = isRelatedDocTip(child) ? relatedDocCard(child) : null;
        if (card) {
          nextChildren.push(card);
          i += 1;
          continue;
        }

        if (transformSuccessAside(child)) {
          visit(child);
          nextChildren.push(child);
          i += 1;
          continue;
        }

        if (isCustomNoteAside(child)) {
          const run = [];
          let j = i;
          while (j < node.children.length) {
            let k = j;
            while (
              k < node.children.length &&
              (isWhitespaceText(node.children[k]) || isDanglingFence(node.children[k]))
            ) {
              k++;
            }
            if (k < node.children.length && isCustomNoteAside(node.children[k])) {
              visit(node.children[k]);
              run.push(node.children[k]);
              j = k + 1;
            } else {
              break;
            }
          }

          if (run.length >= 2 || (run.length === 1 && containsRelatedDoc(run[0]))) {
            groupCounter += 1;
            nextChildren.push(buildTabsNode(run, groupCounter));
          } else {
            nextChildren.push(run[0]);
          }
          i = j;
          continue;
        }

        const firstImg = getSingleImageFromParagraph(child);
        if (firstImg) {
          const items = [];
          let j = i;
          while (j < node.children.length) {
            let k = j;
            while (k < node.children.length && isWhitespaceText(node.children[k])) {
              k++;
            }
            if (k >= node.children.length) break;
            const img = getSingleImageFromParagraph(node.children[k]);
            if (!img) break;
            let nextIdx = k + 1;
            let capIdx = nextIdx;
            while (capIdx < node.children.length && isWhitespaceText(node.children[capIdx])) {
              capIdx++;
            }
            let caption = null;
            if (capIdx < node.children.length) {
              const cap = getCaptionFromParagraph(node.children[capIdx]);
              if (cap) {
                caption = cap;
                nextIdx = capIdx + 1;
              }
            }
            items.push({ img, caption });
            j = nextIdx;
          }

          if (items.length >= 2) {
            nextChildren.push(buildImageRowNode(items));
            i = j;
            continue;
          }
        }

        visit(child);
        nextChildren.push(child);
        i += 1;
      }

      node.children = nextChildren;
    }

    visit(tree);
    transformObsidianHighlights(tree);
  };
}
