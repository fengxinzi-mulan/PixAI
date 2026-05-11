import { describe, expect, it } from 'vitest'
import { canCreateEditableOption, normalizeEditableOptions, toggleEditableMultiValue } from './EditableSelect'

describe('editable select helpers', () => {
  it('only recommends creating an option when input is non-empty and no candidate matches', () => {
    const options = normalizeEditableOptions(['商业海报', '人物肖像'])

    expect(canCreateEditableOption('', options, true)).toBe(false)
    expect(canCreateEditableOption('商业海报', options, true)).toBe(false)
    expect(canCreateEditableOption(' 商业海报 ', options, true)).toBe(false)
    expect(canCreateEditableOption('商业', options, true)).toBe(false)
    expect(canCreateEditableOption('新分类', options, true)).toBe(true)
    expect(canCreateEditableOption('新分类', options, false)).toBe(false)
  })

  it('does not recommend creating when the input already matches candidate text partially', () => {
    const options = normalizeEditableOptions(['表情包', '角色贴纸'])

    expect(canCreateEditableOption('表情', options, true)).toBe(false)
    expect(canCreateEditableOption('贴纸', options, true)).toBe(false)
    expect(canCreateEditableOption('美食', options, true)).toBe(true)
  })

  it('normalizes string options and removes empty duplicates', () => {
    expect(normalizeEditableOptions(['广告', '广告', ' ', '肖像'])).toEqual([
      { value: '广告', label: '广告' },
      { value: '肖像', label: '肖像' }
    ])
  })

  it('toggles multi values without duplicate case-insensitive entries', () => {
    expect(toggleEditableMultiValue(['广告'], '肖像')).toEqual(['广告', '肖像'])
    expect(toggleEditableMultiValue(['广告', '肖像'], '广告')).toEqual(['肖像'])
    expect(toggleEditableMultiValue(['广告'], ' 广告 ')).toEqual([])
  })
})
