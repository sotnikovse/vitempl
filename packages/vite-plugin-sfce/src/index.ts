import { parse } from 'node:path'
import {
  transformWithEsbuild,
  preprocessCSS,
  Plugin,
  HtmlTagDescriptor,
  ResolvedConfig,
} from 'vite'
import type { ModuleInfo, SourceMap } from 'rollup'
import * as compiler from '@vue/compiler-sfc'
import { createRollupError } from './utils/error'
import { kebabCase } from './utils/kebabCase'

const defaultExt = '.sfce.vue'

type Options = {
  extension?: string
}

export default function vitePluginSFCE(rawOptions: Options = {}): Plugin {
  const { extension = defaultExt } = rawOptions
  let config: ResolvedConfig
  let isBuild = false
  let sourceMap = false
  const templatesMap = new Map<string, { id: string; content: string }>()
  const entriesModuleIdsMap = new Map<string, Set<string>>()

  return {
    name: 'vite-plugin-sfce',

    applyToEnvironment(environment) {
      return environment.name === 'client'
    },

    moduleParsed(info) {
      if (info.isEntry) {
        if (!entriesModuleIdsMap.has(info.id)) {
          entriesModuleIdsMap.set(info.id, new Set())
        }

        const setEntryImportedIds = (
          mod: ModuleInfo | null,
          visited = new Set(),
        ) => {
          if (!mod || visited.has(mod.id)) return

          visited.add(mod.id)

          if (mod.id.endsWith(extension)) {
            entriesModuleIdsMap.get(info.id)!.add(mod.id)
          }

          for (const importedId of mod.importedIds) {
            const importedModule = this.getModuleInfo(importedId)
            if (importedModule) {
              setEntryImportedIds(importedModule, visited)
            }
          }
        }

        setEntryImportedIds(info)
      }
    },

    async configResolved(resolvedConfig) {
      config = resolvedConfig
      isBuild = resolvedConfig.command === 'build'
      sourceMap = isBuild ? !!config.build.sourcemap : true
    },

    async transform(code, id) {
      if (id.endsWith(extension)) {
        const { descriptor, errors } = compiler.parse(code, {
          filename: id,
          sourceMap: sourceMap,
        })

        if (errors.length) {
          errors.forEach((error) => this.error(createRollupError(id, error)))
          return null
        }

        const templateId = `${kebabCase(
          parse(id).base.replace(extension, ''),
        )}-template`
        const blocks: string[] = []
        let stylesContent: string[] = []
        let resolvedCode: string | undefined = undefined
        let resolvedMap: SourceMap | undefined = undefined

        if (descriptor.script) {
          const { code, map } = await transformWithEsbuild(
            descriptor.script.content,
            id,
            {
              loader: 'ts',
              target: 'esnext',
              sourcemap: sourceMap,
            },
          )
          resolvedCode = code
          resolvedMap = map
        }

        for (const content of descriptor.styles) {
          const { code } = await preprocessCSS(
            content.content,
            `inline&${content.lang}`,
            config,
          )
          stylesContent.push(code.toString())
        }

        blocks.push(
          ...stylesContent.map((content) => `\n<style>\n${content}\n</style>`),
        )

        if (descriptor.template) {
          blocks.push(descriptor.template.content)
        }

        // при билде template сохраняется для использования в transformIndexHtml
        // при деве в код добавляется вызов функции добавления template,
        // которая добавлена в transformIndexHtml
        if (blocks.length) {
          const templateContent = blocks.join('')
          if (isBuild) {
            templatesMap.set(id, {
              id: templateId,
              content: templateContent,
            })
          } else {
            resolvedCode = `_injectTemplate('${templateId}',\`${templateContent}\`)\n${resolvedCode}`
          }
        }

        return {
          code: resolvedCode,
          map: resolvedMap || {
            mappings: '',
          },
        }
      }
    },

    transformIndexHtml(html, ctx) {
      const tags: HtmlTagDescriptor[] = []
      // при деве добавляется функция добавления template
      if (ctx.server) {
        tags.push({
          tag: 'script',
          children: `function _injectTemplate(id, content) {
  if (!document.getElementById(id) && content) {
    const el = document.createElement('template')
    el.id = id
    el.innerHTML = content
    document.body.appendChild(el)
  }
}`,
          injectTo: 'body',
        })
      } else {
        const moduleIds = entriesModuleIdsMap.get(ctx.filename)
        moduleIds?.forEach((id) => {
          if (id.endsWith(extension)) {
            const template = templatesMap.get(id)
            if (template) {
              tags.push({
                tag: 'template',
                attrs: { id: template.id },
                children: template.content,
                injectTo: 'body',
              })
            }
          }
        })
      }
      return {
        html,
        tags,
      }
    },
  }
}
