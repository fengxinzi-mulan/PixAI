import { useEffect, type JSX } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { GenerationRun } from '@shared/types'
import { elapsedMs, formatDuration } from '@shared/duration'
import { useAppStore } from '@renderer/store/app-store'
import { getWorkspaceRunGridSlots } from '@renderer/workspace-placeholders'
import { getWorkspaceResultSummarySegments } from '@renderer/workspace-summary'
import { GeneratingTile } from './GeneratingTile'
import { ImageTile } from './ImageTile'

export function CanvasArea({
  runs,
  generationStartedAt,
  generating,
  removedIndexes,
  generationClockMs
}: {
  runs: GenerationRun[]
  generationStartedAt: number | null
  generating: boolean
  removedIndexes: number[]
  generationClockMs: number
}): JSX.Element {
  const { conversations, activeConversationId } = useAppStore()
  const refreshConversationResults = useAppStore((state) => state.refreshConversationResults)
  const current = conversations.find((item) => item.id === activeConversationId)
  const items = runs.flatMap((run) => run.items.map((item) => ({ item, run })))
  const activeRun = generating ? runs.find((run) => run.status === 'running') : null
  const generationElapsedMs = generationStartedAt != null ? elapsedMs(generationStartedAt, generationClockMs) : null
  const currentGenerationRun = generationStartedAt == null
    ? null
    : runs.find((run) => Date.parse(run.createdAt) >= generationStartedAt - 2000) || null
  const showInitialPlaceholders = generating && current && !currentGenerationRun
  const runGridSlots = generating && current
    ? activeRun
      ? getWorkspaceRunGridSlots(activeRun.n, activeRun.items, removedIndexes)
      : showInitialPlaceholders
        ? getWorkspaceRunGridSlots(current.n, [], removedIndexes)
        : []
    : []
  const generatingCount = runGridSlots.filter((slot) => slot.type === 'placeholder').length
  const summarySegments = getWorkspaceResultSummarySegments(items.map(({ item }) => item), generatingCount)
  const previewItems = items.map(({ item }) => item).filter((item) => item.status === 'succeeded')

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
        <div className="workspace-summary" aria-label="工作区结果统计">
          {generationElapsedMs != null && generating ? (
            <span className="summary-chip active">当前任务 {formatDuration(generationElapsedMs)}</span>
          ) : null}
          {summarySegments.map((segment) => (
            <span key={segment.key} className={`summary-chip ${segment.tone}`}>
              {segment.label} <strong>{segment.value}</strong>{segment.suffix ? ` ${segment.suffix}` : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="preview-grid">
        {generating && current
          ? runGridSlots.map((slot) => (
              slot.type === 'placeholder' ? (
                <GeneratingTile
                  key={`pending-${slot.requestIndex}`}
                  conversationId={current.id}
                  requestIndex={slot.requestIndex}
                  generationElapsedMs={generationElapsedMs}
                />
              ) : (
                <ImageTile key={slot.item.id} item={slot.item} previewItems={previewItems} />
              )
            ))
          : null}
        {items.length === 0 && !generating ? <div className="empty-state grid-empty">生成后的图片会显示在这里</div> : null}
        {(generating && activeRun ? items.filter(({ run }) => run.id !== activeRun.id) : items).map(({ item }) => (
          <ImageTile key={item.id} item={item} previewItems={previewItems} />
        ))}
      </div>
    </section>
  )
}
