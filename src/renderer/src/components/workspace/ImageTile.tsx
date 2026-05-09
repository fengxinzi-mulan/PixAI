import { useMemo, useState, type JSX } from 'react'
import { Copy, Download, Heart, Trash2 } from 'lucide-react'
import type { ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { PreviewModal } from '@renderer/components/preview/PreviewModal'

export function ImageTile({ item, previewItems }: { item: ImageHistoryItem; previewItems: ImageHistoryItem[] }): JSX.Element {
  const { deleteHistory, toggleFavorite, notify } = useAppStore()
  const [previewOpen, setPreviewOpen] = useState(false)
  const src = useMemo(() => (item.status === 'succeeded' ? window.pixai.image.url(item.id) : ''), [item.id, item.status])
  const openPreview = () => {
    if (item.status === 'succeeded') setPreviewOpen(true)
  }

  if (item.status === 'failed') {
    return (
      <article className="art-card failed">
        <div className="art-tools">
          <button
            title="删除"
            onClick={(event) => {
              event.stopPropagation()
              void deleteHistory(item.id)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="fail-content">
          <strong>{item.errorMessage || '生成失败'}</strong>
          {item.errorDetails ? <details><summary>查看错误详情</summary><code>{item.errorDetails}</code></details> : null}
        </div>
      </article>
    )
  }

  return (
    <article
      className="art-card image-card"
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPreview()
        }
      }}
    >
      <img src={src} alt={item.prompt} />
      <div className="art-tools">
        <button
          title="复制"
          onClick={(event) => {
            event.stopPropagation()
            void window.pixai.image.copy(item.id).then(() => notify('已复制到剪贴板'))
          }}
        >
          <Copy size={14} />
        </button>
        <button
          title="下载"
          onClick={(event) => {
            event.stopPropagation()
            void window.pixai.image.download(item.id).then((path) => path && notify('已保存图片'))
          }}
        >
          <Download size={14} />
        </button>
        <button
          title="收藏"
          onClick={(event) => {
            event.stopPropagation()
            void toggleFavorite(item)
          }}
        >
          <Heart className={item.favorite ? 'filled' : ''} size={14} />
        </button>
        <button
          title="删除"
          onClick={(event) => {
            event.stopPropagation()
            void deleteHistory(item.id)
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {previewOpen ? <PreviewModal initialItem={item} items={previewItems} onClose={() => setPreviewOpen(false)} /> : null}
    </article>
  )
}
