<script setup lang="ts">
import type { List } from "@server/types";
import ListItems from "../partials/ListItems.vue";

defineProps<{ list: List }>();
</script>

<template>
  <ListItems :list="list" />
</template>
