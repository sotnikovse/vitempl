import { resolve } from 'node:path'
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
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  plugins: [Inspect(), vitePluginSfce()],
})
