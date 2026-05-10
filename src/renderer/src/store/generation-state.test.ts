import { describe, expect, it } from 'vitest'
import {
  beginConversationGeneration,
  endConversationGeneration,
  getConversationGenerationState,
  markGenerationRequestRemoved,
  pruneRemovedGenerationIndexesByRunId
} from './generation-state'

describe('conversation generation state', () => {
  it('tracks generation per conversation instead of globally', () => {
    const generatingByConversation = { a: 2, b: 0 }
    const startedAtByConversation = { a: 1000 }

    expect(getConversationGenerationState('a', generatingByConversation, startedAtByConversation)).toEqual({
      generating: true,
      startedAt: 1000,
      activeCount: 2
    })

    expect(getConversationGenerationState('b', generatingByConversation, startedAtByConversation)).toEqual({
      generating: false,
      startedAt: null,
      activeCount: 0
    })
  })

  it('tracks removed request indexes per run', () => {
    const state = markGenerationRequestRemoved('run-1', 2, {
      generatingByConversation: { c1: 1 },
      startedAtByConversation: { c1: 1000 },
      removedIndexesByRunId: { 'run-1': [1] }
    })

    expect(state.removedIndexesByRunId['run-1']).toEqual([1, 2])
  })

  it('increments and decrements generation counts without resetting run removal state', () => {
    const started = beginConversationGeneration('c1', {
      generatingByConversation: {},
      startedAtByConversation: {},
      removedIndexesByRunId: { 'run-1': [1] }
    }, 1000)

    expect(started.generatingByConversation.c1).toBe(1)
    expect(started.startedAtByConversation.c1).toBe(1000)
    expect(started.removedIndexesByRunId['run-1']).toEqual([1])

    const secondStarted = beginConversationGeneration('c1', started, 2000)
    expect(secondStarted.generatingByConversation.c1).toBe(2)
    expect(secondStarted.startedAtByConversation.c1).toBe(1000)

    const oneLeft = endConversationGeneration('c1', secondStarted)
    expect(oneLeft.generatingByConversation.c1).toBe(1)

    const ended = endConversationGeneration('c1', oneLeft)

    expect(ended.generatingByConversation.c1).toBeUndefined()
    expect(ended.startedAtByConversation.c1).toBeUndefined()
  })

  it('prunes removed indexes for runs that are no longer running', () => {
    const state = pruneRemovedGenerationIndexesByRunId(['run-2'], {
      generatingByConversation: {},
      startedAtByConversation: {},
      removedIndexesByRunId: {
        'run-1': [0],
        'run-2': [1]
      }
    })

    expect(state.removedIndexesByRunId).toEqual({ 'run-2': [1] })
  })
})
