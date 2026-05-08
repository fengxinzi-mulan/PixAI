import { describe, expect, it } from 'vitest'
import { getThemeToggleView } from './theme-toggle'

describe('theme toggle view', () => {
  it('matches the prototype labels and switch direction', () => {
    expect(getThemeToggleView(false)).toEqual({
      label: '白天模式',
      switchClassName: 'switch off'
    })
    expect(getThemeToggleView(true)).toEqual({
      label: '黑夜模式',
      switchClassName: 'switch'
    })
  })
})
