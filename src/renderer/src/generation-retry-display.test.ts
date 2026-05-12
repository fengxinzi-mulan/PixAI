import { describe, expect, it } from 'vitest'
import { shouldShowFailedImageRetryChip, shouldShowRetryAttemptChip } from './generation-retry-display'

function failureDetails(retryAttempt: number, maxRetries: number): string {
  return JSON.stringify({
    stage: 'timeout',
    details: {
      retryAttempt,
      maxRetries
    }
  })
}

describe('generation retry display', () => {
  it('keeps showing the current retry while the final retry is still running', () => {
    expect(shouldShowRetryAttemptChip({
      retryAttempt: 2,
      maxRetries: 2,
      retryFailure: { errorDetails: failureDetails(1, 2) }
    })).toBe(true)
  })

  it('hides the retry attempt after the final retry has already failed', () => {
    expect(shouldShowRetryAttemptChip({
      retryAttempt: 2,
      maxRetries: 2,
      retryFailure: { errorDetails: failureDetails(2, 2) }
    })).toBe(false)
  })

  it('does not show a retry attempt before any retry starts', () => {
    expect(shouldShowRetryAttemptChip({
      retryAttempt: 0,
      maxRetries: 2,
      retryFailure: null
    })).toBe(false)
  })

  it('does not show retry attempts on final failed image cards', () => {
    expect(shouldShowFailedImageRetryChip(3)).toBe(false)
  })
})
