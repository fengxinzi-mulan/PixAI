import { useEffect, useMemo, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X } from 'lucide-react'
import type { ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { formatLocalDateTime } from '@renderer/image-preview'

type ErrorPayload = {
  stage?: unknown
  timestamp?: unknown
  request?: unknown
  details?: unknown
}

export function ErrorDetailsModal({
  item,
  onClose
}: {
  item: ImageHistoryItem
  onClose: () => void
}): JSX.Element {
  const notify = useAppStore((state) => state.notify)
  const payload = useMemo(() => parseErrorPayload(item.errorDetails), [item.errorDetails])
  const details = isRecord(payload?.details) ? payload.details : null
  const responseBody = typeof details?.responseBody === 'string' ? details.responseBody : null
  const copyText = item.errorDetails || item.errorMessage || '生成失败'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      notify('已复制错误信息')
    } catch (error) {
      notify(error instanceof Error ? `复制失败：${error.message}` : '复制失败')
    }
  }

  return createPortal(
    <div
      className="modal open"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel error-details-panel">
        <div className="modal-head">
          <span>{item.errorMessage || '生成失败'}</span>
          <div className="mini-controls">
            <button title="复制全部错误信息" onClick={() => void copyError()}>
              <Copy size={15} />
            </button>
            <button title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="error-details-body">
          <div className="error-details-meta">
            {renderMetaText('阶段', payload?.stage)}
            {renderMetaSeparator()}
            {renderMetaText('时间', formatErrorTimestamp(payload?.timestamp))}
            {renderMetaSeparator()}
            {renderMetaText('接口', details?.endpoint)}
          </div>
          <ErrorSection title="请求参数" value={payload?.request ?? '无请求参数'} />
          <ErrorSection title="响应体" value={responseBody ?? details?.responseError ?? details ?? '无响应体'} />
          <ErrorSection title="原始错误详情" value={payload ?? copyText} />
        </div>
      </div>
    </div>,
    document.body
  )
}

function ErrorSection({ title, value }: { title: string; value: unknown }): JSX.Element {
  return (
    <section className="error-details-section">
      <h4>{title}</h4>
      <pre>{formatDetailValue(value)}</pre>
    </section>
  )
}

function parseErrorPayload(errorDetails: string | null): ErrorPayload | null {
  if (!errorDetails) return null
  try {
    const payload = JSON.parse(errorDetails) as ErrorPayload
    return isRecord(payload) ? payload : null
  } catch {
    return null
  }
}

function renderMetaText(label: string, value: unknown): JSX.Element | null {
  if (value === null || value === undefined || value === '') return null
  return (
    <span className="error-details-meta-item">
      <span className="error-details-meta-label">{label}</span>
      <span className="error-details-meta-value">{String(value)}</span>
    </span>
  )
}

function renderMetaSeparator(): JSX.Element {
  return <span className="error-details-meta-separator">I</span>
}

function formatErrorTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const formatted = formatLocalDateTime(value)
  return formatted === '未知' ? value : formatted
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '无'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '无'
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2) || '无'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
