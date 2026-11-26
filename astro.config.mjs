// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightObsidianPlugin from "starlight-obsidian";
import { rehypeCalloutTabs, starlightSuccessCalloutPlugin } from "./src/plugins/rehype-callout-tabs.mjs";
import { rehypeImageRows } from "./src/plugins/rehype-image-rows.mjs";
import { fixUntitledCallouts } from "./src/plugins/fix-untitled-callouts.mjs";

const calloutTabsScript = `
document.addEventListener('click', (event) => {
  const tab = event.target instanceof Element ? event.target.closest('.callout-tabs__tab') : null;
  if (!tab) return;
  const container = tab.closest('.callout-tabs');
  if (!container) return;
  const tabs = Array.from(container.querySelectorAll(':scope > .callout-tabs__list > .callout-tabs__tab'));
  const panels = Array.from(container.querySelectorAll(':scope > .callout-tabs__panels > .callout-tabs__panel'));
  const idx = tabs.indexOf(tab);
  if (idx === -1) return;
  tabs.forEach((t, i) => {
    const active = i === idx;
    t.setAttribute('aria-selected', active ? 'true' : 'false');
    t.tabIndex = active ? 0 : -1;
  });
  panels.forEach((p, i) => {
    p.hidden = i !== idx;
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const tab = event.target instanceof Element ? event.target.closest('.callout-tabs__tab') : null;
  if (!tab) return;
  const container = tab.closest('.callout-tabs');
  if (!container) return;
  const tabs = Array.from(container.querySelectorAll(':scope > .callout-tabs__list > .callout-tabs__tab'));
  const idx = tabs.indexOf(tab);
  if (idx === -1) return;
  const nextIdx = (idx + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIdx].focus();
  tabs[nextIdx].click();
});
`;

const mediaLightboxScript = `
(() => {
  let overlay = null;
  let activeSourceVideo = null;
  let activeModalVideo = null;
  let lastTrigger = null;

  const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

  function preventScroll(event) {
    event.preventDefault();
  }

  function preventScrollKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (SCROLL_KEYS.has(event.key)) {
      if (event.key === ' ' && document.activeElement?.tagName === 'VIDEO') return;
      event.preventDefault();
    }
  }

  function lockScroll() {
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', preventScrollKeys);
  }

  function unlockScroll() {
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('keydown', preventScrollKeys);
  }

  function closeLightbox() {
    if (!overlay) return;
    if (activeModalVideo && activeSourceVideo) {
      try {
        activeSourceVideo.currentTime = activeModalVideo.currentTime;
      } catch {}
      activeModalVideo.pause();
    }
    const closing = overlay;
    overlay = null;
    activeSourceVideo = null;
    activeModalVideo = null;
    unlockScroll();
    closing.classList.remove('is-open');
    window.setTimeout(() => closing.remove(), 180);
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function openLightbox(target) {
    if (overlay) closeLightbox();
    lastTrigger = target;

    const dialog = document.createElement('div');
    dialog.className = 'media-lightbox';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '미디어 전체화면 미리보기');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'media-lightbox__close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    closeBtn.addEventListener('click', closeLightbox);

    const frame = document.createElement('div');
    frame.className = 'media-lightbox__frame';

    if (target.tagName === 'IMG') {
      const img = document.createElement('img');
      img.className = 'media-lightbox__media media-lightbox__media--image';
      img.src = target.currentSrc || target.src;
      img.alt = target.alt || '';
      img.addEventListener('click', closeLightbox);
      frame.appendChild(img);

      const figure = target.closest('figure');
      const figcaption = figure ? figure.querySelector('figcaption') : null;
      if (figcaption && figcaption.textContent && figcaption.textContent.trim()) {
        const cap = document.createElement('p');
        cap.className = 'media-lightbox__caption';
        cap.textContent = figcaption.textContent.trim();
        frame.appendChild(cap);
      }
    } else if (target.tagName === 'VIDEO') {
      const sourceVideo = target;
      const wasPlaying = !sourceVideo.paused && !sourceVideo.ended;
      const currentTime = sourceVideo.currentTime || 0;
      sourceVideo.pause();

      const video = sourceVideo.cloneNode(true);
      video.className = 'media-lightbox__media media-lightbox__media--video';
      video.controls = true;
      video.removeAttribute('width');
      video.removeAttribute('height');
      video.addEventListener('loadedmetadata', () => {
        try {
          if (currentTime > 0) video.currentTime = currentTime;
        } catch {}
        if (wasPlaying || sourceVideo.autoplay) {
          video.play().catch(() => {});
        }
      }, { once: true });

      activeSourceVideo = sourceVideo;
      activeModalVideo = video;
      frame.appendChild(video);
    }

    dialog.appendChild(closeBtn);
    dialog.appendChild(frame);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target === frame) {
        closeLightbox();
      }
    });

    document.body.appendChild(dialog);
    lockScroll();
    overlay = dialog;
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    closeBtn.focus();
  }

  document.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return;

    const img = el.closest('.sl-markdown-content img');
    if (img && !img.closest('a, .media-lightbox')) {
      event.preventDefault();
      openLightbox(img);
      return;
    }

    const video = el.closest('.sl-markdown-content video');
    if (video && !video.closest('a, .media-lightbox')) {
      if (video.controls) {
        const rect = video.getBoundingClientRect();
        if (event.clientY > rect.bottom - 44) return;
      }
      event.preventDefault();
      openLightbox(video);
    }
  });
})();
`;

const site = (
  process.env.SITE_URL ||
  process.env.CF_PAGES_URL ||
  "https://guide.donue.co.kr"
).replace(/\/+$/, "");

// https://astro.build/config
export default defineConfig({
  site,
  trailingSlash: "always",
  markdown: {
    rehypePlugins: [rehypeImageRows, rehypeCalloutTabs],
  },
  integrations: [
    starlight({
      title: "도뉴",
      description: "전자계약의 원스톱 솔루션 도뉴를 쉽게 사용하기 위한 가이드",
      favicon: "/favicon.png",
      logo: {
        src: "./src/assets/donue-logo.png",
        alt: "도뉴",
      },
      defaultLocale: "root",
      locales: {
        root: {
          label: "한국어",
          lang: "ko",
        },
      },
      customCss: ["./src/styles/custom.css"],
      routeMiddleware: "./src/routeData.ts",
      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/png",
            href: "/favicon.png",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            sizes: "180x180",
            href: "/apple-touch-icon.png",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "alternate",
            type: "text/plain",
            href: "/llms.txt",
            title: "LLMs.txt",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "theme-color",
            content: "#CD001A",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: `${site}/og-image.png`,
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:width",
            content: "1200",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:height",
            content: "630",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content: "도뉴 사용 가이드",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: `${site}/og-image.png`,
          },
        },
        {
          tag: "script",
          content: calloutTabsScript,
        },
        {
          tag: "script",
          content: mediaLightboxScript,
        },
      ],
      sidebar: [
        {
          label: "도뉴 사용 가이드",
          link: "/guide/도뉴-사용-가이드/",
        },
        {
          label: "계약 생성",
          items: [{ autogenerate: { directory: "guide/계약 생성" } }],
        },
        {
          label: "계약서 열람 및 서명",
          items: [{ autogenerate: { directory: "guide/계약서 열람 및 서명" } }],
        },
        {
          label: "기업회원 기능",
          items: [{ autogenerate: { directory: "guide/기업회원 기능" } }],
        },
        {
          label: "계약 관리",
          items: [{ autogenerate: { directory: "guide/계약 관리" } }],
        },
        {
          label: "요금제",
          items: [{ autogenerate: { directory: "guide/요금제" } }],
        },
        {
          label: "기타 기능",
          items: [{ autogenerate: { directory: "guide/기타 기능" } }],
        },
        {
          label: "설정",
          items: [{ autogenerate: { directory: "guide/설정" } }],
        },
        {
          label: "더 알아보기",
          items: [
            {
              label: "도뉴 서비스",
              link: "https://donue.co.kr/",
              attrs: {
                target: "_blank",
                rel: "noopener noreferrer",
                title: "새 창에서 열기",
              },
            },
            {
              label: "서비스 소개서",
              link: "https://s3.ap-northeast-2.amazonaws.com/donue/introduce/DONUE+Service+Introduction.pdf",
              attrs: {
                target: "_blank",
                rel: "noopener noreferrer",
                title: "새 창에서 열기",
              },
            },
            {
              label: "공식 블로그",
              link: "https://blog.naver.com/donue_solution",
              attrs: {
                target: "_blank",
                rel: "noopener noreferrer",
                title: "새 창에서 열기",
              },
            },
          ],
        },
      ],
      plugins: [
        starlightObsidianPlugin({
          vault: "vault",
          output: "guide",
          copyFrontmatter: "starlight",
          tableOfContentsOverview: "title",
        }),
        starlightSuccessCalloutPlugin({
          vault: "vault",
          output: "guide",
        }),
      ],
    }),
    fixUntitledCallouts(),
  ],
});
