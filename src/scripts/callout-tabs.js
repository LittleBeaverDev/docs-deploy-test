document.addEventListener("click", (event) => {
  const tab = event.target instanceof Element ? event.target.closest(".callout-tabs__tab") : null;
  if (!tab) return;
  const container = tab.closest(".callout-tabs");
  if (!container) return;
  const tabs = Array.from(container.querySelectorAll(":scope > .callout-tabs__list > .callout-tabs__tab"));
  const panels = Array.from(container.querySelectorAll(":scope > .callout-tabs__panels > .callout-tabs__panel"));
  const idx = tabs.indexOf(tab);
  if (idx === -1) return;
  tabs.forEach((t, i) => {
    const active = i === idx;
    t.setAttribute("aria-selected", active ? "true" : "false");
    t.tabIndex = active ? 0 : -1;
  });
  panels.forEach((p, i) => {
    p.hidden = i !== idx;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const tab = event.target instanceof Element ? event.target.closest(".callout-tabs__tab") : null;
  if (!tab) return;
  const container = tab.closest(".callout-tabs");
  if (!container) return;
  const tabs = Array.from(container.querySelectorAll(":scope > .callout-tabs__list > .callout-tabs__tab"));
  const idx = tabs.indexOf(tab);
  if (idx === -1) return;
  const nextIdx = (idx + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIdx].focus();
  tabs[nextIdx].click();
});
