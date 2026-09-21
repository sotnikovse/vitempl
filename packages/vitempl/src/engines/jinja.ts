import type { TemplateEngine } from "../engine.ts";
import { jinjaEngine } from "./jinja-like.ts";

/**
 * Jinja: шаблоны для Jinja2 (Python) и совместимых с ним движков.
 *
 * Шаблоны читаются во время работы сервера, данные — словарь, поэтому
 * условие может быть любым значением, а экранирование включается
 * на стороне сервера (`autoescape`).
 */
export function jinja(): TemplateEngine {
  return jinjaEngine({
    name: "jinja",
    extension: ".html",
    elseIf: "elif",
    assign: "set",
    namespace: ".",
    not: (condition) => `not ${condition}`,
    and: "and",
    or: "or",
    some: (path) => `${path} is not none`,
    none: (path) => `${path} is none`,
    binds: false,
    recursion: true,
  });
}
