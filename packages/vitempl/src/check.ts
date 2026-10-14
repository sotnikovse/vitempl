import { readFileSync } from "node:fs";
import path from "node:path";
import type { PropType, TemplateDiagnostic, TemplateEngine } from "./engine.ts";
import { componentTags, parseSfc } from "./sfc.ts";

export interface CheckOptions {
  /**
   * Путь к проверяемому файлу. По нему читаются исходники импортированных
   * компонентов, чтобы знать типы их props; без него типы неизвестны, и
   * ошибки, которые от них зависят, не сообщаются — их покажет сборка.
   */
  file?: string;
}

/**
 * Проверяет исходник шаблона без сборки: ошибки разбора SFC и синтаксис,
 * который не поддерживает шаблонизатор. Те же ошибки выдаёт сборка —
 * функция нужна инструментам вроде линтера.
 */
export function checkSource(
  source: string,
  engine: TemplateEngine,
  options: CheckOptions = {},
): TemplateDiagnostic[] {
  const sfc = parseSfc(source);
  const { file } = options;
  // типы props импортированных компонентов по их путям из импорта
  const propTypes = new Map<string, Record<string, PropType>>();
  // типы props самого шаблона (в сборке он известен по имени)
  propTypes.set("", sfc.propTypes);
  if (file) {
    for (const { source: specifier } of sfc.components.values()) {
      try {
        const target = path.resolve(path.dirname(file), specifier);
        propTypes.set(
          specifier,
          parseSfc(readFileSync(target, "utf-8")).propTypes,
        );
      } catch {
        // файла нет или он не читается: тип неизвестен, как без file
      }
    }
  }
  const { errors } = engine.generate(
    sfc.descriptor.template?.ast?.children ?? [],
    {
      // для проверки важно только, какие компоненты импортированы:
      // остальные шаблоны при проверке одного файла неизвестны
      components: componentTags(sfc, (source) => source),
      name: "",
      entry: false,
      templates: new Map(),
      propTypes,
    },
  );
  return [...sfc.errors, ...errors];
}
