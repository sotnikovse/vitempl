import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { handlebars } from "vitempl/handlebars";
import vueParser from "vue-eslint-parser";
import { describe, expect, test } from "vitest";
import plugin from "../src/index.ts";

function lint(
  source: string,
  settings: Record<string, unknown> = { vitempl: { engine: handlebars() } },
) {
  return new Linter()
    .verify(
      source,
      [
        {
          files: ["**/*.vue"],
          languageOptions: {
            parser: vueParser,
            parserOptions: { parser: tsParser, sourceType: "module" },
          },
          plugins: { vitempl: plugin },
          settings,
          rules: { "vitempl/syntax": "error" },
        },
      ],
      { filename: "Component.vue" },
    )
    .map(({ line, column, message }) => ({ line, column, message }));
}

describe("syntax", () => {
  test("сообщает о неподдерживаемом синтаксисе с позицией в файле", () => {
    expect(
      lint(
        '<script setup lang="ts">\nimport { ref } from "vue";\n</script>\n\n<template>\n  <p @click="go">{{ a + b }}</p>\n</template>\n',
      ),
    ).toEqual([
      {
        line: 2,
        column: 1,
        message: expect.stringContaining('импорт "vue"'),
      },
      { line: 6, column: 6, message: "директива v-on не поддерживается" },
      {
        line: 6,
        column: 18,
        message: expect.stringContaining("«a + b» не поддерживается"),
      },
    ]);
  });

  test("не сообщает об ошибках в поддерживаемом шаблоне", () => {
    expect(
      lint(
        '<script setup lang="ts">\nimport AppItem from "./AppItem.vue";\n\ndefineProps<{ items: { title: string }[] }>();\n</script>\n\n<template>\n  <app-item v-for="item in items" :title="item.title" />\n</template>\n',
      ),
    ).toEqual([]);
  });

  test("требует указать шаблонизатор в настройках", () => {
    expect(() => lint("<template><p></p></template>", {})).toThrow(
      "settings.vitempl.engine",
    );
  });
});
