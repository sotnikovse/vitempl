import {
  preprocessCSS,
  transformWithOxc,
  type HtmlTagDescriptor,
  type Plugin,
  type ResolvedConfig,
  type Rolldown,
} from "vite";
import * as compiler from "@vue/compiler-sfc";
import { createRollupError } from "./utils/error";
import {
  createInjectTemplateCall,
  createTemplateContent,
  createTemplateId,
  injectTemplateRuntimeCode,
} from "./utils/template";

const defaultExtension = ".sfce.vue";

export type Options = {
  /** Расширение файлов, обрабатываемых как SFC пользовательских элементов. */
  extension?: string;
};

/**
 * Собирает id .sfce-модулей, попадающих в чанки страницы.
 * Общие (code-split) компоненты лежат в отдельных чанках, поэтому
 * помимо текущего чанка обходятся его статические и динамические импорты.
 */
function collectTemplateIds(
  chunk: Rolldown.OutputChunk,
  bundle: Rolldown.OutputBundle,
  extension: string,
): string[] {
  const ids = new Set<string>();
  const visited = new Set<string>();
  const stack = [chunk];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.fileName)) continue;
    visited.add(current.fileName);

    for (const id of current.moduleIds) {
      if (id.endsWith(extension)) ids.add(id);
    }

    for (const fileName of [...current.imports, ...current.dynamicImports]) {
      const imported = bundle[fileName];
      if (imported?.type === "chunk") stack.push(imported);
    }
  }

  return [...ids];
}

export default function vitePluginSFCE(rawOptions: Options = {}): Plugin {
  const { extension = defaultExtension } = rawOptions;
  let config: ResolvedConfig;
  let isBuild = false;
  let sourceMap = false;
  const templates = new Map<string, { id: string; content: string }>();

  // тип map у transformWithOxc отличается от Rolldown.SourceMap из публичного API,
  // поэтому приводим его в одном месте
  const resolveMap = (map: unknown): Rolldown.SourceMap | { mappings: "" } =>
    sourceMap && map ? (map as Rolldown.SourceMap) : { mappings: "" };

  return {
    name: "vite-plugin-sfce",

    applyToEnvironment(environment) {
      return environment.name === "client";
    },

    // карты накапливаются между сборками в watch-режиме, поэтому сбрасываются
    buildStart() {
      templates.clear();
    },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      isBuild = resolvedConfig.command === "build";
      sourceMap = isBuild ? !!resolvedConfig.build.sourcemap : true;
    },

    async transform(code, id) {
      if (!id.endsWith(extension)) return;

      const { descriptor, errors } = compiler.parse(code, {
        filename: id,
        sourceMap,
      });

      for (const error of errors) {
        this.error(createRollupError(id, error));
      }

      if (descriptor.scriptSetup) {
        this.error({
          id,
          plugin: "vite-plugin-sfce",
          message:
            "<script setup> не поддерживается: пользовательский элемент объявляется классом в блоке <script>",
        });
      }

      let script: string | undefined;
      let scriptMap: unknown;

      if (descriptor.script) {
        const result = await transformWithOxc(
          descriptor.script.content,
          id,
          { lang: "ts" },
          undefined,
          config,
        );
        script = result.code;
        scriptMap = result.map;
      }

      const styles: string[] = [];
      for (const style of descriptor.styles) {
        const lang = style.lang ?? "css";
        const { code } = await preprocessCSS(
          style.content,
          `${id}?sfce&lang.${lang}`,
          config,
        );
        styles.push(code);
      }

      const templateContent = createTemplateContent({
        styles,
        template: descriptor.template?.content,
      });

      const map = resolveMap(scriptMap);

      if (!templateContent) {
        return script ? { code: script, map } : null;
      }

      const templateId = createTemplateId(id, extension);

      if (isBuild) {
        templates.set(id, { id: templateId, content: templateContent });
        return { code: script ?? "", map };
      }

      // в dev шаблон приходит в рантайм, в билде — раскладывается в HTML
      const injection = createInjectTemplateCall(templateId, templateContent);
      return {
        code: script ? `${script}\n${injection}` : injection,
        map,
      };
    },

    transformIndexHtml(html, ctx) {
      const tags: HtmlTagDescriptor[] = [];

      if (ctx.server) {
        tags.push({
          tag: "script",
          children: injectTemplateRuntimeCode,
          injectTo: "body",
        });
      } else {
        if (!ctx.chunk || !ctx.bundle) return { html, tags };

        const injectedIds = new Set<string>();

        for (const id of collectTemplateIds(ctx.chunk, ctx.bundle, extension)) {
          const template = templates.get(id);
          if (!template) continue;

          if (injectedIds.has(template.id)) {
            this.warn(
              `Шаблон "${template.id}" уже добавлен: имена .sfce-файлов должны различаться`,
            );
            continue;
          }

          injectedIds.add(template.id);
          tags.push({
            tag: "template",
            attrs: { id: template.id },
            children: template.content,
            injectTo: "body",
          });
        }
      }

      return { html, tags };
    },
  };
}
