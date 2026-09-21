import Handlebars from "handlebars";
import { describe, expect, test } from "vitest";
import { parse } from "vue/compiler-sfc";
import { handlebars } from "../../src/engines/handlebars.ts";

const components = new Map([
  ["Box", "partials/Box"],
  ["AppItem", "partials/AppItem"],
]);

function generate(template: string) {
  const { descriptor } = parse(`<template>${template}</template>`, {
    templateParseOptions: { whitespace: "preserve" },
  });
  return handlebars().generate(descriptor.template!.ast!.children, {
    components,
    name: "pages/index",
    entry: true,
    templates: new Map(),
  });
}

function code(template: string) {
  const { code, errors } = generate(template);
  expect(errors).toEqual([]);
  return code;
}

function messages(template: string) {
  return generate(template).errors.map((error) => error.message);
}

function render(
  template: string,
  data: object,
  partials: Record<string, string> = {},
) {
  const handlebars = Handlebars.create();
  for (const [name, partial] of Object.entries(partials)) {
    handlebars.registerPartial(name, code(partial));
  }
  return handlebars.compile(code(template))(data);
}

describe("handlebars", () => {
  test("выводит интерполяцию как путь к данным", () => {
    expect(code("<p>{{ user.name }}</p>")).toBe("<p>{{user.name}}</p>");
  });

  test("переводит цепочку v-if/v-else-if/v-else в if/else if/else", () => {
    expect(
      code(
        '<a v-if="a"></a>\n<b v-else-if="b"></b>\n<!-- c -->\n<i v-else></i>',
      ),
    ).toBe("{{#if a}}<a></a>{{else if b}}<b></b>{{else}}<i></i>{{/if}}");
  });

  test("переводит отрицание в условии в unless", () => {
    expect(code('<p v-if="!user">гость</p>')).toBe(
      "{{#unless user}}<p>гость</p>{{/unless}}",
    );
  });

  test("переводит v-for в each с параметрами блока", () => {
    expect(
      code(
        '<li v-for="(item, i) in items" :key="i">{{ item.title }}{{ i }}</li>',
      ),
    ).toBe("{{#each items as |item i|}}<li>{{item.title}}{{i}}</li>{{/each}}");
  });

  test("обращается к данным компонента внутри v-for через ../", () => {
    const template =
      '<li v-for="item in items">{{ title }}: {{ item.title }}</li>';

    expect(code(template)).toBe(
      "{{#each items as |item|}}<li>{{../title}}: {{item.title}}</li>{{/each}}",
    );
    expect(render(template, { title: "T", items: [{ title: "a" }] })).toBe(
      "<li>T: a</li>",
    );
  });

  test("подставляет пути в шаблонную строку атрибута", () => {
    expect(
      code('<a :hx-get="`/items?page=${list.page}&size=5`">далее</a>'),
    ).toBe('<a hx-get="/items?page={{list.page}}&amp;size=5">далее</a>');
  });

  test("выводит булев атрибут по условию", () => {
    expect(code('<input :disabled="locked">')).toBe(
      "<input{{#if locked}} disabled{{/if}}>",
    );
  });

  test("собирает class из статической части и объекта", () => {
    expect(
      code('<p class="a" :class="{ active: isActive, hidden: !visible }"></p>'),
    ).toBe(
      '<p class="a {{#if isActive}}active{{/if}} {{#unless visible}}hidden{{/unless}}"></p>',
    );
  });

  test("экранирует {{ в статическом атрибуте", () => {
    expect(render('<p title="{{x}}"></p>', { x: 1 })).toBe(
      '<p title="{{x}}"></p>',
    );
  });

  test("вызывает компонент как partial-блок с props в параметрах", () => {
    expect(
      code('<AppItem :title="item.title" :list-data="data" label="x" />'),
    ).toBe(
      '{{#> partials/AppItem null title=item.title listData=data label="x"}}{{/partials/AppItem}}',
    );
  });

  test("не передаёт компоненту данные вызывающего шаблона", () => {
    expect(
      render(
        '<Box :label="label" />',
        { title: "T", label: "L" },
        { "partials/Box": "<div>{{ label }}|{{ title }}</div>" },
      ),
    ).toBe("<div>L|</div>");
  });

  test("передаёт содержимое компонента в слот", () => {
    expect(
      render(
        '<Box :label="label"><b>{{ title }}</b></Box>',
        { title: "T", label: "L" },
        { "partials/Box": "<div>{{ label }}<slot /></div>" },
      ),
    ).toBe("<div>L<b>T</b></div>");
  });

  test("не выводит содержимое внешнего слота в компоненте без содержимого", () => {
    expect(
      render(
        "<Box>страница</Box>",
        {},
        {
          "partials/Box": "[<AppItem /><slot />]",
          "partials/AppItem": "<i><slot /></i>",
        },
      ),
    ).toBe("[<i></i>страница]");
  });

  test("сообщает о неподдерживаемом выражении с позицией", () => {
    expect(generate("<p>\n  {{ a + b }}</p>").errors).toEqual([
      {
        message: expect.stringContaining("«a + b» не поддерживается"),
        loc: { line: 2, column: 3 },
      },
    ]);
  });

  test("сообщает о неподдерживаемых директивах", () => {
    expect(
      messages(
        '<button @click="go" v-show="a"></button><input v-model="x"><p v-html="h"></p>',
      ),
    ).toEqual([
      "директива v-on не поддерживается",
      "директива v-show не поддерживается",
      "директива v-model не поддерживается",
      "директива v-html не поддерживается",
    ]);
  });

  test("сообщает о компоненте, который не импортирован", () => {
    expect(messages("<Unknown />")).toEqual([
      "компонент <Unknown> не импортирован в <script setup>",
    ]);
  });

  test("выполняет содержимое слота в данных вызывающего шаблона", () => {
    expect(
      render(
        '<Box :title="name">{{ title }}</Box>',
        { title: "страница", name: "компонент" },
        { "partials/Box": "<div>{{ title }}:<slot /></div>" },
      ),
    ).toBe("<div>компонент:страница</div>");
  });

  test("поддерживает компонент со слотом внутри v-for", () => {
    expect(
      render(
        '<Box v-for="item in items" :title="item.title">{{ item.title }}/{{ page }}</Box>',
        { page: "P", items: [{ title: "a" }, { title: "b" }] },
        { "partials/Box": "<i><slot /></i>" },
      ),
    ).toBe("<i>a/P</i><i>b/P</i>");
  });

  test("поддерживает слот внутри v-for компонента", () => {
    expect(
      render(
        '<Box :items="list">{{ page }}</Box>',
        { page: "P", list: [1, 2] },
        { "partials/Box": '<b v-for="item in items">{{ item }}<slot /></b>' },
      ),
    ).toBe("<b>1P</b><b>2P</b>");
  });

  test("запрещает именованные слоты и слоты с параметрами", () => {
    expect(
      messages(
        '<slot name="footer" /><slot :item="item" /><Box><template #footer>x</template></Box>',
      ),
    ).toEqual([
      "поддерживается только слот по умолчанию без параметров",
      "поддерживается только слот по умолчанию без параметров",
      "именованные слоты не поддерживаются",
      "директива v-slot здесь не поддерживается",
    ]);
  });

  test("запрещает глобальные объекты и служебные переменные Vue", () => {
    expect(messages("{{ Math.PI }}{{ $props.title }}")).toEqual([
      '"Math" не поддерживается: допустимы только данные шаблона',
      '"$props" не поддерживается: допустимы только данные шаблона',
    ]);
  });
});
