import type { GenerationRunRetryFailure } from '@shared/types'

export function shouldShowFailedImageRetryChip(_retryAttempt: number): boolean {
  return false
}

export function shouldShowRetryAttemptChip({
  retryAttempt,
  maxRetries,
  retryFailure
}: {
  retryAttempt: number
  maxRetries: number
  retryFailure: Pick<GenerationRunRetryFailure, 'errorDetails'> | null
}): boolean {
  if (retryAttempt <= 0) return false
  const failedRetryAttempt = getRetryFailureAttempt(retryFailure)
  return failedRetryAttempt === null || failedRetryAttempt < maxRetries || retryAttempt > maxRetries
}

function getRetryFailureAttempt(retryFailure: Pick<GenerationRunRetryFailure, 'errorDetails'> | null): number | null {
  if (!retryFailure?.errorDetails) return null
  try {
    const payload = JSON.parse(retryFailure.errorDetails) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const details = (payload as Record<string, unknown>).details
    if (!details || typeof details !== 'object' || Array.isArray(details)) return null
    const retryAttempt = (details as Record<string, unknown>).retryAttempt
    return typeof retryAttempt === 'number' && Number.isFinite(retryAttempt) ? retryAttempt : null
  } catch {
    return null
  }
}
