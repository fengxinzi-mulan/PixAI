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
        quality: 'high',
        n: 1
      },
      'http',
      {
        endpoint: 'https://example.test/v1/images/generations',
        authorization: 'Bearer sk-secret-value',
        apiKey: 'sk-secret-value',
        responseBody: '{"error":"bad"}'
      }
    )

    expect(details).toContain('"stage": "http"')
    expect(details).not.toContain('sk-secret-value')
    expect(details).not.toContain('Bearer')
  })
})
