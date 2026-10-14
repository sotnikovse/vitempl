import type { TemplateEngine } from "vitempl";
import { askama } from "vitempl/askama";
import { handlebars } from "vitempl/handlebars";
import { jinja } from "vitempl/jinja";

/**
 * Шаблонизатор, под который собираются шаблоны: переменная `ENGINE`
 * (`handlebars`, `askama` или `jinja`). Исходники шаблонов от него не зависят.
 */
const engines: Record<string, () => TemplateEngine> = {
  handlebars,
  askama,
  jinja,
};

export const engineName = process.env.ENGINE ?? "handlebars";

export function createEngine() {
  const create = engines[engineName];
  if (!create) {
    throw new Error(
      `Неизвестный ENGINE "${engineName}", допустимы: ${Object.keys(engines).join(", ")}`,
    );
  }
  return create();
}
