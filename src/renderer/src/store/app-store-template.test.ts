import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/types'
import { useAppStore } from './app-store'

describe('app store prompt template actions', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  it('applies a template to the active conversation', async () => {
    const conversation = createConversation({ title: '新会话', draftPrompt: '旧提示词' })
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...conversation, ...input }))
    installPixaiMock({
      conversation: {
        create: vi.fn(),
        update
      }
    })
    useAppStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
      view: 'prompts',
      promptAssistantRunning: { inspire: false, enrich: false },
      toast: null
    })

    await useAppStore.getState().applyPromptTemplate({
      id: 'template-1',
      title: '测试模板',
      category: '商业海报',
      description: '测试描述',
      prompt: 'new prompt',
      tags: ['广告'],
      ratio: '3:4',
      resolution: '768x1024',
      quality: 'high',
    })

    expect(update).toHaveBeenCalledWith(conversation.id, {
      draftPrompt: 'new prompt',
      title: '测试模板',
      ratio: '3:4',
      size: '768x1024',
      quality: 'high'
    })
    expect(useAppStore.getState().view).toBe('workspace')
    expect(useAppStore.getState().conversations[0].draftPrompt).toBe('new prompt')
  })

  it('applies the template resolution instead of the ratio default', async () => {
    const conversation = createConversation({ title: '已有会话', draftPrompt: '旧提示词' })
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...conversation, ...input }))
    installPixaiMock({
      conversation: {
        create: vi.fn(),
        update
      }
    })
    useAppStore.setState({
      conversations: [conversation],
      activeConversationId: conversation.id,
      view: 'prompts',
      promptAssistantRunning: { inspire: false, enrich: false },
      toast: null
    })

    await useAppStore.getState().applyPromptTemplate({
      id: 'template-resolution',
      title: '高分模板',
      category: '商业海报',
      description: '',
      prompt: 'high resolution prompt',
      tags: [],
      ratio: '16:9',
      resolution: '3840x2160',
      quality: 'high',
    })

    expect(update).toHaveBeenCalledWith(conversation.id, {
      draftPrompt: 'high resolution prompt',
      ratio: '16:9',
      size: '3840x2160',
      quality: 'high'
    })
  })

  it('creates a new conversation when no conversation is active', async () => {
    const createdConversation = createConversation()
    const create = vi.fn(() => Promise.resolve(createdConversation))
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...createdConversation, ...input }))
    installPixaiMock({
      conversation: {
        create,
        update
      }
    })
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      view: 'prompts',
      promptAssistantRunning: { inspire: false, enrich: false },
      toast: null
    })

    await useAppStore.getState().applyPromptTemplate({
      id: 'template-2',
      title: '新模板',
      category: '产品摄影',
      description: '测试描述',
      prompt: 'prompt body',
      tags: ['产品'],
      ratio: '1:1',
      resolution: '1024x1024',
      quality: 'auto',
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      ratio: '1:1',
      size: '1024x1024',
      quality: 'auto'
    }))
    expect(update).toHaveBeenCalledWith(createdConversation.id, {
      draftPrompt: 'prompt body',
      title: '新模板',
      ratio: '1:1',
      size: '1024x1024',
      quality: 'auto'
    })
    expect(useAppStore.getState().view).toBe('workspace')
  })
})

function installPixaiMock(mock: {
  conversation: {
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: globalThis.setTimeout,
      clearInterval: globalThis.clearInterval,
      pixai: {
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
    autoSaveHistory: true,
    keepFailureDetails: false,
    referenceImages: [],
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...input
  }
}
