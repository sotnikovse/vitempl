import { describe, expect, test } from "vitest";
import { parseSfc } from "../src/sfc.ts";

function sfc(script: string, template = "<p></p>") {
  return `<script setup lang="ts">\n${script}\n</script>\n\n<template>${template}</template>\n`;
}

describe("parseSfc", () => {
  test("находит импортированные компоненты и пропускает импорты типов", () => {
    const { components, errors } = parseSfc(
      sfc(
        'import type { Page } from "@server/types";\nimport AppHeader from "../partials/AppHeader.vue";\ndefineProps<Page>();',
      ),
    );

    expect(errors).toEqual([]);
    expect([...components]).toEqual([
      [
        "AppHeader",
        { source: "../partials/AppHeader.vue", loc: { line: 3, column: 1 } },
      ],
    ]);
  });

  test("допускает в <script setup> только импорты, типы и defineProps", () => {
    const { errors } = parseSfc(
      sfc(
        'import { ref } from "vue";\ninterface Props { title: string }\nconst props = defineProps<Props>();\nconst count = ref(0);',
      ),
    );

    expect(errors).toEqual([
      {
        message: expect.stringContaining('импорт "vue"'),
        loc: { line: 2, column: 1 },
      },
      {
        message: expect.stringContaining("допускаются только импорты"),
        loc: { line: 5, column: 1 },
      },
    ]);
  });

  test("запрещает обычный <script> и допускает <style>", () => {
    const { errors } = parseSfc(
      "<script>export default {}</script>\n<template><p></p></template>\n<style>p {}</style>\n",
    );

    expect(errors.map((error) => error.message)).toEqual([
      "поддерживается только <script setup>",
    ]);
  });

  test("запрещает <style scoped> и <style module>", () => {
    const { errors } = parseSfc(
      "<template><p></p></template>\n<style scoped>p {}</style>\n",
    );

    expect(errors).toEqual([
      {
        message: expect.stringContaining("<style scoped>"),
        // loc блока SFC указывает на начало содержимого
        loc: { line: 2, column: 15 },
      },
    ]);
  });

  test("сообщает о синтаксической ошибке с позицией", () => {
    const { errors } = parseSfc("<template>\n  <p></template>");

    expect(errors).toEqual([
      { message: expect.any(String), loc: { line: 2, column: 3 } },
    ]);
  });
});
