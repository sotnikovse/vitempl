import type { ESLint, Rule } from "eslint";
import { checkSource, type TemplateEngine } from "vitempl";

/**
 * Правило `syntax`: показывает в редакторе те же ошибки неподдерживаемого
 * синтаксиса, что и сборка шаблонов. Шаблонизатор, который определяет
 * поддерживаемый синтаксис, задаётся в `settings.vitempl.engine`.
 */
const syntax: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "синтаксис шаблонов, который поддерживает шаблонизатор",
    },
    schema: [],
  },
  create(context) {
    const settings = context.settings.vitempl as
      { engine?: TemplateEngine } | undefined;
    const engine = settings?.engine;
    if (!engine) {
      throw new Error(
        "@vitempl/eslint-plugin: не задан шаблонизатор в settings.vitempl.engine",
      );
    }
    return {
      Program() {
        for (const { message, loc } of checkSource(
          context.sourceCode.text,
          engine,
        )) {
          // в ESLint столбцы считаются с нуля
          context.report({
            message,
            loc: { line: loc.line, column: loc.column - 1 },
          });
        }
      },
    };
  },
};

const plugin: ESLint.Plugin = {
  meta: { name: "@vitempl/eslint-plugin" },
  rules: { syntax },
};

export default plugin;
