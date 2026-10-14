<script setup lang="ts">
import type { IndexPage } from "../types.ts";
import DefaultLayout from "../layouts/DefaultLayout.vue";
import ConfirmForm from "../partials/ConfirmForm.vue";
import ListItems from "../partials/ListItems.vue";

defineProps<IndexPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ title }}</h1>
      <div v-if="user != null" class="user">
        <p>Привет, {{ user.name }}!</p>
        <ConfirmForm action="/logout" message="Выйти?">
          <button type="submit">Выйти</button>
        </ConfirmForm>
      </div>
      <p v-else>Гость, <a href="/login">войдите</a>, чтобы увидеть список.</p>
      <ListItems v-if="list != null" :list="list" />
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
