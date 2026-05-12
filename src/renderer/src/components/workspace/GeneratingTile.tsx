import { useMemo, useState, type JSX } from 'react'
import { formatDuration } from '@shared/duration'
import type { GenerationRunRetryFailure, ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { shouldShowRetryAttemptChip } from '@renderer/generation-retry-display'
import { ErrorDetailsModal } from './ErrorDetailsModal'

export function GeneratingTile({
  runId,
  requestIndex,
  generationElapsedMs,
  retryAttempt = 0,
  maxRetries = 0,
  retryFailure = null
}: {
  runId?: string
  requestIndex?: number
  generationElapsedMs: number | null
  retryAttempt?: number
  maxRetries?: number
  retryFailure?: GenerationRunRetryFailure | null
}): JSX.Element {
  const { cancelGeneration } = useAppStore()
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false)
  const canCancel = runId && typeof requestIndex === 'number'
  const elapsedText = formatDuration(generationElapsedMs ?? 0)
  const canOpenRetryDetails = Boolean(retryFailure)
  const showRetryAttemptChip = shouldShowRetryAttemptChip({ retryAttempt, maxRetries, retryFailure })
  const retryFailureItem = useMemo<ImageHistoryItem | null>(() => {
    if (!retryFailure) return null
    return {
      id: `${runId || 'running'}-${requestIndex ?? 'unknown'}-retry-failure`,
      conversationId: null,
      runId: runId || null,
      prompt: '',
      model: '',
      ratio: '1:1',
      size: null,
      quality: 'auto',
      requestIndex: requestIndex ?? null,
      durationMs: null,
      filePath: null,
      fileSizeBytes: null,
      status: 'failed',
      errorMessage: retryFailure.errorMessage,
      errorDetails: retryFailure.errorDetails,
      retryAttempt: Math.max(0, retryAttempt - 1),
      favorite: false,
      generationMode: 'text-to-image',
      referenceImages: [],
      createdAt: retryFailure.createdAt
    }
  }, [requestIndex, retryAttempt, retryFailure, runId])
  const openRetryDetails = () => {
    if (canOpenRetryDetails) setErrorDetailsOpen(true)
  }

  return (
    <article
      className={`art-card loading generating-card${canOpenRetryDetails ? ' retry-details-card' : ''}`}
      aria-label={canOpenRetryDetails ? '重试中，点击查看上次失败详情' : '生成中'}
      role={canOpenRetryDetails ? 'button' : undefined}
      tabIndex={canOpenRetryDetails ? 0 : undefined}
      title={canOpenRetryDetails ? '点击查看上次失败详情' : undefined}
      onClick={openRetryDetails}
      onKeyDown={(event) => {
        if (!canOpenRetryDetails) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openRetryDetails()
        }
      }}
    >
      <div className="generating-center">
        <span className="generating-label">生成中</span>
        {showRetryAttemptChip
          ? <span className="retry-chip">{`重试第 ${retryAttempt} 次`}</span>
          : retryFailure ? <span className="retry-chip">重试中</span> : null}
      </div>
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
      {errorDetailsOpen && retryFailureItem ? (
        <ErrorDetailsModal item={retryFailureItem} onClose={() => setErrorDetailsOpen(false)} />
      ) : null}
    </article>
  )
}
