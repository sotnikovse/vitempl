<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <li>{{ title }}</li>
</template>

<style>
.item {
  color: blue;
}
</style>
