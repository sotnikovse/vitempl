<script setup lang="ts">
import type { ErrorPage } from "@server/types";
import DefaultLayout from "../layouts/DefaultLayout.vue";

defineProps<ErrorPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ status }}</h1>
      <p>{{ message }}</p>
    </main>
  </DefaultLayout>
</template>
