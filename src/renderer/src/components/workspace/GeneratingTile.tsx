import type { JSX } from 'react'
import { formatDuration } from '@shared/duration'
import { useAppStore } from '@renderer/store/app-store'

export function GeneratingTile({
  runId,
  requestIndex,
  generationElapsedMs
}: {
  runId?: string
  requestIndex?: number
  generationElapsedMs: number | null
}): JSX.Element {
  const { cancelGeneration } = useAppStore()
  const canCancel = runId && typeof requestIndex === 'number'
  const elapsedText = formatDuration(generationElapsedMs ?? 0)

  return (
    <article className="art-card loading generating-card" aria-label="生成中">
      <span className="generating-label">生成中</span>
      <div className="generating-meta">
        <span>{`已耗时 ${elapsedText}`}</span>
        {canCancel ? (
          <button
            type="button"
            className="cancel-chip"
            onClick={(event) => {
              event.stopPropagation()
              void cancelGeneration(runId, requestIndex)
            }}
          >
            取消
          </button>
        ) : null}
      </div>
    </article>
  )
}
