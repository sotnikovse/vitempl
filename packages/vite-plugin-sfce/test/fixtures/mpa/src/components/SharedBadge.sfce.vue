<template>
  <span class="badge"><slot></slot></span>
</template>

<script lang="ts">
class SharedBadge extends HTMLElement {
  constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });
    const template = document.getElementById(
      "shared-badge-template",
    ) as HTMLTemplateElement;
    shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

export default SharedBadge;

declare global {
  interface HTMLElementTagNameMap {
    "shared-badge": SharedBadge;
  }
}
</script>

<style>
.badge {
  color: green;
}
</style>
