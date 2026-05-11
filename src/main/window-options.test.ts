import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

import { createMainWindowOptions } from './window-options'

describe('main window options', () => {
  it('hides the native application menu bar', () => {
    expect(createMainWindowOptions().autoHideMenuBar).toBe(true)
  })
})
