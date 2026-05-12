export function getGenerationAttemptStartedAt(
  startedAt: number | null | undefined,
  retryFailureCreatedAt: string | null | undefined
): number | null {
  const retryStartedAt = retryFailureCreatedAt ? Date.parse(retryFailureCreatedAt) : NaN
  if (Number.isFinite(retryStartedAt)) return retryStartedAt
  return typeof startedAt === 'number' && Number.isFinite(startedAt) ? startedAt : null
}
