import path from "node:path";
import { describe, expect, test } from "vitest";
import { collectTemplates } from "../src/graph.ts";

const srcDir = path.resolve("/project/src");
const file = (name: string) => path.join(srcDir, name);

/** SFC, который импортирует перечисленные компоненты */
function sfc(...imports: string[]) {
  const lines = imports.map(
    (source, index) => `import C${index} from "${source}";`,
  );
  return `<script setup lang="ts">\n${lines.join("\n")}\n</script>\n<template><p></p></template>\n`;
}

function collect(entries: string[], files: Record<string, string>) {
  const sources = new Map(
    Object.entries(files).map(([name, source]) => [file(name), source]),
  );
  return collectTemplates(entries.map(file), {
    srcDir,
    load: async (path) => sources.get(path),
  });
}

describe("collectTemplates", () => {
  test("собирает только шаблоны, достижимые из входов", async () => {
    const templates = await collect(["pages/index.vue"], {
      "pages/index.vue": sfc("../partials/Used.vue"),
      "partials/Used.vue": sfc(),
      "partials/Unused.vue": sfc(),
    });

    expect([...templates.keys()]).toEqual([
      file("pages/index.vue"),
      file("partials/Used.vue"),
    ]);
  });

  test("обходит вложенные импорты", async () => {
    const templates = await collect(["pages/index.vue"], {
      "pages/index.vue": sfc("../layouts/Default.vue"),
      "layouts/Default.vue": sfc("../partials/Header.vue"),
      "partials/Header.vue": sfc("./Logo.vue"),
      "partials/Logo.vue": sfc(),
    });

    expect([...templates.keys()]).toEqual([
      file("pages/index.vue"),
      file("layouts/Default.vue"),
      file("partials/Header.vue"),
      file("partials/Logo.vue"),
    ]);
  });

  test("обходит циклические импорты без зацикливания", async () => {
    const templates = await collect(["pages/index.vue"], {
      "pages/index.vue": sfc("../partials/Tree.vue"),
      "partials/Tree.vue": sfc("./Tree.vue"),
    });

    expect([...templates.keys()]).toEqual([
      file("pages/index.vue"),
      file("partials/Tree.vue"),
    ]);
  });

  test("выбрасывает ошибку, если импортированный компонент не найден", async () => {
    await expect(
      collect(["pages/index.vue"], {
        "pages/index.vue": sfc("../partials/Missing.vue"),
      }),
    ).rejects.toThrow(
      `${file("pages/index.vue")}:2:1: компонент "../partials/Missing.vue" не найден: ${file("partials/Missing.vue")}`,
    );
  });

  test("указывает вход, из которого импортирован компонент с ошибкой", async () => {
    await expect(
      collect(["pages/about.vue"], {
        "pages/about.vue": sfc("../layouts/Default.vue"),
        "layouts/Default.vue": sfc("../partials/Missing.vue"),
      }),
    ).rejects.toThrow(`(вход ${file("pages/about.vue")})`);
  });

  test("выбрасывает ошибку, если компонент вне папки исходников", async () => {
    await expect(
      collect(["pages/index.vue"], {
        "pages/index.vue": sfc("../../Secret.vue"),
      }),
    ).rejects.toThrow("находится вне папки исходников");
  });
});
