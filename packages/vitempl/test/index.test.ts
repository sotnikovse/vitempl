import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, createLogger } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { TemplateEngine } from "../src/engine.ts";
import { askama } from "../src/engines/askama.ts";
import { handlebars } from "../src/engines/handlebars.ts";
import vitempl from "../src/index.ts";

const fixture = fileURLToPath(new URL("./fixtures/basic", import.meta.url));

function buildTemplates(
  root: string,
  outDir: string,
  engine: TemplateEngine = handlebars(),
) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [
      vitempl({
        engine,
        outDir: path.join(outDir, "templates"),
      }),
    ],
    build: { outDir: path.join(outDir, "public"), emptyOutDir: true },
  });
}

/** Собирает проект из одной страницы с указанным исходником */
async function buildPage(source: string) {
  const root = await mkdtemp(path.join(tmpdir(), "templates-page-"));
  try {
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await writeFile(path.join(root, "index.html"), "<!--app-html-->");
    await writeFile(path.join(root, "src/pages/index.vue"), source);
    await buildTemplates(root, path.join(root, "dist"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function listFiles(dir: string) {
  const files = await readdir(dir, { recursive: true, withFileTypes: true });
  return files
    .filter((file) => file.isFile())
    .map((file) =>
      path
        .relative(dir, path.join(file.parentPath, file.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
}

describe("vitempl", () => {
  let outDir: string;
  const read = (file: string) => readFile(path.join(outDir, file), "utf-8");

  beforeAll(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "templates-"));
    await buildTemplates(fixture, outDir);
  });

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  test("оборачивает страницу в shell и подключает собранные ассеты", async () => {
    const html = await read("templates/pages/index.hbs");

    expect(html).toMatch(
      /<script type="module" crossorigin src="\/assets\/[\w-]+\.js"><\/script>/,
    );
    expect(html).toMatch(
      /<link rel="stylesheet" crossorigin href="\/assets\/[\w-]+\.css">/,
    );
    expect(html).toContain("<title>{{ title }}</title>");
    expect(html).not.toContain("<!--app-html-->");
    expect(html).not.toContain("/src/");
  });

  test("генерирует шаблоны для заданного шаблонизатора", async () => {
    expect(await read("templates/pages/index.hbs")).toContain(
      "{{#each ../items as |item|}}{{#> partials/ListItem null title=item.title}}{{/partials/ListItem}}{{/each}}",
    );
    expect(await read("templates/fragments/list.hbs")).toBe(
      "{{#each items as |item|}}{{#> partials/ListItem null title=item.title}}{{/partials/ListItem}}{{/each}}",
    );
  });

  /** Стили, подключённые к собранной странице */
  async function styles(page: string) {
    const html = await read(`templates/${page}`);
    const hrefs = [...html.matchAll(/href="(\/assets\/[\w.-]+\.css)"/g)];
    const files = await Promise.all(
      hrefs.map(([, href]) => read(`public${href}`)),
    );
    return files.join("");
  }

  test("подключает к странице стили её самой и её компонентов", async () => {
    const page = await styles("pages/index.hbs");

    expect(page).toContain(".page");
    expect(page).toContain(".item");
  });

  test("не подключает к странице стили компонентов, которых на ней нет", async () => {
    expect(await styles("pages/nested/deep.hbs")).not.toContain(".item");
  });

  test("подключает стили общего компонента из одного файла", async () => {
    const hrefs = async (page: string) =>
      [
        ...(await read(`templates/${page}`)).matchAll(
          /href="(\/assets\/[\w.-]+\.css)"/g,
        ),
      ].map(([, href]) => href);
    const index = await hrefs("pages/index.hbs");
    const deep = await hrefs("pages/nested/deep.hbs");

    const common = index.filter((href) => deep.includes(href));
    expect(common).toHaveLength(1);
    expect(await read(`public${common[0]}`)).toContain(".base-button");
  });

  test("предупреждает о стилях шаблона, которого нет ни на одной странице", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "templates-styles-"));
    const warnings: string[] = [];
    const logger = createLogger("warn");
    logger.warn = (message) => warnings.push(message);
    try {
      for (const dir of ["src/pages", "src/fragments", "src/partials"]) {
        await mkdir(path.join(root, dir), { recursive: true });
      }
      await writeFile(path.join(root, "index.html"), "<!--app-html-->");
      await writeFile(
        path.join(root, "src/pages/index.vue"),
        "<template><p>страница</p></template>",
      );
      await writeFile(
        path.join(root, "src/partials/Only.vue"),
        "<template><p>только во фрагменте</p></template>\n<style>.only { color: red; }</style>",
      );
      await writeFile(
        path.join(root, "src/fragments/list.vue"),
        '<script setup lang="ts">\nimport Only from "../partials/Only.vue";\n</script>\n<template><Only /></template>',
      );

      await build({
        root,
        configFile: false,
        customLogger: logger,
        plugins: [
          vitempl({
            engine: handlebars(),
            outDir: path.join(root, "dist/templates"),
          }),
        ],
        build: { outDir: path.join(root, "dist/public"), emptyOutDir: true },
      });

      expect(warnings.join("\n")).toContain(
        "src/partials/Only.vue: блок <style> не попадёт в сборку",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

  test("собирает только используемые шаблоны с сохранением вложенности", async () => {
    expect(await listFiles(path.join(outDir, "templates"))).toEqual([
      "fragments/list.hbs",
      "layouts/Layout.hbs",
      "pages/index.hbs",
      "pages/nested/deep.hbs",
      "partials/BaseButton.hbs",
      "partials/ListItem.hbs",
    ]);
  });

  test("не оставляет HTML страниц в папке статики", async () => {
    const files = await listFiles(path.join(outDir, "public"));

    expect(files.filter((file) => file.endsWith(".html"))).toEqual([]);
  });

  test("прерывает сборку, если импортированный компонент не найден", async () => {
    await expect(
      buildPage(
        '<script setup>\nimport Missing from "../partials/Missing.vue";\n</script>\n<template><Missing /></template>',
      ),
    ).rejects.toThrow(
      'src/pages/index.vue:2:1: компонент "../partials/Missing.vue" не найден',
    );
  });

  test("прерывает сборку при ошибке компиляции", async () => {
    await expect(
      buildPage('<template><p @click="go"></p></template>'),
    ).rejects.toThrow(
      /src\/pages\/index\.vue:1:\d+: директива v-on не поддерживается/,
    );
  });
});

describe("vitempl с askama", () => {
  let outDir: string;
  const read = (file: string) => readFile(path.join(outDir, file), "utf-8");

  beforeAll(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "templates-askama-"));
    await buildTemplates(fixture, outDir, askama());
  });

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  test("собирает шаблоны с расширением шаблонизатора", async () => {
    expect(await listFiles(path.join(outDir, "templates"))).toContain(
      "pages/index.html",
    );
  });

  test("делает из компонента макрос с его данными", async () => {
    expect(await read("templates/partials/ListItem.html")).toBe(
      "{% macro render(title) %}<li>{{ title }}</li>{% endmacro %}",
    );
  });

  test("импортирует компоненты страницы и передаёт им только их данные", async () => {
    const page = await read("templates/pages/index.html");
    expect(page).toContain(
      '{% import "layouts/Layout.html" as layouts_layout %}',
    );
    expect(page).toContain(
      '{% import "partials/ListItem.html" as partials_list_item %}',
    );
    expect(page).toContain(
      "{% for item in items %}{{ partials_list_item::render(title=item.title) }}{% endfor %}",
    );
  });

  test("передаёт содержимое страницы в слот layout", async () => {
    const page = await read("templates/pages/index.html");
    expect(page).toContain("{% call layouts_layout::render() %}");
    expect(page).toContain("{% endcall %}");
    expect(await read("templates/layouts/Layout.html")).toBe(
      "{% macro render() %}<main>{{ caller() }}</main>{% endmacro %}",
    );
  });
});
