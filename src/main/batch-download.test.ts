import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImageHistoryItem } from '@shared/types'
import { copySelectedHistoryImages, resolveUniqueTargetPath } from './batch-download'

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pixai-batch-download-test-'))
  tempDirs.push(dir)
  return dir
}

function createHistoryItem(input: Partial<ImageHistoryItem> & Pick<ImageHistoryItem, 'id'>): ImageHistoryItem {
  const { id, ...rest } = input
  return {
    id,
    conversationId: null,
    runId: null,
    prompt: 'prompt',
    model: 'gpt-image-2',
    ratio: '1:1',
    size: '1024x1024',
    quality: 'high',
    requestIndex: null,
    durationMs: null,
    filePath: null,
    fileSizeBytes: null,
    status: 'succeeded',
    errorMessage: null,
    errorDetails: null,
    favorite: false,
    generationMode: 'text-to-image',
    referenceImages: [],
    createdAt: '2026-05-11T00:00:00.000Z',
    ...rest
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('batch download', () => {
  it('copies unique succeeded images and skips failed or missing items', () => {
    const sourceDir = createTempDir()
    const targetDir = createTempDir()
    const firstPath = join(sourceDir, 'first.png')
    const secondPath = join(sourceDir, 'second.jpg')
    writeFileSync(firstPath, 'first')
    writeFileSync(secondPath, 'second')
    const items = new Map([
      ['first', createHistoryItem({ id: 'first', filePath: firstPath })],
      ['second', createHistoryItem({ id: 'second', filePath: secondPath })],
      ['failed', createHistoryItem({ id: 'failed', status: 'failed', errorMessage: 'no image' })],
      ['missing-file', createHistoryItem({ id: 'missing-file', filePath: join(sourceDir, 'missing.png') })]
    ])

    const result = copySelectedHistoryImages({
      ids: ['first', 'first', 'failed', 'missing-file', 'unknown', 'second'],
      directory: targetDir,
      getHistory: (id) => items.get(id) || null
    })

    expect(result).toEqual({ directory: targetDir, saved: 2, skipped: 3 })
    expect(readFileSync(join(targetDir, 'first.png'), 'utf8')).toBe('first')
    expect(readFileSync(join(targetDir, 'second.jpg'), 'utf8')).toBe('second')
  })

  it('does not overwrite existing files in the target directory', () => {
    const sourceDir = createTempDir()
    const targetDir = createTempDir()
    const sourcePath = join(sourceDir, 'image.png')
    writeFileSync(sourcePath, 'new image')
    writeFileSync(join(targetDir, 'image.png'), 'existing image')

    const result = copySelectedHistoryImages({
      ids: ['image'],
      directory: targetDir,
      getHistory: () => createHistoryItem({ id: 'image', filePath: sourcePath })
    })

    expect(result.saved).toBe(1)
    expect(readFileSync(join(targetDir, 'image.png'), 'utf8')).toBe('existing image')
    expect(readFileSync(join(targetDir, 'image-2.png'), 'utf8')).toBe('new image')
  })

  it('increments the conflict suffix until a free file name is found', () => {
    const targetDir = createTempDir()
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'image.webp'), 'one')
    writeFileSync(join(targetDir, 'image-2.webp'), 'two')

    expect(resolveUniqueTargetPath(targetDir, 'image.webp')).toBe(join(targetDir, 'image-3.webp'))
    expect(existsSync(join(targetDir, 'image-3.webp'))).toBe(false)
  })
})
