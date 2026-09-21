<script setup lang="ts">
import BaseButton from "../partials/BaseButton.vue";
import Layout from "../layouts/Layout.vue";
import ListItem from "../partials/ListItem.vue";

defineProps<{ title: string; items: { title: string }[] }>();
</script>

<template>
  <Layout>
    <h1>{{ title }}</h1>
    <BaseButton label="Кнопка" />
    <ul>
      <ListItem v-for="item in items" :title="item.title" />
    </ul>
  </Layout>
</template>

<style>
.page {
  color: red;
}
</style>
