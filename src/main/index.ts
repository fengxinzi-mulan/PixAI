import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, net, protocol } from 'electron'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ConversationUpdate, GenerateImageInput, HistoryListOptions, ProviderSettingsUpdate } from '../shared/types'
import { AppDatabase } from './database'
import { ImageService } from './image-service'
import { SettingsStore } from './settings'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pixai-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
])

let database: AppDatabase
let settings: SettingsStore
let imageService: ImageService

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

function createGeneratorWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'PixAI',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window.show())

  if (isDev) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => settings.getPublicSettings())
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, input: ProviderSettingsUpdate) => settings.update(input))
  ipcMain.handle(IPC_CHANNELS.imageGenerate, (_event, input: GenerateImageInput) => imageService.generate(input))
  ipcMain.handle(IPC_CHANNELS.imageCopy, (_event, id: string) => copyImageToClipboard(id))
  ipcMain.handle(IPC_CHANNELS.imageDownload, async (event, id: string) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return downloadImage(window, id)
  })
  ipcMain.handle(IPC_CHANNELS.historyList, (_event, options?: HistoryListOptions) => database.listHistory(options))
  ipcMain.handle(IPC_CHANNELS.historyDelete, (_event, id: string) => database.deleteHistory(id))
  ipcMain.handle(IPC_CHANNELS.historyFavorite, (_event, input: { id: string; favorite: boolean }) =>
    database.setFavorite(input.id, input.favorite)
  )
  ipcMain.handle(IPC_CHANNELS.conversationList, () => database.listConversations())
  ipcMain.handle(IPC_CHANNELS.conversationCreate, () => createConversation())
  ipcMain.handle(IPC_CHANNELS.conversationUpdate, (_event, input: { id: string; input: ConversationUpdate }) =>
    database.updateConversation(input.id, input.input)
  )
  ipcMain.handle(IPC_CHANNELS.conversationDelete, (_event, id: string) => database.deleteConversation(id))
  ipcMain.handle(IPC_CHANNELS.conversationRuns, (_event, id: string) => database.listRuns(id))
  ipcMain.handle(IPC_CHANNELS.windowNewGenerator, () => createConversation())
}

function getImageFilePath(id: string): string {
  const item = database.getHistory(id)
  if (!item?.filePath || !existsSync(item.filePath)) {
    throw new Error('Image file not found')
  }
  return item.filePath
}

function copyImageToClipboard(id: string): void {
  const filePath = getImageFilePath(id)
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) {
    throw new Error('Unable to read image file')
  }
  clipboard.writeImage(image)
}

async function downloadImage(window: BrowserWindow | undefined, id: string): Promise<string | null> {
  const filePath = getImageFilePath(id)
  const extension = extname(filePath) || '.png'
  const options = {
    title: '保存图片',
    defaultPath: basename(filePath) || `pixai-image-${id}${extension}`,
    filters: [
      { name: 'Image', extensions: [extension.replace('.', '') || 'png'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) {
    return null
  }

  copyFileSync(filePath, result.filePath)
  return result.filePath
}

function createConversation() {
  return database.createConversation({
    id: randomUUID(),
    title: '新对话',
    draftPrompt: '',
    model: settings.getPublicSettings().defaultModel,
    size: '1024x1024',
    quality: 'auto',
    n: 1
  })
}

function registerImageProtocol(): void {
  protocol.handle('pixai-image', (request) => {
    const url = new URL(request.url)
    const id = decodeURIComponent(url.hostname || url.pathname.replace(/^\/+/, ''))
    const item = database.getHistory(id)

    if (!item?.filePath || !existsSync(item.filePath)) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(item.filePath).toString())
  })
}

app.whenReady().then(() => {
  database = new AppDatabase()
  settings = new SettingsStore()
  imageService = new ImageService(database, settings)

  registerImageProtocol()
  registerIpc()
  createGeneratorWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createGeneratorWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  database?.close()
})
