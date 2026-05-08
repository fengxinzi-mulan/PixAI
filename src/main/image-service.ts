import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { buildImageEndpoint, buildImageRequestBody, ratioToSize } from '@shared/image-options'
import { elapsedMs } from '@shared/duration'
import type { GenerateImageInput, GenerateImageResult, GenerationRun, ImageHistoryItem } from '@shared/types'
import type { AppDatabase } from './database'
import { createErrorDetails } from './error-details'
import type { ImageResponseData } from './image-response'
import type { SettingsStore } from './settings'

type ImageApiResponse = {
  data?: ImageResponseData[]
  error?: {
    message?: string
    type?: string
    code?: string
    param?: string
  }
}

export class ImageService {
  private readonly activeRequests = new Map<string, Array<{ controller: AbortController }>>()

  constructor(
    private readonly database: AppDatabase,
    private readonly settings: SettingsStore
  ) {}

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const startedAtMs = Date.now()
    const settings = this.settings.getPublicSettings()
    const apiKey = this.settings.getApiKey()
    const conversation = this.database.getConversation(input.conversationId)
    const globalVisible = conversation?.autoSaveHistory !== false
    const prompt = input.prompt.trim()
    const model = input.model.trim() || settings.defaultModel
    const size = ratioToSize(input.ratio)
    const createdAt = new Date().toISOString()
    const run = this.database.insertRun({
      id: randomUUID(),
      conversationId: input.conversationId,
      prompt,
      model,
      ratio: input.ratio,
      size,
      quality: input.quality,
      durationMs: null,
      n: input.n,
      status: 'running',
      errorMessage: null,
      errorDetails: null,
      createdAt
    })

    if (!prompt) {
      return this.saveFailure(input, run, model, 'Prompt is required.', 'validation', { reason: 'Prompt is required.' }, createdAt, elapsedMs(startedAtMs))
    }

    if (!apiKey) {
      return this.saveFailure(input, run, model, 'API key is not configured.', 'configuration', {
        reason: 'API key is not configured.'
      }, createdAt, elapsedMs(startedAtMs))
    }

    const endpoint = buildImageEndpoint(settings.baseURL)
    const targetCount = Math.min(10, Math.max(1, input.n || 1))
    const requestControllers = Array.from({ length: targetCount }, () => ({ controller: new AbortController() }))
    this.activeRequests.set(input.conversationId, requestControllers)
    try {
      const items: ImageHistoryItem[] = []
      let succeededCount = 0
      let canceledCount = 0
      await Promise.all(
        requestControllers.map(async ({ controller }, requestIndex) => {
          try {
            const imageData = await this.requestImageBatch(endpoint, apiKey, { ...input, model, n: 1 }, controller.signal)
            const image = imageData[0]
            if (!image) {
              const durationMs = elapsedMs(startedAtMs)
              const item = this.createFailureItem(input, run, model, 'The image API returned no images.', 'empty-data', {
                endpoint,
                requestIndex
              }, new Date().toISOString(), durationMs)
              items.push(item)
              return item
            }

            const id = randomUUID()
            const filePath = await this.saveImage(id, image)
            const durationMs = elapsedMs(startedAtMs)
            succeededCount += 1
            const item = this.database.insertHistory({
              id,
              conversationId: input.conversationId,
              runId: run.id,
              prompt,
              model,
              ratio: input.ratio,
              size,
              quality: input.quality,
              requestIndex,
              durationMs,
              filePath,
              status: 'succeeded',
              errorMessage: null,
              errorDetails: null,
              globalVisible,
              createdAt: new Date().toISOString()
            })
            items.push(item)
            return item
          } catch (error) {
            if (controller.signal.aborted) {
              canceledCount += 1
              return null
            }

            const durationMs = elapsedMs(startedAtMs)
            if (error instanceof ImageHttpError) {
              const item = this.createFailureItem(input, run, model, error.message, 'http', {
                ...error.details,
                requestIndex
              }, new Date().toISOString(), durationMs)
              items.push(item)
              return item
            }

            const item = this.createFailureItem(input, run, model, error instanceof Error ? error.message : 'Image generation failed.', 'exception', {
              exception: serializeError(error),
              requestIndex
            }, new Date().toISOString(), durationMs)
            items.push(item)
            return item
          }
        })
      )

      const failedCount = items.length - succeededCount
      const errorMessage = failedCount > 0 && succeededCount === 0
        ? (canceledCount === failedCount ? 'Generation canceled.' : 'Image generation failed.')
        : null
      const errorDetails = errorMessage ? createErrorDetails({ ...input, model }, canceledCount === failedCount ? 'canceled' : 'batch-failed', {
        succeededCount,
        failedCount,
        canceledCount
      }) : null
      const completedRun = this.database.updateRun(run.id, {
        status: succeededCount > 0 ? 'succeeded' : 'failed',
        errorMessage,
        errorDetails,
        durationMs: elapsedMs(startedAtMs)
      })
      return {
        run: { ...completedRun, items },
        items,
        errorMessage: errorMessage || undefined,
        errorDetails: errorDetails || undefined,
        canceled: canceledCount > 0 && succeededCount === 0
      }
    } catch (error) {
      if (error instanceof ImageHttpError) {
        return this.saveFailure(input, run, model, error.message, 'http', error.details, createdAt, elapsedMs(startedAtMs))
      }

      return this.saveFailure(input, run, model, error instanceof Error ? error.message : 'Image generation failed.', 'exception', {
        exception: serializeError(error)
      }, createdAt, elapsedMs(startedAtMs))
    } finally {
      this.activeRequests.delete(input.conversationId)
    }
  }

  cancelConversationGeneration(conversationId: string, requestIndex?: number): void {
    const requests = this.activeRequests.get(conversationId)
    if (!requests) {
      return
    }
    if (typeof requestIndex === 'number') {
      const request = requests[requestIndex]
      if (!request) {
        return
      }
      request.controller.abort()
      return
    }
    if (requests.length > 1) {
      return
    }
    for (const request of requests) {
      request.controller.abort()
    }
  }

  private async saveImage(id: string, image: ImageResponseData): Promise<string> {
    mkdirSync(this.database.imagesDir, { recursive: true })
    if (image.b64_json) {
      const filePath = join(this.database.imagesDir, `${id}.png`)
      writeFileSync(filePath, Buffer.from(image.b64_json, 'base64'))
      return filePath
    }

    if (image.url) {
      const response = await fetch(image.url)
      if (!response.ok) throw new Error(`Unable to download generated image: HTTP ${response.status}.`)
      const contentType = response.headers.get('content-type') || ''
      const urlPath = new URL(image.url).pathname
      const extension = extensionFromContentType(contentType) || extname(urlPath) || '.png'
      const filePath = join(this.database.imagesDir, `${id}${extension}`)
      writeFileSync(filePath, Buffer.from(await response.arrayBuffer()))
      return filePath
    }

    throw new Error('The image API response did not include b64_json or url.')
  }

  private async requestImageBatch(
    endpoint: string,
    apiKey: string,
    input: GenerateImageInput,
    signal: AbortSignal
  ): Promise<ImageResponseData[]> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal,
      body: JSON.stringify(buildImageRequestBody(input))
    })
    const responseText = await response.text()
    const { payload, parseError } = this.parseResponse(responseText)

    if (!response.ok) {
      throw new ImageHttpError(payload.error?.message || `Image generation failed with HTTP ${response.status}.`, {
        endpoint,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        responseError: payload.error,
        responseBody: responseText,
        parseError
      })
    }

    return payload.data || []
  }

  private saveFailure(
    input: GenerateImageInput,
    run: GenerationRun,
    model: string,
    errorMessage: string,
    stage: string,
    details: Record<string, unknown>,
    createdAt: string,
    durationMs = 0
  ): GenerateImageResult {
    const errorDetails = createErrorDetails({ ...input, model }, stage, details)
    const item = this.createFailureItem(input, run, model, errorMessage, stage, details, createdAt, durationMs, errorDetails)
    const failedRun = this.database.updateRun(run.id, { status: 'failed', errorMessage, errorDetails, durationMs })
    return { run: { ...failedRun, items: [item] }, items: [item], errorMessage, errorDetails }
  }

  private createFailureItem(
    input: GenerateImageInput,
    run: GenerationRun,
    model: string,
    errorMessage: string,
    stage: string,
    details: Record<string, unknown>,
    createdAt: string,
    durationMs = 0,
    existingErrorDetails?: string
  ): ImageHistoryItem {
    const errorDetails = existingErrorDetails || createErrorDetails({ ...input, model }, stage, details)
    return this.database.insertHistory({
      id: randomUUID(),
      conversationId: input.conversationId,
      runId: run.id,
      prompt: input.prompt.trim(),
      model,
      ratio: input.ratio,
      size: ratioToSize(input.ratio),
      quality: input.quality,
      requestIndex: typeof details.requestIndex === 'number' ? details.requestIndex : null,
      durationMs,
      filePath: null,
      status: 'failed',
      errorMessage,
      errorDetails,
      globalVisible: this.database.getConversation(input.conversationId)?.autoSaveHistory !== false,
      createdAt
    })
  }

  private parseResponse(responseText: string): { payload: ImageApiResponse; parseError: string | null } {
    if (!responseText.trim()) return { payload: {}, parseError: null }
    try {
      return { payload: JSON.parse(responseText) as ImageApiResponse, parseError: null }
    } catch (error) {
      return { payload: {}, parseError: error instanceof Error ? error.message : String(error) }
    }
  }
}

function extensionFromContentType(contentType: string): string | null {
  if (contentType.includes('jpeg')) return '.jpg'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('png')) return '.png'
  return null
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof ImageHttpError) {
    return {
      name: error.name,
      message: error.message,
      http: error.details
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  return { value: String(error) }
}

class ImageHttpError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ImageHttpError'
  }
}
