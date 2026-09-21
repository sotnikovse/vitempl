import path from "node:path";
import { describe, expect, test } from "vitest";
import { isInside } from "../src/utils.ts";

describe("isInside", () => {
  const dir = path.resolve("/project/src");

  test("возвращает true для файла внутри папки", () => {
    expect(isInside(dir, path.join(dir, "partials/header.hbs"))).toBe(true);
  });

  test("возвращает false для самой папки", () => {
    expect(isInside(dir, dir)).toBe(false);
  });

  test("возвращает false для файла вне папки", () => {
    expect(isInside(dir, path.resolve("/project/secret.hbs"))).toBe(false);
  });

  test("не путает файл, имя которого начинается с точек, с выходом из папки", () => {
    expect(isInside(dir, path.join(dir, "..hidden.hbs"))).toBe(true);
  });
});
