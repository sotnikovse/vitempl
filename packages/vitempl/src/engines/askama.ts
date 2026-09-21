import type { TemplateEngine } from "../engine.ts";
import { jinjaEngine } from "./jinja-like.ts";

/**
 * askama: компилируемые в Rust шаблоны на основе Jinja.
 *
 * Шаблоны становятся частью бинарника при сборке сервера, данные приходят
 * из структуры, поэтому выражения в них — выражения Rust: условие должно
 * быть `bool`, а необязательное значение проверяется на null
 * (`user != null` превращается в `{% if let Some(user) = user %}`).
 */
export function askama(): TemplateEngine {
  return jinjaEngine({
    name: "askama",
    extension: ".html",
    elseIf: "else if",
    assign: "let",
    namespace: "::",
    not: (condition) => `!${condition}`,
    and: "&&",
    or: "||",
    some: (path, alias) => `let Some(${alias}) = ${path}`,
    none: (path) => `${path}.is_none()`,
    binds: true,
    recursion: false,
  });
}
