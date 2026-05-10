import { useEffect, useMemo, type JSX } from 'react'
import { Image as ImageIcon, Trash2 } from 'lucide-react'
import { elapsedMs } from '@shared/duration'
import type { GenerationRun, ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { getWorkspaceRunGridSlots, type WorkspaceRunGridSlot } from '@renderer/workspace-placeholders'
import { getWorkspaceResultSummarySegments } from '@renderer/workspace-summary'
import { GeneratingTile } from './GeneratingTile'
import { ImageTile } from './ImageTile'

export function CanvasArea({
  runs,
  generationStartedAt,
  generating,
  generationClockMs
}: {
  runs: GenerationRun[]
  generationStartedAt: number | null
  generating: boolean
  generationClockMs: number
}): JSX.Element {
  const {
    conversations,
    activeConversationId,
    generatingByConversation,
    removedGenerationIndexesByRunId
  } = useAppStore()
  const refreshConversationResults = useAppStore((state) => state.refreshConversationResults)
  const deleteHistoryItems = useAppStore((state) => state.deleteHistoryItems)
  const current = conversations.find((item) => item.id === activeConversationId)
  const orderedRuns = useMemo(() => [...runs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [runs])
  const items = orderedRuns.flatMap((run) => run.items.map((item) => ({ item, run })))
  const previewItems = items.map(({ item }) => item).filter((item) => item.status === 'succeeded')
  const failedItems = items.map(({ item }) => item).filter((item) => item.status === 'failed')
  const orderedSlots = useMemo(() => (
    orderedRuns.flatMap((run) => {
      const removedIndexes = run.status === 'running' ? removedGenerationIndexesByRunId[run.id] || [] : []
      const slots = run.status === 'running'
        ? getWorkspaceRunGridSlots(run.n, run.items, removedIndexes)
        : run.items.map((item) => ({ type: 'item' as const, requestIndex: item.requestIndex, item }))
      return slots.map((slot) => ({ run, slot }))
    })
  ), [orderedRuns, removedGenerationIndexesByRunId])
  const runningRuns = orderedRuns.filter((run) => run.status === 'running')
  const pendingGenerationCount = activeConversationId ? generatingByConversation[activeConversationId] || 0 : 0
  const extraPendingCount = Math.max(pendingGenerationCount - runningRuns.length, 0)
  const visibleGeneratingCount = orderedSlots.filter(({ slot }) => slot.type === 'placeholder').length
  const generatingCount = visibleGeneratingCount + extraPendingCount
  const generationElapsedMs = generationStartedAt != null ? elapsedMs(generationStartedAt, generationClockMs) : null
  const summarySegments = getWorkspaceResultSummarySegments(items.map(({ item }) => item), generatingCount)

  useEffect(() => {
    if (!generating || !current) return
    void refreshConversationResults(current.id)
    const timer = window.setInterval(() => {
      void refreshConversationResults(current.id)
    }, 900)
    return () => window.clearInterval(timer)
  }, [current, generating, refreshConversationResults])

  return (
    <section className="canvas-area">
      <div className="history-head">
        <div className="history-title">
          <ImageIcon size={16} />
          当前工作区
        </div>
        <div className="workspace-head-actions">
          {failedItems.length > 0 ? (
            <button
              type="button"
              className="clear-failed-button"
              title="清空当前工作区中的失败图片"
              onClick={() => void deleteHistoryItems(failedItems.map((item) => item.id))}
            >
              <Trash2 size={14} />
              清空失败
            </button>
          ) : null}
          <div className="workspace-summary" aria-label="工作区结果统计">
            {generationElapsedMs != null && generating ? (
              <span className="summary-chip active">进行中 {pendingGenerationCount || runningRuns.length} 组</span>
            ) : null}
            {summarySegments.map((segment) => (
              <span key={segment.key} className={`summary-chip ${segment.tone}`}>
                {segment.label} <strong>{segment.value}</strong>{segment.suffix ? ` ${segment.suffix}` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="preview-grid">
        {orderedSlots.length === 0 && extraPendingCount === 0 && !generating ? (
          <div className="empty-state grid-empty">生成后的图片会显示在这里</div>
        ) : null}
        {Array.from({ length: extraPendingCount }, (_value, index) => (
          <GeneratingTile
            key={`pending-local-${index}`}
            generationElapsedMs={generationElapsedMs}
          />
        ))}
        {orderedSlots.map(({ run, slot }) => renderSlot(run, slot, previewItems, generationClockMs))}
      </div>
    </section>
  )
}

function renderSlot(
  run: GenerationRun,
  slot: WorkspaceRunGridSlot,
  previewItems: ImageHistoryItem[],
  generationClockMs: number
): JSX.Element {
  if (slot.type === 'item') {
    return <ImageTile key={slot.item.id} item={slot.item} previewItems={previewItems} />
  }
  const startedAt = Date.parse(run.createdAt)
  return (
    <GeneratingTile
      key={`${run.id}-pending-${slot.requestIndex}`}
      runId={run.id}
      requestIndex={slot.requestIndex}
      generationElapsedMs={Number.isFinite(startedAt) ? elapsedMs(startedAt, generationClockMs) : null}
    />
  )
}
