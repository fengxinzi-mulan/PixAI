import { create } from 'zustand'
import { formatDuration } from '@shared/duration'
import { DEFAULT_MODEL } from '@shared/image-options'
import type {
  Conversation,
  ConversationUpdate,
  GenerateImageInput,
  GenerationRun,
  HistoryListOptions,
  ImageHistoryItem,
  ProviderSettings,
  ProviderSettingsUpdate
} from '@shared/types'
import {
  beginConversationGeneration,
  endConversationGeneration,
  getConversationGenerationState as getConversationGenerationStateForId,
  markGenerationRequestCanceled
} from './generation-state'

type View = 'workspace' | 'gallery'

type AppState = {
  view: View
  settingsVisible: boolean
  darkMode: boolean
  settings: ProviderSettings | null
  conversations: Conversation[]
  activeConversationId: string | null
  runsByConversation: Record<string, GenerationRun[]>
  history: ImageHistoryItem[]
  query: string
  sort: 'newest' | 'oldest'
  favoritesOnly: boolean
  loading: boolean
  generationClockMs: number
  generatingByConversation: Record<string, boolean>
  generationStartedAtByConversation: Record<string, number>
  canceledGenerationIndexesByConversation: Record<string, number[]>
  toast: string | null
  getConversationGenerationState: (conversationId: string) => { generating: boolean; startedAt: number | null }
  load: () => Promise<void>
  setView: (view: View) => void
  toggleSettings: () => void
  toggleTheme: () => void
  setQuery: (query: string) => void
  setSort: (sort: 'newest' | 'oldest') => Promise<void>
  setFavoritesOnly: (favoritesOnly: boolean) => Promise<void>
  setActiveConversation: (id: string) => Promise<void>
  createConversation: () => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  updateActiveConversation: (input: ConversationUpdate) => Promise<void>
  updateSettings: (input: ProviderSettingsUpdate) => Promise<void>
  importReferenceFiles: (files: File[]) => Promise<void>
  addHistoryAsReference: (historyId: string) => Promise<void>
  removeReferenceImage: (referenceImageId: string) => Promise<void>
  reorderReferenceImages: (referenceImageIds: string[]) => Promise<void>
  generate: () => Promise<void>
  refreshConversationResults: (conversationId: string) => Promise<void>
  cancelGeneration: (conversationId?: string, requestIndex?: number) => Promise<void>
  reloadHistory: (options?: Partial<HistoryListOptions>) => Promise<void>
  deleteHistory: (id: string) => Promise<void>
  deleteHistoryItems: (ids: string[]) => Promise<void>
  toggleFavorite: (item: ImageHistoryItem) => Promise<void>
  setFavoriteForHistoryItems: (items: ImageHistoryItem[], favorite: boolean) => Promise<void>
  reuseHistory: (item: ImageHistoryItem) => Promise<void>
  notify: (message: string | null) => void
}

let generationClockTimer: number | null = null

function startGenerationClock(): void {
  if (generationClockTimer != null || typeof window === 'undefined') return
  generationClockTimer = window.setInterval(() => {
    useAppStore.setState({ generationClockMs: Date.now() })
  }, 1000)
}

function stopGenerationClock(): void {
  if (generationClockTimer == null) return
  window.clearInterval(generationClockTimer)
  generationClockTimer = null
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'workspace',
  settingsVisible: true,
  darkMode: false,
  settings: null,
  conversations: [],
  activeConversationId: null,
  runsByConversation: {},
  history: [],
  query: '',
  sort: 'newest',
  favoritesOnly: false,
  loading: false,
  generationClockMs: Date.now(),
  generatingByConversation: {},
  generationStartedAtByConversation: {},
  canceledGenerationIndexesByConversation: {},
  toast: null,
  getConversationGenerationState: (conversationId) =>
    getConversationGenerationStateForId(conversationId, get().generatingByConversation, get().generationStartedAtByConversation),
  load: async () => {
    set({ loading: true })
    const settings = await window.pixai.settings.get()
    let conversations = await window.pixai.conversation.list()
    if (conversations.length === 0) conversations = [await window.pixai.conversation.create()]
    const activeConversationId = get().activeConversationId || conversations[0]?.id || null
    const runs = activeConversationId ? await window.pixai.conversation.runs(activeConversationId) : []
    const history = await window.pixai.history.list({ sort: get().sort })
    set({
      settings,
      conversations,
      activeConversationId,
      runsByConversation: activeConversationId ? { [activeConversationId]: runs } : {},
      history,
      loading: false
    })
  },
  setView: (view) => set({ view }),
  toggleSettings: () => set((state) => ({ settingsVisible: !state.settingsVisible, view: 'workspace' })),
  toggleTheme: () => set((state) => ({ darkMode: !state.darkMode })),
  setQuery: (query) => set({ query }),
  setSort: async (sort) => {
    set({ sort })
    await get().reloadHistory({ sort })
  },
  setFavoritesOnly: async (favoritesOnly) => {
    set({ favoritesOnly })
    await get().reloadHistory({ favoritesOnly })
  },
  setActiveConversation: async (id) => {
    set({ activeConversationId: id, view: 'workspace' })
    if (!get().runsByConversation[id]) {
      const runs = await window.pixai.conversation.runs(id)
      set({ runsByConversation: { ...get().runsByConversation, [id]: runs } })
    }
  },
  createConversation: async () => {
    const conversation = await window.pixai.conversation.create()
    set({
      conversations: [conversation, ...get().conversations],
      activeConversationId: conversation.id,
      view: 'workspace',
      runsByConversation: { ...get().runsByConversation, [conversation.id]: [] }
    })
    get().notify('已新建会话')
  },
  deleteConversation: async (id) => {
    await window.pixai.conversation.delete(id)
    let conversations = get().conversations.filter((item) => item.id !== id)
    if (conversations.length === 0) conversations = [await window.pixai.conversation.create()]
    const activeConversationId = get().activeConversationId === id ? conversations[0].id : get().activeConversationId
    const runsByConversation = { ...get().runsByConversation }
    delete runsByConversation[id]
    set({ conversations, activeConversationId, runsByConversation })
    get().notify('已删除会话，历史记录已保留')
  },
  updateActiveConversation: async (input) => {
    const id = get().activeConversationId
    if (!id) return
    const normalized = input.n !== undefined ? { ...input, n: Math.min(10, Math.max(1, input.n)) } : input
    set({
      conversations: get().conversations.map((item) =>
        item.id === id ? { ...item, ...normalized, updatedAt: new Date().toISOString() } : item
      )
    })
    const updated = await window.pixai.conversation.update(id, normalized)
    set({ conversations: get().conversations.map((item) => (item.id === id ? updated : item)) })
  },
  updateSettings: async (input) => {
    const settings = await window.pixai.settings.update(input)
    set({ settings })
    get().notify('设置已保存')
  },
  importReferenceFiles: async (files) => {
    const id = get().activeConversationId
    if (!id || files.length === 0) return
    try {
      const payload = await Promise.all(files.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        data: await file.arrayBuffer()
      })))
      const referenceImages = await window.pixai.reference.importFiles(id, payload)
      set({
        conversations: get().conversations.map((item) => (item.id === id ? { ...item, referenceImages } : item))
      })
      get().notify(`已添加 ${payload.length} 张参考图`)
    } catch (error) {
      get().notify(error instanceof Error ? error.message : '参考图添加失败')
    }
  },
  addHistoryAsReference: async (historyId) => {
    const state = get()
    const id = state.activeConversationId
    if (!id) return
    const conversation = state.conversations.find((item) => item.id === id)
    const sourceItem = state.history.find((item) => item.id === historyId)
      || Object.values(state.runsByConversation)
        .flatMap((runs) => runs.flatMap((run) => run.items))
        .find((item) => item.id === historyId)
    try {
      for (const reference of conversation?.referenceImages || []) {
        await window.pixai.reference.remove(id, reference.id)
      }
      const referenceImages = await window.pixai.reference.addFromHistory(id, historyId)
      const updated = await window.pixai.conversation.update(id, { draftPrompt: sourceItem?.prompt || '' })
      set({
        conversations: get().conversations.map((item) => (item.id === id ? { ...updated, referenceImages } : item)),
        view: 'workspace'
      })
      get().notify('已进入编辑')
    } catch (error) {
      get().notify(error instanceof Error ? error.message : '编辑失败')
    }
  },
  removeReferenceImage: async (referenceImageId) => {
    const id = get().activeConversationId
    if (!id) return
    const referenceImages = await window.pixai.reference.remove(id, referenceImageId)
    set({
      conversations: get().conversations.map((item) => (item.id === id ? { ...item, referenceImages } : item))
    })
  },
  reorderReferenceImages: async (referenceImageIds) => {
    const id = get().activeConversationId
    if (!id) return
    const referenceImages = await window.pixai.reference.reorder(id, referenceImageIds)
    set({
      conversations: get().conversations.map((item) => (item.id === id ? { ...item, referenceImages } : item))
    })
  },
  generate: async () => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === state.activeConversationId)
    if (!conversation || state.generatingByConversation[conversation.id]) return
    const generationStartedAt = Date.now()
    set({ generationClockMs: generationStartedAt })
    startGenerationClock()
    const prompt = conversation.draftPrompt.trim()
    const input: GenerateImageInput = {
      conversationId: conversation.id,
      prompt,
      model: conversation.model || state.settings?.defaultModel || DEFAULT_MODEL,
      ratio: conversation.ratio,
      quality: conversation.quality,
      n: conversation.n,
      referenceImageIds: conversation.referenceImages.map((reference) => reference.id)
    }
    const nextGenerationState = beginConversationGeneration(conversation.id, {
      generatingByConversation: state.generatingByConversation,
      startedAtByConversation: state.generationStartedAtByConversation,
      canceledIndexesByConversation: state.canceledGenerationIndexesByConversation
    }, generationStartedAt)
    set({
      generatingByConversation: nextGenerationState.generatingByConversation,
      generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
      canceledGenerationIndexesByConversation: nextGenerationState.canceledIndexesByConversation
    })
    const titlePatch = conversation.title === '新会话' && prompt ? { title: prompt.length > 18 ? `${prompt.slice(0, 18)}...` : prompt } : null
    try {
      if (titlePatch) await get().updateActiveConversation(titlePatch)
      const result = await window.pixai.image.generate(input)
      const runs = await window.pixai.conversation.runs(conversation.id)
      const history = await window.pixai.history.list({ query: state.query, sort: state.sort, favoritesOnly: state.favoritesOnly })
      set({
        runsByConversation: { ...get().runsByConversation, [conversation.id]: runs },
        history
      })
      const durationText = result.run.durationMs != null ? `，用时 ${formatDuration(result.run.durationMs)}` : ''
      get().notify(result.canceled ? `已取消${durationText}` : result.errorMessage ? `生成失败：${result.errorMessage}${durationText}` : `生成完成${durationText}`)
    } catch (error) {
      get().notify(error instanceof Error ? `生成失败：${error.message}` : '生成失败')
    } finally {
      const nextGenerationState = endConversationGeneration(conversation.id, {
        generatingByConversation: get().generatingByConversation,
        startedAtByConversation: get().generationStartedAtByConversation,
        canceledIndexesByConversation: get().canceledGenerationIndexesByConversation
      })
      set({
        generatingByConversation: nextGenerationState.generatingByConversation,
        generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
        canceledGenerationIndexesByConversation: nextGenerationState.canceledIndexesByConversation
      })
      if (Object.keys(nextGenerationState.generatingByConversation).length === 0) {
        stopGenerationClock()
      }
    }
  },
  refreshConversationResults: async (conversationId) => {
    const state = get()
    const runs = await window.pixai.conversation.runs(conversationId)
    const history = await window.pixai.history.list({
      query: state.query,
      sort: state.sort,
      favoritesOnly: state.favoritesOnly
    })
    set({
      runsByConversation: { ...get().runsByConversation, [conversationId]: runs },
      history
    })
  },
  cancelGeneration: async (conversationId, requestIndex) => {
    const id = conversationId || get().activeConversationId
    if (!id || !get().generatingByConversation[id]) return
    if (typeof requestIndex === 'number') {
      const nextGenerationState = markGenerationRequestCanceled(id, requestIndex, {
        generatingByConversation: get().generatingByConversation,
        startedAtByConversation: get().generationStartedAtByConversation,
        canceledIndexesByConversation: get().canceledGenerationIndexesByConversation
      })
      set({
        generatingByConversation: nextGenerationState.generatingByConversation,
        generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
        canceledGenerationIndexesByConversation: nextGenerationState.canceledIndexesByConversation
      })
    }
    await window.pixai.image.cancel(id, requestIndex)
  },
  reloadHistory: async (options = {}) => {
    const state = get()
    const history = await window.pixai.history.list({
      query: options.query ?? state.query,
      sort: options.sort ?? state.sort,
      favoritesOnly: options.favoritesOnly ?? state.favoritesOnly
    })
    set({ history })
  },
  deleteHistory: async (id) => {
    const item = get().history.find((entry) => entry.id === id)
    await window.pixai.history.delete(id)
    await get().reloadHistory()
    if (item?.conversationId) {
      const runs = await window.pixai.conversation.runs(item.conversationId)
      set({ runsByConversation: { ...get().runsByConversation, [item.conversationId]: runs } })
    }
    get().notify('已删除历史项')
  },
  deleteHistoryItems: async (ids) => {
    const selectedIds = new Set(ids)
    if (selectedIds.size === 0) return
    const affectedConversationIds = new Set(
      get().history
        .filter((entry) => selectedIds.has(entry.id) && entry.conversationId)
        .map((entry) => entry.conversationId as string)
    )
    for (const id of selectedIds) {
      await window.pixai.history.delete(id)
    }
    await get().reloadHistory()
    const runsByConversation = { ...get().runsByConversation }
    for (const conversationId of affectedConversationIds) {
      runsByConversation[conversationId] = await window.pixai.conversation.runs(conversationId)
    }
    set({ runsByConversation })
    get().notify(`已删除 ${selectedIds.size} 项`)
  },
  toggleFavorite: async (item) => {
    await window.pixai.history.favorite(item.id, !item.favorite)
    await get().reloadHistory()
    if (item.conversationId) {
      const runs = await window.pixai.conversation.runs(item.conversationId)
      set({ runsByConversation: { ...get().runsByConversation, [item.conversationId]: runs } })
    }
  },
  setFavoriteForHistoryItems: async (items, favorite) => {
    if (items.length === 0) return
    const affectedConversationIds = new Set(items.map((item) => item.conversationId).filter((id): id is string => Boolean(id)))
    for (const item of items) {
      await window.pixai.history.favorite(item.id, favorite)
    }
    await get().reloadHistory()
    const runsByConversation = { ...get().runsByConversation }
    for (const conversationId of affectedConversationIds) {
      runsByConversation[conversationId] = await window.pixai.conversation.runs(conversationId)
    }
    set({ runsByConversation })
    get().notify(favorite ? `已收藏 ${items.length} 项` : `已取消收藏 ${items.length} 项`)
  },
  reuseHistory: async (item) => {
    let id = item.conversationId || get().activeConversationId
    if (!id) {
      await get().createConversation()
      id = get().activeConversationId
    }
    if (!id) return
    await window.pixai.conversation.update(id, {
      draftPrompt: item.prompt,
      model: item.model,
      ratio: item.ratio,
      quality: item.quality
    })
    const conversations = await window.pixai.conversation.list()
    const runs = await window.pixai.conversation.runs(id)
    set({ conversations, activeConversationId: id, runsByConversation: { ...get().runsByConversation, [id]: runs }, view: 'workspace' })
    get().notify('已回填到当前会话')
  },
  notify: (message) => {
    set({ toast: message })
    if (message) window.setTimeout(() => set({ toast: null }), 1800)
  }
}))
