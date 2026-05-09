export type ImageRatio = '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '9:21'
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high' | 'standard' | 'hd'
export type ImageStatus = 'succeeded' | 'failed'
export type GenerationRunStatus = 'running' | ImageStatus

export type GenerateImageInput = {
  conversationId: string
  prompt: string
  model: string
  ratio: ImageRatio
  quality: ImageQuality
  n: number
}

export type Conversation = {
  id: string
  title: string
  draftPrompt: string
  model: string
  ratio: ImageRatio
  quality: ImageQuality
  n: number
  autoSaveHistory: boolean
  keepFailureDetails: boolean
  createdAt: string
  updatedAt: string
}

export type ConversationUpdate = Partial<
  Pick<Conversation, 'title' | 'draftPrompt' | 'model' | 'ratio' | 'quality' | 'n' | 'autoSaveHistory' | 'keepFailureDetails'>
>

export type ImageHistoryItem = {
  id: string
  conversationId: string | null
  runId: string | null
  prompt: string
  model: string
  ratio: ImageRatio
  size: string | null
  quality: ImageQuality
  requestIndex: number | null
  durationMs: number | null
  filePath: string | null
  fileSizeBytes: number | null
  status: ImageStatus
  errorMessage: string | null
  errorDetails: string | null
  favorite: boolean
  createdAt: string
}

export type GenerationRun = {
  id: string
  conversationId: string
  prompt: string
  model: string
  ratio: ImageRatio
  size: string | null
  quality: ImageQuality
  n: number
  status: GenerationRunStatus
  durationMs: number | null
  errorMessage: string | null
  errorDetails: string | null
  createdAt: string
  items: ImageHistoryItem[]
}

export type ProviderSettings = {
  baseURL: string
  apiKeyStored: boolean
  defaultModel: string
  insecureStorage: boolean
}

export type ProviderSettingsUpdate = {
  baseURL?: string
  apiKey?: string | null
  defaultModel?: string
}

export type GenerateImageResult = {
  run: GenerationRun
  items: ImageHistoryItem[]
  errorMessage?: string
  errorDetails?: string
  canceled?: boolean
}

export type HistoryListOptions = {
  query?: string
  sort?: 'newest' | 'oldest'
  favoritesOnly?: boolean
}

export type PixAIAPI = {
  settings: {
    get: () => Promise<ProviderSettings>
    update: (input: ProviderSettingsUpdate) => Promise<ProviderSettings>
  }
  conversation: {
    list: () => Promise<Conversation[]>
    create: () => Promise<Conversation>
    update: (id: string, input: ConversationUpdate) => Promise<Conversation>
    delete: (id: string) => Promise<void>
    runs: (id: string) => Promise<GenerationRun[]>
  }
  image: {
    generate: (input: GenerateImageInput) => Promise<GenerateImageResult>
    cancel: (conversationId: string, requestIndex?: number) => Promise<void>
    url: (id: string) => string
    copy: (id: string) => Promise<void>
    download: (id: string) => Promise<string | null>
  }
  history: {
    list: (options?: HistoryListOptions) => Promise<ImageHistoryItem[]>
    delete: (id: string) => Promise<void>
    favorite: (id: string, favorite: boolean) => Promise<ImageHistoryItem>
  }
  shell: {
    openPath: (filePath: string) => Promise<string>
  }
}
