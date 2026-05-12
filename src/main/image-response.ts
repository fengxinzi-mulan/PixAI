export type ImageResponseData = {
  b64_json?: string
  url?: string
}

export async function collectImageData(
  requestedCount: number,
  requestImages: (count: number) => Promise<ImageResponseData[]>
): Promise<ImageResponseData[]> {
  const target = Math.min(10, Math.max(1, requestedCount || 1))
  if (target === 1) {
    return (await requestImages(1)).slice(0, 1)
  }

  const batches: ImageResponseData[][] = []
  for (let index = 0; index < target; index += 1) {
    batches.push(await requestImages(1))
  }

  return batches.flatMap((batch) => batch.slice(0, 1))
}
