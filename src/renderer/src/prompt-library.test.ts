import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clonePromptTemplate,
  createEmptyPromptTemplateInput,
  createPromptLibraryItem,
  deletePromptLibraryItem,
  filterPromptTemplates,
  getPromptLibraryItems,
  getPromptTemplateCategories,
  PROMPT_TEMPLATES,
  updatePromptLibraryItem
} from './prompt-library'

describe('prompt library', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: createLocalStorageMock()
      },
      configurable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true
    })
  })

  it('seeds builtin templates into local storage on first access', () => {
    window.localStorage.clear()

    const items = getPromptLibraryItems()

    expect(items).toHaveLength(PROMPT_TEMPLATES.length)
    expect(items[0].prompt).toContain('奢华腕表广告海报')
  })

  it('returns sorted unique categories', () => {
    expect(getPromptTemplateCategories(PROMPT_TEMPLATES)).toEqual([
      '商业海报',
      '产品摄影',
      '人物肖像',
      '时尚编辑',
      '运动广告',
      '故事板',
      '贴纸包',
      '信息图',
      '空间设计',
      '食物摄影',
      '电影封面',
      'UI 视觉'
    ])
  })

  it('filters by query, category, ratio and quality', () => {
    expect(filterPromptTemplates(PROMPT_TEMPLATES, { query: '贴纸' }).map((template) => template.id)).toEqual(['sticker-sheet'])
    expect(filterPromptTemplates(PROMPT_TEMPLATES, { category: '产品摄影', ratio: '4:3' }).map((template) => template.id)).toEqual(['minimal-product-shot'])
    expect(filterPromptTemplates(PROMPT_TEMPLATES, { quality: 'medium' }).map((template) => template.id)).toEqual([
      'storyboard-grid',
      'infographic-product',
      'glass-ui-card'
    ])
  })

  it('keeps prompt text and resolution together', () => {
    const template = PROMPT_TEMPLATES[0]
    expect(template.prompt).toContain('奢华腕表广告海报')
    expect(template.resolution).toBe('1024x1024')
  })

  it('supports create update and delete operations for templates', () => {
    window.localStorage.clear()
    getPromptLibraryItems()

    const created = createPromptLibraryItem({
      ...createEmptyPromptTemplateInput(),
      title: '自定义模板',
      category: '测试分类',
      description: '测试说明',
      prompt: '中文提示词',
      tags: ['测试'],
      ratio: '1:1',
      resolution: '1024x1024',
      quality: 'high'
    })
    expect(created.prompt).toBe('中文提示词')
    expect(getPromptLibraryItems().some((item) => item.id === created.id)).toBe(true)

    const builtin = getPromptLibraryItems().find((item) => item.id === 'sticker-sheet')
    expect(builtin).toBeTruthy()
    const updated = updatePromptLibraryItem('sticker-sheet', {
      ...clonePromptTemplate(builtin!),
      title: '贴纸包（已更新）'
    })
    expect(updated.title).toBe('贴纸包（已更新）')

    deletePromptLibraryItem(created.id)
    expect(getPromptLibraryItems().some((item) => item.id === created.id)).toBe(false)
  })
})

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    }
  } as Storage
}
