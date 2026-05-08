import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConversationUpdate,
  GenerateImageInput,
  HistoryListOptions,
  PixAIAPI,
  ProviderSettingsUpdate
} from '@shared/types'

const api: PixAIAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input: ProviderSettingsUpdate) => ipcRenderer.invoke('settings:update', input)
  },
  conversation: {
    list: () => ipcRenderer.invoke('conversation:list'),
    create: () => ipcRenderer.invoke('conversation:create'),
    update: (id: string, input: ConversationUpdate) => ipcRenderer.invoke('conversation:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('conversation:delete', id),
    runs: (id: string) => ipcRenderer.invoke('conversation:runs', id)
  },
  image: {
    generate: (input: GenerateImageInput) => ipcRenderer.invoke('image:generate', input),
    cancel: (conversationId: string, requestIndex?: number) => ipcRenderer.invoke('image:cancel', conversationId, requestIndex),
    url: (id: string) => `pixai-image://image/${encodeURIComponent(id)}`,
    copy: (id: string) => ipcRenderer.invoke('image:copy', id),
    download: (id: string) => ipcRenderer.invoke('image:download', id)
  },
  history: {
    list: (options?: HistoryListOptions) => ipcRenderer.invoke('history:list', options),
    delete: (id: string) => ipcRenderer.invoke('history:delete', id),
    favorite: (id: string, favorite: boolean) => ipcRenderer.invoke('history:favorite', id, favorite)
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath)
  }
}

contextBridge.exposeInMainWorld('pixai', api)
