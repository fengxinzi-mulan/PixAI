import { describe, expect, it } from 'vitest'
import { beginConversationGeneration, endConversationGeneration, getConversationGenerationState, markGenerationRequestCanceled } from './generation-state'

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

  it('tracks canceled request indexes per conversation', () => {
    const state = markGenerationRequestCanceled('c1', 2, {
      generatingByConversation: { c1: true },
      startedAtByConversation: { c1: 1000 },
      canceledIndexesByConversation: { c1: [1] }
    })

    expect(state.canceledIndexesByConversation.c1).toEqual([1, 2])
  })

  it('clears stale canceled request indexes when generation starts and ends', () => {
    const started = beginConversationGeneration('c1', {
      generatingByConversation: {},
      startedAtByConversation: {},
      canceledIndexesByConversation: { c1: [1] }
    }, 1000)

    expect(started.canceledIndexesByConversation.c1).toEqual([])

    const ended = endConversationGeneration('c1', started)

    expect(ended.canceledIndexesByConversation.c1).toBeUndefined()
  })
})
