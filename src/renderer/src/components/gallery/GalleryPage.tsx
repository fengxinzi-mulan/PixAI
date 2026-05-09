import { useEffect, useMemo, useState, type JSX } from 'react'
import { ArrowLeft, CheckSquare, Heart, RotateCcw, Search, Square, Star, Trash2 } from 'lucide-react'
import type { ImageHistoryItem, ImageQuality, ImageRatio, ImageStatus } from '@shared/types'
import { IMAGE_QUALITIES, IMAGE_RATIOS, formatImageQuality } from '@shared/image-options'
import { useAppStore } from '@renderer/store/app-store'
import { ImageTile } from '@renderer/components/workspace/ImageTile'
import { GallerySelect, type GallerySelectOption } from './GallerySelect'

type GalleryStatusFilter = 'all' | ImageStatus
type GallerySortMode =
  | 'newest'
  | 'oldest'
  | 'favorites'
  | 'model'
  | 'ratio'
  | 'quality'
  | 'size'
  | 'duration'
  | 'succeeded'
  | 'failed'

const statusOptions: Array<GallerySelectOption<GalleryStatusFilter>> = [
  { value: 'all', label: '状态' },
  { value: 'succeeded', label: '成功' },
  { value: 'failed', label: '失败' }
]

const sortOptions: Array<GallerySelectOption<GallerySortMode>> = [
  { value: 'newest', label: '最新' },
  { value: 'oldest', label: '最早' },
  { value: 'favorites', label: '收藏优先' },
  { value: 'model', label: '模型' },
  { value: 'ratio', label: '比例' },
  { value: 'quality', label: '质量' },
  { value: 'size', label: '文件大小' },
  { value: 'duration', label: '耗时' },
  { value: 'succeeded', label: '成功优先' },
  { value: 'failed', label: '失败优先' }
]

const pageSizeOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const ratioFilterOptions: Array<GallerySelectOption<'all' | ImageRatio>> = [
  { value: 'all', label: '比例' },
  ...IMAGE_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))
]
const qualityFilterOptions: Array<GallerySelectOption<'all' | ImageQuality>> = [
  { value: 'all', label: '质量' },
  ...IMAGE_QUALITIES.map((quality) => ({ value: quality, label: formatImageQuality(quality) }))
]
const pageSizeSelectOptions: Array<GallerySelectOption<number>> = pageSizeOptions.map((value) => ({
  value,
  label: `${value} / 页`
}))

const qualityOrder: Record<ImageQuality, number> = {
  auto: 0,
  low: 1,
  medium: 2,
  standard: 3,
  high: 4,
  hd: 5
}

function compareByTimeDesc(a: ImageHistoryItem, b: ImageHistoryItem): number {
  return b.createdAt.localeCompare(a.createdAt)
}

function parseRatioValue(ratio: ImageRatio): number {
  const [widthText, heightText] = ratio.split(':')
  const width = Number(widthText)
  const height = Number(heightText)
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return 0
  return width / height
}

function uniqueSorted<T extends string>(items: Array<T | null | undefined>): T[] {
  return Array.from(new Set(items.filter((item): item is T => Boolean(item)))).sort((a, b) => a.localeCompare(b))
}

export function GalleryPage(): JSX.Element {
  const {
    history,
    query,
    favoritesOnly,
    setQuery,
    reloadHistory,
    setFavoritesOnly,
    setView,
    deleteHistoryItems,
    setFavoriteForHistoryItems
  } = useAppStore()
  const [statusFilter, setStatusFilter] = useState<GalleryStatusFilter>('all')
  const [modelFilter, setModelFilter] = useState('all')
  const [ratioFilter, setRatioFilter] = useState<'all' | ImageRatio>('all')
  const [qualityFilter, setQualityFilter] = useState<'all' | ImageQuality>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const [sortMode, setSortMode] = useState<GallerySortMode>('newest')

  const modelOptions = useMemo(() => uniqueSorted(history.map((item) => item.model)), [history])
  const modelFilterOptions = useMemo<Array<GallerySelectOption<string>>>(() => [
    { value: 'all', label: '模型' },
    ...modelOptions.map((model) => ({ value: model, label: model }))
  ], [modelOptions])
  const filteredHistory = useMemo(() => history.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (modelFilter !== 'all' && item.model !== modelFilter) return false
    if (ratioFilter !== 'all' && item.ratio !== ratioFilter) return false
    if (qualityFilter !== 'all' && item.quality !== qualityFilter) return false
    return true
  }), [history, modelFilter, qualityFilter, ratioFilter, statusFilter])
  const sortedHistory = useMemo(() => {
    const items = [...filteredHistory]
    const byTimeAsc = (a: ImageHistoryItem, b: ImageHistoryItem) => a.createdAt.localeCompare(b.createdAt)
    const byFavoriteFirst = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite)
      return compareByTimeDesc(a, b)
    }
    const byModel = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      const modelOrder = a.model.localeCompare(b.model)
      if (modelOrder !== 0) return modelOrder
      return compareByTimeDesc(a, b)
    }
    const byRatio = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      const ratioOrder = parseRatioValue(a.ratio) - parseRatioValue(b.ratio)
      if (ratioOrder !== 0) return ratioOrder
      return compareByTimeDesc(a, b)
    }
    const byQuality = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      const qualityOrderValue = qualityOrder[a.quality] - qualityOrder[b.quality]
      if (qualityOrderValue !== 0) return qualityOrderValue
      return compareByTimeDesc(a, b)
    }
    const bySize = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      const aSize = a.fileSizeBytes ?? -1
      const bSize = b.fileSizeBytes ?? -1
      if (aSize !== bSize) return bSize - aSize
      return compareByTimeDesc(a, b)
    }
    const byDuration = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      const aDuration = a.durationMs ?? -1
      const bDuration = b.durationMs ?? -1
      if (aDuration !== bDuration) return bDuration - aDuration
      return compareByTimeDesc(a, b)
    }
    const byStatus = (a: ImageHistoryItem, b: ImageHistoryItem) => {
      if (a.status !== b.status) return a.status === 'failed' ? 1 : -1
      return compareByTimeDesc(a, b)
    }

    switch (sortMode) {
      case 'oldest':
        return items.sort(byTimeAsc)
      case 'favorites':
        return items.sort(byFavoriteFirst)
      case 'model':
        return items.sort(byModel)
      case 'ratio':
        return items.sort(byRatio)
      case 'quality':
        return items.sort(byQuality)
      case 'size':
        return items.sort(bySize)
      case 'duration':
        return items.sort(byDuration)
      case 'succeeded':
        return items.sort(byStatus)
      case 'failed':
        return items.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'failed' ? -1 : 1
          return compareByTimeDesc(a, b)
        })
      case 'newest':
      default:
        return items.sort(compareByTimeDesc)
    }
  }, [filteredHistory, sortMode])
  const pageCount = Math.max(1, Math.ceil(sortedHistory.length / pageSize))
  const visibleHistory = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedHistory.slice(start, start + pageSize)
  }, [page, pageSize, sortedHistory])
  const selectedItems = useMemo(() => history.filter((item) => selectedIds.has(item.id)), [history, selectedIds])
  const previewItems = visibleHistory.filter((item) => item.status === 'succeeded')
  const allFilteredSelected = sortedHistory.length > 0 && sortedHistory.every((item) => selectedIds.has(item.id))
  const filteredSelectedCount = sortedHistory.filter((item) => selectedIds.has(item.id)).length

  useEffect(() => {
    setSelectedIds((current) => new Set(history.filter((item) => current.has(item.id)).map((item) => item.id)))
  }, [history])

  useEffect(() => {
    setPage(1)
  }, [favoritesOnly, modelFilter, qualityFilter, query, ratioFilter, statusFilter, sortMode])

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(sortedHistory.map((item) => item.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setModelFilter('all')
    setRatioFilter('all')
    setQualityFilter('all')
    if (favoritesOnly) void setFavoritesOnly(false)
    if (query) {
      setQuery('')
      void reloadHistory({ query: '' })
    }
  }

  return (
    <section className="gallery-page">
      <div className="gallery-tools">
        <div className="search-wrap">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              void reloadHistory({ query: event.target.value })
            }}
            placeholder="搜索 prompt、模型或参数"
          />
        </div>
        <button className={favoritesOnly ? 'active-soft' : ''} onClick={() => void setFavoritesOnly(!favoritesOnly)}>
          <Star size={15} />
          {favoritesOnly ? '全部历史' : '只看收藏'}
        </button>
        <GallerySelect value={statusFilter} options={statusOptions} ariaLabel="筛选状态" onChange={setStatusFilter} />
        <GallerySelect value={modelFilter} options={modelFilterOptions} ariaLabel="筛选模型" className="model-select" onChange={setModelFilter} />
        <GallerySelect value={ratioFilter} options={ratioFilterOptions} ariaLabel="筛选比例" onChange={setRatioFilter} />
        <GallerySelect value={qualityFilter} options={qualityFilterOptions} ariaLabel="筛选质量" onChange={setQualityFilter} />
        <GallerySelect value={sortMode} options={sortOptions} ariaLabel="排序方式" className="sort-select" onChange={setSortMode} />
        <button onClick={resetFilters}>
          <RotateCcw size={15} />
          重置
        </button>
      </div>

      <div className="gallery-bulkbar">
        <div className="gallery-bulk-title">
          <span>批量操作</span>
        </div>
        <div className="gallery-bulk-actions">
          <button className={allFilteredSelected ? 'active-soft' : ''} disabled={sortedHistory.length === 0} onClick={toggleSelectAll}>
            {allFilteredSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            {allFilteredSelected ? `已选 ${filteredSelectedCount}` : '全选'}
          </button>
          <button disabled={selectedIds.size === 0} onClick={() => void setFavoriteForHistoryItems(selectedItems, true)}>
            <Heart size={15} />
            收藏所选
          </button>
          <button disabled={selectedIds.size === 0} onClick={() => void setFavoriteForHistoryItems(selectedItems, false)}>取消收藏</button>
          <button
            className="danger"
            disabled={selectedIds.size === 0}
            onClick={() => {
              void deleteHistoryItems(Array.from(selectedIds))
              clearSelection()
            }}
          >
            <Trash2 size={15} />
            删除所选
          </button>
        </div>
      </div>

      <div className="gallery-grid">
        {visibleHistory.length === 0 ? <div className="empty-state grid-empty">暂无匹配历史</div> : null}
        {visibleHistory.map((item) => (
          <div key={item.id} className="gallery-tile-frame">
            <ImageTile
              item={item}
              previewItems={previewItems}
              selectable
              selected={selectedIds.has(item.id)}
              showReuseAction
              onSelectedChange={(selected) => toggleSelected(item.id, selected)}
            />
          </div>
        ))}
      </div>

      <div className="gallery-pagination">
        <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
        <span>{page} / {pageCount}</span>
        <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button>
        <GallerySelect value={pageSize} options={pageSizeSelectOptions} ariaLabel="每页数量" className="page-size-select" onChange={setPageSize} />
      </div>
    </section>
  )
}
