import path from "node:path";
import type { TemplateLocation } from "./engine.ts";
import { parseSfc, type Sfc } from "./sfc.ts";
import { isInside } from "./utils.ts";

export interface TemplateGraphOptions {
  /** Папка исходников шаблонов: компоненты вне неё подключать нельзя */
  srcDir: string;
  /** Читает шаблон, `undefined` — файла нет */
  load(file: string): Promise<string | undefined>;
  /** Путь к файлу для сообщений */
  display?(file: string): string;
}

/**
 * Обходит импорты компонентов от входов и разбирает используемые шаблоны:
 * в сборку попадают только они.
 */
export async function collectTemplates(
  entries: string[],
  options: TemplateGraphOptions,
): Promise<Map<string, Sfc>> {
  const { srcDir, load, display = (file) => file } = options;
  const templates = new Map<string, Sfc>();

  const at = (file: string, loc: TemplateLocation) =>
    `${display(file)}:${loc.line}:${loc.column}`;

  async function visit(file: string, source: string, entry: string) {
    const sfc = parseSfc(source);
    templates.set(file, sfc);
    for (const { source: specifier, loc } of sfc.components.values()) {
      const target = path.resolve(path.dirname(file), specifier);
      if (templates.has(target)) {
        continue;
      }
      if (!isInside(srcDir, target)) {
        throw new Error(
          `${at(file, loc)}: компонент "${specifier}" находится вне папки исходников ${display(srcDir)}`,
        );
      }
      const targetSource = await load(target);
      if (targetSource === undefined) {
        const from = entry === file ? "" : ` (вход ${display(entry)})`;
        throw new Error(
          `${at(file, loc)}: компонент "${specifier}" не найден: ${display(target)}${from}`,
        );
      }
      await visit(target, targetSource, entry);
    }
  }

  for (const entry of entries) {
    if (templates.has(entry)) {
      continue;
    }
    const source = await load(entry);
    if (source === undefined) {
      throw new Error(`${display(entry)}: файл не найден`);
    }
    await visit(entry, source, entry);
  }

  return templates;
}
