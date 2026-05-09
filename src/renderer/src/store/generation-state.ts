export type GenerationState = {
  generatingByConversation: Record<string, boolean>
  startedAtByConversation: Record<string, number>
  removedIndexesByConversation: Record<string, number[]>
}

export function getConversationGenerationState(
  conversationId: string,
  generatingByConversation: Record<string, boolean>,
  startedAtByConversation: Record<string, number>
): { generating: boolean; startedAt: number | null } {
  return {
    generating: Boolean(generatingByConversation[conversationId]),
    startedAt: startedAtByConversation[conversationId] ?? null
  }
}

export function beginConversationGeneration(
  conversationId: string,
  state: GenerationState,
  startedAt = Date.now()
): GenerationState {
  return {
    generatingByConversation: { ...state.generatingByConversation, [conversationId]: true },
    startedAtByConversation: { ...state.startedAtByConversation, [conversationId]: startedAt },
    removedIndexesByConversation: { ...state.removedIndexesByConversation, [conversationId]: [] }
  }
}

export function endConversationGeneration(conversationId: string, state: GenerationState): GenerationState {
  const generatingByConversation = { ...state.generatingByConversation }
  const startedAtByConversation = { ...state.startedAtByConversation }
  const removedIndexesByConversation = { ...state.removedIndexesByConversation }
  delete generatingByConversation[conversationId]
  delete startedAtByConversation[conversationId]
  delete removedIndexesByConversation[conversationId]
  return { generatingByConversation, startedAtByConversation, removedIndexesByConversation }
}

export function markGenerationRequestRemoved(
  conversationId: string,
  requestIndex: number,
  state: GenerationState
): GenerationState {
  const current = state.removedIndexesByConversation[conversationId] || []
  const nextIndexes = current.includes(requestIndex) ? current : [...current, requestIndex].sort((a, b) => a - b)
  return {
    ...state,
    removedIndexesByConversation: {
      ...state.removedIndexesByConversation,
      [conversationId]: nextIndexes
    }
  }
}
