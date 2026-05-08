import type { ImageHistoryItem } from '@shared/types'

export type WorkspaceSummarySegment = {
  key: 'total' | 'succeeded' | 'failed' | 'generating'
  label: string
  value: number
  suffix?: string
  tone: 'total' | 'success' | 'danger' | 'active'
}

export function getWorkspaceResultSummarySegments(items: ImageHistoryItem[], generatingCount: number): WorkspaceSummarySegment[] {
  const succeeded = items.filter((item) => item.status === 'succeeded').length
  const failed = items.filter((item) => item.status === 'failed').length

  return [
    { key: 'total', label: '共', value: items.length, suffix: '条', tone: 'total' },
    { key: 'succeeded', label: '成功', value: succeeded, tone: 'success' },
    { key: 'failed', label: '失败', value: failed, tone: 'danger' },
    { key: 'generating', label: '生成中', value: generatingCount, tone: 'active' }
  ]
}

export function formatWorkspaceResultSummary(items: ImageHistoryItem[], generatingCount: number): string {
  return getWorkspaceResultSummarySegments(items, generatingCount)
    .map((segment) => `${segment.label} ${segment.value}${segment.suffix ? ` ${segment.suffix}` : ''}`)
    .join(' · ')
}
