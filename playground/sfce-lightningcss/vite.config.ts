import { resolve } from 'node:path'
import { browserslistToTargets } from 'lightningcss'
import browserslist from 'browserslist'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import vitePluginSfce from 'vite-plugin-sfce'

export default defineConfig({
  appType: 'mpa',
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist()),
    },
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
