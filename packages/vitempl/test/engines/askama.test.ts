import { describe, expect, test } from "vitest";
import { parse } from "vue/compiler-sfc";
import type { TemplateInfo } from "../../src/engine.ts";
import { askama } from "../../src/engines/askama.ts";

const components = new Map([
  ["Box", "partials/Box"],
  ["AppItem", "partials/AppItem"],
]);

interface Options {
  /** Шаблон — страница или фрагмент: его не оборачивает макрос */
  entry?: boolean;
  name?: string;
  templates?: Record<string, TemplateInfo>;
}

function generate(template: string, options: Options = {}) {
  const { descriptor } = parse(`<template>${template}</template>`, {
    templateParseOptions: { whitespace: "preserve" },
  });
  return askama().generate(descriptor.template!.ast!.children, {
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

function messages(template: string, options: Options = {}) {
  return generate(template, options).errors.map((error) => error.message);
}

describe("askama", () => {
  test("выводит интерполяцию как путь к данным", () => {
    expect(code("<p>{{ user.name }}</p>")).toBe("<p>{{ user.name }}</p>");
  });

  test("оборачивает компонент в макрос с данными, которые он использует", () => {
    expect(code("<p>{{ title }}{{ user.name }}</p>", { entry: false })).toBe(
      "{% macro render(title, user) %}<p>{{ title }}{{ user.name }}</p>{% endmacro %}",
    );
  });

  test("не оборачивает в макрос страницу и фрагмент", () => {
    expect(code("<p>{{ title }}</p>")).toBe("<p>{{ title }}</p>");
  });

  test("переводит цепочку v-if/v-else-if/v-else", () => {
    expect(
      code('<a v-if="a"></a>\n<b v-else-if="b"></b>\n<i v-else></i>'),
    ).toBe(
      "{% if a %}<a></a>{% else if b %}<b></b>{% else %}<i></i>{% endif %}",
    );
  });

  test("переводит отрицание в условии", () => {
    expect(code('<p v-if="!admin">гость</p>')).toBe(
      "{% if !admin %}<p>гость</p>{% endif %}",
    );
  });

  test("связывает проверенное на null значение с именем", () => {
    expect(code('<p v-if="user != null">{{ user.name }}</p>')).toBe(
      "{% if let Some(user) = user %}<p>{{ user.name }}</p>{% endif %}",
    );
  });

  test("подставляет связанное имя вместо пути к значению", () => {
    expect(code('<p v-if="page.user != null">{{ page.user.name }}</p>')).toBe(
      "{% if let Some(user) = page.user %}<p>{{ user.name }}</p>{% endif %}",
    );
  });

  test("переводит проверку на отсутствие значения", () => {
    expect(code('<p v-if="user == null">гость</p>')).toBe(
      "{% if user.is_none() %}<p>гость</p>{% endif %}",
    );
  });

  test("переводит сравнение с литералом", () => {
    expect(code('<a v-if="page > 1">назад</a>')).toBe(
      "{% if page > 1 %}<a>назад</a>{% endif %}",
    );
  });

  test("переводит v-for, вторая переменная становится индексом", () => {
    expect(code('<li v-for="(item, i) in items">{{ i }}{{ item }}</li>')).toBe(
      "{% for item in items %}{% let i = loop.index0 %}<li>{{ i }}{{ item }}</li>{% endfor %}",
    );
  });

  test("вызывает компонент как макрос и импортирует его", () => {
    expect(
      code('<Box :items="list" />', {
        templates: { "partials/Box": { params: ["items"], hasSlot: false } },
      }),
    ).toBe(
      '{% import "partials/Box.html" as partials_box %}{{ partials_box::render(items=list) }}',
    );
  });

  test("передаёт содержимое компонента со слотом через call", () => {
    expect(
      code('<Box :items="list"><b>{{ title }}</b></Box>', {
        templates: { "partials/Box": { params: ["items"], hasSlot: true } },
      }),
    ).toBe(
      '{% import "partials/Box.html" as partials_box %}{% call partials_box::render(items=list) %}<b>{{ title }}</b>{% endcall %}',
    );
  });

  test("не передаёт компоненту данные, которые он не использует", () => {
    expect(
      code('<Box :items="list" :extra="title" />', {
        templates: { "partials/Box": { params: ["items"], hasSlot: false } },
      }),
    ).toBe(
      '{% import "partials/Box.html" as partials_box %}{{ partials_box::render(items=list) }}',
    );
  });

  test("сообщает о данных компонента, которые не переданы", () => {
    expect(
      messages("<Box />", {
        templates: { "partials/Box": { params: ["items"], hasSlot: false } },
      }),
    ).toEqual([
      'компонент <Box> обращается к данным "items", но они не переданы',
    ]);
  });

  test("превращает слот компонента в caller", () => {
    expect(code("<div><slot /></div>", { entry: false })).toBe(
      "{% macro render() %}<div>{{ caller() }}</div>{% endmacro %}",
    );
  });

  test("запрещает слот на странице", () => {
    expect(messages("<div><slot /></div>")).toEqual([
      "слот поддерживается только в компоненте: страницу и фрагмент сервер рендерит целиком",
    ]);
  });

  test("запрещает компонент, который подключает сам себя", () => {
    expect(messages("<Box />", { entry: false, name: "partials/Box" })).toEqual(
      ["askama не поддерживает компонент, который подключает сам себя"],
    );
  });

  test("экранирует разделители шаблонизатора в тексте", () => {
    expect(code("<p>{% if %} и {# note #}</p>")).toBe(
      '<p>{{ "{%" }} if %} и {{ "{#" }} note #}</p>',
    );
  });

  test("переводит привязанные атрибуты и булев атрибут", () => {
    expect(
      code('<button :formaction="item.href" :disabled="item.done">да</button>'),
    ).toBe(
      '<button formaction="{{ item.href }}"{% if item.done %} disabled{% endif %}>да</button>',
    );
  });

  test("переводит объект в :class в условия", () => {
    expect(code('<i class="icon" :class="{ active: item.done }" />')).toBe(
      '<i class="icon {% if item.done %}active{% endif %}"></i>',
    );
  });
});
