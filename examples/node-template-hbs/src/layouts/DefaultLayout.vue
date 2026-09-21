<script setup lang="ts">
import type { Nav } from "@server/types";
import AppFooter from "../partials/AppFooter.vue";
import AppHeader from "../partials/AppHeader.vue";

defineProps<{ nav: Nav }>();
</script>

<template>
  <AppHeader :links="nav" />
  <slot />
  <AppFooter />
</template>
