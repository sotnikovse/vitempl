import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import vitePluginSfce from 'vite-plugin-sfce'

export default defineConfig({
  appType: 'mpa',
  css: {
    transformer: 'lightningcss',
  },
  build: {
    cssMinify: 'lightningcss',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
      },
    },
  },
  plugins: [Inspect(), vitePluginSfce()],
})
