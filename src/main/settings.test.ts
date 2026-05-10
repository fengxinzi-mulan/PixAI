import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { SettingsStore } from './settings'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8')
  }
}))

describe('settings store', () => {
  it('uses a separate default prompt assistant model', () => {
    const store = createStore()

    expect(store.getPublicSettings()).toMatchObject({
      defaultModel: 'gpt-image-2',
      promptModel: 'gpt-5.4-mini'
    })
  })

  it('updates prompt model without changing image model', () => {
    const store = createStore()

    const settings = store.update({ promptModel: 'gpt-5.4' })

    expect(settings.defaultModel).toBe('gpt-image-2')
    expect(settings.promptModel).toBe('gpt-5.4')
    expect(store.getPublicSettings().promptModel).toBe('gpt-5.4')
  })
})

function createStore(): SettingsStore {
  return new SettingsStore(join(mkdtempSync(join(tmpdir(), 'pixai-settings-test-')), 'settings.json'))
}
