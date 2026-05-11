import { describe, expect, it } from 'vitest'
import type { GenerationRun, ImageHistoryItem } from '@shared/types'
import { createInterruptedRunRecoveryPlan, interruptedRunErrorMessage } from './interrupted-run-recovery'

function createRun(overrides: Partial<GenerationRun> = {}): GenerationRun {
  return {
    id: 'run-1',
    conversationId: 'c1',
    prompt: 'prompt',
    model: 'gpt-image-2',
    ratio: '1:1',
    size: '1024x1024',
    quality: 'auto',
    n: 2,
    status: 'running',
    durationMs: null,
    errorMessage: null,
    errorDetails: null,
    generationMode: 'text-to-image',
    referenceImages: [],
    createdAt: '2026-05-11T00:00:00.000Z',
    items: [],
    ...overrides
  }
}

function createItem(overrides: Partial<ImageHistoryItem> = {}): ImageHistoryItem {
  return {
    id: 'item-1',
    conversationId: 'c1',
    runId: 'run-1',
    prompt: 'prompt',
    model: 'gpt-image-2',
    ratio: '1:1',
    size: '1024x1024',
    quality: 'auto',
    requestIndex: 0,
    durationMs: 1000,
    filePath: 'image.png',
    fileSizeBytes: 10,
    status: 'succeeded',
    errorMessage: null,
    errorDetails: null,
    favorite: false,
    generationMode: 'text-to-image',
    referenceImages: [],
    createdAt: '2026-05-11T00:00:01.000Z',
    ...overrides
  }
}

describe('interrupted run recovery', () => {
  it('fails missing request indexes from stale running runs', () => {
    const plan = createInterruptedRunRecoveryPlan(
      createRun({ items: [createItem({ requestIndex: 0 })] }),
      new Date('2026-05-11T00:00:03.000Z')
    )

    expect(plan.status).toBe('failed')
    expect(plan.durationMs).toBe(3000)
    expect(plan.errorMessage).toBe(interruptedRunErrorMessage)
    expect(plan.failedItems).toEqual([
      expect.objectContaining({
        requestIndex: 1,
        durationMs: 3000,
        errorMessage: interruptedRunErrorMessage,
        createdAt: '2026-05-11T00:00:03.000Z'
      })
    ])
  })

  it('marks a stale run as succeeded when every request already succeeded', () => {
    const plan = createInterruptedRunRecoveryPlan(
      createRun({
        n: 1,
        items: [createItem({ requestIndex: 0, status: 'succeeded' })]
      }),
      new Date('2026-05-11T00:00:03.000Z')
    )

    expect(plan.status).toBe('succeeded')
    expect(plan.errorMessage).toBeNull()
    expect(plan.failedItems).toEqual([])
  })

  it('marks a stale run as failed when completed items include failures', () => {
    const plan = createInterruptedRunRecoveryPlan(
      createRun({
        n: 1,
        items: [createItem({ requestIndex: 0, status: 'failed', errorMessage: 'bad request', filePath: null })]
      }),
      new Date('2026-05-11T00:00:03.000Z')
    )

    expect(plan.status).toBe('failed')
    expect(plan.errorMessage).toBe(interruptedRunErrorMessage)
    expect(plan.failedItems).toEqual([])
  })
})
