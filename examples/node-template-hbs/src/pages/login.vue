<script setup lang="ts">
import type { LoginPage } from "@server/types";
import DefaultLayout from "../layouts/DefaultLayout.vue";

defineProps<LoginPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ title }}</h1>
      <p v-if="error" class="error">{{ error }}</p>
      <form class="login-form" method="post" action="/login">
        <input
          name="login"
          placeholder="admin"
          autocomplete="username"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="admin"
          autocomplete="current-password"
          required
        />
        <button type="submit">Войти</button>
      </form>
    </main>
  </DefaultLayout>
</template>

<style>
.login-form {
  display: grid;
  gap: 12px;
  max-width: 320px;
}

.login-form input,
.login-form button {
  font: inherit;
  padding: 8px 12px;
}

.error {
  color: #d33;
}
</style>
