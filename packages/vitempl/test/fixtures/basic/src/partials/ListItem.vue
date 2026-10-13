<script lang="ts">
console.log("list-item-script");
</script>

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
