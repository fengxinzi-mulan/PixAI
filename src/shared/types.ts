export type GenerateImageInput = {
  conversationId: string
  prompt: string
  model: string
  size?: string
  quality?: string
  n?: number
}

export type ImageStatus = 'succeeded' | 'failed'
export type GenerationRunStatus = 'running' | ImageStatus

export type Conversation = {
  id: string
  title: string
  draftPrompt: string
  model: string
  size: string
  quality: string
  n: number
  createdAt: string
  updatedAt: string
}

export type ConversationUpdate = Partial<
  Pick<Conversation, 'title' | 'draftPrompt' | 'model' | 'size' | 'quality' | 'n'>
>

export type ImageHistoryItem = {
  id: string
  conversationId: string | null
  runId: string | null
  prompt: string
  model: string
  size: string | null
  quality: string | null
  filePath: string | null
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
  size: string | null
  quality: string | null
  n: number
  status: GenerationRunStatus
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
  image: {
    generate: (input: GenerateImageInput) => Promise<GenerateImageResult>
    url: (id: string) => string
    copy: (id: string) => Promise<void>
    download: (id: string) => Promise<string | null>
  }
  history: {
    list: (options?: HistoryListOptions) => Promise<ImageHistoryItem[]>
    delete: (id: string) => Promise<void>
    favorite: (id: string, favorite: boolean) => Promise<ImageHistoryItem>
  }
  conversation: {
    list: () => Promise<Conversation[]>
    create: () => Promise<Conversation>
    update: (id: string, input: ConversationUpdate) => Promise<Conversation>
    delete: (id: string) => Promise<void>
    runs: (id: string) => Promise<GenerationRun[]>
  }
  window: {
    newGenerator: () => Promise<Conversation>
  }
}
