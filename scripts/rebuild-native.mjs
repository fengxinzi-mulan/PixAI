import { spawnSync } from 'node:child_process'

const arch = process.arch
const platform = process.platform === 'win32' ? 'win32' : process.platform
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const result = spawnSync(
  pnpmBin,
  ['exec', 'electron-builder', 'install-app-deps', '--platform', platform, '--arch', arch],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
