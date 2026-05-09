import { useState, type JSX } from 'react'
import { Loader2 } from 'lucide-react'
import { formatDuration } from '@shared/duration'
import { useAppStore } from '@renderer/store/app-store'

export function GeneratingTile({
  conversationId,
  requestIndex,
  generationElapsedMs
}: {
  conversationId: string
  requestIndex: number
  generationElapsedMs: number | null
}): JSX.Element {
  const { cancelGeneration } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const elapsedText = formatDuration(generationElapsedMs ?? 0)

  return (
    <article
      className="art-card loading generating-card"
      aria-label="生成中"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Loader2 className="art-spinner spin" size={24} />
      <span className="generating-label">生成中</span>
      <div className="generating-meta">
        <span>{`已耗时 ${elapsedText}`}</span>
        {hovered ? (
          <button
            type="button"
            className="cancel-chip"
            onClick={(event) => {
              event.stopPropagation()
              void cancelGeneration(conversationId, requestIndex)
            }}
          >
            取消
          </button>
        ) : null}
      </div>
    </article>
  )
}
