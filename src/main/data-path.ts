import { dirname, join } from 'node:path'

export function resolveDataDir(input: { cwd: string; packaged: boolean; exePath: string; userDataPath?: string }): string {
  if (!input.packaged) return join(input.cwd, 'data')
  if (process.platform === 'darwin' && input.userDataPath) return join(input.userDataPath, 'data')
  return join(dirname(input.exePath), 'data')
}
