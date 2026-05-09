import type { GenerateImageInput, ImageQuality, ImageRatio } from './types'

export const DEFAULT_MODEL = 'gpt-image-2'
export const IMAGE_RATIOS: ImageRatio[] = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21']
export const IMAGE_QUALITIES: GenerateImageInput['quality'][] = ['auto', 'low', 'medium', 'high', 'standard', 'hd']
export const IMAGE_QUALITY_LABELS: Record<ImageQuality, string> = {
  auto: '自动',
  low: '低',
  medium: '中',
  high: '高',
  standard: '标准',
  hd: '高清'
}

const ratioSizeMap: Record<ImageRatio, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '4:3': '1365x1024',
  '3:4': '1024x1365',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '21:9': '2048x878',
  '9:21': '878x2048'
}

export function ratioToSize(ratio: ImageRatio): string {
  return ratioSizeMap[ratio]
}

export function formatImageQuality(quality: ImageQuality): string {
  return IMAGE_QUALITY_LABELS[quality] || quality
}

export function buildImageEndpoint(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, '')
  return `${normalized}/v1/images/generations`
}

export function buildImageRequestBody(input: GenerateImageInput): Record<string, unknown> {
  return {
    prompt: input.prompt.trim(),
    model: input.model.trim() || DEFAULT_MODEL,
    size: ratioToSize(input.ratio),
    quality: input.quality,
    n: Math.min(10, Math.max(1, input.n || 1))
  }
}
