import { describe, expect, it } from 'vitest'
import type { ImageHistoryItem } from '@shared/types'
import { getGeneratingPlaceholderIndexes, getWorkspaceRunGridSlots } from './workspace-placeholders'

describe('workspace placeholders', () => {
  it('keeps only indexes that are still generating', () => {
    expect(getGeneratingPlaceholderIndexes(4, [1, 3], [2])).toEqual([0])
  })

  it('returns no placeholders when all indexes are completed or canceled', () => {
    expect(getGeneratingPlaceholderIndexes(3, [0, 2], [1])).toEqual([])
  })

  it('keeps completed and failed images in their original request slots', () => {
    const succeeded = { id: 'ok', requestIndex: 2, status: 'succeeded' } as ImageHistoryItem
    const failed = { id: 'fail', requestIndex: 0, status: 'failed' } as ImageHistoryItem

    expect(getWorkspaceRunGridSlots(4, [succeeded, failed], [1])).toEqual([
      { type: 'item', requestIndex: 0, item: failed },
      { type: 'item', requestIndex: 2, item: succeeded },
      { type: 'placeholder', requestIndex: 3 }
    ])
  })
})
