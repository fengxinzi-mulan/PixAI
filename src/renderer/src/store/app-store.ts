import { create } from 'zustand'
import { formatDuration } from '@shared/duration'
import { DEFAULT_IMAGE_OUTPUT_FORMAT, DEFAULT_MODEL, getDefaultImageSize } from '@shared/image-options'
import type {
  Conversation,
  ConversationCreateInput,
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
  markGenerationRequestRemoved,
  pruneRemovedGenerationIndexesByRunId
} from './generation-state'
import type { PromptTemplate } from '../prompt-library'

type View = 'workspace' | 'gallery' | 'prompts'

function normalizeConversationInteger(value: number | null | undefined, min: number, max: number): number | undefined {
  if (value === null || value === undefined) return undefined
  if (!Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function normalizeConversationOptionalInteger(
  value: number | null | undefined,
  min: number,
  max: number
): number | null | undefined {
  if (value === null || value === undefined) return value
  if (!Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

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
  generatingByConversation: Record<string, number>
  generationStartedAtByConversation: Record<string, number>
  removedGenerationIndexesByRunId: Record<string, number[]>
  promptAssistantRunning: { inspire: boolean; enrich: boolean }
  toast: string | null
  getConversationGenerationState: (conversationId: string) => { generating: boolean; startedAt: number | null; activeCount: number }
  load: () => Promise<void>
  setView: (view: View) => void
  toggleSettings: () => void
  toggleTheme: () => void
  setQuery: (query: string) => void
  setSort: (sort: 'newest' | 'oldest') => Promise<void>
  setFavoritesOnly: (favoritesOnly: boolean) => Promise<void>
  setActiveConversation: (id: string) => Promise<void>
  createConversation: (template?: ConversationCreateInput, options?: { silent?: boolean }) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  updateActiveConversation: (input: ConversationUpdate) => Promise<void>
  updateSettings: (input: ProviderSettingsUpdate) => Promise<void>
  importReferenceFiles: (files: File[]) => Promise<void>
  addHistoryAsReference: (historyId: string) => Promise<void>
  removeReferenceImage: (referenceImageId: string) => Promise<void>
  reorderReferenceImages: (referenceImageIds: string[]) => Promise<void>
  applyPromptTemplate: (template: PromptTemplate) => Promise<void>
  inspirePrompt: () => Promise<void>
  enrichPrompt: () => Promise<void>
  generate: () => Promise<void>
  refreshConversationResults: (conversationId: string) => Promise<void>
  cancelGeneration: (runId?: string, requestIndex?: number) => Promise<void>
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

function collectRunningRunIds(runsByConversation: Record<string, GenerationRun[]>): string[] {
  return Object.values(runsByConversation)
    .flatMap((runs) => runs.filter((run) => run.status === 'running').map((run) => run.id))
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
  removedGenerationIndexesByRunId: {},
  promptAssistantRunning: { inspire: false, enrich: false },
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
  createConversation: async (template = {}, options = {}) => {
    const current = get().conversations.find((item) => item.id === get().activeConversationId) || get().conversations[0] || null
    const conversation = await window.pixai.conversation.create({
      ratio: template.ratio ?? current?.ratio,
      size: template.size ?? current?.size,
      quality: template.quality ?? current?.quality,
      model: template.model ?? current?.model,
      n: template.n ?? current?.n,
      outputFormat: template.outputFormat ?? current?.outputFormat,
      outputCompression: template.outputCompression ?? current?.outputCompression,
      background: template.background ?? current?.background,
      moderation: template.moderation ?? current?.moderation,
      stream: template.stream ?? current?.stream,
      partialImages: template.partialImages ?? current?.partialImages,
      inputFidelity: template.inputFidelity ?? current?.inputFidelity,
      autoSaveHistory: template.autoSaveHistory ?? current?.autoSaveHistory,
      keepFailureDetails: template.keepFailureDetails ?? current?.keepFailureDetails
    })
    set({
      conversations: [conversation, ...get().conversations],
      activeConversationId: conversation.id,
      view: 'workspace',
      runsByConversation: { ...get().runsByConversation, [conversation.id]: [] }
    })
    if (!options.silent) get().notify('已新建会话')
  },
  deleteConversation: async (id) => {
    const deletedConversation = get().conversations.find((item) => item.id === id) || null
    await window.pixai.conversation.delete(id)
    let conversations = get().conversations.filter((item) => item.id !== id)
    if (conversations.length === 0) {
      const runsByConversation = { ...get().runsByConversation }
      delete runsByConversation[id]
      set({ conversations: [], activeConversationId: null, runsByConversation })
      await get().createConversation({
        ratio: deletedConversation?.ratio,
        size: deletedConversation?.size,
        quality: deletedConversation?.quality,
        model: deletedConversation?.model,
        n: deletedConversation?.n,
        outputFormat: deletedConversation?.outputFormat,
        outputCompression: deletedConversation?.outputCompression,
        background: deletedConversation?.background,
        moderation: deletedConversation?.moderation,
        stream: deletedConversation?.stream,
        partialImages: deletedConversation?.partialImages,
        inputFidelity: deletedConversation?.inputFidelity,
        autoSaveHistory: deletedConversation?.autoSaveHistory,
        keepFailureDetails: deletedConversation?.keepFailureDetails
      }, { silent: true })
      get().notify('已删除会话，历史记录已保留')
      return
    }
    const activeConversationId = get().activeConversationId === id ? conversations[0].id : get().activeConversationId
    const runsByConversation = { ...get().runsByConversation }
    delete runsByConversation[id]
    set({ conversations, activeConversationId, runsByConversation })
    get().notify('已删除会话，历史记录已保留')
  },
  updateActiveConversation: async (input) => {
    const id = get().activeConversationId
    if (!id) return
    const normalizedBase: ConversationUpdate = { ...input }
    if (input.n !== undefined) {
      normalizedBase.n = normalizeConversationInteger(input.n, 1, 10) ?? 1
    }
    if (input.outputCompression !== undefined) {
      normalizedBase.outputCompression = normalizeConversationOptionalInteger(input.outputCompression, 0, 100) ?? null
    }
    if (input.partialImages !== undefined) {
      normalizedBase.partialImages = normalizeConversationOptionalInteger(input.partialImages, 0, 3) ?? null
    }
    const normalized =
      normalizedBase.ratio !== undefined && normalizedBase.size === undefined
        ? { ...normalizedBase, size: getDefaultImageSize(normalizedBase.ratio) }
        : normalizedBase
    const draftPromptOnly = Object.keys(normalized).length === 1 && Object.prototype.hasOwnProperty.call(normalized, 'draftPrompt')
    set({
      conversations: get().conversations.map((item) =>
        item.id === id ? { ...item, ...normalized, updatedAt: new Date().toISOString() } : item
      )
    })
    if (draftPromptOnly) {
      void window.pixai.conversation.update(id, normalized).catch((error) => {
        get().notify(error instanceof Error ? error.message : '草稿保存失败')
      })
      return
    }
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
      const updated = await window.pixai.conversation.update(id, {
        draftPrompt: sourceItem?.prompt || '',
        ratio: sourceItem?.ratio,
        size: sourceItem?.size || (sourceItem?.ratio ? getDefaultImageSize(sourceItem.ratio) : undefined),
        model: sourceItem?.model,
        quality: sourceItem?.quality
      })
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
  applyPromptTemplate: async (template) => {
    const state = get()
    let conversation = state.conversations.find((item) => item.id === state.activeConversationId) || null
    if (!conversation) {
      await get().createConversation(
        {
          ratio: template.ratio,
          size: template.resolution || getDefaultImageSize(template.ratio),
          quality: template.quality
        },
        { silent: true }
      )
      conversation = get().conversations.find((item) => item.id === get().activeConversationId) || null
    }
    if (!conversation) return

    const patch: ConversationUpdate = {
      draftPrompt: template.prompt,
      ratio: template.ratio,
      size: template.resolution || getDefaultImageSize(template.ratio),
      quality: template.quality
    }
    if (conversation.title === '新会话') {
      patch.title = template.title
    }

    await get().updateActiveConversation(patch)
    set({ view: 'workspace' })
    get().notify(`已套用「${template.title}」`)
  },
  inspirePrompt: async () => {
    const conversation = get().conversations.find((item) => item.id === get().activeConversationId)
    if (!conversation || get().promptAssistantRunning.inspire) return
    set({ promptAssistantRunning: { ...get().promptAssistantRunning, inspire: true } })
    try {
      const prompt = await window.pixai.prompt.inspire({ hasReferenceImages: conversation.referenceImages.length > 0 })
      const updated = await window.pixai.conversation.update(conversation.id, { draftPrompt: prompt })
      set({
        conversations: get().conversations.map((item) => (item.id === conversation.id ? updated : item))
      })
      get().notify('已生成灵感提示词')
    } catch (error) {
      get().notify(error instanceof Error ? `提示词生成失败：${error.message}` : '提示词生成失败')
    } finally {
      set({ promptAssistantRunning: { ...get().promptAssistantRunning, inspire: false } })
    }
  },
  enrichPrompt: async () => {
    const conversation = get().conversations.find((item) => item.id === get().activeConversationId)
    const currentPrompt = conversation?.draftPrompt.trim() || ''
    if (!conversation || !currentPrompt || get().promptAssistantRunning.enrich) return
    set({ promptAssistantRunning: { ...get().promptAssistantRunning, enrich: true } })
    try {
      const prompt = await window.pixai.prompt.enrich({
        prompt: currentPrompt,
        hasReferenceImages: conversation.referenceImages.length > 0
      })
      const updated = await window.pixai.conversation.update(conversation.id, { draftPrompt: prompt })
      set({
        conversations: get().conversations.map((item) => (item.id === conversation.id ? updated : item))
      })
      get().notify('已丰富提示词')
    } catch (error) {
      get().notify(error instanceof Error ? `提示词生成失败：${error.message}` : '提示词生成失败')
    } finally {
      set({ promptAssistantRunning: { ...get().promptAssistantRunning, enrich: false } })
    }
  },
  generate: async () => {
    const state = get()
    const conversation = state.conversations.find((item) => item.id === state.activeConversationId)
    if (!conversation) return
    const generationStartedAt = Date.now()
    set({ generationClockMs: generationStartedAt })
    startGenerationClock()
    const prompt = conversation.draftPrompt.trim()
    const input: GenerateImageInput = {
      conversationId: conversation.id,
      prompt,
      model: conversation.model || state.settings?.defaultModel || DEFAULT_MODEL,
      ratio: conversation.ratio,
      size: conversation.size || getDefaultImageSize(conversation.ratio),
      quality: conversation.quality,
      n: conversation.n,
      outputCompression: conversation.outputCompression ?? undefined,
      background: conversation.background,
      moderation: conversation.moderation,
      stream: conversation.stream,
      partialImages: conversation.partialImages ?? undefined,
      inputFidelity: conversation.inputFidelity ?? undefined,
      outputFormat: conversation.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT,
      referenceImageIds: conversation.referenceImages.map((reference) => reference.id)
    }
    const nextGenerationState = beginConversationGeneration(conversation.id, {
      generatingByConversation: state.generatingByConversation,
      startedAtByConversation: state.generationStartedAtByConversation,
      removedIndexesByRunId: state.removedGenerationIndexesByRunId
    }, generationStartedAt)
    set({
      generatingByConversation: nextGenerationState.generatingByConversation,
      generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
      removedGenerationIndexesByRunId: nextGenerationState.removedIndexesByRunId
    })
    const titlePatch = conversation.title === '新会话' && prompt ? { title: prompt.length > 18 ? `${prompt.slice(0, 18)}...` : prompt } : null
    try {
      if (titlePatch) await get().updateActiveConversation(titlePatch)
      const resultPromise = window.pixai.image.generate(input)
      void get().refreshConversationResults(conversation.id)
      const result = await resultPromise
      const runs = await window.pixai.conversation.runs(conversation.id)
      const history = await window.pixai.history.list({ query: state.query, sort: state.sort, favoritesOnly: state.favoritesOnly })
      const runsByConversation = { ...get().runsByConversation, [conversation.id]: runs }
      const runningRunIds = collectRunningRunIds(runsByConversation)
      const prunedGenerationState = pruneRemovedGenerationIndexesByRunId(runningRunIds, {
        generatingByConversation: get().generatingByConversation,
        startedAtByConversation: get().generationStartedAtByConversation,
        removedIndexesByRunId: get().removedGenerationIndexesByRunId
      })
      set({
        runsByConversation,
        history,
        removedGenerationIndexesByRunId: prunedGenerationState.removedIndexesByRunId
      })
      const durationText = result.run.durationMs != null ? `，用时 ${formatDuration(result.run.durationMs)}` : ''
      get().notify(result.canceled ? `已取消${durationText}` : result.errorMessage ? `生成失败：${result.errorMessage}${durationText}` : `生成完成${durationText}`)
    } catch (error) {
      get().notify(error instanceof Error ? `生成失败：${error.message}` : '生成失败')
    } finally {
      const nextGenerationState = endConversationGeneration(conversation.id, {
        generatingByConversation: get().generatingByConversation,
        startedAtByConversation: get().generationStartedAtByConversation,
        removedIndexesByRunId: get().removedGenerationIndexesByRunId
      })
      set({
        generatingByConversation: nextGenerationState.generatingByConversation,
        generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
        removedGenerationIndexesByRunId: nextGenerationState.removedIndexesByRunId
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
    const runsByConversation = { ...get().runsByConversation, [conversationId]: runs }
    const runningRunIds = collectRunningRunIds(runsByConversation)
    const nextGenerationState = pruneRemovedGenerationIndexesByRunId(runningRunIds, {
      generatingByConversation: get().generatingByConversation,
      startedAtByConversation: get().generationStartedAtByConversation,
      removedIndexesByRunId: get().removedGenerationIndexesByRunId
    })
    set({
      runsByConversation,
      history,
      removedGenerationIndexesByRunId: nextGenerationState.removedIndexesByRunId
    })
  },
  cancelGeneration: async (runId, requestIndex) => {
    if (!runId) return
    if (typeof requestIndex === 'number') {
      const nextGenerationState = markGenerationRequestRemoved(runId, requestIndex, {
        generatingByConversation: get().generatingByConversation,
        startedAtByConversation: get().generationStartedAtByConversation,
        removedIndexesByRunId: get().removedGenerationIndexesByRunId
      })
      set({
        generatingByConversation: nextGenerationState.generatingByConversation,
        generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
        removedGenerationIndexesByRunId: nextGenerationState.removedIndexesByRunId
      })
    }
    await window.pixai.image.cancel(runId, requestIndex)
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
    if (item?.conversationId && item.runId && typeof item.requestIndex === 'number') {
      const activeRun = get().runsByConversation[item.conversationId]?.find((run) => run.id === item.runId && run.status === 'running')
      if (activeRun) {
        const nextGenerationState = markGenerationRequestRemoved(item.runId, item.requestIndex, {
          generatingByConversation: get().generatingByConversation,
          startedAtByConversation: get().generationStartedAtByConversation,
          removedIndexesByRunId: get().removedGenerationIndexesByRunId
        })
        set({
          generatingByConversation: nextGenerationState.generatingByConversation,
          generationStartedAtByConversation: nextGenerationState.startedAtByConversation,
          removedGenerationIndexesByRunId: nextGenerationState.removedIndexesByRunId
        })
      }
    }
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
    const state = get()
    const affectedConversationIds = new Set(
      state.history
        .filter((entry) => selectedIds.has(entry.id) && entry.conversationId)
        .map((entry) => entry.conversationId as string)
    )
    let nextRemovedIndexesByRunId = { ...state.removedGenerationIndexesByRunId }
    let nextGeneratingByConversation = { ...state.generatingByConversation }
    let nextStartedAtByConversation = { ...state.generationStartedAtByConversation }
    let removedStateChanged = false
    for (const id of selectedIds) {
      const item = state.history.find((entry) => entry.id === id)
      if (item?.conversationId && item.runId && typeof item.requestIndex === 'number') {
        const activeRun = state.runsByConversation[item.conversationId]?.find((run) => run.id === item.runId && run.status === 'running')
        if (activeRun) {
          const nextGenerationState = markGenerationRequestRemoved(item.runId, item.requestIndex, {
            generatingByConversation: nextGeneratingByConversation,
            startedAtByConversation: nextStartedAtByConversation,
            removedIndexesByRunId: nextRemovedIndexesByRunId
          })
          nextGeneratingByConversation = nextGenerationState.generatingByConversation
          nextStartedAtByConversation = nextGenerationState.startedAtByConversation
          nextRemovedIndexesByRunId = nextGenerationState.removedIndexesByRunId
          removedStateChanged = true
        }
      }
      await window.pixai.history.delete(id)
    }
    if (removedStateChanged) {
      set({
        generatingByConversation: nextGeneratingByConversation,
        generationStartedAtByConversation: nextStartedAtByConversation,
        removedGenerationIndexesByRunId: nextRemovedIndexesByRunId
      })
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
      size: item.size || getDefaultImageSize(item.ratio),
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
