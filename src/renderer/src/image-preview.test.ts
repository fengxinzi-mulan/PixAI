import { describe, expect, it } from 'vitest'
import type { ImageHistoryItem } from '@shared/types'
import {
  clampPreviewZoom,
  formatFileSize,
  formatPreviewZoom,
  getInitialPreviewZoom,
  getInitialPreviewZoomForArea,
  getPreviewMetadataRows,
  getPreviewZoomAfterWheel
} from './image-preview'

describe('image preview zoom helpers', () => {
  it('fits large images into the viewport on open', () => {
    expect(getInitialPreviewZoom(1000, 800, 2000, 1000)).toBeCloseTo(0.45, 2)
    expect(getInitialPreviewZoom(1000, 800, 1000, 2000)).toBeCloseTo(0.33, 2)
  })

  it('fits images into the available art area when a side panel is present', () => {
    expect(
      getInitialPreviewZoom(1200, 760, 2400, 1200, {
        widthRatio: 0.68,
        heightRatio: 0.86,
        maxWidth: 820,
        maxHeight: 820
      })
    ).toBeCloseTo(0.34, 2)

    expect(
      getInitialPreviewZoom(1600, 1000, 1000, 2000, {
        widthRatio: 0.68,
        heightRatio: 0.86,
        maxWidth: 820,
        maxHeight: 820
      })
    ).toBeCloseTo(0.41, 2)
  })

  it('fits images against the measured preview art area', () => {
    expect(getInitialPreviewZoomForArea(900, 820, 2400, 1200, 36)).toBeCloseTo(0.36, 2)
    expect(getInitialPreviewZoomForArea(900, 820, 1000, 2000, 36)).toBeCloseTo(0.39, 2)
  })

  it('keeps zoom within the allowed range', () => {
    expect(clampPreviewZoom(0.1)).toBe(0.25)
    expect(clampPreviewZoom(1.5)).toBe(1.5)
    expect(clampPreviewZoom(6)).toBe(4)
  })

  it('zooms in and out from wheel input', () => {
    expect(getPreviewZoomAfterWheel(1, -120)).toBeCloseTo(1.15, 2)
    expect(getPreviewZoomAfterWheel(1, 120)).toBeCloseTo(0.85, 2)
  })

  it('formats preview zoom as a rounded percentage', () => {
    expect(formatPreviewZoom(1)).toBe('100%')
    expect(formatPreviewZoom(0.855)).toBe('86%')
  })

  it('formats image file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2_621_440)).toBe('2.5 MB')
  })

  it('builds preview metadata rows from image history', () => {
    const item = {
      model: 'gpt-image-2',
      ratio: '3:4',
      size: '1024x1365',
      quality: 'high',
      durationMs: 65_000,
      fileSizeBytes: 2_621_440
    } as ImageHistoryItem

    expect(getPreviewMetadataRows(item)).toEqual([
      { label: '类型', value: '文生图' },
      { label: '用时', value: '1m 5s' },
      { label: '比例', value: '3:4' },
      { label: '质量', value: '高' },
      { label: '尺寸', value: '1024x1365' },
      { label: '大小', value: '2.5 MB' },
      { label: '模型', value: 'gpt-image-2' }
    ])
  })
})
