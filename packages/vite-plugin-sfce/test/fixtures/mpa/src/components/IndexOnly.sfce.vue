<template>
  <p>index only</p>
</template>

<script lang="ts">
class IndexOnly extends HTMLElement {
  constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });
    const template = document.getElementById(
      "index-only-template",
    ) as HTMLTemplateElement;
    shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

export default IndexOnly;
</script>

<style>
p {
  color: blue;
}
</style>
