import { describe, expect, test } from "vitest";
import {
  createInjectTemplateCall,
  createTemplateContent,
  createTemplateId,
  injectTemplateRuntimeCode,
} from "../../src/utils/template";

describe("createTemplateId", () => {
  test("строит id из имени файла", () => {
    expect(
      createTemplateId("/src/components/CustomButton.sfce.vue", ".sfce.vue"),
    ).toBe("custom-button-template");
  });

  test("приводит snake_case к kebab-case", () => {
    expect(createTemplateId("/src/user_card.sfce.vue", ".sfce.vue")).toBe(
      "user-card-template",
    );
  });

  test("поддерживает другое расширение", () => {
    expect(createTemplateId("/src/user-card.vue", ".vue")).toBe(
      "user-card-template",
    );
  });
});

describe("createTemplateContent", () => {
  test("оборачивает стили в тег style", () => {
    expect(createTemplateContent({ styles: ["a { color: red }"] })).toBe(
      "\n<style>\na { color: red }\n</style>",
    );
  });

  test("добавляет разметку после стилей", () => {
    expect(
      createTemplateContent({
        styles: ["a {}"],
        template: "<a></a>",
      }),
    ).toBe("\n<style>\na {}\n</style><a></a>");
  });

  test("возвращает пустую строку без стилей и разметки", () => {
    expect(createTemplateContent({ styles: [] })).toBe("");
  });
});

describe("createInjectTemplateCall", () => {
  test("экранирует содержимое, ломающее template literal", () => {
    const content = 'a`b${c}"d\\e\nf';

    const calls: Array<[string, string]> = [];
    const run = new Function(
      "_injectTemplate",
      createInjectTemplateCall("t", content),
    );

    run((id: string, value: string) => calls.push([id, value]));

    expect(calls).toEqual([["t", content]]);
  });
});

describe("injectTemplateRuntimeCode", () => {
  function createDocumentStub() {
    const elements = new Map<string, unknown>();
    const appended: Array<{ id: string; innerHTML: string }> = [];

    return {
      appended,
      document: {
        getElementById: (id: string) => elements.get(id) ?? null,
        createElement: () => ({ id: "", innerHTML: "" }),
        body: {
          appendChild(element: { id: string; innerHTML: string }) {
            appended.push(element);
            elements.set(element.id, element);
          },
        },
      },
    };
  }

  test("добавляет шаблон в document", () => {
    const { appended, document } = createDocumentStub();
    const run = new Function(
      "document",
      `${injectTemplateRuntimeCode}; return _injectTemplate;`,
    )(document);

    run("t", "<b>x</b>");

    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ id: "t", innerHTML: "<b>x</b>" });
  });

  test("не добавляет дубликат с тем же id", () => {
    const { appended, document } = createDocumentStub();
    const run = new Function(
      "document",
      `${injectTemplateRuntimeCode}; return _injectTemplate;`,
    )(document);

    run("t", "<b>x</b>");
    run("t", "<b>y</b>");

    expect(appended).toHaveLength(1);
  });

  test("игнорирует пустое содержимое", () => {
    const { appended, document } = createDocumentStub();
    const run = new Function(
      "document",
      `${injectTemplateRuntimeCode}; return _injectTemplate;`,
    )(document);

    run("t", "");

    expect(appended).toHaveLength(0);
  });
});
