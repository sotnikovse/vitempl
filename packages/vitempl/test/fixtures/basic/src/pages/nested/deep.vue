<script setup lang="ts">
import BaseButton from "../../partials/BaseButton.vue";
import Layout from "../../layouts/Layout.vue";

defineProps<{ title: string }>();
</script>

<template>
  <Layout>
    <h1>{{ title }}</h1>
    <BaseButton label="Кнопка" />
  </Layout>
</template>
