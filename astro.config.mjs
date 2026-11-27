// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightObsidianPlugin from "starlight-obsidian";
import { rehypeCalloutTabs, starlightSuccessCalloutPlugin } from "./src/plugins/rehype-callout-tabs.mjs";
import { rehypeImageRows } from "./src/plugins/rehype-image-rows.mjs";
import { rehypeAutoplayVideos } from "./src/plugins/rehype-autoplay-videos.mjs";
import { fixUntitledCallouts } from "./src/plugins/fix-untitled-callouts.mjs";
import { buildSidebarFromVault, watchSortspec } from "./src/lib/sortspec.mjs";

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
    rehypePlugins: [rehypeImageRows, rehypeCalloutTabs, rehypeAutoplayVideos],
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
      ],
      sidebar: [
        ...buildSidebarFromVault({ vaultDir: "vault", output: "guide" }),
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
          ignore: ["**/sortspec.md"],
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
    watchSortspec("vault"),
    {
      name: "guide-client-scripts",
      hooks: {
        "astro:config:setup"({ injectScript }) {
          injectScript(
            "page",
            'import "/src/scripts/callout-tabs.js"; import "/src/scripts/media-lightbox.js";',
          );
        },
      },
    },
  ],
});
