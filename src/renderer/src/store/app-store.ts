import { create } from 'zustand'
import type {
  Conversation,
  ConversationUpdate,
  GenerateImageInput,
  GenerationRun,
  ImageHistoryItem,
  ProviderSettings,
  ProviderSettingsUpdate
} from '@shared/types'

type View = 'generate' | 'history'

type AppState = {
  view: View
  settings: ProviderSettings | null
  conversations: Conversation[]
  activeConversationId: string | null
  runsByConversation: Record<string, GenerationRun[]>
  history: ImageHistoryItem[]
  query: string
  sort: 'newest' | 'oldest'
  favoritesOnly: boolean
  loading: boolean
  generatingIds: Record<string, boolean>
  message: string | null
  error: string | null
  errorDetails: string | null
  setView: (view: View) => void
  setQuery: (query: string) => void
  setSort: (sort: 'newest' | 'oldest') => void
  setFavoritesOnly: (favoritesOnly: boolean) => void
  setActiveConversation: (id: string) => Promise<void>
  updateActiveConversation: (input: ConversationUpdate) => Promise<void>
  load: () => Promise<void>
  updateSettings: (input: ProviderSettingsUpdate) => Promise<void>
  createConversation: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  generate: () => Promise<void>
  reloadHistory: () => Promise<void>
  reloadRuns: (conversationId: string) => Promise<void>
  deleteHistory: (id: string) => Promise<void>
  toggleFavorite: (item: ImageHistoryItem) => Promise<void>
  reuse: (item: ImageHistoryItem) => Promise<void>
  newGeneratorWindow: () => Promise<void>
}

const DEFAULT_SIZE = '1024x1024'
const DEFAULT_QUALITY = 'auto'

export const useAppStore = create<AppState>((set, get) => ({
  view: 'generate',
  settings: null,
  conversations: [],
  activeConversationId: null,
  runsByConversation: {},
  history: [],
  query: '',
  sort: 'newest',
  favoritesOnly: false,
  loading: false,
  generatingIds: {},
  message: null,
  error: null,
  errorDetails: null,
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
  setActiveConversation: async (id) => {
    set({ activeConversationId: id, view: 'generate', error: null, errorDetails: null, message: null })
    if (!get().runsByConversation[id]) {
      await get().reloadRuns(id)
    }
  },
  updateActiveConversation: async (input) => {
    const id = get().activeConversationId
    if (!id) return
    const normalized = {
      ...input,
      ...(input.n !== undefined ? { n: Math.min(10, Math.max(1, Number.isFinite(input.n) ? input.n : 1)) } : {})
    }

    const optimistic = get().conversations.map((conversation) =>
      conversation.id === id ? { ...conversation, ...normalized, updatedAt: new Date().toISOString() } : conversation
    )
    set({ conversations: optimistic })

    const updated = await window.pixai.conversation.update(id, normalized)
    set({
      conversations: get().conversations.map((conversation) => (conversation.id === id ? updated : conversation))
    })
  },
  load: async () => {
    set({ loading: true, error: null, errorDetails: null })
    try {
      const settings = await window.pixai.settings.get()
      let conversations = await window.pixai.conversation.list()
      if (conversations.length === 0) {
        conversations = [await window.pixai.conversation.create()]
      }
      const activeConversationId = get().activeConversationId || conversations[0]?.id || null
      const history = await window.pixai.history.list({ sort: get().sort })
      const runs = activeConversationId ? await window.pixai.conversation.runs(activeConversationId) : []
      set({
        settings,
        conversations,
        activeConversationId,
        history,
        runsByConversation: activeConversationId ? { ...get().runsByConversation, [activeConversationId]: runs } : {},
        loading: false
      })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '加载失败', errorDetails: null })
    }
  },
  updateSettings: async (input) => {
    const settings = await window.pixai.settings.update(input)
    set({ settings, message: '设置已保存', error: null, errorDetails: null })
  },
  createConversation: async () => {
    const conversation = await window.pixai.conversation.create()
    set({
      conversations: [conversation, ...get().conversations],
      activeConversationId: conversation.id,
      view: 'generate',
      runsByConversation: { ...get().runsByConversation, [conversation.id]: [] },
      error: null,
      errorDetails: null,
      message: null
    })
  },
  deleteConversation: async (id) => {
    await window.pixai.conversation.delete(id)
    const remaining = get().conversations.filter((conversation) => conversation.id !== id)
    const runsByConversation = { ...get().runsByConversation }
    delete runsByConversation[id]

    if (remaining.length === 0) {
      const conversation = await window.pixai.conversation.create()
      set({
        conversations: [conversation],
        activeConversationId: conversation.id,
        runsByConversation: { [conversation.id]: [] }
      })
      return
    }

    const activeConversationId = get().activeConversationId === id ? remaining[0].id : get().activeConversationId
    set({ conversations: remaining, activeConversationId, runsByConversation })
    if (activeConversationId && !runsByConversation[activeConversationId]) {
      await get().reloadRuns(activeConversationId)
    }
  },
  generate: async () => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === state.activeConversationId)
    if (!conversation) return

    const prompt = conversation.draftPrompt.trim()
    const input: GenerateImageInput = {
      conversationId: conversation.id,
      prompt,
      model: conversation.model || state.settings?.defaultModel || 'gpt-image-2',
      size: conversation.size || DEFAULT_SIZE,
      quality: conversation.quality || DEFAULT_QUALITY,
      n: conversation.n || 1
    }

    set({
      generatingIds: { ...state.generatingIds, [conversation.id]: true },
      error: null,
      errorDetails: null,
      message: null
    })

    if (conversation.title === '新对话' && prompt) {
      const title = prompt.length > 28 ? `${prompt.slice(0, 28)}...` : prompt
      await get().updateActiveConversation({ title })
    }

    const result = await window.pixai.image.generate(input)
    const runs = await window.pixai.conversation.runs(conversation.id)
    const history = await window.pixai.history.list({
      query: state.query,
      sort: state.sort,
      favoritesOnly: state.favoritesOnly
    })

    set({
      generatingIds: { ...get().generatingIds, [conversation.id]: false },
      runsByConversation: { ...get().runsByConversation, [conversation.id]: runs },
      history,
      error: result.errorMessage || null,
      errorDetails: result.errorDetails || null,
      message: result.errorMessage ? null : '生成完成'
    })
  },
  reloadHistory: async () => {
    const state = get()
    const history = await window.pixai.history.list({
      query: state.query,
      sort: state.sort,
      favoritesOnly: state.favoritesOnly
    })
    set({ history })
  },
  reloadRuns: async (conversationId) => {
    const runs = await window.pixai.conversation.runs(conversationId)
    set({ runsByConversation: { ...get().runsByConversation, [conversationId]: runs } })
  },
  deleteHistory: async (id) => {
    const item = get().history.find((historyItem) => historyItem.id === id)
    await window.pixai.history.delete(id)
    await get().reloadHistory()
    if (item?.conversationId) {
      await get().reloadRuns(item.conversationId)
    }
  },
  toggleFavorite: async (item) => {
    await window.pixai.history.favorite(item.id, !item.favorite)
    await get().reloadHistory()
    if (item.conversationId) {
      await get().reloadRuns(item.conversationId)
    }
  },
  reuse: async (item) => {
    let conversationId = item.conversationId
    if (!conversationId || !get().conversations.some((conversation) => conversation.id === conversationId)) {
      await get().createConversation()
      conversationId = get().activeConversationId
    }
    if (!conversationId) return

    set({ activeConversationId: conversationId, view: 'generate' })
    await window.pixai.conversation.update(conversationId, {
      draftPrompt: item.prompt,
      model: item.model,
      size: item.size || DEFAULT_SIZE,
      quality: item.quality || DEFAULT_QUALITY
    })
    const conversations = await window.pixai.conversation.list()
    const runs = await window.pixai.conversation.runs(conversationId)
    set({
      conversations,
      runsByConversation: { ...get().runsByConversation, [conversationId]: runs },
      error: item.status === 'failed' ? item.errorMessage : null,
      errorDetails: item.status === 'failed' ? item.errorDetails : null,
      message: null
    })
  },
  newGeneratorWindow: async () => {
    await get().createConversation()
  }
}))
