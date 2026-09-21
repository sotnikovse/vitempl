<script setup lang="ts">
import type { Nav } from "@server/types";

defineProps<{ links: Nav }>();
</script>

<template>
  <header class="app-header container">
    <span class="logo"><a href="/">Лого</a></span>
    <nav>
      <ul>
        <li v-for="item in links" :key="item.href">
          <a :href="item.href">{{ item.title }}</a>
        </li>
      </ul>
    </nav>
  </header>
</template>
