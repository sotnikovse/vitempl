<script lang="ts">
console.log("base-button-script");
</script>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <button class="base-button">{{ label }}</button>
</template>

<style>
.base-button {
  color: green;
}
</style>
