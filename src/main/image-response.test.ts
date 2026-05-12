import { describe, expect, it } from 'vitest'
import { collectImageData } from './image-response'

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('collectImageData', () => {
  it('requests n single-image batches serially', async () => {
    let calls = 0
    let inFlight = 0
    let maxInFlight = 0
    const resolvers: Array<(value: { b64_json?: string }[]) => void> = []

    const promise = collectImageData(3, async (count) => {
      calls += 1
      expect(count).toBe(1)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return await new Promise<{ b64_json?: string }[]>((resolve) => {
        resolvers.push((value) => {
          inFlight -= 1
          resolve(value)
        })
      })
    })

    expect(calls).toBe(1)
    expect(maxInFlight).toBe(1)

    resolvers[0]([{ b64_json: 'image-1' }])
    await nextTask()
    expect(calls).toBe(2)

    resolvers[1]([{ b64_json: 'image-2' }])
    await nextTask()
    expect(calls).toBe(3)

    resolvers[2]([{ b64_json: 'image-3' }])

    await expect(promise).resolves.toEqual([
      { b64_json: 'image-1' },
      { b64_json: 'image-2' },
      { b64_json: 'image-3' }
    ])
  })

  it('uses one request when the provider needs only one image', async () => {
    let calls = 0

    const images = await collectImageData(1, async (count) => {
      calls += 1
      expect(count).toBe(1)
      return [{ url: 'https://example.test/1.png' }]
    })

    expect(calls).toBe(1)
    expect(images).toHaveLength(1)
  })
})
