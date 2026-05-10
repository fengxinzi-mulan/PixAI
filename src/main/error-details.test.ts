import { describe, expect, it } from 'vitest'
import { createErrorDetails } from './error-details'

describe('error details', () => {
  it('does not include api keys or authorization values', () => {
    const details = createErrorDetails(
      {
        conversationId: 'c1',
        prompt: 'test prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'high',
        n: 1,
        outputFormat: 'jpeg',
        outputCompression: 85,
        background: 'opaque',
        moderation: 'low',
        stream: true,
        partialImages: 2,
        inputFidelity: 'high',
        referenceImageIds: ['ref-1', 'ref-2']
      },
      'http',
      {
        endpoint: 'https://example.test/v1/images/generations',
        authorization: 'Bearer sk-secret-value',
        apiKey: 'sk-secret-value',
        responseBody: '{"error":"bad"}'
      }
    )
    const payload = JSON.parse(details)

    expect(details).toContain('"stage": "http"')
    expect(details).toContain('"size": "1024x1024"')
    expect(details).toContain('"referenceImageCount": 2')
    expect(details).toContain('"referenceImageIds": [')
    expect(payload.request).toMatchObject({
      outputFormat: 'jpeg',
      outputCompression: 85,
      background: 'opaque',
      moderation: 'low',
      stream: true,
      partialImages: 2,
      inputFidelity: 'high'
    })
    expect(details).not.toContain('sk-secret-value')
    expect(details).not.toContain('Bearer')
  })
})
