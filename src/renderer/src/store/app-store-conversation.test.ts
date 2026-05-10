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
})

function installWindow(conversation: {
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
}): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: globalThis.setTimeout,
      clearInterval: globalThis.clearInterval,
      pixai: {
        conversation
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
    autoSaveHistory: true,
    keepFailureDetails: false,
    referenceImages: [],
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...input
  }
}
