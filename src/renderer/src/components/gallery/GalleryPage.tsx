import type { JSX } from 'react'
import { ArrowLeft, Search, Star } from 'lucide-react'
import { useAppStore } from '@renderer/store/app-store'
import { HistoryCard } from './HistoryCard'

export function GalleryPage(): JSX.Element {
  const {
    history,
    query,
    sort,
    favoritesOnly,
    setQuery,
    reloadHistory,
    setSort,
    setFavoritesOnly,
    setView,
    deleteHistory
  } = useAppStore()

  return (
    <section className="gallery-page">
      <div className="gallery-hero">
        <div>
          <h2>图库</h2>
          <p>集中浏览、检索和管理所有会话的生成历史。</p>
        </div>
        <button onClick={() => setView('workspace')}>
          <ArrowLeft size={16} />
          返回工作台
        </button>
      </div>
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
        <button onClick={() => void setSort(sort === 'newest' ? 'oldest' : 'newest')}>排序：{sort === 'newest' ? '最近' : '较早'}</button>
        <button className={favoritesOnly ? 'active-soft' : ''} onClick={() => void setFavoritesOnly(!favoritesOnly)}>
          <Star size={15} />
          {favoritesOnly ? '全部历史' : '只看收藏'}
        </button>
      </div>
      <div className="gallery-grid">
        {history.length === 0 ? <div className="empty-state grid-empty">暂无匹配历史</div> : null}
        {history.map((item) => (
          <HistoryCard key={item.id} item={item} onDelete={() => void deleteHistory(item.id)} />
        ))}
      </div>
    </section>
  )
}
