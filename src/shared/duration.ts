export function elapsedMs(startedAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, nowMs - startedAtMs)
}

export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = Math.floor(safe / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}m ${seconds}s`
}
