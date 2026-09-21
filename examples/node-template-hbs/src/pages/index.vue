<script setup lang="ts">
import type { IndexPage } from "@server/types";
import DefaultLayout from "../layouts/DefaultLayout.vue";
import ListItems from "../partials/ListItems.vue";

defineProps<IndexPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ title }}</h1>
      <div v-if="user" class="user">
        <p>Привет, {{ user.name }}!</p>
        <form method="post" action="/logout">
          <button type="submit">Выйти</button>
        </form>
      </div>
      <p v-else>Гость, <a href="/login">войдите</a>, чтобы увидеть список.</p>
      <ListItems v-if="list" :list="list" />
    </main>
  </DefaultLayout>
</template>

<style>
.user {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
