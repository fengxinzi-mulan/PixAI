import { DEFAULT_IMAGE_OUTPUT_FORMAT, getDefaultImageSize } from '@shared/image-options'
import type { GenerationRun, ImageStatus } from '@shared/types'
import { createErrorDetails } from './error-details'

export const interruptedRunErrorMessage = 'Generation interrupted before completion.'

export type InterruptedRunFailureItem = {
  requestIndex: number
  durationMs: number
  errorMessage: string
  errorDetails: string
  retryAttempt: number
  createdAt: string
}

export type InterruptedRunRecoveryPlan = {
  status: ImageStatus
  durationMs: number
  errorMessage: string | null
  errorDetails: string | null
  failedItems: InterruptedRunFailureItem[]
}

export function createInterruptedRunRecoveryPlan(run: GenerationRun, now = new Date()): InterruptedRunRecoveryPlan {
  const startedAtMs = Date.parse(run.createdAt)
  const durationMs = Number.isFinite(startedAtMs) ? Math.max(0, now.getTime() - startedAtMs) : 0
  const completedIndexes = new Set(
    run.items
      .map((item) => item.requestIndex)
      .filter((requestIndex): requestIndex is number => typeof requestIndex === 'number')
  )
  const missingIndexes = Array.from({ length: Math.max(0, run.n) }, (_value, requestIndex) => requestIndex)
    .filter((requestIndex) => !completedIndexes.has(requestIndex))

  if (missingIndexes.length > 0) {
    const errorDetails = buildInterruptedRunErrorDetails(run, missingIndexes)
    return {
      status: 'failed',
      durationMs,
      errorMessage: interruptedRunErrorMessage,
      errorDetails,
      failedItems: missingIndexes.map((requestIndex) => ({
        requestIndex,
        durationMs,
        errorMessage: interruptedRunErrorMessage,
        errorDetails,
        retryAttempt: run.retryAttempts[requestIndex] || 0,
        createdAt: now.toISOString()
      }))
    }
  }

  const hasFailureItem = run.items.some((item) => item.status === 'failed')
  return {
    status: hasFailureItem ? 'failed' : 'succeeded',
    durationMs,
    errorMessage: hasFailureItem ? interruptedRunErrorMessage : null,
    errorDetails: hasFailureItem ? buildInterruptedRunErrorDetails(run, []) : null,
    failedItems: []
  }
}

function buildInterruptedRunErrorDetails(run: GenerationRun, missingIndexes: number[]): string {
  return createErrorDetails(
    {
      conversationId: run.conversationId,
      prompt: run.prompt,
      model: run.model,
      ratio: run.ratio,
      size: run.size || getDefaultImageSize(run.ratio),
      quality: run.quality,
      n: run.n,
      outputFormat: DEFAULT_IMAGE_OUTPUT_FORMAT,
      stream: false
    },
    'startup-interrupted',
    {
      runId: run.id,
      missingIndexes
    }
  )
}
