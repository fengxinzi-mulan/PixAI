import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { prepareDataDir, resolveDataDir } from './data-path'

describe('data path resolution', () => {
  it('uses the project directory in development', () => {
    expect(resolveDataDir({
      cwd: 'E:/Go/src/PixAI',
      packaged: false,
      exePath: 'E:/Go/src/PixAI/node_modules/electron.exe'
    })).toBe(normalize('E:/Go/src/PixAI/data'))
  })

  it('uses a sibling data directory for packaged Windows builds', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    try {
      expect(resolveDataDir({
        cwd: 'E:/Go/src/PixAI',
        packaged: true,
        exePath: 'D:/Apps/PixAI/PixAI.exe'
      })).toBe(normalize('D:/Apps/PixAI-data'))
    } finally {
      platformSpy.mockRestore()
    }
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

  it('moves legacy packaged Windows data to the sibling directory when the target is missing', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = mkdtempSync(join(tmpdir(), 'pixai-data-path-test-'))
    const installDir = join(root, 'PixAI')
    const legacyDir = join(installDir, 'data')
    const targetDir = join(root, 'PixAI-data')
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, 'pixai.sqlite'), 'legacy database')

    try {
      expect(prepareDataDir({
        cwd: 'E:/Go/src/PixAI',
        packaged: true,
        exePath: join(installDir, 'PixAI.exe')
      })).toBe(targetDir)
      expect(existsSync(join(targetDir, 'pixai.sqlite'))).toBe(true)
      expect(existsSync(legacyDir)).toBe(false)
    } finally {
      platformSpy.mockRestore()
    }
  })

  it('does not overwrite an existing sibling data directory during legacy migration', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = mkdtempSync(join(tmpdir(), 'pixai-data-path-test-'))
    const installDir = join(root, 'PixAI')
    const legacyDir = join(installDir, 'data')
    const targetDir = join(root, 'PixAI-data')
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(legacyDir, 'pixai.sqlite'), 'legacy database')
    writeFileSync(join(targetDir, 'settings.json'), '{}')

    try {
      expect(prepareDataDir({
        cwd: 'E:/Go/src/PixAI',
        packaged: true,
        exePath: join(installDir, 'PixAI.exe')
      })).toBe(targetDir)
      expect(readdirSync(targetDir)).toEqual(['settings.json'])
      expect(existsSync(join(legacyDir, 'pixai.sqlite'))).toBe(true)
    } finally {
      platformSpy.mockRestore()
    }
  })
})
