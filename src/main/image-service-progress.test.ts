import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ImageService } from './image-service'

function deferredResponse(): {
  promise: Promise<Response>
  resolve: (value: Response) => void
} {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function imageResponse(): Response {
  return new Response(JSON.stringify({
    data: [{ b64_json: Buffer.from('image').toString('base64') }]
  }), { status: 200 })
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('image service progress', () => {
  it('records each image duration at the time its request completes', async () => {
    const originalFetch = globalThis.fetch
    const dateNow = vi.spyOn(Date, 'now')
    const response = deferredResponse()
    const insertHistory = vi.fn((input) => ({ ...input, favorite: false }))
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

    dateNow.mockReturnValue(10_000)
    globalThis.fetch = vi.fn(() => response.promise) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({ autoSaveHistory: true }),
          insertRun: () => run,
          insertHistory,
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: [] })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-progress-test-'))
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
        n: 1
      })

      await Promise.resolve()
      dateNow.mockReturnValue(52_300)
      response.resolve(imageResponse())
      await resultPromise

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.test/v1/images/generations',
        expect.objectContaining({ method: 'POST' })
      )
      expect(insertHistory.mock.calls[0][0].durationMs).toBe(42_300)
      expect(insertHistory.mock.calls[0][0].fileSizeBytes).toBe(Buffer.byteLength('image'))
    } finally {
      globalThis.fetch = originalFetch
      dateNow.mockRestore()
    }
  })

  it('persists each generated image as soon as that request finishes', async () => {
    const originalFetch = globalThis.fetch
    const first = deferredResponse()
    const second = deferredResponse()
    const insertHistory = vi.fn((input) => ({ ...input, favorite: false }))
    const run = {
      id: 'run-1',
      conversationId: 'c1',
      prompt: 'prompt',
      model: 'gpt-image-2',
      ratio: '1:1',
      size: '1024x1024',
      quality: 'auto',
      n: 2,
      status: 'running',
      durationMs: null,
      errorMessage: null,
      errorDetails: null,
      createdAt: new Date().toISOString(),
      items: []
    }

    globalThis.fetch = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({ autoSaveHistory: true }),
          insertRun: () => run,
          insertHistory,
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: [] })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-progress-test-'))
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
        n: 2
      })

      await Promise.resolve()
      first.resolve(imageResponse())
      await nextTask()

      expect(insertHistory).toHaveBeenCalledTimes(1)

      second.resolve(imageResponse())
      await resultPromise

      expect(insertHistory).toHaveBeenCalledTimes(2)
      expect(insertHistory.mock.calls.map(([input]) => input.requestIndex)).toEqual([0, 1])
      expect(insertHistory.mock.calls.every(([input]) => input.durationMs >= 0)).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('saves base64 images with the requested output format extension', async () => {
    const originalFetch = globalThis.fetch
    const insertHistory = vi.fn((input) => ({ ...input, favorite: false }))
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

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('image').toString('base64') }]
      }), { status: 200 }))
    ) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({ autoSaveHistory: true }),
          insertRun: () => run,
          insertHistory,
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: [] })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-progress-test-'))
        } as never,
        {
          getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
          getApiKey: () => 'sk-test'
        } as never
      )

      await imageService.generate({
        conversationId: 'c1',
        prompt: 'prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'auto',
        n: 1,
        outputFormat: 'jpeg'
      })

      expect(insertHistory.mock.calls[0][0].filePath).toMatch(/\.jpg$/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('persists failed requests with their original request index', async () => {
    const originalFetch = globalThis.fetch
    const insertHistory = vi.fn((input) => ({ ...input, favorite: false }))
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

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: 'bad request' } }), {
        status: 400,
        statusText: 'Bad Request'
      }))
    ) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({ autoSaveHistory: true }),
          insertRun: () => run,
          insertHistory,
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: [] })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-progress-test-'))
        } as never,
        {
          getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
          getApiKey: () => 'sk-test'
        } as never
      )

      await imageService.generate({
        conversationId: 'c1',
        prompt: 'prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'auto',
        n: 1
      })

      expect(insertHistory).toHaveBeenCalledTimes(1)
      expect(insertHistory.mock.calls[0][0].requestIndex).toBe(0)
      expect(insertHistory.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('uses the image edits endpoint and multipart body when reference images are provided', async () => {
    const originalFetch = globalThis.fetch
    const referencesDir = mkdtempSync(join(tmpdir(), 'pixai-edit-test-'))
    const referencePath = join(referencesDir, 'reference.png')
    writeFileSync(referencePath, Buffer.from('reference'))
    const reference = {
      id: 'ref-1',
      name: 'reference.png',
      mimeType: 'image/png',
      filePath: referencePath,
      fileSizeBytes: Buffer.byteLength('reference'),
      createdAt: new Date().toISOString()
    }
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
      generationMode: 'image-to-image',
      referenceImages: [reference],
      createdAt: new Date().toISOString(),
      items: []
    }
    const insertRunReferences = vi.fn()

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('image').toString('base64') }]
      }), { status: 200 }))
    ) as unknown as typeof fetch

    try {
      const imageService = new ImageService(
        {
          getConversation: () => ({ autoSaveHistory: true }),
          listConversationReferences: () => [reference],
          insertRun: () => run,
          insertRunReferences,
          insertHistory: vi.fn((input) => ({ ...input, favorite: false })),
          updateRun: vi.fn((_id, input) => ({ ...run, ...input, items: [] })),
          imagesDir: mkdtempSync(join(tmpdir(), 'pixai-edit-output-test-'))
        } as never,
        {
          getPublicSettings: () => ({ baseURL: 'https://example.test', defaultModel: 'gpt-image-2' }),
          getApiKey: () => 'sk-test'
        } as never
      )

      await imageService.generate({
        conversationId: 'c1',
        prompt: 'prompt',
        model: 'gpt-image-2',
        ratio: '1:1',
        size: '1024x1024',
        quality: 'auto',
        n: 1,
        outputFormat: 'jpeg',
        outputCompression: 85,
        background: 'opaque',
        moderation: 'low',
        stream: true,
        partialImages: 2,
        inputFidelity: 'high',
        referenceImageIds: [reference.id]
      })

      expect(fetch).toHaveBeenCalledWith('https://example.test/v1/images/edits', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      }))
      const body = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as FormData
      expect(body.get('prompt')).toBe('prompt')
      expect(body.get('model')).toBe('gpt-image-2')
      expect(body.get('size')).toBe('1024x1024')
      expect(body.get('quality')).toBe('auto')
      expect(body.get('n')).toBe('1')
      expect(body.get('output_format')).toBe('jpeg')
      expect(body.get('output_compression')).toBe('85')
      expect(body.get('background')).toBe('opaque')
      expect(body.get('moderation')).toBe('low')
      expect(body.get('stream')).toBe('true')
      expect(body.get('partial_images')).toBe('2')
      expect(body.get('input_fidelity')).toBeNull()
      expect(body.getAll('image[]')).toHaveLength(1)
      expect(insertRunReferences).toHaveBeenCalledWith(run.id, [reference])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
