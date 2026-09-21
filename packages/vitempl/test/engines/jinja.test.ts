import { describe, expect, test } from "vitest";
import { parse } from "vue/compiler-sfc";
import type { TemplateInfo } from "../../src/engine.ts";
import { jinja } from "../../src/engines/jinja.ts";

const components = new Map([["Box", "partials/Box"]]);

interface Options {
  entry?: boolean;
  name?: string;
  templates?: Record<string, TemplateInfo>;
}

function generate(template: string, options: Options = {}) {
  const { descriptor } = parse(`<template>${template}</template>`, {
    templateParseOptions: { whitespace: "preserve" },
  });
  return jinja().generate(descriptor.template!.ast!.children, {
    components,
    name: options.name ?? "pages/index",
    entry: options.entry ?? true,
    templates: new Map(Object.entries(options.templates ?? {})),
  });
}

function code(template: string, options: Options = {}) {
  const { code, errors } = generate(template, options);
  expect(errors).toEqual([]);
  return code;
}

describe("jinja", () => {
  test("переводит цепочку v-if/v-else-if/v-else в if/elif/else", () => {
    expect(
      code('<a v-if="a"></a>\n<b v-else-if="b"></b>\n<i v-else></i>'),
    ).toBe("{% if a %}<a></a>{% elif b %}<b></b>{% else %}<i></i>{% endif %}");
  });

  test("переводит отрицание в условии", () => {
    expect(code('<p v-if="!admin">гость</p>')).toBe(
      "{% if not admin %}<p>гость</p>{% endif %}",
    );
  });

  test("проверяет наличие значения, не переименовывая его", () => {
    expect(code('<p v-if="user != null">{{ user.name }}</p>')).toBe(
      "{% if user is not none %}<p>{{ user.name }}</p>{% endif %}",
    );
  });

  test("переводит проверку на отсутствие значения", () => {
    expect(code('<p v-if="user == null">гость</p>')).toBe(
      "{% if user is none %}<p>гость</p>{% endif %}",
    );
  });

  test("объявляет индекс v-for через set", () => {
    expect(code('<li v-for="(item, i) in items">{{ i }}</li>')).toBe(
      "{% for item in items %}{% set i = loop.index0 %}<li>{{ i }}</li>{% endfor %}",
    );
  });

  test("вызывает макрос компонента через точку", () => {
    expect(
      code('<Box :items="list" />', {
        templates: { "partials/Box": { params: ["items"], hasSlot: false } },
      }),
    ).toBe(
      '{% import "partials/Box.html" as partials_box %}{{ partials_box.render(items=list) }}',
    );
  });

  test("разрешает компоненту подключать сам себя", () => {
    expect(
      code('<Box :items="item.children" />', {
        entry: false,
        name: "partials/Box",
        templates: { "partials/Box": { params: ["items"], hasSlot: false } },
      }),
    ).toBe(
      "{% macro render(item) %}{{ render(items=item.children) }}{% endmacro %}",
    );
  });
});
