import type { TemplateDiagnostic, TemplateEngine } from "./engine.ts";
import { componentTags, parseSfc } from "./sfc.ts";

/**
 * Проверяет исходник шаблона без сборки: ошибки разбора SFC и синтаксис,
 * который не поддерживает шаблонизатор. Те же ошибки выдаёт сборка —
 * функция нужна инструментам вроде линтера.
 */
export function checkSource(
  source: string,
  engine: TemplateEngine,
): TemplateDiagnostic[] {
  const sfc = parseSfc(source);
  const { errors } = engine.generate(
    sfc.descriptor.template?.ast?.children ?? [],
    {
      // для проверки важно только, какие компоненты импортированы:
      // остальные шаблоны при проверке одного файла неизвестны
      components: componentTags(sfc, (source) => source),
      name: "",
      entry: false,
      templates: new Map(),
    },
  );
  return [...sfc.errors, ...errors];
}
