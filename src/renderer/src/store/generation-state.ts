export type GenerationState = {
  generatingByConversation: Record<string, boolean>
  startedAtByConversation: Record<string, number>
  canceledIndexesByConversation: Record<string, number[]>
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
    canceledIndexesByConversation: { ...state.canceledIndexesByConversation, [conversationId]: [] }
  }
}

export function endConversationGeneration(conversationId: string, state: GenerationState): GenerationState {
  const generatingByConversation = { ...state.generatingByConversation }
  const startedAtByConversation = { ...state.startedAtByConversation }
  const canceledIndexesByConversation = { ...state.canceledIndexesByConversation }
  delete generatingByConversation[conversationId]
  delete startedAtByConversation[conversationId]
  delete canceledIndexesByConversation[conversationId]
  return { generatingByConversation, startedAtByConversation, canceledIndexesByConversation }
}

export function markGenerationRequestCanceled(
  conversationId: string,
  requestIndex: number,
  state: GenerationState
): GenerationState {
  const current = state.canceledIndexesByConversation[conversationId] || []
  const nextIndexes = current.includes(requestIndex) ? current : [...current, requestIndex].sort((a, b) => a - b)
  return {
    ...state,
    canceledIndexesByConversation: {
      ...state.canceledIndexesByConversation,
      [conversationId]: nextIndexes
    }
  }
}
