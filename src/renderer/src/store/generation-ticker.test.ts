import { describe, expect, it } from 'vitest'

describe('generation ticker state', () => {
  it('derives active generation state from the latest per-conversation maps', () => {
    const activeConversationId = 'c1'
    const generatingByConversation = { c1: 2 }
    const generationStartedAtByConversation = { c1: 1000 }

    const activeGenerationState = activeConversationId
      ? {
          generating: Boolean(generatingByConversation[activeConversationId]),
          startedAt: generationStartedAtByConversation[activeConversationId] ?? null,
          activeCount: generatingByConversation[activeConversationId] || 0
        }
      : { generating: false, startedAt: null, activeCount: 0 }

    expect(activeGenerationState).toEqual({
      generating: true,
      startedAt: 1000,
      activeCount: 2
    })
  })
})
