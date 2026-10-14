<script setup lang="ts">
import type { List } from "../types.ts";
import ListItems from "../partials/ListItems.vue";

defineProps<{ list: List }>();
</script>

<template>
  <ListItems :list="list" />
</template>
