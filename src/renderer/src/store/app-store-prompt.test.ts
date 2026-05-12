import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/types'
import { useAppStore } from './app-store'

describe('app store prompt assistant actions', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  it('writes inspired prompt into the current conversation draft', async () => {
    const conversation = createConversation({ draftPrompt: '' })
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...conversation, ...input }))
    installPixaiMock({
      prompt: {
        inspire: vi.fn(() => Promise.resolve('新的灵感提示词')),
        enrich: vi.fn()
      },
      conversation: { update }
    })
    useAppStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
      promptAssistantRunning: { inspire: false, enrich: false },
      toast: null
    })

    await useAppStore.getState().inspirePrompt()

    expect(window.pixai.prompt.inspire).toHaveBeenCalledWith({ hasReferenceImages: false })
    expect(update).toHaveBeenCalledWith(conversation.id, { draftPrompt: '新的灵感提示词' })
    expect(useAppStore.getState().conversations[0].draftPrompt).toBe('新的灵感提示词')
  })

  it('does not overwrite draft prompt when enrichment fails', async () => {
    const conversation = createConversation({ draftPrompt: '原始提示词' })
    installPixaiMock({
      prompt: {
        inspire: vi.fn(),
        enrich: vi.fn(() => Promise.reject(new Error('request failed')))
      },
      conversation: {
        update: vi.fn()
      }
    })
    useAppStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
      promptAssistantRunning: { inspire: false, enrich: false },
      toast: null
    })

    await useAppStore.getState().enrichPrompt()

    expect(window.pixai.conversation.update).not.toHaveBeenCalled()
    expect(useAppStore.getState().conversations[0].draftPrompt).toBe('原始提示词')
  })
})

function installPixaiMock(mock: {
  prompt: {
    inspire: ReturnType<typeof vi.fn>
    enrich: ReturnType<typeof vi.fn>
  }
  conversation: {
    update: ReturnType<typeof vi.fn>
  }
}): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: globalThis.setTimeout,
      clearInterval: globalThis.clearInterval,
      pixai: {
        prompt: mock.prompt,
        conversation: mock.conversation
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
