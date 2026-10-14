<script setup lang="ts">
defineProps<{
  label: string;
  name: string;
  type: string;
  autocomplete: string;
  /** Значение поля; `null` — поле пустое */
  value: string | null;
  /** Подсказка под полем; `null` — подсказки нет */
  hint: string | null;
}>();
</script>

<template>
  <label class="form-field">
    <span>{{ label }}</span>
    <input
      :name="name"
      :type="type"
      :value="value"
      :autocomplete="autocomplete"
      required
    />
    <small v-if="hint != null">{{ hint }}</small>
  </label>
</template>

<style>
.form-field {
  display: grid;
  gap: 4px;
}

.form-field input {
  font: inherit;
  padding: 8px 12px;
}

.form-field small {
  color: #666;
}
</style>
