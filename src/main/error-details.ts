import type { GenerateImageInput } from '@shared/types'

const MAX_DETAILS_LENGTH = 12_000
const MAX_TEXT_LENGTH = 6_000
const sensitiveKeys = new Set(['apikey', 'api_key', 'authorization', 'auth', 'token'])

export function createErrorDetails(
  input: GenerateImageInput,
  stage: string,
  details: Record<string, unknown>
): string {
  const payload = {
    stage,
    timestamp: new Date().toISOString(),
    request: {
      conversationId: input.conversationId,
      model: input.model,
      ratio: input.ratio,
      size: input.size,
      quality: input.quality,
      n: input.n,
      outputFormat: input.outputFormat ?? null,
      outputCompression: input.outputCompression ?? null,
      background: input.background ?? null,
      moderation: input.moderation ?? null,
      stream: Boolean(input.stream),
      partialImages: input.partialImages ?? null,
      inputFidelity: input.inputFidelity ?? null,
      referenceImageIds: input.referenceImageIds ?? [],
      promptLength: input.prompt.length,
      promptPreview: input.prompt.slice(0, 300),
      referenceImageCount: input.referenceImageIds?.length || 0
    },
    details
  }

  return truncate(
    JSON.stringify(
      payload,
      (key, value) => {
        if (sensitiveKeys.has(key.toLowerCase())) return '[redacted]'
        if (typeof value === 'string') return redactSecrets(truncate(value, MAX_TEXT_LENGTH))
        return value
      },
      2
    ),
    MAX_DETAILS_LENGTH
  )
}

function redactSecrets(value: string): string {
  return value.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [redacted]').replace(/sk-[\w-]+/gi, 'sk-[redacted]')
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
}
