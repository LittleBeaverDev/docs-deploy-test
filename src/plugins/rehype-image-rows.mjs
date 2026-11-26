function isWhitespaceText(node) {
  return node?.type === "text" && /^\s*$/.test(node.value);
}

function significantChildren(node) {
  return (node.children ?? []).filter((child) => !isWhitespaceText(child));
}

function isElement(node, tagName) {
  return node?.type === "element" && node.tagName === tagName;
}

function imageChildren(node) {
  return significantChildren(node).filter((child) => isElement(child, "img"));
}

function isImageParagraph(node) {
  if (!isElement(node, "p")) return false;
  const children = significantChildren(node);
  return children.length > 0 && children.every((child) => isElement(child, "img"));
}

function captionChildren(node) {
  if (!isElement(node, "p")) return null;
  const children = significantChildren(node);
  if (children.length !== 1 || !isElement(children[0], "em")) return null;
  return children[0].children ?? [];
}

function figure(img, caption) {
  const children = [img];
  if (caption) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: { className: ["image-row__caption"] },
      children: caption,
    });
  }
  return {
    type: "element",
    tagName: "figure",
    properties: { className: ["image-row__item"] },
    children,
  };
}

function readFigures(children, start) {
  let index = start;
  while (index < children.length && isWhitespaceText(children[index])) index += 1;
  const paragraph = children[index];
  if (!isImageParagraph(paragraph)) return null;

  const figures = imageChildren(paragraph).map((img) => figure(img, null));
  index += 1;

  if (figures.length === 1) {
    let captionAt = index;
    while (captionAt < children.length && isWhitespaceText(children[captionAt])) captionAt += 1;
    const caption = captionChildren(children[captionAt]);
    if (caption) {
      figures[0] = figure(imageChildren(paragraph)[0], caption);
      index = captionAt + 1;
    }
  }

  return { figures, next: index };
}

function imageRow(figures) {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["image-row"] },
    children: figures,
  };
}

function groupImages(node) {
  if (!Array.isArray(node.children)) return;

  const nextChildren = [];
  let index = 0;

  while (index < node.children.length) {
    const first = readFigures(node.children, index);
    if (!first) {
      const child = node.children[index];
      groupImages(child);
      nextChildren.push(child);
      index += 1;
      continue;
    }

    const figures = [...first.figures];
    let cursor = first.next;
    while (cursor < node.children.length) {
      const more = readFigures(node.children, cursor);
      if (!more) break;
      figures.push(...more.figures);
      cursor = more.next;
    }

    const captionedAlone = figures.length === 1 && figures[0].children.some((child) => isElement(child, "figcaption"));

    if (figures.length < 2 && !captionedAlone) {
      const child = node.children[index];
      groupImages(child);
      nextChildren.push(child);
      index += 1;
      continue;
    }

    nextChildren.push(imageRow(figures));
    index = cursor;
  }

  node.children = nextChildren;
}

export function rehypeImageRows() {
  return (tree) => {
    groupImages(tree);
  };
}
