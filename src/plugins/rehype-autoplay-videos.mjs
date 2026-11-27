/**
 * Rehype plugin that converts embedded `<video>` elements (e.g. from starlight-obsidian)
 * into GIF-like silent looping autoplay videos without visible player controls.
 */
function transformNode(node) {
  if (!node || typeof node !== "object") return;

  if (node.type === "element" && node.tagName === "video") {
    const props = (node.properties ??= {});
    delete props.controls;
    props.autoplay = true;
    props.loop = true;
    props.muted = true;
    props.playsInline = true;
  } else if (node.type === "raw" && typeof node.value === "string" && node.value.includes("<video")) {
    node.value = node.value.replace(/<video\b([^>]*)>/gi, (_match, attrs) => {
      const cleaned = attrs
        .replace(/\s+controls(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, "")
        .trim();
      const extra = [];
      if (!/\bautoplay\b/i.test(cleaned)) extra.push("autoplay");
      if (!/\bloop\b/i.test(cleaned)) extra.push("loop");
      if (!/\bmuted\b/i.test(cleaned)) extra.push("muted");
      if (!/\bplaysinline\b/i.test(cleaned)) extra.push("playsinline");
      const allAttrs = [cleaned, ...extra].filter(Boolean).join(" ");
      return `<video ${allAttrs}>`;
    });
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      transformNode(child);
    }
  }
}

export function rehypeAutoplayVideos() {
  return (tree) => {
    transformNode(tree);
  };
}
