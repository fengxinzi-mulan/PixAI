import { formatDuration } from '@shared/duration'
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

export function getPreviewMetadataRows(item: ImageHistoryItem): PreviewMetadataRow[] {
  const rows: PreviewMetadataRow[] = [
    { label: '用时', value: item.durationMs != null ? formatDuration(item.durationMs) : '未知' },
    { label: '比例', value: item.ratio },
    { label: '质量', value: item.quality },
    { label: '模型', value: item.model }
  ]

  if (item.size) {
    rows.splice(3, 0, { label: '尺寸', value: item.size })
  }

  return rows
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
