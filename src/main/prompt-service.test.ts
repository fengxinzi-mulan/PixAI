import { describe, expect, it, vi } from 'vitest'
import { PromptService } from './prompt-service'

describe('prompt service', () => {
  it('calls the Responses API with the prompt assistant model', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      output_text: '一座清晨雾气中的玻璃温室，柔和自然光，电影感构图。'
    }), { status: 200 })))
    globalThis.fetch = fetchMock as typeof fetch

    try {
      const service = new PromptService(createSettings())
      const result = await service.inspire({ hasReferenceImages: true })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      const body = JSON.parse(String(init.body))

      expect(url).toBe('https://example.test/v1/responses')
      expect(body.model).toBe('gpt-5.4-mini')
      expect(JSON.stringify(body.input)).toContain('参考图')
      expect(result).toBe('一座清晨雾气中的玻璃温室，柔和自然光，电影感构图。')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('extracts text from message content responses', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      output: [
        { content: [{ text: 'expanded prompt' }] }
      ]
    }), { status: 200 }))) as typeof fetch

    try {
      const service = new PromptService(createSettings())
      await expect(service.enrich({ prompt: 'portrait' })).resolves.toBe('expanded prompt')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('surfaces API error messages', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { message: 'model unavailable' }
    }), { status: 400 }))) as typeof fetch

    try {
      const service = new PromptService(createSettings())
      await expect(service.inspire()).rejects.toThrow('model unavailable')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

function createSettings() {
  return {
    getPublicSettings: () => ({
      baseURL: 'https://example.test',
      defaultModel: 'gpt-image-2',
      promptModel: 'gpt-5.4-mini',
      apiKeyStored: true,
      insecureStorage: false
    }),
    getApiKey: () => 'sk-test'
  } as never
}
