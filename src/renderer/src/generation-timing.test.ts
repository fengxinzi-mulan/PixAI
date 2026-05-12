import { describe, expect, it } from 'vitest'
import { getGenerationAttemptStartedAt } from './generation-timing'

describe('generation timing helper', () => {
  it('prefers the latest retry failure timestamp when present', () => {
    expect(getGenerationAttemptStartedAt(1000, '1970-01-01T00:00:05.000Z')).toBe(5000)
  })

  it('falls back to the base start time when retry failure timestamp is absent or invalid', () => {
    expect(getGenerationAttemptStartedAt(1000, null)).toBe(1000)
    expect(getGenerationAttemptStartedAt(1000, 'not-a-date')).toBe(1000)
  })
})
