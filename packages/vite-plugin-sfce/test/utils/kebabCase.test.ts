import { describe, expect, test } from 'vitest'
import { kebabCase } from '../../src/utils/kebabCase'

describe('utils/kebabCase.ts', () => {
  test('should convert camelCase to kebab-case', () => {
    expect(kebabCase('camelCase')).toBe('camel-case')
  })

  test('should convert PascalCase to kebab-case', () => {
    expect(kebabCase('PascalCase')).toBe('pascal-case')
  })

  test('should convert snake_case to kebab-case', () => {
    const input = 'snake_case'
    const result = 'snake-case'
    expect(kebabCase(input)).toBe(result)
    expect(kebabCase(input.toUpperCase())).toBe(result)
  })
})
