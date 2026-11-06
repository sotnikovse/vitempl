<script setup lang="ts">
import type { LoginPage } from "../types.ts";
import DefaultLayout from "../layouts/DefaultLayout.vue";
import FormField from "../partials/FormField.vue";

defineProps<LoginPage>();
</script>

<template>
  <DefaultLayout :nav="nav">
    <main class="container">
      <h1>{{ title }}</h1>
      <p v-if="error != null" class="error">{{ error }}</p>
      <form class="login-form" method="post" action="/login">
        <FormField
          label="Логин"
          name="login"
          type="text"
          autocomplete="username"
          :value="login"
          :hint="null"
        />
        <FormField
          label="Пароль"
          name="password"
          type="password"
          autocomplete="current-password"
          :value="null"
          hint="Для примера подходит admin / admin"
        />
        <label class="remember">
          <input type="checkbox" name="remember" :checked="remember" />
          Запомнить меня
        </label>
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

.login-form button {
  font: inherit;
  padding: 8px 12px;
}

.remember {
  display: flex;
  gap: 8px;
  align-items: center;
}

.error {
  color: #d33;
}
</style>
