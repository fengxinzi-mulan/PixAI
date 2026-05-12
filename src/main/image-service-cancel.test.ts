import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ImageService } from './image-service'

function neverEndingEventStreamResponse(): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"progress"}\n\n'))
    }
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  })
}

describe('image service cancellation', () => {
  it('aborts a single active request when no request index is provided', async () => {
    const abortSpy = vi.fn()
    const imageService = new ImageService(
      {
        getConversation: () => ({
          autoSaveHistory: true
        }),
        insertRun: (input: unknown) => input,
        insertHistory: vi.fn(),
        updateRun: vi.fn(),
        imagesDir: 'ignored'
      } as never,
      {
        getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
        getApiKey: () => 'sk-test'
      } as never
    )

    const activeRequests = new Map<string, Array<{ controller: AbortController }>>()
    activeRequests.set('run-1', [{ controller: { abort: abortSpy } as unknown as AbortController }])
    ;(imageService as unknown as { activeRequests: Map<string, Array<{ controller: AbortController }>> }).activeRequests = activeRequests

    imageService.cancelRunGeneration('run-1')

    expect(abortSpy).toHaveBeenCalledTimes(1)
  })

  it('does not cancel all active requests when a multi-image cancel omits the request index', async () => {
    const abortFirst = vi.fn()
    const abortSecond = vi.fn()
    const imageService = new ImageService(
      {
        getConversation: () => ({
          autoSaveHistory: true
        }),
        insertRun: (input: unknown) => input,
        insertHistory: vi.fn(),
        updateRun: vi.fn(),
        imagesDir: 'ignored'
      } as never,
      {
        getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
        getApiKey: () => 'sk-test'
      } as never
    )

    const activeRequests = new Map<string, Array<{ controller: AbortController }>>()
    activeRequests.set('run-1', [
      { controller: { abort: abortFirst } as unknown as AbortController },
      { controller: { abort: abortSecond } as unknown as AbortController }
    ])
    ;(imageService as unknown as { activeRequests: Map<string, Array<{ controller: AbortController }>> }).activeRequests = activeRequests

    imageService.cancelRunGeneration('run-1')

    expect(abortFirst).not.toHaveBeenCalled()
    expect(abortSecond).not.toHaveBeenCalled()
  })

  it('aborts only the selected request when canceling one image', async () => {
    const abortFirst = vi.fn()
    const abortSecond = vi.fn()
    const abortThird = vi.fn()
    const imageService = new ImageService(
      {
        getConversation: () => ({
          autoSaveHistory: true
        }),
        insertRun: (input: unknown) => input,
        insertHistory: vi.fn(),
        updateRun: vi.fn(),
        imagesDir: 'ignored'
      } as never,
      {
        getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
        getApiKey: () => 'sk-test'
      } as never
    )

    const activeRequests = new Map<string, Array<{ controller: AbortController }>>()
    activeRequests.set('run-1', [
      { controller: { abort: abortFirst } as unknown as AbortController },
      { controller: { abort: abortSecond } as unknown as AbortController },
      { controller: { abort: abortThird } as unknown as AbortController }
    ])
    ;(imageService as unknown as { activeRequests: Map<string, Array<{ controller: AbortController }>> }).activeRequests = activeRequests

    imageService.cancelRunGeneration('run-1', 1)

    expect(abortFirst).not.toHaveBeenCalled()
    expect(abortSecond).toHaveBeenCalledTimes(1)
    expect(abortThird).not.toHaveBeenCalled()
  })

  it('does not cancel requests from a different run', async () => {
    const abortFirstRun = vi.fn()
    const abortSecondRun = vi.fn()
    const imageService = new ImageService(
      {
        getConversation: () => ({
          autoSaveHistory: true
        }),
        insertRun: (input: unknown) => input,
        insertHistory: vi.fn(),
        updateRun: vi.fn(),
        imagesDir: 'ignored'
      } as never,
      {
        getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
        getApiKey: () => 'sk-test'
      } as never
    )

    const activeRequests = new Map<string, Array<{ controller: AbortController }>>()
    activeRequests.set('run-1', [{ controller: { abort: abortFirstRun } as unknown as AbortController }])
    activeRequests.set('run-2', [{ controller: { abort: abortSecondRun } as unknown as AbortController }])
    ;(imageService as unknown as { activeRequests: Map<string, Array<{ controller: AbortController }>> }).activeRequests = activeRequests

    imageService.cancelRunGeneration('run-1', 0)

    expect(abortFirstRun).toHaveBeenCalledTimes(1)
    expect(abortSecondRun).not.toHaveBeenCalled()
  })

  it('skips the canceled item and keeps the other generated images when canceling a single request', async () => {
    const originalFetch = globalThis.fetch
    const historyItems: Array<Record<string, unknown>> = []
    const run = {
      id: 'run-1',
      conversationId: 'c1',
      prompt: 'prompt',
      model: 'gpt-image-2',
      ratio: '1:1',
      size: '1024x1024',
      quality: 'auto',
      n: 3,
      status: 'running',
      durationMs: null,
      errorMessage: null,
      errorDetails: null,
      createdAt: new Date().toISOString(),
      items: []
    }
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('image').toString('base64') }]
      }), { status: 200 }))
    ) as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({
            autoSaveHistory: true
          }),
          insertRun: () => run,
          insertHistory: vi.fn((input) => {
            const item = { ...input, favorite: false }
            historyItems.push(item)
            return item
          }),
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: historyItems })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-cancel-test-'))
        } as never,
        {
          getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
          getApiKey: () => 'sk-test'
        } as never
      )

      const resultPromise = imageService.generate({
        conversationId: 'c1',
        prompt: 'prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'auto',
        n: 3
      })
      await Promise.resolve()

      imageService.cancelRunGeneration(run.id, 1)
      const result = await resultPromise

      expect(result.items).toHaveLength(2)
      expect(result.items.map((item) => item.status)).toEqual(['succeeded', 'succeeded'])
      expect(result.items.map((item) => item.requestIndex)).toEqual([0, 2])
      expect(historyItems).toHaveLength(2)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
      expect(result.canceled).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not fallback after a user cancels an active streamed request', async () => {
    const originalFetch = globalThis.fetch
    const historyItems: Array<Record<string, unknown>> = []
    const run = {
      id: 'run-1',
      conversationId: 'c1',
      prompt: 'prompt',
      model: 'gpt-image-2',
      ratio: '1:1',
      size: '1024x1024',
      quality: 'auto',
      n: 1,
      status: 'running',
      durationMs: null,
      errorMessage: null,
      errorDetails: null,
      createdAt: new Date().toISOString(),
      items: []
    }
    globalThis.fetch = vi.fn(() => Promise.resolve(neverEndingEventStreamResponse())) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({
            autoSaveHistory: true
          }),
          insertRun: () => run,
          insertHistory: vi.fn((input) => {
            const item = { ...input, favorite: false }
            historyItems.push(item)
            return item
          }),
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: historyItems })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-cancel-test-'))
        } as never,
        {
          getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
          getApiKey: () => 'sk-test'
        } as never
      )

      const resultPromise = imageService.generate({
        conversationId: 'c1',
        prompt: 'prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'auto',
        n: 1,
        stream: true
      })
      await Promise.resolve()
      await Promise.resolve()

      imageService.cancelRunGeneration(run.id, 0)
      const result = await resultPromise

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(historyItems).toHaveLength(0)
      expect(result.canceled).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
