import { describe, expect, test } from "vitest";
import { createRollupError } from "../../src/utils/error";

describe("createRollupError", () => {
  test("переносит основные поля ошибки", () => {
    const result = createRollupError(
      "/src/components/Button.sfce.vue",
      new SyntaxError("unexpected token"),
    );

    expect(result.id).toBe("/src/components/Button.sfce.vue");
    expect(result.plugin).toBe("vite-plugin-sfce");
    expect(result.message).toBe("unexpected token");
    expect(result.name).toBe("SyntaxError");
    expect(result.stack).toBeTypeOf("string");
  });

  test("добавляет позицию, если у ошибки есть код и loc", () => {
    const error = Object.assign(new SyntaxError("broken template"), {
      code: 42,
      loc: { start: { line: 3, column: 7 } },
    });

    const result = createRollupError("/src/components/Button.sfce.vue", error);

    expect(result.loc).toEqual({
      file: "/src/components/Button.sfce.vue",
      line: 3,
      column: 7,
    });
  });

  test("не добавляет позицию без loc", () => {
    const result = createRollupError(
      "/src/components/Button.sfce.vue",
      new SyntaxError("broken template"),
    );

    expect(result.loc).toBeUndefined();
  });
});
