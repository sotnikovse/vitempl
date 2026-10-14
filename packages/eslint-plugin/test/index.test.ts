import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { askama } from "vitempl/askama";
import { handlebars } from "vitempl/handlebars";
import vueParser from "vue-eslint-parser";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import plugin from "../src/index.ts";

function lint(
  source: string,
  settings: Record<string, unknown> = { vitempl: { engine: handlebars() } },
  filename = "Component.vue",
) {
  return new Linter({ cwd: path.dirname(path.resolve(filename)) })
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
      { filename },
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

  test("сообщает о выражении в привязке атрибута, которого нет в сборке", () => {
    expect(
      lint(`<template>\n  <a :title="a ? 'x' : 'y'">о</a>\n</template>\n`),
    ).toEqual([
      {
        line: 2,
        column: 6,
        message: expect.stringContaining("не поддерживается"),
      },
    ]);
  });

  test("не сообщает о поддерживаемых привязках атрибутов", () => {
    expect(
      lint(
        `<template>\n  <input :value="user.name" :disabled="!locked" :class="{ on: active }" />\n</template>\n`,
      ),
    ).toEqual([]);
  });

  describe("тип «пусто» в askama", () => {
    const settings = { vitempl: { engine: askama() } };
    const page = (prop: string) =>
      `<script setup lang="ts">\nimport Field from "./Field.vue";\n</script>\n\n<template>\n  <Field :${prop}="null" />\n</template>\n`;
    const field = (type: string) =>
      `<script setup lang="ts">\ndefineProps<{ hint: ${type} }>();\n</script>\n<template><p>{{ hint }}</p></template>\n`;
    let dir: string;
    const lintPage = (type: string) => {
      writeFileSync(path.join(dir, "Field.vue"), field(type));
      return lint(page("hint"), settings, path.join(dir, "Page.vue"));
    };

    beforeAll(() => {
      dir = mkdtempSync(path.join(tmpdir(), "vitempl-lint-"));
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    test("берёт тип prop из файла компонента", () => {
      expect(lintPage("string | null")).toEqual([]);
    });

    test("сообщает, если тип prop вывести нельзя", () => {
      expect(lintPage("{ a: string } | null")).toEqual([
        {
          line: 6,
          column: 10,
          message: expect.stringContaining("не может вывести тип «пусто»"),
        },
      ]);
    });

    test("не сообщает об ошибке, если файл компонента не прочитать", () => {
      expect(
        lint(
          page("hint").replace("./Field.vue", "./Missing.vue"),
          settings,
          path.join(dir, "Page.vue"),
        ),
      ).toEqual([]);
    });
  });

  test("требует указать шаблонизатор в настройках", () => {
    expect(() => lint("<template><p></p></template>", {})).toThrow(
      "settings.vitempl.engine",
    );
  });
});
