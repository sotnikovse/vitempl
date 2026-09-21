<script setup lang="ts">
import type { List } from "@server/types";

defineProps<{ list: List }>();
</script>

<template>
  <section id="list">
    <h2>{{ list.title }}: страница {{ list.page }}</h2>
    <ul>
      <li v-for="item in list.items" :key="item.title">{{ item.title }}</li>
    </ul>
    <nav class="pagination">
      <a
        v-if="list.hasPrev"
        :href="`/?page=${list.prevPage}`"
        :hx-get="`/fragments/items-list?page=${list.prevPage}`"
        :hx-push-url="`/?page=${list.prevPage}`"
        hx-target="#list"
        hx-swap="outerHTML"
        >Назад</a
      >
      <a
        v-if="list.hasNext"
        :href="`/?page=${list.nextPage}`"
        :hx-get="`/fragments/items-list?page=${list.nextPage}`"
        :hx-push-url="`/?page=${list.nextPage}`"
        hx-target="#list"
        hx-swap="outerHTML"
        >Вперёд</a
      >
    </nav>
  </section>
</template>
