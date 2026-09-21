import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "ru-RU",
  title: "vitempl",
  description: "Шаблоны для серверного рендеринга из Vue SFC",
  markdown: {
    config(md) {
      // в инлайн-коде встречается синтаксис шаблонов (`{{> page}}`),
      // Vue не должен разбирать его как интерполяцию
      const codeInline = md.renderer.rules.code_inline!;
      md.renderer.rules.code_inline = (tokens, idx, ...rest) => {
        tokens[idx].attrSet("v-pre", "");
        return codeInline(tokens, idx, ...rest);
      };
    },
  },
  themeConfig: {
    nav: [{ text: "Документация", link: "/introduction" }],

    sidebar: [
      {
        text: "vitempl",
        items: [
          { text: "Введение", link: "/introduction" },
          { text: "Синтаксис", link: "/syntax" },
          { text: "Сборка", link: "/build" },
          { text: "Шаблонизаторы", link: "/engines" },
          { text: "ESLint", link: "/eslint" },
          { text: "Пример", link: "/example" },
        ],
      },
    ],
  },
});
