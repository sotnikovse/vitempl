<template>
  <h1>Тест</h1>
  <div>
    <button>Кнопка</button>
  </div>
</template>

<script lang="ts">
class TestComp extends HTMLElement {
  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })
    const template = document.getElementById(
      'test-comp-template',
    ) as HTMLTemplateElement
    shadowRoot.appendChild(template.content.cloneNode(true))
  }

  connectedCallback() {
    this.shadowRoot?.querySelector('button')?.addEventListener('click', () => {
      alert('Тестовый компонент')
    })
  }
}

export default TestComp

declare global {
  interface HTMLElementTagNameMap {
    'test-comp': TestComp
  }
}
</script>

<style>
:host {
  display: grid;
  row-gap: 1rem;
  backdrop-filter: blur(8px);
}
</style>
