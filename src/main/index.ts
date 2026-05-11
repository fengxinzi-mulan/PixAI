import { copyFileSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron'
import type {
  ConversationCreateInput,
  GenerateImageInput,
  HistoryListOptions,
  PromptAssistInput,
  ProviderSettingsUpdate,
  ReferenceImageImportFile
} from '@shared/types'
import { AppDatabase } from './database'
import { copySelectedHistoryImages } from './batch-download'
import { resolveDataDir } from './data-path'
import { ImageService } from './image-service'
import { PromptService } from './prompt-service'
import { SettingsStore } from './settings'
import { createMainWindowOptions } from './window-options'

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

let mainWindow: BrowserWindow | null = null
let database: AppDatabase
let settings: SettingsStore
let imageService: ImageService
let promptService: PromptService

function getDataDir(): string {
  return resolveDataDir({ cwd: process.cwd(), packaged: app.isPackaged, exePath: app.getPath('exe') })
}

function createWindow(): void {
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow(createMainWindowOptions())
  mainWindow.setMenu(null)

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerImageProtocol(): void {
  protocol.handle('pixai-image', async (request) => {
    const url = new URL(request.url)
    const kind = url.hostname
    const id = decodeURIComponent(url.pathname.replace(/^\//, '') || url.hostname)
    const filePath = kind === 'reference' ? database.getReferenceImage(id)?.filePath : database.getHistory(id)?.filePath
    if (!filePath || !existsSync(filePath)) {
      return new Response(kind === 'reference' ? 'Reference image not found.' : 'Image not found.', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => settings.getPublicSettings())
  ipcMain.handle('settings:update', (_event, input: ProviderSettingsUpdate) => settings.update(input))

  ipcMain.handle('conversation:list', () => database.listConversations())
  ipcMain.handle('conversation:create', (_event, input?: ConversationCreateInput) => database.createConversation(input))
  ipcMain.handle('conversation:update', (_event, id: string, input) => database.updateConversation(id, input))
  ipcMain.handle('conversation:delete', (_event, id: string) => database.deleteConversation(id))
  ipcMain.handle('conversation:runs', (_event, id: string) => database.listRuns(id))

  ipcMain.handle('history:list', (_event, options?: HistoryListOptions) => database.listHistory(options))
  ipcMain.handle('history:delete', (_event, id: string) => database.deleteHistory(id))
  ipcMain.handle('history:favorite', (_event, id: string, favorite: boolean) => database.setFavorite(id, favorite))

  ipcMain.handle('image:generate', (_event, input: GenerateImageInput) => imageService.generate(input))
  ipcMain.handle('image:cancel', (_event, runId: string, requestIndex?: number) =>
    imageService.cancelRunGeneration(runId, requestIndex))
  ipcMain.handle('image:url', (_event, id: string) => `pixai-image://image/${encodeURIComponent(id)}`)
  ipcMain.handle('image:copy', (_event, id: string) => {
    const item = database.getHistory(id)
    if (!item?.filePath) throw new Error('Image file not found.')
    const image = nativeImage.createFromPath(item.filePath)
    if (image.isEmpty()) throw new Error('Unable to read image file.')
    clipboard.writeImage(image)
  })
  ipcMain.handle('image:download', async (_event, id: string) => {
    const item = database.getHistory(id)
    if (!item?.filePath) throw new Error('Image file not found.')
    const options = {
      title: '保存图片',
      defaultPath: basename(item.filePath),
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    }
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    copyFileSync(item.filePath, result.filePath)
    return result.filePath
  })
  ipcMain.handle('image:download-many', async (_event, ids: string[]) => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          title: '选择保存目录',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: '选择保存目录',
          properties: ['openDirectory', 'createDirectory']
        })
    const directory = result.filePaths[0]
    if (result.canceled || !directory) return null
    return copySelectedHistoryImages({
      ids,
      directory,
      getHistory: (id) => database.getHistory(id)
    })
  })
  ipcMain.handle('prompt:inspire', (_event, input?: PromptAssistInput) => promptService.inspire(input))
  ipcMain.handle('prompt:enrich', (_event, input: PromptAssistInput & { prompt: string }) => promptService.enrich(input))
  ipcMain.handle('reference:import-files', (_event, conversationId: string, files: ReferenceImageImportFile[]) => {
    for (const file of files) {
      database.createReferenceImageFromBytes({ conversationId, ...file })
    }
    return database.listConversationReferences(conversationId)
  })
  ipcMain.handle('reference:add-from-history', (_event, conversationId: string, historyId: string) => {
    database.addHistoryImageAsReference(conversationId, historyId)
    return database.listConversationReferences(conversationId)
  })
  ipcMain.handle('reference:remove', (_event, conversationId: string, referenceImageId: string) =>
    database.removeReferenceFromConversation(conversationId, referenceImageId))
  ipcMain.handle('reference:reorder', (_event, conversationId: string, referenceImageIds: string[]) =>
    database.reorderConversationReferences(conversationId, referenceImageIds))
  ipcMain.handle('reference:url', (_event, id: string) => `pixai-image://reference/${encodeURIComponent(id)}`)
  ipcMain.handle('shell:open-path', (_event, filePath: string) => shell.openPath(filePath))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const dataDir = getDataDir()
  database = new AppDatabase(dataDir)
  database.recoverInterruptedRuns()
  settings = new SettingsStore(join(dataDir, 'settings.json'))
  imageService = new ImageService(database, settings)
  promptService = new PromptService(settings)
  registerImageProtocol()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  database?.close()
})
