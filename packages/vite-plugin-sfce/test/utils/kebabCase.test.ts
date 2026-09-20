import { describe, expect, test } from "vitest";
import { kebabCase } from "../../src/utils/kebabCase";

describe("kebabCase", () => {
  test("преобразует camelCase", () => {
    expect(kebabCase("camelCase")).toBe("camel-case");
  });

  test("преобразует PascalCase", () => {
    expect(kebabCase("PascalCase")).toBe("pascal-case");
  });

  test("преобразует snake_case и верхний регистр", () => {
    expect(kebabCase("snake_case")).toBe("snake-case");
    expect(kebabCase("SNAKE_CASE")).toBe("snake-case");
  });

  test("преобразует пробелы", () => {
    expect(kebabCase("custom button")).toBe("custom-button");
  });
});
