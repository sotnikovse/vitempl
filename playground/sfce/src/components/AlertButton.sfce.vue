<template>
  <button>
    <slot></slot>
  </button>
</template>

<script lang="ts">
class AlertButton extends HTMLElement {
  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })
    const template = document.getElementById(
      'alert-button-template',
    ) as HTMLTemplateElement
    shadowRoot.appendChild(template.content.cloneNode(true))
  }

  connectedCallback() {
    this.shadowRoot?.querySelector('button')?.addEventListener('click', () => {
      alert(`Нажата кнопка "${this.textContent}"`)
    })
  }
}

export default AlertButton

declare global {
  interface HTMLElementTagNameMap {
    'alert-button': AlertButton
  }
}
</script>

<style>
button {
  padding: 0.5rem 0.75rem;
  font-size: 1.125rem;
  color: red;
  background-color: lightgray;
  backdrop-filter: blur(8px);
  border-radius: 0.5rem;
  border-color: lightgray;
}

button:hover {
  border-color: gray;
}
</style>
