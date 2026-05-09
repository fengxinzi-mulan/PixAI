import type { JSX } from 'react'
import { formatDuration } from '@shared/duration'
import type { ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'

export function HistoryCard({ item, onDelete }: { item: ImageHistoryItem; onDelete: () => void }): JSX.Element {
  const { reuseHistory, toggleFavorite } = useAppStore()

  return (
    <article className="history-card">
      <div className={`thumb ${item.status === 'failed' ? 'fail' : ''}`}>
        {item.status === 'succeeded' && item.filePath ? <img src={window.pixai.image.url(item.id)} alt="" /> : null}
      </div>
      <div className="history-info">
        <strong>{item.status === 'failed' ? '生成失败' : '生成结果'}</strong>
        <p>{item.prompt}</p>
        <div className="history-actions">
          {item.durationMs != null ? <span className="pill tiny">用时 {formatDuration(item.durationMs)}</span> : null}
          <button className={`pill tiny ${item.favorite ? 'good' : ''}`} onClick={() => void toggleFavorite(item)}>
            收藏
          </button>
          <button className="pill tiny" onClick={() => void reuseHistory(item)}>
            回填
          </button>
          <button className="pill tiny" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>
    </article>
  )
}
