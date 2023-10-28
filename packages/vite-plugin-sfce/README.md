# vite-plugin-sfce

Плагин vite для работы с кастомными элементы в однофайловом компоненте.

Шаблоны кастомных элементов инжектируются в html, это может быть полезна для для mpa приложений.

> Блок стилей процесситься и добавлется в шаблон.

## Использование

Для хайлайта используются инструменты разработки vue и кастомная трансформация, поэтому файлы должны оканчиваться на `.sfce.vue`.

```vue
<template>
  <div>
    <button>Тест</button>
  </div>
</template>

<script lang="ts">
export default class TestComp extends HTMLElement {
  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })
    const template = document.getElementById(
      'test-comp-template',
    ) as HTMLTemplateElement
    shadowRoot.appendChild(template.content.cloneNode(true))
  }
}
</script>

<style>
:host {
  color: red;
}
</style>
```

## Лицензия

MIT
