import { normalize } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveDataDir } from './data-path'

describe('data path resolution', () => {
  it('uses the project directory in development', () => {
    expect(resolveDataDir({
      cwd: 'E:/Go/src/PixAI',
      packaged: false,
      exePath: 'E:/Go/src/PixAI/node_modules/electron.exe'
    })).toBe(normalize('E:/Go/src/PixAI/data'))
  })

  it('uses the installation directory in packaged builds', () => {
    expect(resolveDataDir({
      cwd: 'E:/Go/src/PixAI',
      packaged: true,
      exePath: 'C:/Program Files/PixAI/PixAI.exe'
    })).toBe(normalize('C:/Program Files/PixAI/data'))
  })

  it('uses the user data directory for packaged macOS builds', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    try {
      expect(resolveDataDir({
        cwd: '/Users/dev/PixAI',
        packaged: true,
        exePath: '/Applications/PixAI.app/Contents/MacOS/PixAI',
        userDataPath: '/Users/dev/Library/Application Support/PixAI'
      })).toBe(normalize('/Users/dev/Library/Application Support/PixAI/data'))
    } finally {
      platformSpy.mockRestore()
    }
  })
})
