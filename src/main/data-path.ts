import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

type DataDirInput = { cwd: string; packaged: boolean; exePath: string; userDataPath?: string }

const WINDOWS_PACKAGED_DATA_DIR_NAME = 'PixAI-data'

export function resolveDataDir(input: DataDirInput): string {
  if (!input.packaged) return join(input.cwd, 'data')
  if (process.platform === 'darwin' && input.userDataPath) return join(input.userDataPath, 'data')
  return join(dirname(dirname(input.exePath)), WINDOWS_PACKAGED_DATA_DIR_NAME)
}

export function prepareDataDir(input: DataDirInput): string {
  const dataDir = resolveDataDir(input)
  const legacyDataDir = resolveLegacyDataDir(input)
  if (legacyDataDir && normalize(legacyDataDir) !== normalize(dataDir)) {
    migrateLegacyDataDir(legacyDataDir, dataDir)
  }
  return dataDir
}

function resolveLegacyDataDir(input: DataDirInput): string | null {
  if (!input.packaged) return null
  if (process.platform === 'darwin') return null
  return join(dirname(input.exePath), 'data')
}

function migrateLegacyDataDir(legacyDataDir: string, dataDir: string): void {
  if (!existsSync(legacyDataDir) || !statSync(legacyDataDir).isDirectory()) {
    return
  }
  if (existsSync(dataDir) && !isEmptyDirectory(dataDir)) {
    return
  }

  try {
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true })
    }
    mkdirSync(dirname(dataDir), { recursive: true })
    renameSync(legacyDataDir, dataDir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to migrate PixAI data from "${legacyDataDir}" to "${dataDir}": ${message}`)
  }
}

function isEmptyDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory() && readdirSync(path).length === 0
  } catch {
    return false
  }
}
