<template>
  <h2><slot name="name">Имя не указано</slot></h2>
  <div>Email: <slot name="email">Нет email</slot></div>
  <div>Телефон: <slot name="phone">Нет телефона</slot></div>
  <div><slot></slot></div>
  <div>
    <alert-button>Перейти</alert-button>
  </div>
</template>

<script lang="ts">
class UserCard extends HTMLElement {
  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })
    const template = document.getElementById(
      'user-card-template',
    ) as HTMLTemplateElement
    shadowRoot.appendChild(template.content.cloneNode(true))
  }
}

export default UserCard

declare global {
  interface HTMLElementTagNameMap {
    'user-card': UserCard
  }
}
</script>

<style>
:host {
  display: grid;
  row-gap: 1rem;
  border-radius: 0.5rem;
  border: 1px solid red;
  padding: 1rem;
}
h2 {
  margin-top: 0;
}
</style>
