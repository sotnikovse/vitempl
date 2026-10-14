<script setup lang="ts">
defineProps<{ action: string; message: string }>();
</script>

<script lang="ts">
// Клиентский скрипт компонента: подключается только к страницам, где есть
// ConfirmForm. Модуль выполняется один раз на страницу, поэтому события
// обрабатываются делегированием, а не поиском «своего» экземпляра.
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  const message = form.dataset.confirm;
  if (message && !confirm(message)) {
    event.preventDefault();
  }
});
</script>

<template>
  <form method="post" :action="action" :data-confirm="message">
    <slot />
  </form>
</template>
