import { describe, expect, it } from 'vitest'
import { beginConversationGeneration, endConversationGeneration, getConversationGenerationState, markGenerationRequestRemoved } from './generation-state'

describe('conversation generation state', () => {
  it('tracks generation per conversation instead of globally', () => {
    const generatingByConversation = { a: true, b: false }
    const startedAtByConversation = { a: 1000 }

    expect(getConversationGenerationState('a', generatingByConversation, startedAtByConversation)).toEqual({
      generating: true,
      startedAt: 1000
    })

    expect(getConversationGenerationState('b', generatingByConversation, startedAtByConversation)).toEqual({
      generating: false,
      startedAt: null
    })
  })

  it('tracks removed request indexes per conversation', () => {
    const state = markGenerationRequestRemoved('c1', 2, {
      generatingByConversation: { c1: true },
      startedAtByConversation: { c1: 1000 },
      removedIndexesByConversation: { c1: [1] }
    })

    expect(state.removedIndexesByConversation.c1).toEqual([1, 2])
  })

  it('clears stale removed request indexes when generation starts and ends', () => {
    const started = beginConversationGeneration('c1', {
      generatingByConversation: {},
      startedAtByConversation: {},
      removedIndexesByConversation: { c1: [1] }
    }, 1000)

    expect(started.removedIndexesByConversation.c1).toEqual([])

    const ended = endConversationGeneration('c1', started)

    expect(ended.removedIndexesByConversation.c1).toBeUndefined()
  })
})
