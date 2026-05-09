import { dirname, join } from 'node:path'

export function resolveDataDir(input: { cwd: string; packaged: boolean; exePath: string }): string {
  return input.packaged ? join(dirname(input.exePath), 'data') : join(input.cwd, 'data')
}
