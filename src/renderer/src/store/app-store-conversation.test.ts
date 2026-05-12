import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/types'
import { useAppStore } from './app-store'

describe('app store conversation defaults', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      runsByConversation: {},
      toast: null
    })
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  it('creates a new conversation with the active conversation image settings', async () => {
    const active = createConversation({ id: 'old', ratio: '9:16', size: '2160x3840', quality: 'medium' })
    const created = createConversation({ id: 'new', ratio: '9:16', size: '2160x3840', quality: 'medium' })
    const create = vi.fn(() => Promise.resolve(created))
    installWindow({ create })
    useAppStore.setState({
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      toast: null
    })

    await useAppStore.getState().createConversation()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      ratio: '9:16',
      size: '2160x3840',
      quality: 'medium',
      model: 'gpt-image-2',
      n: 1,
      outputFormat: 'png',
      outputCompression: null,
      background: 'auto',
      moderation: 'auto',
      stream: false,
      partialImages: 0,
      inputFidelity: null,
      maxRetries: 0,
      generationTimeoutSeconds: 300,
      autoSaveHistory: true,
      keepFailureDetails: false
    }))
    expect(useAppStore.getState().activeConversationId).toBe('new')
    expect(useAppStore.getState().conversations[0]).toMatchObject({
      id: 'new',
      ratio: '9:16',
      size: '2160x3840',
      quality: 'medium'
    })
  })

  it('uses the standard resolution when changing ratios without an explicit size', async () => {
    const active = createConversation({ id: 'c1', ratio: '16:9', size: '3840x2160', quality: 'high' })
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input }))
    installWindow({ update })
    useAppStore.setState({
      conversations: [active],
      activeConversationId: active.id,
      toast: null
    })

    await useAppStore.getState().updateActiveConversation({ ratio: '9:16' })

    expect(update).toHaveBeenCalledWith(active.id, { ratio: '9:16', size: '1008x1792' })
    expect(useAppStore.getState().conversations[0]).toMatchObject({
      ratio: '9:16',
      size: '1008x1792'
    })
  })

  it('passes the active conversation retry count into image generation', async () => {
    const active = createConversation({ id: 'c1', draftPrompt: 'prompt', maxRetries: 3 })
    const generate = vi.fn(() => Promise.resolve({
      run: {
        id: 'run-1',
        conversationId: active.id,
        prompt: 'prompt',
        model: active.model,
        ratio: active.ratio,
        size: active.size,
        quality: active.quality,
        n: active.n,
        status: 'succeeded',
        durationMs: 1000,
        errorMessage: null,
        errorDetails: null,
        maxRetries: 3,
        retryAttempts: {},
        retryFailures: {},
        generationMode: 'text-to-image',
        referenceImages: [],
        createdAt: '2026-05-10T00:00:01.000Z',
        items: []
      },
      items: []
    }))
    installWindow({
      update: vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input })),
      runs: vi.fn(() => Promise.resolve([])),
      generate,
      historyList: vi.fn(() => Promise.resolve([]))
    })
    useAppStore.setState({
      settings: { baseURL: 'https://example.test', apiKeyStored: true, defaultModel: 'gpt-image-2', promptModel: 'gpt-5.4-mini', insecureStorage: false },
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      history: [],
      query: '',
      sort: 'newest',
      favoritesOnly: false,
      toast: null
    })

    await useAppStore.getState().generate()

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: active.id,
      prompt: 'prompt',
      maxRetries: 3,
      generationTimeoutSeconds: 300
    }))
  })
})

function installWindow(conversation: {
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
  runs?: ReturnType<typeof vi.fn>
  generate?: ReturnType<typeof vi.fn>
  historyList?: ReturnType<typeof vi.fn>
}): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      pixai: {
        conversation: {
          ...conversation,
          runs: conversation.runs
        },
        image: {
          generate: conversation.generate
        },
        history: {
          list: conversation.historyList
        }
      }
    },
    configurable: true
  })
}

function createConversation(input: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    title: '新会话',
    draftPrompt: '',
    model: 'gpt-image-2',
    ratio: '1:1',
    size: '1024x1024',
    quality: 'auto',
    n: 1,
    outputFormat: 'png',
    outputCompression: null,
    background: 'auto',
    moderation: 'auto',
    stream: false,
    partialImages: 0,
    inputFidelity: null,
    maxRetries: 0,
    generationTimeoutSeconds: 300,
    autoSaveHistory: true,
    keepFailureDetails: false,
    referenceImages: [],
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...input
  }
}
