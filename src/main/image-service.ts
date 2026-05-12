import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  buildImageEditEndpoint,
  buildImageEndpoint,
  buildImageRequestBody,
  DEFAULT_IMAGE_MAX_RETRIES,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  MAX_IMAGE_MAX_RETRIES,
  getDefaultImageSize,
  normalizeImageGenerationTimeoutSeconds,
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

const STREAM_IDLE_TIMEOUT_MS = 60_000

type ImageRequestDiagnostics = {
  streamFallback?: {
    reason: 'stream-idle-timeout' | 'stream-empty'
    fallbackExecuted: boolean
    idleTimeoutMs: number
  }
}

type ImageRequestResult = {
  images: ImageResponseData[]
  diagnostics?: ImageRequestDiagnostics
}

type StreamedImageDataResult = {
  images: ImageResponseData[]
  timedOut: boolean
}

type RequestAbortScope = {
  signal: AbortSignal
  userSignal: AbortSignal
  timedOut: () => boolean
  cleanup: () => void
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
    const maxRetries = normalizeRetryCount(input.maxRetries)
    const generationTimeoutSeconds = normalizeImageGenerationTimeoutSeconds(input.generationTimeoutSeconds)
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
      maxRetries,
      retryAttempts: {},
      retryFailures: {},
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
      await runWithConcurrency(
        requestControllers,
        targetCount,
        async ({ controller }, requestIndex) => {
          if (controller.signal.aborted) {
            canceledCount += 1
            return null
          }

          try {
            const generated = await this.generateRequestWithRetries({
              input,
              run,
              model,
              endpoint,
              apiKey,
              referenceImages,
              requestSignal: controller.signal,
              requestIndex,
              maxRetries,
              generationTimeoutSeconds,
              startedAtMs
            })
            if (!generated.image) {
              items.push(generated.item)
              return generated.item
            }

            const id = randomUUID()
            const savedImage = await this.saveImage(id, generated.image, input.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT)
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
              retryAttempt: generated.retryAttempt,
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
                requestIndex,
                retryAttempt: maxRetries,
                maxRetries
              }, new Date().toISOString(), durationMs)
              items.push(item)
              return item
            }

            const item = this.createFailureItem(input, run, model, error instanceof Error ? error.message : 'Image generation failed.', 'exception', {
              exception: serializeError(error),
              requestIndex,
              retryAttempt: maxRetries,
              maxRetries
            }, new Date().toISOString(), durationMs)
            items.push(item)
            return item
          }
        }
      )

      const failedCount = items.length - succeededCount
      const errorMessage = failedCount > 0 && succeededCount === 0
        ? (canceledCount === failedCount ? 'Generation canceled.' : 'Image generation failed.')
        : null
      const errorDetails = errorMessage ? createErrorDetails({ ...input, model, generationTimeoutSeconds }, canceledCount === failedCount ? 'canceled' : 'batch-failed', {
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
    await mkdir(this.database.imagesDir, { recursive: true })
    if (image.b64_json) {
      const filePath = join(this.database.imagesDir, `${id}${extensionFromOutputFormat(outputFormat)}`)
      const fileBuffer = Buffer.from(image.b64_json, 'base64')
      await writeFile(filePath, fileBuffer)
      return { filePath, fileSizeBytes: fileBuffer.length }
    }

    if (image.url) {
      const dataUrlImage = parseImageDataUrl(image.url)
      if (dataUrlImage) {
        const filePath = join(this.database.imagesDir, `${id}${extensionFromContentType(dataUrlImage.contentType) || extensionFromOutputFormat(outputFormat)}`)
        const fileBuffer = Buffer.from(dataUrlImage.base64, 'base64')
        await writeFile(filePath, fileBuffer)
        return { filePath, fileSizeBytes: fileBuffer.length }
      }

      const response = await fetch(image.url)
      if (!response.ok) throw new Error(`Unable to download generated image: HTTP ${response.status}.`)
      const contentType = response.headers.get('content-type') || ''
      const urlPath = new URL(image.url).pathname
      const extension = extensionFromContentType(contentType) || extname(urlPath) || '.png'
      const filePath = join(this.database.imagesDir, `${id}${extension}`)
      const fileBuffer = Buffer.from(await response.arrayBuffer())
      await writeFile(filePath, fileBuffer)
      return { filePath, fileSizeBytes: fileBuffer.length }
    }

    throw new Error('The image API response did not include b64_json or url.')
  }

  private async requestImageBatch(
    endpoint: string,
    apiKey: string,
    input: GenerateImageInput,
    referenceImages: ReferenceImage[],
    scope: RequestAbortScope,
    diagnostics: ImageRequestDiagnostics = {}
  ): Promise<ImageRequestResult> {
    if (referenceImages.length > 0) {
      return this.requestImageEditBatch(endpoint, apiKey, input, referenceImages, scope, diagnostics)
    }

    const attempt = createLinkedAbortController(scope.signal)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: attempt.signal,
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
          parseError,
          ...diagnostics
        })
      }

      if (input.stream && contentType.includes('text/event-stream')) {
        const streamed = await this.readStreamedImageData(response, attempt.controller)
        if (streamed.images.length > 0 || scope.signal.aborted) {
          return { images: streamed.images, diagnostics }
        }

        const nextDiagnostics = withStreamFallbackDiagnostics(
          diagnostics,
          streamed.timedOut ? 'stream-idle-timeout' : 'stream-empty'
        )
        return this.requestImageBatch(endpoint, apiKey, disableStreaming(input), referenceImages, scope, nextDiagnostics)
      }

      const responseText = await response.text()
      const { payload } = this.parseResponse(responseText)
      return { images: payload.data || [], diagnostics }
    } finally {
      attempt.cleanup()
    }
  }

  private async generateRequestWithRetries({
    input,
    run,
    model,
    endpoint,
    apiKey,
    referenceImages,
    requestSignal,
    requestIndex,
    maxRetries,
    generationTimeoutSeconds,
    startedAtMs
  }: {
    input: GenerateImageInput
    run: GenerationRun
    model: string
    endpoint: string
    apiKey: string
    referenceImages: ReferenceImage[]
    requestSignal: AbortSignal
    requestIndex: number
    maxRetries: number
    generationTimeoutSeconds: number
    startedAtMs: number
  }): Promise<
    | { image: ImageResponseData; retryAttempt: number }
    | { image: null; item: ImageHistoryItem; retryAttempt: number }
  > {
    for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt += 1) {
      if (requestSignal.aborted) {
        throw requestSignal.reason || new DOMException('Aborted', 'AbortError')
      }
      if (retryAttempt > 0) {
        this.database.updateRunRetryAttempt(run.id, requestIndex, retryAttempt)
      }

      const attemptScope = createRequestAbortScope(requestSignal, generationTimeoutSeconds * 1000)
      try {
        const attemptedAt = new Date().toISOString()
        const requestResult = await this.requestImageBatch(
          endpoint,
          apiKey,
          { ...input, model, n: 1, maxRetries },
          referenceImages,
          attemptScope
        )
        const image = requestResult.images.at(-1)
        if (image) {
          return { image, retryAttempt }
        }

        const retryFailure = {
          errorMessage: 'The image API returned no images.',
          errorDetails: createErrorDetails({ ...input, model, generationTimeoutSeconds }, 'empty-data', {
            endpoint,
            requestIndex,
            retryAttempt,
            maxRetries,
            ...requestResult.diagnostics
          }),
          createdAt: attemptedAt
        }
        this.database.updateRunRetryFailure(run.id, requestIndex, retryFailure)
        if (retryAttempt < maxRetries) continue

        const durationMs = elapsedMs(startedAtMs)
        const item = this.createFailureItem(input, run, model, retryFailure.errorMessage, 'empty-data', {
          endpoint,
          requestIndex,
          retryAttempt,
          maxRetries,
          ...requestResult.diagnostics
        }, retryFailure.createdAt, durationMs, retryFailure.errorDetails)
        return { image: null, item, retryAttempt }
      } catch (error) {
        if (requestSignal.aborted) {
          throw error
        }

        const durationMs = elapsedMs(startedAtMs)
        if (attemptScope.timedOut()) {
          const errorMessage = buildGenerationTimeoutMessage(generationTimeoutSeconds)
          const retryFailure = {
            errorMessage,
            errorDetails: createErrorDetails({ ...input, model, generationTimeoutSeconds }, 'timeout', {
              endpoint,
              requestIndex,
              retryAttempt,
              maxRetries,
              timeoutMs: generationTimeoutSeconds * 1000
            }),
            createdAt: new Date().toISOString()
          }
          this.database.updateRunRetryFailure(run.id, requestIndex, retryFailure)
          if (retryAttempt < maxRetries) continue
          const item = this.createFailureItem(input, run, model, retryFailure.errorMessage, 'timeout', {
            endpoint,
            requestIndex,
            retryAttempt,
            maxRetries,
            timeoutMs: generationTimeoutSeconds * 1000
          }, retryFailure.createdAt, durationMs, retryFailure.errorDetails)
          return { image: null, item, retryAttempt }
        }

        if (error instanceof ImageHttpError) {
          const retryFailure = {
            errorMessage: error.message,
            errorDetails: createErrorDetails({ ...input, model, generationTimeoutSeconds }, 'http', {
              ...error.details,
              requestIndex,
              retryAttempt,
              maxRetries
            }),
            createdAt: new Date().toISOString()
          }
          this.database.updateRunRetryFailure(run.id, requestIndex, retryFailure)
          if (retryAttempt < maxRetries) continue
          const item = this.createFailureItem(input, run, model, retryFailure.errorMessage, 'http', {
            ...error.details,
            requestIndex,
            retryAttempt,
            maxRetries
          }, retryFailure.createdAt, durationMs, retryFailure.errorDetails)
          return { image: null, item, retryAttempt }
        }

        const errorMessage = error instanceof Error ? error.message : 'Image generation failed.'
        const retryFailure = {
          errorMessage,
          errorDetails: createErrorDetails({ ...input, model, generationTimeoutSeconds }, 'exception', {
            exception: serializeError(error),
            requestIndex,
            retryAttempt,
            maxRetries
          }),
          createdAt: new Date().toISOString()
        }
        this.database.updateRunRetryFailure(run.id, requestIndex, retryFailure)
        if (retryAttempt < maxRetries) continue
        const item = this.createFailureItem(input, run, model, retryFailure.errorMessage, 'exception', {
          exception: serializeError(error),
          requestIndex,
          retryAttempt,
          maxRetries
        }, retryFailure.createdAt, durationMs, retryFailure.errorDetails)
        return { image: null, item, retryAttempt }
      } finally {
        attemptScope.cleanup()
      }
    }

    throw new Error('Image generation retry loop exited unexpectedly.')
  }

  private async requestImageEditBatch(
    endpoint: string,
    apiKey: string,
    input: GenerateImageInput,
    referenceImages: ReferenceImage[],
    scope: RequestAbortScope,
    diagnostics: ImageRequestDiagnostics = {}
  ): Promise<ImageRequestResult> {
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
    if (input.stream && input.partialImages != null && Number.isFinite(input.partialImages) && input.partialImages > 0) {
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

    const attempt = createLinkedAbortController(scope.signal)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: attempt.signal,
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
          parseError,
          ...diagnostics
        })
      }

      if (input.stream && contentType.includes('text/event-stream')) {
        const streamed = await this.readStreamedImageData(response, attempt.controller)
        if (streamed.images.length > 0 || scope.signal.aborted) {
          return { images: streamed.images, diagnostics }
        }

        const nextDiagnostics = withStreamFallbackDiagnostics(
          diagnostics,
          streamed.timedOut ? 'stream-idle-timeout' : 'stream-empty'
        )
        return this.requestImageEditBatch(endpoint, apiKey, disableStreaming(input), referenceImages, scope, nextDiagnostics)
      }

      const responseText = await response.text()
      const { payload } = this.parseResponse(responseText)
      return { images: payload.data || [], diagnostics }
    } finally {
      attempt.cleanup()
    }
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
      retryAttempt: typeof details.retryAttempt === 'number' ? details.retryAttempt : 0,
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

  private async readStreamedImageData(response: Response, attemptController: AbortController): Promise<StreamedImageDataResult> {
    if (!response.body) {
      throw new Error('The image stream response had no body.')
    }

    let latestImage: ImageResponseData | null = null
    let lastImageAt = Date.now()
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const consumePayload = (data: string) => {
      const trimmed = data.trim()
      if (!trimmed || trimmed === '[DONE]') return
      for (const payload of parseStreamPayloads(trimmed)) {
        const images = extractImageResponseData(payload)
        if (images.length > 0) {
          latestImage = images.at(-1) || latestImage
          lastImageAt = Date.now()
        }
      }
    }

    const consumeBlock = (block: string) => {
      const dataLines = block
        .split('\n')
        .filter((line) => line.trimStart().startsWith('data:'))
        .map((line) => line.trimStart().slice(5).trimStart())
      if (dataLines.length > 0) {
        consumePayload(dataLines.join('\n'))
        return
      }

      for (const line of block.split('\n')) {
        consumePayload(line)
      }
    }

    while (true) {
      const remainingMs = STREAM_IDLE_TIMEOUT_MS - (Date.now() - lastImageAt)
      if (remainingMs <= 0) {
        await cancelStreamReader(reader, attemptController)
        return { images: latestImage ? [latestImage] : [], timedOut: true }
      }

      const result = await readStreamChunk(reader, remainingMs, attemptController.signal)
      if (result.timedOut) {
        await cancelStreamReader(reader, attemptController)
        return { images: latestImage ? [latestImage] : [], timedOut: true }
      }

      const { done, value } = result.chunk
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

    return { images: latestImage ? [latestImage] : [], timedOut: false }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<unknown>
): Promise<void> {
  const workerCount = Math.min(items.length, Math.max(1, concurrency))
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex
        nextIndex += 1
        if (index >= items.length) return
        await worker(items[index] as T, index)
      }
    })
  )
}

function createRequestAbortScope(userSignal: AbortSignal, timeoutMs: number): RequestAbortScope {
  const controller = new AbortController()
  let timedOut = false
  const abortFromUser = () => controller.abort(userSignal.reason)
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('Image generation timed out.', 'TimeoutError'))
  }, timeoutMs)

  if (userSignal.aborted) {
    abortFromUser()
  } else {
    userSignal.addEventListener('abort', abortFromUser, { once: true })
  }

  return {
    signal: controller.signal,
    userSignal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout)
      userSignal.removeEventListener('abort', abortFromUser)
    }
  }
}

function createLinkedAbortController(parentSignal: AbortSignal): {
  controller: AbortController
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort(parentSignal.reason)
  if (parentSignal.aborted) {
    abortFromParent()
  } else {
    parentSignal.addEventListener('abort', abortFromParent, { once: true })
  }
  return {
    controller,
    signal: controller.signal,
    cleanup: () => parentSignal.removeEventListener('abort', abortFromParent)
  }
}

function withStreamFallbackDiagnostics(
  diagnostics: ImageRequestDiagnostics,
  reason: 'stream-idle-timeout' | 'stream-empty'
): ImageRequestDiagnostics {
  return {
    ...diagnostics,
    streamFallback: {
      reason,
      fallbackExecuted: true,
      idleTimeoutMs: STREAM_IDLE_TIMEOUT_MS
    }
  }
}

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  signal: AbortSignal
): Promise<
  | { timedOut: false; chunk: ReadableStreamReadResult<Uint8Array> }
  | { timedOut: true }
> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let cleanupAbort = (): void => undefined
  try {
    if (signal.aborted) {
      throw signal.reason || new DOMException('Aborted', 'AbortError')
    }
    return await Promise.race([
      reader.read().then((chunk) => ({ timedOut: false as const, chunk })),
      new Promise<{ timedOut: true }>((resolve) => {
        timeout = setTimeout(() => resolve({ timedOut: true }), Math.max(0, timeoutMs))
      }),
      new Promise<never>((_resolve, reject) => {
        const abort = () => {
          void reader.cancel().catch(() => undefined)
          reject(signal.reason || new DOMException('Aborted', 'AbortError'))
        }
        signal.addEventListener('abort', abort, { once: true })
        cleanupAbort = () => signal.removeEventListener('abort', abort)
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
    cleanupAbort()
  }
}

async function cancelStreamReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  attemptController: AbortController
): Promise<void> {
  attemptController.abort(new DOMException('Image stream idle timeout.', 'TimeoutError'))
  try {
    await reader.cancel()
  } catch {
    // The fetch abort may already have closed the stream.
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

function parseImageDataUrl(value: string): { contentType: string; base64: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value.trim())
  return match ? { contentType: match[1], base64: match[2] } : null
}

function disableStreaming(input: GenerateImageInput): GenerateImageInput {
  return {
    ...input,
    stream: false,
    partialImages: undefined
  }
}

function buildGenerationTimeoutMessage(timeoutSeconds: number): string {
  return `Image generation timed out after ${timeoutSeconds} seconds.`
}

function normalizeRetryCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_IMAGE_MAX_RETRIES
  return Math.min(MAX_IMAGE_MAX_RETRIES, Math.max(0, Math.trunc(value)))
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
    const directBase64 = getImageBase64Value(record)
    const directUrl = getImageUrlValue(record)
    if (directBase64 || directUrl) {
      images.push({
        ...(directBase64 ? { b64_json: directBase64 } : {}),
        ...(directUrl ? { url: directUrl } : {})
      })
    }

    for (const child of Object.values(record)) {
      visit(child)
    }
  }

  visit(value)
  return images
}

function parseStreamPayloads(data: string): unknown[] {
  const parsed = tryParseJson(data)
  if (parsed !== null) return [parsed]

  return data
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => tryParseJson(line))
    .filter((value): value is unknown => value !== null)
}

function tryParseJson(value: string): unknown | null {
  if (!value.startsWith('{') && !value.startsWith('[')) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function getImageBase64Value(record: Record<string, unknown>): string | null {
  const directKeys = ['b64_json', 'b64', 'base64', 'image_b64', 'image_base64', 'partial_image_b64']
  for (const key of directKeys) {
    const value = normalizeBase64Image(record[key])
    if (value) return value
  }

  for (const [key, value] of Object.entries(record)) {
    if (!isImageLikeKey(key)) continue
    const normalized = normalizeBase64Image(value)
    if (normalized) return normalized
  }
  return null
}

function getImageUrlValue(record: Record<string, unknown>): string | null {
  const directKeys = ['url', 'image_url', 'output_url']
  for (const key of directKeys) {
    const value = normalizeImageUrl(record[key])
    if (value) return value
  }

  for (const [key, value] of Object.entries(record)) {
    if (!isImageLikeKey(key)) continue
    const normalized = normalizeImageUrl(value)
    if (normalized) return normalized
  }
  return null
}

function normalizeBase64Image(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const dataUrlMatch = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(value.trim())
  const candidate = dataUrlMatch ? dataUrlMatch[1] : value.trim()
  if (candidate.length < 80) return null
  if (!/^[A-Za-z0-9+/=_-]+$/.test(candidate)) return null
  return candidate
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed
  return null
}

function isImageLikeKey(key: string): boolean {
  return /image|img|picture|output|result/i.test(key)
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
