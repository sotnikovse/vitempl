<script setup lang="ts">
import type { AboutPage } from "../types.ts";
import DefaultLayout from "../layouts/DefaultLayout.vue";

defineProps<AboutPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </main>
  </DefaultLayout>
</template>
