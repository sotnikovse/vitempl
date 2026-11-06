import type { TemplateEngine } from "../engine.ts";
import { jinjaEngine } from "./jinja-like.ts";

/** Тип Rust для типа prop в TypeScript (`number` — целое, как принято в адаптере) */
const RUST_TYPES: Record<string, string> = {
  string: "String",
  number: "i64",
  boolean: "bool",
};

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
    // Rust не выводит тип голого `None`, поэтому он берётся из типа prop
    nullLiteral: (type) => {
      const rust = type && RUST_TYPES[type];
      return rust ? `None::<${rust}>` : undefined;
    },
    // параметр с «пусто» в askama — Option, поэтому значение оборачивается
    nullable: (literal) => `Some(${literal})`,
    binds: true,
    recursion: false,
  });
}
