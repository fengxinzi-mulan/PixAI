import { describe, expect, it } from 'vitest'
import { createMainWindowOptions } from './window-options'

describe('main window options', () => {
  it('hides the native application menu bar', () => {
    expect(createMainWindowOptions().autoHideMenuBar).toBe(true)
  })
})
