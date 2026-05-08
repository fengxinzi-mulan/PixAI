import { describe, expect, it } from 'vitest'
import { elapsedMs, formatDuration } from './duration'

describe('duration helpers', () => {
  it('formats short durations as seconds', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(850)).toBe('0s')
    expect(formatDuration(12_300)).toBe('12s')
  })

  it('formats longer durations as minutes and seconds', () => {
    expect(formatDuration(61_200)).toBe('1m 1s')
    expect(formatDuration(125_000)).toBe('2m 5s')
  })

  it('computes elapsed milliseconds from timestamps', () => {
    expect(elapsedMs(1_000, 4_250)).toBe(3_250)
  })
})
