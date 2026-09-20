# vite-plugin-sfce

Плагин vite для работы с пользовательскими элементами (Custom Elements) в формате однофайловых компонентов Vue.

Ориентирован на MPA: шаблон и стили компонента встраиваются в HTML той страницы, где он используется.

- Компиляция SFC - обработка однофайловых компонентов Vue как пользовательских элементов
- Интеграция стилей - CSS стили включаются в shadow DOM элементов
- Поддержка TypeScript - полная поддержка TypeScript в блоках скриптов

> Стили компонентов обрабатываются и добавляются непосредственно в шаблон элемента.

> Требуется Vite 8: для транспиляции блоков `<script>` используется `transformWithOxc`.

## Как это работает

- Шаблон и стили каждого компонента собираются в один `<template>` с id вида `<имя-файла>-template` (например, `CustomButton.sfce.vue` → `custom-button-template`).
- В dev-режиме шаблон добавляется на страницу в рантайме, в сборке — встраивается в HTML той страницы, где используется компонент.
- Имена `.sfce`-файлов должны различаться: id шаблона выводится из имени файла, а не из пути.
- `<script setup>` не поддерживается — элемент описывается классом в блоке `<script>`.

## Использование

```bash
npm install -D vite-plugin-sfce
```

vite.config.ts

```ts
import { defineConfig } from "vite";
import vitePluginSfce from "vite-plugin-sfce";

export default defineConfig({
  plugins: [vitePluginSfce()],
});
```

components/CustomButton.sfce.vue

```vue
<template>
  <div role="button">
    <span>Кнопка</span>
  </div>
</template>

<script lang="ts">
class CustomButton extends HTMLElement {
  constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });
    const template = document.getElementById(
      "custom-button-template",
    ) as HTMLTemplateElement;
    shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.shadowRoot
      ?.querySelector('[role="button"]')
      ?.addEventListener("click", () => {
        alert("Нажата кнопка");
      });
  }
}

export default CustomButton;

declare global {
  interface HTMLElementTagNameMap {
    "custom-button": CustomButton;
  }
}
</script>

<style>
:host {
  color: red;
}
</style>
```

main.ts

```ts
import CustomButton from "./components/CustomButton.sfce.vue";
customElements.define("custom-button", CustomButton);
```

## Конфигурация

### `extension`

- **Тип:** `string`
- **По умолчанию:** `'.sfce.vue'`

Расширения файлов для обработки как SFC компоненты пользовательских элементов.

## Лицензия

MIT
