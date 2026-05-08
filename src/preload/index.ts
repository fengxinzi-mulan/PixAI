import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type {
  GenerateImageInput,
  ConversationUpdate,
  HistoryListOptions,
  PixAIAPI,
  ProviderSettingsUpdate
} from '../shared/types'

const api: PixAIAPI = {
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (input: ProviderSettingsUpdate) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, input)
  },
  image: {
    generate: (input: GenerateImageInput) => ipcRenderer.invoke(IPC_CHANNELS.imageGenerate, input),
    url: (id: string) => `pixai-image://${encodeURIComponent(id)}`,
    copy: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.imageCopy, id),
    download: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.imageDownload, id)
  },
  history: {
    list: (options?: HistoryListOptions) => ipcRenderer.invoke(IPC_CHANNELS.historyList, options),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.historyDelete, id),
    favorite: (id: string, favorite: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.historyFavorite, { id, favorite })
  },
  conversation: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.conversationList),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.conversationCreate),
    update: (id: string, input: ConversationUpdate) =>
      ipcRenderer.invoke(IPC_CHANNELS.conversationUpdate, { id, input }),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.conversationDelete, id),
    runs: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.conversationRuns, id)
  },
  window: {
    newGenerator: () => ipcRenderer.invoke(IPC_CHANNELS.windowNewGenerator)
  }
}

contextBridge.exposeInMainWorld('pixai', api)
