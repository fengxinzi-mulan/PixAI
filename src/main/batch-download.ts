import { copyFileSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { BatchDownloadResult, ImageHistoryItem } from '@shared/types'

type HistoryLookup = (id: string) => ImageHistoryItem | null

export function copySelectedHistoryImages(input: {
  ids: string[]
  directory: string
  getHistory: HistoryLookup
}): BatchDownloadResult {
  const ids = Array.from(new Set(input.ids))
  let saved = 0
  let skipped = 0

  for (const id of ids) {
    const item = input.getHistory(id)
    if (item?.status !== 'succeeded' || !item.filePath || !existsSync(item.filePath)) {
      skipped += 1
      continue
    }

    copyFileSync(item.filePath, resolveUniqueTargetPath(input.directory, basename(item.filePath)))
    saved += 1
  }

  return {
    directory: input.directory,
    saved,
    skipped
  }
}

export function resolveUniqueTargetPath(directory: string, fileName: string): string {
  const safeName = basename(fileName) || 'image.png'
  const extension = extname(safeName)
  const baseName = extension ? safeName.slice(0, -extension.length) : safeName
  let targetPath = join(directory, safeName)
  let suffix = 2

  while (existsSync(targetPath)) {
    targetPath = join(directory, `${baseName}-${suffix}${extension}`)
    suffix += 1
  }

  return targetPath
}
