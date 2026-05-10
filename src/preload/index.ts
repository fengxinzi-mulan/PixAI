import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConversationCreateInput,
  ConversationUpdate,
  GenerateImageInput,
  HistoryListOptions,
  PixAIAPI,
  PromptAssistInput,
  ProviderSettingsUpdate,
  ReferenceImageImportFile
} from '@shared/types'

const api: PixAIAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input: ProviderSettingsUpdate) => ipcRenderer.invoke('settings:update', input)
  },
  conversation: {
    list: () => ipcRenderer.invoke('conversation:list'),
    create: (input?: ConversationCreateInput) => ipcRenderer.invoke('conversation:create', input),
    update: (id: string, input: ConversationUpdate) => ipcRenderer.invoke('conversation:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('conversation:delete', id),
    runs: (id: string) => ipcRenderer.invoke('conversation:runs', id)
  },
  image: {
    generate: (input: GenerateImageInput) => ipcRenderer.invoke('image:generate', input),
    cancel: (runId: string, requestIndex?: number) => ipcRenderer.invoke('image:cancel', runId, requestIndex),
    url: (id: string) => `pixai-image://image/${encodeURIComponent(id)}`,
    copy: (id: string) => ipcRenderer.invoke('image:copy', id),
    download: (id: string) => ipcRenderer.invoke('image:download', id)
  },
  prompt: {
    inspire: (input?: PromptAssistInput) => ipcRenderer.invoke('prompt:inspire', input),
    enrich: (input: PromptAssistInput & { prompt: string }) => ipcRenderer.invoke('prompt:enrich', input)
  },
  history: {
    list: (options?: HistoryListOptions) => ipcRenderer.invoke('history:list', options),
    delete: (id: string) => ipcRenderer.invoke('history:delete', id),
    favorite: (id: string, favorite: boolean) => ipcRenderer.invoke('history:favorite', id, favorite)
  },
  reference: {
    importFiles: (conversationId: string, files: ReferenceImageImportFile[]) =>
      ipcRenderer.invoke('reference:import-files', conversationId, files),
    addFromHistory: (conversationId: string, historyId: string) =>
      ipcRenderer.invoke('reference:add-from-history', conversationId, historyId),
    remove: (conversationId: string, referenceImageId: string) =>
      ipcRenderer.invoke('reference:remove', conversationId, referenceImageId),
    reorder: (conversationId: string, referenceImageIds: string[]) =>
      ipcRenderer.invoke('reference:reorder', conversationId, referenceImageIds),
    url: (id: string) => `pixai-image://reference/${encodeURIComponent(id)}`
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath)
  }
}

contextBridge.exposeInMainWorld('pixai', api)
