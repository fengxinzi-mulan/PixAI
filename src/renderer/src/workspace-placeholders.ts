import type { ImageHistoryItem } from '@shared/types'

export type WorkspaceRunGridSlot =
  | { type: 'placeholder'; requestIndex: number }
  | { type: 'item'; requestIndex: number | null; item: ImageHistoryItem }

export function getGeneratingPlaceholderIndexes(
  totalCount: number,
  completedIndexes: Array<number | null | undefined>,
  canceledIndexes: number[]
): number[] {
  const completed = new Set(completedIndexes.filter((index): index is number => typeof index === 'number'))
  const canceled = new Set(canceledIndexes)
  return Array.from({ length: Math.max(0, totalCount) }, (_value, index) => index)
    .filter((index) => !completed.has(index) && !canceled.has(index))
}

export function getWorkspaceRunGridSlots(
  totalCount: number,
  items: ImageHistoryItem[],
  canceledIndexes: number[]
): WorkspaceRunGridSlot[] {
  const canceled = new Set(canceledIndexes)
  const itemsByIndex = new Map<number, ImageHistoryItem>()
  const unindexedItems: ImageHistoryItem[] = []

  for (const item of items) {
    if (typeof item.requestIndex === 'number') {
      if (!canceled.has(item.requestIndex)) itemsByIndex.set(item.requestIndex, item)
    } else {
      unindexedItems.push(item)
    }
  }

  const slots: WorkspaceRunGridSlot[] = []
  for (let requestIndex = 0; requestIndex < Math.max(0, totalCount); requestIndex += 1) {
    if (canceled.has(requestIndex)) continue
    const item = itemsByIndex.get(requestIndex)
    slots.push(item ? { type: 'item', requestIndex, item } : { type: 'placeholder', requestIndex })
  }

  return [
    ...slots,
    ...unindexedItems.map((item) => ({ type: 'item' as const, requestIndex: null, item }))
  ]
}
