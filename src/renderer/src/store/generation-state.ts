export type GenerationState = {
  generatingByConversation: Record<string, number>
  startedAtByConversation: Record<string, number>
  removedIndexesByRunId: Record<string, number[]>
}

export function getConversationGenerationState(
  conversationId: string,
  generatingByConversation: Record<string, number>,
  startedAtByConversation: Record<string, number>
): { generating: boolean; startedAt: number | null; activeCount: number } {
  const activeCount = generatingByConversation[conversationId] || 0
  return {
    generating: activeCount > 0,
    startedAt: startedAtByConversation[conversationId] ?? null,
    activeCount
  }
}

export function beginConversationGeneration(
  conversationId: string,
  state: GenerationState,
  startedAt = Date.now()
): GenerationState {
  const currentCount = state.generatingByConversation[conversationId] || 0
  const nextCount = currentCount + 1
  return {
    generatingByConversation: { ...state.generatingByConversation, [conversationId]: nextCount },
    startedAtByConversation: currentCount === 0
      ? { ...state.startedAtByConversation, [conversationId]: startedAt }
      : state.startedAtByConversation,
    removedIndexesByRunId: state.removedIndexesByRunId
  }
}

export function endConversationGeneration(conversationId: string, state: GenerationState): GenerationState {
  const generatingByConversation = { ...state.generatingByConversation }
  const startedAtByConversation = { ...state.startedAtByConversation }
  const removedIndexesByRunId = { ...state.removedIndexesByRunId }
  const currentCount = generatingByConversation[conversationId] || 0
  if (currentCount <= 1) {
    delete generatingByConversation[conversationId]
    delete startedAtByConversation[conversationId]
  } else {
    generatingByConversation[conversationId] = currentCount - 1
  }
  return { generatingByConversation, startedAtByConversation, removedIndexesByRunId }
}

export function markGenerationRequestRemoved(
  runId: string,
  requestIndex: number,
  state: GenerationState
): GenerationState {
  const current = state.removedIndexesByRunId[runId] || []
  const nextIndexes = current.includes(requestIndex) ? current : [...current, requestIndex].sort((a, b) => a - b)
  return {
    ...state,
    removedIndexesByRunId: {
      ...state.removedIndexesByRunId,
      [runId]: nextIndexes
    }
  }
}

export function pruneRemovedGenerationIndexesByRunId(
  runIds: string[],
  state: GenerationState
): GenerationState {
  const allowed = new Set(runIds)
  const removedIndexesByRunId = Object.fromEntries(
    Object.entries(state.removedIndexesByRunId).filter(([runId]) => allowed.has(runId))
  )
  return {
    ...state,
    removedIndexesByRunId
  }
}
