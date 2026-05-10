import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  buildImageEditEndpoint,
  buildImageEndpoint,
  buildImageRequestBody,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  getDefaultImageSize,
  supportsImageInputFidelity
} from '@shared/image-options'
import { elapsedMs } from '@shared/duration'
import type {
  GenerateImageInput,
  GenerateImageResult,
  GenerationMode,
  GenerationRun,
  ImageHistoryItem,
  ImageOutputFormat,
  ReferenceImage
} from '@shared/types'
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
    const size = input.size.trim() || getDefaultImageSize(input.ratio)
    const createdAt = new Date().toISOString()
    const referenceImages = this.getGenerationReferences(input)
    const generationMode: GenerationMode = referenceImages.length > 0 ? 'image-to-image' : 'text-to-image'
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
      generationMode,
      referenceImages,
      createdAt
    })
    if (referenceImages.length > 0) this.database.insertRunReferences(run.id, referenceImages)

    if (!prompt) {
      return this.saveFailure(input, run, model, 'Prompt is required.', 'validation', { reason: 'Prompt is required.' }, createdAt, elapsedMs(startedAtMs))
    }

    if (!apiKey) {
      return this.saveFailure(input, run, model, 'API key is not configured.', 'configuration', {
        reason: 'API key is not configured.'
      }, createdAt, elapsedMs(startedAtMs))
    }

    const endpoint = generationMode === 'image-to-image' ? buildImageEditEndpoint(settings.baseURL) : buildImageEndpoint(settings.baseURL)
    const targetCount = Math.min(10, Math.max(1, input.n || 1))
    const requestControllers = Array.from({ length: targetCount }, () => ({ controller: new AbortController() }))
    this.activeRequests.set(run.id, requestControllers)
    try {
      const items: ImageHistoryItem[] = []
      let succeededCount = 0
      let canceledCount = 0
      await Promise.all(
        requestControllers.map(async ({ controller }, requestIndex) => {
          try {
            const imageData = await this.requestImageBatch(endpoint, apiKey, { ...input, model, n: 1 }, referenceImages, controller.signal)
            const image = imageData.at(-1)
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
            const savedImage = await this.saveImage(id, image, input.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT)
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
              filePath: savedImage.filePath,
              fileSizeBytes: savedImage.fileSizeBytes,
              status: 'succeeded',
              errorMessage: null,
              errorDetails: null,
              generationMode,
              referenceImages,
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
      this.activeRequests.delete(run.id)
    }
  }

  cancelRunGeneration(runId: string, requestIndex?: number): void {
    const requests = this.activeRequests.get(runId)
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

  private async saveImage(
    id: string,
    image: ImageResponseData,
    outputFormat: ImageOutputFormat
  ): Promise<{ filePath: string; fileSizeBytes: number }> {
    mkdirSync(this.database.imagesDir, { recursive: true })
    if (image.b64_json) {
      const filePath = join(this.database.imagesDir, `${id}${extensionFromOutputFormat(outputFormat)}`)
      const fileBuffer = Buffer.from(image.b64_json, 'base64')
      writeFileSync(filePath, fileBuffer)
      return { filePath, fileSizeBytes: fileBuffer.length }
    }

    if (image.url) {
      const response = await fetch(image.url)
      if (!response.ok) throw new Error(`Unable to download generated image: HTTP ${response.status}.`)
      const contentType = response.headers.get('content-type') || ''
      const urlPath = new URL(image.url).pathname
      const extension = extensionFromContentType(contentType) || extname(urlPath) || '.png'
      const filePath = join(this.database.imagesDir, `${id}${extension}`)
      const fileBuffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(filePath, fileBuffer)
      return { filePath, fileSizeBytes: fileBuffer.length }
    }

    throw new Error('The image API response did not include b64_json or url.')
  }

  private async requestImageBatch(
    endpoint: string,
    apiKey: string,
    input: GenerateImageInput,
    referenceImages: ReferenceImage[],
    signal: AbortSignal
  ): Promise<ImageResponseData[]> {
    if (referenceImages.length > 0) {
      return this.requestImageEditBatch(endpoint, apiKey, input, referenceImages, signal)
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal,
      body: JSON.stringify(buildImageRequestBody(input))
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      const responseText = await response.text()
      const { payload, parseError } = this.parseResponse(responseText)
      throw new ImageHttpError(payload.error?.message || `Image generation failed with HTTP ${response.status}.`, {
        endpoint,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        responseError: payload.error,
        responseBody: responseText,
        parseError
      })
    }

    if (input.stream && contentType.includes('text/event-stream')) {
      return this.readStreamedImageData(response)
    }

    const responseText = await response.text()
    const { payload } = this.parseResponse(responseText)
    return payload.data || []
  }

  private async requestImageEditBatch(
    endpoint: string,
    apiKey: string,
    input: GenerateImageInput,
    referenceImages: ReferenceImage[],
    signal: AbortSignal
  ): Promise<ImageResponseData[]> {
    const formData = new FormData()
    formData.set('prompt', input.prompt.trim())
    formData.set('model', input.model.trim())
    formData.set('size', input.size.trim() || getDefaultImageSize(input.ratio))
    formData.set('quality', input.quality)
    formData.set('n', String(Math.min(10, Math.max(1, input.n || 1))))
    if (input.outputFormat) formData.set('output_format', input.outputFormat)
    if (input.outputCompression != null && Number.isFinite(input.outputCompression)) {
      formData.set('output_compression', String(input.outputCompression))
    }
    if (input.background) formData.set('background', input.background)
    if (input.moderation) formData.set('moderation', input.moderation)
    if (input.stream) formData.set('stream', 'true')
    if (input.partialImages != null && Number.isFinite(input.partialImages)) {
      formData.set('partial_images', String(input.partialImages))
    }
    if (input.inputFidelity && supportsImageInputFidelity(input.model)) {
      formData.set('input_fidelity', input.inputFidelity)
    }
    for (const referenceImage of referenceImages) {
      if (!referenceImage.filePath) continue
      const fileBuffer = readFileSync(referenceImage.filePath)
      formData.append('image[]', new Blob([fileBuffer], { type: referenceImage.mimeType }), referenceImage.name)
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal,
      body: formData
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      const responseText = await response.text()
      const { payload, parseError } = this.parseResponse(responseText)
      throw new ImageHttpError(payload.error?.message || `Image edit failed with HTTP ${response.status}.`, {
        endpoint,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        responseError: payload.error,
        responseBody: responseText,
        parseError
      })
    }

    if (input.stream && contentType.includes('text/event-stream')) {
      return this.readStreamedImageData(response)
    }

    const responseText = await response.text()
    const { payload } = this.parseResponse(responseText)
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
      size: input.size.trim() || getDefaultImageSize(input.ratio),
      quality: input.quality,
      requestIndex: typeof details.requestIndex === 'number' ? details.requestIndex : null,
      durationMs,
      filePath: null,
      fileSizeBytes: null,
      status: 'failed',
      errorMessage,
      errorDetails,
      generationMode: run.generationMode,
      referenceImages: run.referenceImages,
      globalVisible: this.database.getConversation(input.conversationId)?.autoSaveHistory !== false,
      createdAt
    })
  }

  private getGenerationReferences(input: GenerateImageInput): ReferenceImage[] {
    const requestedIds = input.referenceImageIds || []
    if (requestedIds.length === 0) return []
    const requestedIdSet = new Set(requestedIds)
    const referencesById = new Map(
      this.database.listConversationReferences(input.conversationId).map((reference) => [reference.id, reference])
    )
    return requestedIds
      .filter((id, index) => requestedIds.indexOf(id) === index && requestedIdSet.has(id))
      .map((id) => referencesById.get(id))
      .filter((reference): reference is ReferenceImage => Boolean(reference?.filePath))
      .slice(0, 8)
  }

  private parseResponse(responseText: string): { payload: ImageApiResponse; parseError: string | null } {
    if (!responseText.trim()) return { payload: {}, parseError: null }
    try {
      return { payload: JSON.parse(responseText) as ImageApiResponse, parseError: null }
    } catch (error) {
      return { payload: {}, parseError: error instanceof Error ? error.message : String(error) }
    }
  }

  private async readStreamedImageData(response: Response): Promise<ImageResponseData[]> {
    if (!response.body) {
      throw new Error('The image stream response had no body.')
    }

    const images: ImageResponseData[] = []
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const consumeBlock = (block: string) => {
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim()
      if (!data || data === '[DONE]') return
      try {
        const payload = JSON.parse(data)
        images.push(...extractImageResponseData(payload))
      } catch {
        // Ignore non-JSON stream chunks.
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex >= 0) {
        consumeBlock(buffer.slice(0, separatorIndex))
        buffer = buffer.slice(separatorIndex + 2)
        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, '\n')
    if (buffer.trim()) {
      consumeBlock(buffer)
    }

    return images
  }
}

function extensionFromContentType(contentType: string): string | null {
  if (contentType.includes('jpeg')) return '.jpg'
  if (contentType.includes('webp')) return '.webp'
  if (contentType.includes('png')) return '.png'
  return null
}

function extensionFromOutputFormat(format: ImageOutputFormat): string {
  if (format === 'jpeg') return '.jpg'
  if (format === 'webp') return '.webp'
  return '.png'
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

function extractImageResponseData(value: unknown): ImageResponseData[] {
  const images: ImageResponseData[] = []
  const visited = new Set<object>()

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }

    const record = node as Record<string, unknown>
    if (typeof record.b64_json === 'string' || typeof record.url === 'string') {
      images.push({
        ...(typeof record.b64_json === 'string' ? { b64_json: record.b64_json } : {}),
        ...(typeof record.url === 'string' ? { url: record.url } : {})
      })
    }

    for (const child of Object.values(record)) {
      visit(child)
    }
  }

  visit(value)
  return images
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
