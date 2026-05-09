import { describe, expect, it } from 'vitest'
import type { ImageHistoryItem } from './types'
import { filterHistoryItems } from './history-filter'

const baseItem = {
  conversationId: null,
  runId: null,
  model: 'gpt-image-2',
  ratio: '1:1' as const,
  size: '1024x1024',
  quality: 'high' as const,
  requestIndex: null,
  durationMs: 12345,
  filePath: null,
  fileSizeBytes: null,
  status: 'succeeded' as const,
  errorMessage: null,
  errorDetails: null
} satisfies Omit<ImageHistoryItem, 'id' | 'prompt' | 'favorite' | 'createdAt'>

describe('history filtering', () => {
  it('filters by prompt text, favorites, and newest ordering', () => {
    const items: ImageHistoryItem[] = [
      { ...baseItem, id: 'old', prompt: 'greenhouse mist', favorite: false, createdAt: '2026-05-01T00:00:00.000Z' },
      { ...baseItem, id: 'new', prompt: 'fresh avatar', favorite: true, createdAt: '2026-05-03T00:00:00.000Z' },
      { ...baseItem, id: 'middle', prompt: 'avatar poster', favorite: true, createdAt: '2026-05-02T00:00:00.000Z' }
    ]

    const result = filterHistoryItems(items, { query: 'avatar', favoritesOnly: true, sort: 'newest' })

    expect(result.map((item) => item.id)).toEqual(['new', 'middle'])
  })

  it('matches localized quality labels', () => {
    const items: ImageHistoryItem[] = [
      { ...baseItem, id: 'high', prompt: 'portrait', favorite: false, createdAt: '2026-05-01T00:00:00.000Z' },
      { ...baseItem, id: 'auto', prompt: 'poster', quality: 'auto', favorite: false, createdAt: '2026-05-02T00:00:00.000Z' }
    ]

    expect(filterHistoryItems(items, { query: '高' }).map((item) => item.id)).toEqual(['high'])
    expect(filterHistoryItems(items, { query: '自动' }).map((item) => item.id)).toEqual(['auto'])
  })
})
