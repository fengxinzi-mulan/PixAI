import { describe, expect, it } from 'vitest'
import { IMAGE_QUALITIES, IMAGE_QUALITY_LABELS, IMAGE_RATIOS, buildImageEditEndpoint, buildImageEndpoint, buildImageRequestBody, formatImageQuality, ratioToSize } from './image-options'

describe('image options', () => {
  it('maps expanded ratios to API size strings', () => {
    expect(IMAGE_RATIOS).toEqual(['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21'])
    expect(ratioToSize('1:1')).toBe('1024x1024')
    expect(ratioToSize('3:2')).toBe('1536x1024')
    expect(ratioToSize('2:3')).toBe('1024x1536')
    expect(ratioToSize('4:3')).toBe('1365x1024')
    expect(ratioToSize('3:4')).toBe('1024x1365')
    expect(ratioToSize('16:9')).toBe('1792x1024')
    expect(ratioToSize('9:16')).toBe('1024x1792')
    expect(ratioToSize('21:9')).toBe('2048x878')
    expect(ratioToSize('9:21')).toBe('878x2048')
  })

  it('exposes GPT and compatibility quality options', () => {
    expect(IMAGE_QUALITIES).toEqual(['auto', 'low', 'medium', 'high', 'standard', 'hd'])
    expect(IMAGE_QUALITY_LABELS).toEqual({
      auto: '自动',
      low: '低',
      medium: '中',
      high: '高',
      standard: '标准',
      hd: '高清'
    })
    expect(formatImageQuality('hd')).toBe('高清')
  })

  it('normalizes baseURL into the generations endpoint', () => {
    expect(buildImageEndpoint('https://example.test///')).toBe('https://example.test/v1/images/generations')
  })

  it('normalizes baseURL into the edits endpoint', () => {
    expect(buildImageEditEndpoint('https://example.test///')).toBe('https://example.test/v1/images/edits')
  })

  it('builds a request body without leaking empty optional fields', () => {
    expect(
      buildImageRequestBody({
        conversationId: 'c1',
        prompt: '  mint glasshouse  ',
        model: 'gpt-image-2',
        ratio: '3:2',
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
})
