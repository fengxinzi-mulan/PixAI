import { join } from 'node:path'
import { app } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'

export function createMainWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 1040,
    minWidth: 1120,
    minHeight: 760,
    title: 'PixAI',
    icon: resolveWindowIconPath(),
    backgroundColor: '#f5f8f6',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }
}

function resolveWindowIconPath(): string {
  const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  if (app?.isPackaged) {
    return join(process.resourcesPath, iconFileName)
  }
  return join(process.cwd(), `src/renderer/src/assets/${iconFileName}`)
}
