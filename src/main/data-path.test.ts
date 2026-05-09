import { normalize } from 'node:path'
import { describe, expect, it } from 'vitest'
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
})
