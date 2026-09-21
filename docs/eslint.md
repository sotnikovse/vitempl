# ESLint

Плагин `@vitempl/eslint-plugin` показывает в редакторе те же ошибки неподдерживаемого синтаксиса, что и сборка: правило `vitempl/syntax` выполняет ту же проверку (`checkSource` из `vitempl`). Шаблонизатор, который определяет поддерживаемый синтаксис, задаётся в `settings.vitempl.engine`.

```ts [eslint.config.ts]
import tsParser from "@typescript-eslint/parser";
import vitempl from "@vitempl/eslint-plugin";
import { handlebars } from "vitempl/handlebars";
import vueParser from "vue-eslint-parser";

export default [
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, sourceType: "module" },
    },
    plugins: { vitempl },
    settings: { vitempl: { engine: handlebars() } },
    rules: { "vitempl/syntax": "error" },
  },
];
```

Для разбора `.vue` нужен `vue-eslint-parser`, для `<script setup lang="ts">` — `@typescript-eslint/parser`. ESLint загружает конфиг на TypeScript через `jiti`. Чтобы ошибки были видны при написании шаблона, в редакторе нужно расширение ESLint.
