import { join } from 'node:path'
import type { BrowserWindowConstructorOptions } from 'electron'

export function createMainWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 1040,
    minWidth: 1120,
    minHeight: 760,
    title: 'PixAI',
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
