import type {
  GenerateImageInput,
  ImageBackground,
  ImageInputFidelity,
  ImageModeration,
  ImageOutputFormat,
  ImageQuality,
  ImageRatio
} from './types'

export const DEFAULT_MODEL = 'gpt-image-2'
export const DEFAULT_IMAGE_OUTPUT_FORMAT: ImageOutputFormat = 'png'
export const IMAGE_RATIOS: ImageRatio[] = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21']
export const IMAGE_QUALITIES: GenerateImageInput['quality'][] = ['auto', 'low', 'medium', 'high']
export const IMAGE_OUTPUT_FORMATS: ImageOutputFormat[] = ['jpeg', 'png', 'webp']
export const IMAGE_BACKGROUNDS: ImageBackground[] = ['auto', 'opaque']
export const IMAGE_MODERATIONS: ImageModeration[] = ['auto', 'low']
export const IMAGE_INPUT_FIDELITIES: ImageInputFidelity[] = ['low', 'high']
export const IMAGE_QUALITY_LABELS: Record<ImageQuality, string> = {
  auto: '自动',
  low: '低',
  medium: '中',
  high: '高'
}
export const IMAGE_OUTPUT_FORMAT_LABELS: Record<ImageOutputFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP'
}
export const IMAGE_BACKGROUND_LABELS: Record<ImageBackground, string> = {
  auto: '自动',
  opaque: '不透明'
}
export const IMAGE_MODERATION_LABELS: Record<ImageModeration, string> = {
  auto: '自动',
  low: '低'
}
export const IMAGE_INPUT_FIDELITY_LABELS: Record<ImageInputFidelity, string> = {
  low: '低',
  high: '高'
}

export type ImageSizeOption = {
  value: string
  label: string
}

const imageSizeOptionsByRatio: Record<ImageRatio, ImageSizeOption[]> = {
  '1:1': [
    { value: '1024x1024', label: '标准 1024×1024' },
    { value: '1536x1536', label: '高清 1536×1536' },
    { value: '2048x2048', label: '2K 2048×2048' },
    { value: '2560x2560', label: '高分 2560×2560' }
  ],
  '3:2': [
    { value: '1536x1024', label: '标准 1536×1024' },
    { value: '3072x2048', label: '高分 3072×2048' }
  ],
  '2:3': [
    { value: '1024x1536', label: '标准 1024×1536' },
    { value: '2048x3072', label: '高分 2048×3072' }
  ],
  '4:3': [
    { value: '1024x768', label: '标准 1024×768' },
    { value: '1536x1152', label: '高清 1536×1152' },
    { value: '2048x1536', label: '高分 2048×1536' },
    { value: '3072x2304', label: '高分 3072×2304' }
  ],
  '3:4': [
    { value: '768x1024', label: '标准 768×1024' },
    { value: '1152x1536', label: '高清 1152×1536' },
    { value: '1536x2048', label: '高分 1536×2048' },
    { value: '2304x3072', label: '高分 2304×3072' }
  ],
  '16:9': [
    { value: '1280x720', label: '720P 1280×720' },
    { value: '1536x864', label: '1536×864' },
    { value: '1792x1008', label: '标准 1792×1008' },
    { value: '2048x1152', label: '2K 2048×1152' },
    { value: '2560x1440', label: '2K 2560×1440' },
    { value: '3072x1728', label: '高分 3072×1728' },
    { value: '3840x2160', label: '4K 3840×2160' }
  ],
  '9:16': [
    { value: '720x1280', label: '720P 720×1280' },
    { value: '864x1536', label: '864×1536' },
    { value: '1008x1792', label: '标准 1008×1792' },
    { value: '1152x2048', label: '2K 1152×2048' },
    { value: '1440x2560', label: '2K 1440×2560' },
    { value: '1728x3072', label: '高分 1728×3072' },
    { value: '2160x3840', label: '4K 2160×3840' }
  ],
  '21:9': [
    { value: '1344x576', label: '标准 1344×576' },
    { value: '1792x768', label: '高分 1792×768' },
    { value: '2240x960', label: '高分 2240×960' },
    { value: '2688x1152', label: '高分 2688×1152' },
    { value: '3136x1344', label: '高分 3136×1344' },
    { value: '3584x1536', label: '高分 3584×1536' }
  ],
  '9:21': [
    { value: '576x1344', label: '标准 576×1344' },
    { value: '768x1792', label: '高分 768×1792' },
    { value: '960x2240', label: '高分 960×2240' },
    { value: '1152x2688', label: '高分 1152×2688' },
    { value: '1344x3136', label: '高分 1344×3136' },
    { value: '1536x3584', label: '高分 1536×3584' }
  ]
}

export function getImageSizeOptions(ratio: ImageRatio): ImageSizeOption[] {
  return imageSizeOptionsByRatio[ratio]
}

export function getDefaultImageSize(ratio: ImageRatio): string {
  return getImageSizeOptions(ratio).find((option) => option.label.startsWith('标准'))?.value
    || getImageSizeOptions(ratio)[0]?.value
    || ratioToSize(ratio)
}

export function isImageSizeCompatible(ratio: ImageRatio, size: string): boolean {
  return getImageSizeOptions(ratio).some((option) => option.value === size)
}

const ratioSizeMap: Record<ImageRatio, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1792x1008',
  '9:16': '1008x1792',
  '21:9': '1344x576',
  '9:21': '576x1344'
}

export function ratioToSize(ratio: ImageRatio): string {
  return ratioSizeMap[ratio]
}

export function formatImageQuality(quality: ImageQuality): string {
  return IMAGE_QUALITY_LABELS[quality] || quality
}

export function formatImageSize(size: string): string {
  return size.replace('x', '×')
}

function toOptionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function buildImageEndpoint(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, '')
  return `${normalized}/v1/images/generations`
}

export function buildImageEditEndpoint(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, '')
  return `${normalized}/v1/images/edits`
}

export function supportsImageInputFidelity(model: string): boolean {
  return !model.trim().toLowerCase().startsWith('gpt-image-2')
}

export function buildImageRequestBody(input: GenerateImageInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: input.prompt.trim(),
    model: input.model.trim() || DEFAULT_MODEL,
    size: input.size.trim() || getDefaultImageSize(input.ratio),
    quality: input.quality,
    n: Math.min(10, Math.max(1, input.n || 1))
  }
  if (input.outputFormat) body.output_format = input.outputFormat
  if (toOptionalNumber(input.outputCompression) != null) body.output_compression = input.outputCompression
  if (input.background) body.background = input.background
  if (input.moderation) body.moderation = input.moderation
  const partialImages = toOptionalNumber(input.partialImages)
  if (input.stream) body.stream = true
  if (input.stream && partialImages != null && partialImages > 0) body.partial_images = partialImages
  return body
}
