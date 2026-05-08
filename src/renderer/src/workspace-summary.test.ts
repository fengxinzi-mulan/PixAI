import { describe, expect, it } from 'vitest'
import type { ImageHistoryItem } from '@shared/types'
import { formatWorkspaceResultSummary, getWorkspaceResultSummarySegments } from './workspace-summary'

describe('workspace result summary', () => {
  it('counts total, succeeded, failed, and generating items', () => {
    const items = [
      { status: 'succeeded' },
      { status: 'failed' },
      { status: 'succeeded' }
    ] as ImageHistoryItem[]

    expect(formatWorkspaceResultSummary(items, 2)).toBe('共 3 条 · 成功 2 · 失败 1 · 生成中 2')
  })

  it('shows zero counts when the workspace is empty', () => {
    expect(formatWorkspaceResultSummary([], 0)).toBe('共 0 条 · 成功 0 · 失败 0 · 生成中 0')
  })

  it('returns highlighted summary segments with separate tones', () => {
    const items = [
      { status: 'succeeded' },
      { status: 'failed' },
      { status: 'succeeded' }
    ] as ImageHistoryItem[]

    expect(getWorkspaceResultSummarySegments(items, 2)).toEqual([
      { key: 'total', label: '共', value: 3, suffix: '条', tone: 'total' },
      { key: 'succeeded', label: '成功', value: 2, tone: 'success' },
      { key: 'failed', label: '失败', value: 1, tone: 'danger' },
      { key: 'generating', label: '生成中', value: 2, tone: 'active' }
    ])
  })
})
