<script setup lang="ts">
import ListItem from "../partials/ListItem.vue";

defineProps<{ items: { title: string }[] }>();
</script>

<template>
  <list-item v-for="item in items" :title="item.title" />
</template>
