export type ImageRatio = '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '9:21'
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high'
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp'
export type ImageBackground = 'auto' | 'opaque'
export type ImageModeration = 'auto' | 'low'
export type ImageInputFidelity = 'low' | 'high'
export type ImageStatus = 'succeeded' | 'failed'
export type GenerationRunStatus = 'running' | ImageStatus
export type GenerationMode = 'text-to-image' | 'image-to-image'

export type ReferenceImage = {
  id: string
  name: string
  mimeType: string
  filePath: string | null
  fileSizeBytes: number
  createdAt: string
}

export type ReferenceImageImportFile = {
  name: string
  mimeType: string
  data: ArrayBuffer
}

export type GenerateImageInput = {
  conversationId: string
  prompt: string
  model: string
  ratio: ImageRatio
  size: string
  quality: ImageQuality
  n: number
  outputFormat?: ImageOutputFormat
  outputCompression?: number
  background?: ImageBackground
  moderation?: ImageModeration
  stream?: boolean
  partialImages?: number
  inputFidelity?: ImageInputFidelity
  referenceImageIds?: string[]
}

export type PromptAssistInput = {
  prompt?: string
  hasReferenceImages?: boolean
}

export type Conversation = {
  id: string
  title: string
  draftPrompt: string
  model: string
  ratio: ImageRatio
  size: string
  quality: ImageQuality
  n: number
  outputFormat: ImageOutputFormat
  outputCompression: number | null
  background: ImageBackground
  moderation: ImageModeration
  stream: boolean
  partialImages: number | null
  inputFidelity: ImageInputFidelity | null
  autoSaveHistory: boolean
  keepFailureDetails: boolean
  referenceImages: ReferenceImage[]
  createdAt: string
  updatedAt: string
}

export type ConversationUpdate = Partial<
  Pick<
    Conversation,
    | 'title'
    | 'draftPrompt'
    | 'model'
    | 'ratio'
    | 'size'
    | 'quality'
    | 'n'
    | 'outputFormat'
    | 'outputCompression'
    | 'background'
    | 'moderation'
    | 'stream'
    | 'partialImages'
    | 'inputFidelity'
    | 'autoSaveHistory'
    | 'keepFailureDetails'
  >
>

export type ConversationCreateInput = Partial<
  Pick<
    Conversation,
    | 'model'
    | 'ratio'
    | 'size'
    | 'quality'
    | 'n'
    | 'outputFormat'
    | 'outputCompression'
    | 'background'
    | 'moderation'
    | 'stream'
    | 'partialImages'
    | 'inputFidelity'
    | 'autoSaveHistory'
    | 'keepFailureDetails'
  >
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
  generationMode: GenerationMode
  referenceImages: ReferenceImage[]
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
  generationMode: GenerationMode
  referenceImages: ReferenceImage[]
  createdAt: string
  items: ImageHistoryItem[]
}

export type ProviderSettings = {
  baseURL: string
  apiKeyStored: boolean
  defaultModel: string
  promptModel: string
  insecureStorage: boolean
}

export type ProviderSettingsUpdate = {
  baseURL?: string
  apiKey?: string | null
  defaultModel?: string
  promptModel?: string
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
    create: (input?: ConversationCreateInput) => Promise<Conversation>
    update: (id: string, input: ConversationUpdate) => Promise<Conversation>
    delete: (id: string) => Promise<void>
    runs: (id: string) => Promise<GenerationRun[]>
  }
  image: {
    generate: (input: GenerateImageInput) => Promise<GenerateImageResult>
    cancel: (runId: string, requestIndex?: number) => Promise<void>
    url: (id: string) => string
    copy: (id: string) => Promise<void>
    download: (id: string) => Promise<string | null>
  }
  prompt: {
    inspire: (input?: PromptAssistInput) => Promise<string>
    enrich: (input: PromptAssistInput & { prompt: string }) => Promise<string>
  }
  reference: {
    importFiles: (conversationId: string, files: ReferenceImageImportFile[]) => Promise<ReferenceImage[]>
    addFromHistory: (conversationId: string, historyId: string) => Promise<ReferenceImage[]>
    remove: (conversationId: string, referenceImageId: string) => Promise<ReferenceImage[]>
    reorder: (conversationId: string, referenceImageIds: string[]) => Promise<ReferenceImage[]>
    url: (id: string) => string
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
