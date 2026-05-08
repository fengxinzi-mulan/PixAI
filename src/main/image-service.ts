import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { GenerateImageInput, GenerateImageResult, GenerationRun } from '../shared/types'
import type { AppDatabase } from './database'
import type { SettingsStore } from './settings'

type ImageResponseData = {
  b64_json?: string
  url?: string
}

type OpenAIImageResponse = {
  data?: ImageResponseData[]
  error?: {
    message?: string
    type?: string
    code?: string
    param?: string
  }
}

const MAX_ERROR_DETAILS_LENGTH = 12_000
const MAX_RESPONSE_BODY_LENGTH = 6_000
const MAX_PROMPT_PREVIEW_LENGTH = 300

export class ImageService {
  constructor(
    private readonly database: AppDatabase,
    private readonly settings: SettingsStore
  ) {}

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const settings = this.settings.getPublicSettings()
    const apiKey = this.settings.getApiKey()
    const model = input.model?.trim() || settings.defaultModel
    const prompt = input.prompt.trim()
    const createdAt = new Date().toISOString()
    const run = this.database.insertRun({
      id: randomUUID(),
      conversationId: input.conversationId,
      prompt,
      model,
      size: input.size || null,
      quality: input.quality || null,
      n: input.n || 1,
      status: 'running',
      errorMessage: null,
      errorDetails: null,
      createdAt
    })

    if (!prompt) {
      return this.saveFailure(input, run, model, 'Prompt is required.', this.errorDetails(input, model, 'validation', {
        reason: 'Prompt is required.'
      }), createdAt)
    }

    if (!apiKey) {
      return this.saveFailure(input, run, model, 'API key is not configured.', this.errorDetails(input, model, 'configuration', {
        reason: 'API key is not configured.'
      }), createdAt)
    }

    try {
      const endpoint = this.endpoint(settings.baseURL)
      const response = await fetch(this.endpoint(settings.baseURL), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.requestBody(input, model))
      })

      const responseText = await response.text()
      const { payload, parseError } = this.parseResponse(responseText)
      if (!response.ok) {
        const errorMessage = payload?.error?.message || `Image generation failed with HTTP ${response.status}.`
        return this.saveFailure(
          input,
          run,
          model,
          errorMessage,
          this.errorDetails(input, model, 'http', {
            endpoint,
            httpStatus: response.status,
            httpStatusText: response.statusText,
            responseError: payload?.error,
            responseBody: responseText,
            parseError
          }),
          createdAt
        )
      }

      if (!payload.data?.length) {
        return this.saveFailure(input, run, model, 'The image API returned no images.', this.errorDetails(input, model, 'empty-data', {
          endpoint,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          responseBody: responseText,
          parseError
        }), createdAt)
      }

      const items = []
      for (const image of payload.data) {
        const id = randomUUID()
        const filePath = await this.saveImage(id, image)
        items.push(
          this.database.insertHistory({
            id,
            conversationId: input.conversationId,
            runId: run.id,
            prompt,
            model,
            size: input.size || null,
            quality: input.quality || null,
            filePath,
            status: 'succeeded',
            errorMessage: null,
            errorDetails: null,
            favorite: false,
            createdAt: new Date().toISOString()
          })
        )
      }

      const completedRun = this.database.updateRun(run.id, { status: 'succeeded', errorMessage: null, errorDetails: null })
      return { run: completedRun, items }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Image generation failed.'
      return this.saveFailure(
        input,
        run,
        model,
        errorMessage,
        this.errorDetails(input, model, 'exception', {
          exception: this.serializeError(error)
        }),
        createdAt
      )
    }
  }

  private requestBody(input: GenerateImageInput, model: string): Record<string, unknown> {
    return {
      prompt: input.prompt.trim(),
      model,
      ...(input.size ? { size: input.size } : {}),
      ...(input.quality ? { quality: input.quality } : {}),
      ...(input.n ? { n: input.n } : {})
    }
  }

  private endpoint(baseURL: string): string {
    return `${baseURL.replace(/\/+$/, '')}/v1/images/generations`
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
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new ImageDownloadError(`Unable to download generated image: HTTP ${response.status}.`, {
          imageUrl: image.url,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          responseBody: body
        })
      }

      const contentType = response.headers.get('content-type') || ''
      const urlPath = new URL(image.url).pathname
      const extension = this.extensionFromContentType(contentType) || extname(urlPath) || '.png'
      const filePath = join(this.database.imagesDir, `${id}${extension}`)
      writeFileSync(filePath, Buffer.from(await response.arrayBuffer()))
      return filePath
    }

    throw new Error('The image API response did not include b64_json or url.')
  }

  private extensionFromContentType(contentType: string): string | null {
    if (contentType.includes('jpeg')) return '.jpg'
    if (contentType.includes('webp')) return '.webp'
    if (contentType.includes('png')) return '.png'
    return null
  }

  private saveFailure(
    input: GenerateImageInput,
    run: GenerationRun,
    model: string,
    errorMessage: string,
    errorDetails: string,
    createdAt: string
  ): GenerateImageResult {
    const item = this.database.insertHistory({
      id: randomUUID(),
      conversationId: input.conversationId,
      runId: run.id,
      prompt: input.prompt.trim(),
      model,
      size: input.size || null,
      quality: input.quality || null,
      filePath: null,
      status: 'failed',
      errorMessage,
      errorDetails,
      favorite: false,
      createdAt
    })
    const failedRun = this.database.updateRun(run.id, { status: 'failed', errorMessage, errorDetails })

    return { run: { ...failedRun, items: [item] }, items: [item], errorMessage, errorDetails }
  }

  private parseResponse(responseText: string): { payload: OpenAIImageResponse; parseError: string | null } {
    if (!responseText.trim()) {
      return { payload: {}, parseError: null }
    }

    try {
      return { payload: JSON.parse(responseText) as OpenAIImageResponse, parseError: null }
    } catch (error) {
      return {
        payload: {},
        parseError: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }
    }
  }

  private errorDetails(
    input: GenerateImageInput,
    model: string,
    stage: string,
    details: Record<string, unknown>
  ): string {
    const payload = {
      stage,
      timestamp: new Date().toISOString(),
      request: {
        conversationId: input.conversationId,
        model,
        size: input.size || null,
        quality: input.quality || null,
        n: input.n || 1,
        promptLength: input.prompt.length,
        promptPreview: input.prompt.slice(0, MAX_PROMPT_PREVIEW_LENGTH)
      },
      ...details
    }

    return this.truncate(this.safeStringify(payload), MAX_ERROR_DETAILS_LENGTH)
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof ImageDownloadError) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        download: {
          imageUrl: error.details.imageUrl,
          httpStatus: error.details.httpStatus,
          httpStatusText: error.details.httpStatusText,
          responseBody: this.truncate(error.details.responseBody, MAX_RESPONSE_BODY_LENGTH)
        }
      }
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    return {
      value: String(error)
    }
  }

  private safeStringify(value: unknown): string {
    return JSON.stringify(
      value,
      (_key, innerValue) => {
        if (typeof innerValue === 'string') {
          return this.truncate(innerValue, MAX_RESPONSE_BODY_LENGTH)
        }
        return innerValue
      },
      2
    )
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value
    }
    return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
  }
}

class ImageDownloadError extends Error {
  readonly details: {
    imageUrl: string
    httpStatus: number
    httpStatusText: string
    responseBody: string
  }

  constructor(message: string, details: ImageDownloadError['details']) {
    super(message)
    this.name = 'ImageDownloadError'
    this.details = details
  }
}
