import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizePath,
  type HtmlTagDescriptor,
  type Plugin,
  type ResolvedConfig,
} from "vite";
import type {
  GenerateContext,
  TemplateEngine,
  TemplateInfo,
} from "./engine.ts";
import { collectTemplates } from "./graph.ts";
import { componentTags, type Sfc } from "./sfc.ts";
import { isInside } from "./utils.ts";

export { checkSource } from "./check.ts";
export type {
  GenerateContext,
  GenerateResult,
  TemplateInfo,
  TemplateDiagnostic,
  TemplateEngine,
  TemplateLocation,
} from "./engine.ts";

// #region options
export interface VitemplOptions {
  /** Шаблонизатор, для которого собираются шаблоны */
  engine: TemplateEngine;
  /**
   * Папка исходников шаблонов относительно root
   * @default "src"
   */
  srcDir?: string;
  /**
   * Папка страниц относительно srcDir: страницы оборачиваются в shell и обрабатываются Vite как HTML
   * @default "pages"
   */
  pagesDir?: string;
  /**
   * Папка фрагментов относительно srcDir: фрагменты рендерятся сервером отдельно, без shell
   * @default "fragments"
   */
  fragmentsDir?: string;
  /**
   * HTML-документ относительно root, в который оборачивается каждая страница.
   * Пишется на языке шаблонизатора. Ссылки на ассеты в нём должны быть
   * от корня (`/src/main.ts`), так как после обёртки они разрешаются
   * от папки страницы.
   * @default "index.html"
   */
  shell?: string;
  /**
   * Место в shell, куда вставляется страница
   * @default "<!--app-html-->"
   */
  placeholder?: string;
  /**
   * Папка собранных шаблонов относительно root
   * @default "dist/templates"
   */
  outDir?: string;
}
// #endregion options

/** Расширение исходников шаблонов */
const SOURCE_EXTENSION = ".vue";
/**
 * Запрос к блоку `<style>` шаблона. Заканчивается на `lang.css`, чтобы Vite
 * узнал в нём CSS — так же помечает свои стили плагин Vue.
 */
const STYLE_QUERY = "vitempl-style";
const styleRequestRE = new RegExp(
  `^(.+)\\?${STYLE_QUERY}&index=(\\d+)&lang\\.`,
);
/** Суффикс, по которому Vite распознаёт страницу как HTML */
const HTML_SUFFIX = ".html";

/**
 * Собирает шаблоны для SSR на сервере.
 *
 * Исходники шаблонов — Vue SFC, от страниц и фрагментов обходятся импорты
 * компонентов, и в сборку попадают только используемые. Каждый шаблон
 * генерируется для заданного шаблонизатора, а страницы дополнительно
 * подаются в Vite как HTML-входы: подключения скриптов и стилей
 * заменяются на собранные ассеты.
 */
export default function vitempl(options: VitemplOptions): Plugin {
  const {
    engine,
    srcDir = "src",
    pagesDir = "pages",
    fragmentsDir = "fragments",
    shell = "index.html",
    placeholder = "<!--app-html-->",
    outDir = "dist/templates",
  } = options;

  let config: ResolvedConfig;
  let shellSource = "";
  /** Страницы: HTML-модуль → файл исходника */
  const pages = new Map<string, string>();
  let fragments: string[] = [];
  /** Разобранные исходники: файл → SFC */
  let parsed = new Map<string, Sfc>();
  /** Сгенерированные шаблоны: файл исходника → шаблон */
  const generated = new Map<string, string>();
  /** Страницы после обработки Vite: файл исходника → HTML */
  const output = new Map<string, string>();

  const wrap = (html: string) => shellSource.replace(placeholder, () => html);
  const display = (file: string) =>
    normalizePath(path.relative(config.root, file));
  /** Путь от srcDir без расширения — под этим именем шаблон регистрирует сервер */
  const templateName = (file: string) =>
    normalizePath(path.relative(path.resolve(config.root, srcDir), file)).slice(
      0,
      -SOURCE_EXTENSION.length,
    );

  /** Шаблон и все шаблоны, которые он импортирует */
  function reachable(file: string) {
    const files = new Set<string>();
    const visit = (current: string) => {
      if (files.has(current)) {
        return;
      }
      files.add(current);
      for (const { source } of parsed.get(current)?.components.values() ?? []) {
        visit(normalizePath(path.resolve(path.dirname(current), source)));
      }
    };
    visit(normalizePath(file));
    return files;
  }

  /** Ссылки на стили страницы и компонентов, которые она импортирует */
  function styleTags(page: string) {
    const tags: HtmlTagDescriptor[] = [];
    for (const file of reachable(page)) {
      const url = normalizePath(path.relative(config.root, file));
      parsed.get(file)?.descriptor.styles.forEach((style, index) => {
        tags.push({
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: `/${url}?${STYLE_QUERY}&index=${index}&lang.${style.lang ?? "css"}`,
          },
          injectTo: "head",
        });
      });
    }
    return tags;
  }

  return {
    name: "vitempl",
    apply: "build",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // входы задаются здесь, а не в хуке config: пути должны считаться от
    // config.root, который Vite приводит к реальному пути (без симлинков)
    async options(inputOptions) {
      const pagesPath = path.resolve(config.root, srcDir, pagesDir);
      const input: Record<string, string> = {};

      pages.clear();
      for (const file of await scan(pagesPath)) {
        const id = normalizePath(file + HTML_SUFFIX);
        const name = normalizePath(path.relative(pagesPath, file));
        pages.set(id, file);
        input[name.slice(0, -SOURCE_EXTENSION.length)] = id;
      }
      if (pages.size === 0) {
        throw new Error(
          `[templates] не найдено ни одной страницы ${SOURCE_EXTENSION} в ${display(pagesPath)}`,
        );
      }
      fragments = await scan(path.resolve(config.root, srcDir, fragmentsDir));

      return { ...inputOptions, input };
    },

    async buildStart() {
      const templatesDir = path.resolve(config.root, outDir);
      if (templatesDir === config.root || isInside(templatesDir, config.root)) {
        this.error(`outDir ${outDir} не может содержать root`);
      }

      const shellPath = path.resolve(config.root, shell);
      shellSource = await readFile(shellPath, "utf-8");
      this.addWatchFile(shellPath);
      if (!shellSource.includes(placeholder)) {
        this.error(`${shell}: не найдено место для страницы ${placeholder}`);
      }

      const templates = await collectTemplates(
        [...pages.values(), ...fragments],
        {
          srcDir: path.resolve(config.root, srcDir),
          load: loadTemplate,
          display,
        },
      ).catch((error: Error) => this.error(error.message));

      parsed = new Map(
        [...templates].map(([file, sfc]) => [normalizePath(file), sfc]),
      );
      // стили подключаются к страницам, поэтому шаблон со стилями,
      // до которого нельзя дойти от страницы, останется без них в браузере
      const onPages = new Set(
        [...pages.values()].flatMap((page) => [...reachable(page)]),
      );
      for (const [file, sfc] of parsed) {
        if (sfc.descriptor.styles.length > 0 && !onPages.has(file)) {
          this.warn(
            `${display(file)}: блок <style> не попадёт в сборку — шаблон не используется ни на одной странице`,
          );
        }
      }

      generated.clear();
      output.clear();
      const entries = new Set(
        [...pages.values(), ...fragments].map((file) => normalizePath(file)),
      );
      /** Разбор шаблонов: вызов компонента может зависеть от самого компонента */
      const infos = new Map<string, TemplateInfo>();
      const contexts = new Map<string, GenerateContext>();
      for (const [file, sfc] of templates) {
        contexts.set(file, {
          components: componentTags(sfc, (source) =>
            templateName(path.resolve(path.dirname(file), source)),
          ),
          name: templateName(file),
          entry: entries.has(normalizePath(file)),
          templates: infos,
        });
      }
      if (engine.analyze) {
        for (const [file, sfc] of templates) {
          infos.set(
            templateName(file),
            engine.analyze(
              sfc.descriptor.template?.ast?.children ?? [],
              contexts.get(file)!,
            ),
          );
        }
      }

      const errors: string[] = [];
      for (const [file, sfc] of templates) {
        this.addWatchFile(file);
        const result = engine.generate(
          sfc.descriptor.template?.ast?.children ?? [],
          contexts.get(file)!,
        );
        generated.set(file, result.code);
        for (const { message, loc } of [...sfc.errors, ...result.errors]) {
          errors.push(`${display(file)}:${loc.line}:${loc.column}: ${message}`);
        }
      }
      if (errors.length) {
        this.error(errors.join("\n"));
      }
    },

    resolveId(id) {
      return pages.has(id) ? id : null;
    },

    load(id) {
      const style = styleRequestRE.exec(id);
      if (style) {
        const sfc = parsed.get(style[1]);
        return sfc?.descriptor.styles[Number(style[2])]?.content ?? null;
      }
      const file = pages.get(id);
      return file ? (generated.get(file) ?? null) : null;
    },

    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const file = pages.get(normalizePath(ctx.filename));
        if (file) {
          return { html: wrap(html), tags: styleTags(file) };
        }
      },
    },

    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const [id, file] of pages) {
          const fileName = normalizePath(path.relative(config.root, id));
          const asset = bundle[fileName];
          if (asset?.type !== "asset") {
            return this.error(`Vite не собрал HTML страницы ${fileName}`);
          }
          output.set(
            file,
            typeof asset.source === "string"
              ? asset.source
              : new TextDecoder().decode(asset.source),
          );
          delete bundle[fileName];
        }
      },
    },

    async writeBundle() {
      const templatesDir = path.resolve(config.root, outDir);
      if (config.build.emptyOutDir ?? isInside(config.root, templatesDir)) {
        await rm(templatesDir, { recursive: true, force: true });
      }
      for (const [file, code] of generated) {
        const target = path.join(
          templatesDir,
          templateName(file) + engine.extension,
        );
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, output.get(file) ?? code);
      }
      config.logger.info(
        `шаблоны (${engine.name}): ${generated.size} → ${display(templatesDir)}`,
      );
    },
  };
}

/** Находит исходники шаблонов в папке и её подпапках */
async function scan(dir: string) {
  try {
    const entries = await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith(SOURCE_EXTENSION),
      )
      .map((entry) => path.join(entry.parentPath, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function loadTemplate(file: string) {
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
