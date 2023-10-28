import { parse } from 'node:path'
import {
  transformWithEsbuild,
  Plugin,
  HtmlTagDescriptor,
  ResolvedConfig,
} from 'vite'
import * as compiler from '@vue/compiler-sfc'
import { createRollupError } from './utils/error'
import { kebabCase } from './utils/kebabCase'

const sfceExt = '.sfce.vue'

function createCachedImport<T>(imp: () => Promise<T>): () => T | Promise<T> {
  let cached: T | Promise<T>
  return () => {
    if (!cached) {
      cached = imp().then((module) => {
        cached = module
        return module
      })
    }
    return cached
  }
}

const importLightningCSS = createCachedImport(() => import('lightningcss'))

export default function vitePluginSFCE(): Plugin {
  let config: ResolvedConfig
  let isBuild = false
  let sourceMap = false
  const templatesMap = new Map<string, { id: string; content: string }>()

  return {
    name: 'vite-plugin-sfce',

    async configResolved(resolvedConfig) {
      config = resolvedConfig
      isBuild = resolvedConfig.command === 'build'
      sourceMap = isBuild ? !!config.build.sourcemap : true
    },

    async transform(code, id) {
      if (id.endsWith(sfceExt)) {
        const { descriptor, errors } = compiler.parse(code, {
          filename: id,
          sourceMap: sourceMap,
        })

        if (errors.length) {
          errors.forEach((error) => this.error(createRollupError(id, error)))
          return null
        }

        let resolvedCode: string | undefined = undefined
        let resolvedMap: string | undefined = undefined

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
          resolvedMap = map as any
        }

        const templateId = `${kebabCase(
          parse(id).base.replace(sfceExt, ''),
        )}-template`
        const blocks: string[] = []
        let stylesContent = descriptor.styles.map((style) => style.content)

        if (config.css?.transformer === 'lightningcss') {
          const lightningcss = await importLightningCSS()

          stylesContent = descriptor.styles.map((style) => {
            const { code } = lightningcss.transform({
              filename: id,
              code: Buffer.from(style.content),
              minify: isBuild && !!config.build.cssMinify,
              targets: config.css?.lightningcss?.targets,
            })
            return code.toString()
          })
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
        const { chunk } = ctx
        chunk?.moduleIds?.forEach((id) => {
          if (id.endsWith(sfceExt)) {
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
