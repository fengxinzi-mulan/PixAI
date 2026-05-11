import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  IMAGE_BACKGROUND_LABELS,
  IMAGE_BACKGROUNDS,
  IMAGE_INPUT_FIDELITY_LABELS,
  IMAGE_INPUT_FIDELITIES,
  IMAGE_MODERATION_LABELS,
  IMAGE_MODERATIONS,
  IMAGE_OUTPUT_FORMAT_LABELS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_QUALITY_LABELS,
  IMAGE_RATIOS,
  buildImageEditEndpoint,
  buildImageEndpoint,
  buildImageRequestBody,
  formatImageQuality,
  getDefaultImageSize,
  getImageSizeOptions,
  ratioToSize,
  supportsImageInputFidelity
} from './image-options'

describe('image options', () => {
  it('maps expanded ratios to API size strings', () => {
    expect(IMAGE_RATIOS).toEqual(['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21'])
    expect(ratioToSize('1:1')).toBe('1024x1024')
    expect(ratioToSize('3:2')).toBe('1536x1024')
    expect(ratioToSize('2:3')).toBe('1024x1536')
    expect(ratioToSize('4:3')).toBe('1024x768')
    expect(ratioToSize('3:4')).toBe('768x1024')
    expect(ratioToSize('16:9')).toBe('1792x1008')
    expect(ratioToSize('9:16')).toBe('1008x1792')
    expect(ratioToSize('21:9')).toBe('1344x576')
    expect(ratioToSize('9:21')).toBe('576x1344')
    expect(getDefaultImageSize('16:9')).toBe('1792x1008')
    expect(getDefaultImageSize('9:16')).toBe('1008x1792')
    expect(getImageSizeOptions('16:9').at(-1)?.value).toBe('3840x2160')
  })

  it('exposes GPT and compatibility quality options', () => {
    expect(IMAGE_QUALITIES).toEqual(['auto', 'low', 'medium', 'high'])
    expect(IMAGE_QUALITY_LABELS).toEqual({
      auto: '自动',
      low: '低',
      medium: '中',
      high: '高'
    })
    expect(formatImageQuality('high')).toBe('高')
    expect(IMAGE_OUTPUT_FORMATS).toEqual(['jpeg', 'png', 'webp'])
    expect(DEFAULT_IMAGE_OUTPUT_FORMAT).toBe('png')
    expect(IMAGE_OUTPUT_FORMAT_LABELS).toEqual({ jpeg: 'JPEG', png: 'PNG', webp: 'WebP' })
    expect(IMAGE_BACKGROUNDS).toEqual(['auto', 'opaque'])
    expect(IMAGE_BACKGROUND_LABELS).toEqual({ auto: '自动', opaque: '不透明' })
    expect(IMAGE_MODERATIONS).toEqual(['auto', 'low'])
    expect(IMAGE_MODERATION_LABELS).toEqual({ auto: '自动', low: '低' })
    expect(IMAGE_INPUT_FIDELITIES).toEqual(['low', 'high'])
    expect(IMAGE_INPUT_FIDELITY_LABELS).toEqual({ low: '低', high: '高' })
  })

  it('normalizes baseURL into the generations endpoint', () => {
    expect(buildImageEndpoint('https://example.test///')).toBe('https://example.test/v1/images/generations')
  })

  it('normalizes baseURL into the edits endpoint', () => {
    expect(buildImageEditEndpoint('https://example.test///')).toBe('https://example.test/v1/images/edits')
  })

  it('treats gpt-image-2 as not supporting input fidelity overrides', () => {
    expect(supportsImageInputFidelity('gpt-image-2')).toBe(false)
    expect(supportsImageInputFidelity('gpt-image-1')).toBe(true)
  })

  it('builds a request body without leaking empty optional fields', () => {
    expect(
      buildImageRequestBody({
        conversationId: 'c1',
        prompt: '  mint glasshouse  ',
        model: 'gpt-image-2',
        ratio: '3:2',
        size: '1536x1024',
        quality: 'auto',
        n: 2
      })
    ).toEqual({
      prompt: 'mint glasshouse',
      model: 'gpt-image-2',
      size: '1536x1024',
      quality: 'auto',
      n: 2
    })
  })

  it('maps advanced request fields when they are enabled', () => {
    expect(
      buildImageRequestBody({
        conversationId: 'c1',
        prompt: 'scene',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'high',
        n: 1,
        outputFormat: 'webp',
        outputCompression: 85,
        background: 'opaque',
        moderation: 'low',
        stream: true,
        partialImages: 3
      })
    ).toEqual({
      prompt: 'scene',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'high',
      n: 1,
      output_format: 'webp',
      output_compression: 85,
      background: 'opaque',
      moderation: 'low',
      stream: true,
      partial_images: 3
    })
  })
})
