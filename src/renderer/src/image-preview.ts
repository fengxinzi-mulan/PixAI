import { formatDuration } from '@shared/duration'
import { formatImageQuality } from '@shared/image-options'
import type { ImageHistoryItem } from '@shared/types'

const PREVIEW_MIN_ZOOM = 0.25
const PREVIEW_MAX_ZOOM = 4
const PREVIEW_WHEEL_STEP = 0.15

type PreviewFitOptions = {
  widthRatio?: number
  heightRatio?: number
  maxWidth?: number
  maxHeight?: number
}

export type PreviewMetadataRow = {
  label: string
  value: string
}

export type PreviewPan = {
  x: number
  y: number
}

export function formatFileSize(bytes: number): string {
  const safe = Math.max(0, bytes)
  if (safe < 1024) return `${safe} B`

  const kilobytes = safe / 1024
  if (kilobytes < 1024) return `${formatFileSizeNumber(kilobytes)} KB`

  return `${formatFileSizeNumber(kilobytes / 1024)} MB`
}

export function getPreviewMetadataRows(item: ImageHistoryItem): PreviewMetadataRow[] {
  const rows: PreviewMetadataRow[] = [
    { label: '类型', value: item.generationMode === 'image-to-image' ? '图生图' : '文生图' },
    { label: '生成时间', value: formatGeneratedAt(item.createdAt) },
    { label: '用时', value: item.durationMs != null ? formatDuration(item.durationMs) : '未知' },
    { label: '比例', value: item.ratio },
    { label: '质量', value: formatImageQuality(item.quality) }
  ]

  if (item.size) {
    rows.push({ label: '尺寸', value: item.size })
  }

  const format = formatImageFileFormat(item.filePath)
  if (format) {
    rows.push({ label: '格式', value: format })
  }

  if (item.fileSizeBytes != null) {
    rows.push({ label: '大小', value: formatFileSize(item.fileSizeBytes) })
  }

  rows.push({ label: '模型', value: item.model })
  return rows
}

export function formatGeneratedAt(value: string | null | undefined): string {
  return formatLocalDateTime(value)
}

export function formatLocalDateTime(value: string | null | undefined, includeSeconds = true): string {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  const hours = padDatePart(date.getHours())
  const minutes = padDatePart(date.getMinutes())
  if (!includeSeconds) {
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
  const seconds = padDatePart(date.getSeconds())
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatFileSizeNumber(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1)
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function clampPreviewZoom(zoom: number): number {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, zoom))
}

export function getInitialPreviewZoom(
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
  options: PreviewFitOptions = {}
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return 1
  }

  const ratioWidth = viewportWidth * (options.widthRatio ?? 0.9)
  const ratioHeight = viewportHeight * (options.heightRatio ?? 0.82)
  const cappedWidth = typeof options.maxWidth === 'number' ? Math.min(ratioWidth, options.maxWidth) : ratioWidth
  const cappedHeight = typeof options.maxHeight === 'number' ? Math.min(ratioHeight, options.maxHeight) : ratioHeight
  const availableWidth = Math.max(320, cappedWidth)
  const availableHeight = Math.max(240, cappedHeight)
  const fitZoom = Math.min(availableWidth / imageWidth, availableHeight / imageHeight)
  return clampPreviewZoom(fitZoom)
}

export function getInitialPreviewZoomForArea(
  areaWidth: number,
  areaHeight: number,
  imageWidth: number,
  imageHeight: number,
  padding = 0
): number {
  if (areaWidth <= 0 || areaHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return 1
  }

  const availableWidth = Math.max(1, areaWidth - padding)
  const availableHeight = Math.max(1, areaHeight - padding)
  return clampPreviewZoom(Math.min(availableWidth / imageWidth, availableHeight / imageHeight))
}

export function getPreviewZoomAfterWheel(zoom: number, deltaY: number): number {
  const direction = deltaY > 0 ? -1 : 1
  return clampPreviewZoom(zoom + direction * PREVIEW_WHEEL_STEP)
}

export function formatPreviewZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

export function formatPreviewPanTransform(pan: PreviewPan): string {
  return `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px)`
}

function formatImageFileFormat(filePath: string | null): string | null {
  if (!filePath) return null
  const extension = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  if (!extension) return null
  if (extension === 'jpg' || extension === 'jpeg') return 'JPEG'
  if (extension === 'png') return 'PNG'
  if (extension === 'webp') return 'WebP'
  return extension.toUpperCase()
}
