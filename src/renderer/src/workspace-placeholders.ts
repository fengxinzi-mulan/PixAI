import type { ImageHistoryItem } from '@shared/types'

export type WorkspaceRunGridSlot =
  | { type: 'placeholder'; requestIndex: number; retryAttempt: number }
  | { type: 'item'; requestIndex: number | null; item: ImageHistoryItem }

export function getGeneratingPlaceholderIndexes(
  totalCount: number,
  completedIndexes: Array<number | null | undefined>,
  removedIndexes: number[]
): number[] {
  const completed = new Set(completedIndexes.filter((index): index is number => typeof index === 'number'))
  const removed = new Set(removedIndexes)
  return Array.from({ length: Math.max(0, totalCount) }, (_value, index) => index)
    .filter((index) => !completed.has(index) && !removed.has(index))
}

export function getWorkspaceRunGridSlots(
  totalCount: number,
  items: ImageHistoryItem[],
  removedIndexes: number[],
  retryAttempts: Record<number, number> = {}
): WorkspaceRunGridSlot[] {
  const removed = new Set(removedIndexes)
  const itemsByIndex = new Map<number, ImageHistoryItem>()
  const unindexedItems: ImageHistoryItem[] = []

  for (const item of items) {
    if (typeof item.requestIndex === 'number') {
      if (!removed.has(item.requestIndex)) itemsByIndex.set(item.requestIndex, item)
    } else {
      unindexedItems.push(item)
    }
  }

  const slots: WorkspaceRunGridSlot[] = []
  for (let requestIndex = 0; requestIndex < Math.max(0, totalCount); requestIndex += 1) {
    if (removed.has(requestIndex)) continue
    const item = itemsByIndex.get(requestIndex)
    slots.push(item ? { type: 'item', requestIndex, item } : {
      type: 'placeholder',
      requestIndex,
      retryAttempt: retryAttempts[requestIndex] || 0
    })
  }

  return [
    ...slots,
    ...unindexedItems.map((item) => ({ type: 'item' as const, requestIndex: null, item }))
  ]
}
