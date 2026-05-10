import { formatImageQuality } from './image-options'
import type { HistoryListOptions, ImageHistoryItem } from './types'

export function filterHistoryItems(items: ImageHistoryItem[], options: HistoryListOptions = {}): ImageHistoryItem[] {
  const query = options.query?.trim().toLowerCase() || ''
  const filtered = items.filter((item) => {
    const matchesQuery = !query
      || `${item.prompt} ${item.model} ${item.ratio} ${item.size ?? ''} ${item.quality} ${formatImageQuality(item.quality)}`.toLowerCase().includes(query)
    const matchesFavorite = !options.favoritesOnly || item.favorite
    return matchesQuery && matchesFavorite
  })

  return filtered.sort((left, right) => {
    const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return options.sort === 'oldest' ? delta : -delta
  })
}
