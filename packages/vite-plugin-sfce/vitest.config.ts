import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    includeSource: ['test/**/*.{js,ts}'],
  },
})
