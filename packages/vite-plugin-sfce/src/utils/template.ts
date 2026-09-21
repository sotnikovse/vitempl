import { parse } from "node:path";
import { kebabCase } from "./kebabCase.ts";

/**
 * Идентификатор `<template>` в итоговом HTML.
 * Выводится из имени файла, чтобы совпадать с id, который ищет
 * сам пользовательский элемент (`document.getElementById`).
 */
export function createTemplateId(fileId: string, extension: string): string {
  const base = parse(fileId).base;
  const name = base.endsWith(extension)
    ? base.slice(0, -extension.length)
    : base;

  return `${kebabCase(name)}-template`;
}

/**
 * Собирает содержимое `<template>`: стили оборачиваются в `<style>`,
 * затем добавляется разметка компонента.
 */
export function createTemplateContent(options: {
  styles: string[];
  template?: string;
}): string {
  const blocks = options.styles.map((style) => `\n<style>\n${style}\n</style>`);

  if (options.template) {
    blocks.push(options.template);
  }

  return blocks.join("");
}

/**
 * Вызов инъекции шаблона в dev-режиме.
 * Содержимое экранируется через JSON, чтобы разметка с кавычками,
 * обратными слэшами и интерполяциями не ломала JS-модуль.
 */
export function createInjectTemplateCall(
  templateId: string,
  content: string,
): string {
  return `_injectTemplate(${JSON.stringify(templateId)}, ${JSON.stringify(content)})`;
}

/**
 * Рантайм-функция, которая добавляется в HTML в dev-режиме.
 */
export const injectTemplateRuntimeCode = `function _injectTemplate(id, content) {
  if (!document.getElementById(id) && content) {
    const el = document.createElement('template')
    el.id = id
    el.innerHTML = content
    document.body.appendChild(el)
  }
}`;
