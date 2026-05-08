import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ProviderSettings, ProviderSettingsUpdate } from '../shared/types'

type StoredSettings = {
  baseURL: string
  defaultModel: string
  encryptedApiKey: string | null
  plainApiKey: string | null
}

const DEFAULT_SETTINGS: StoredSettings = {
  baseURL: 'https://api.openai.com',
  defaultModel: 'gpt-image-2',
  encryptedApiKey: null,
  plainApiKey: null
}

export class SettingsStore {
  private readonly settingsPath: string

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'settings.json')
    mkdirSync(dirname(this.settingsPath), { recursive: true })
  }

  getPublicSettings(): ProviderSettings {
    const settings = this.read()
    return {
      baseURL: settings.baseURL,
      apiKeyStored: Boolean(settings.encryptedApiKey || settings.plainApiKey),
      defaultModel: settings.defaultModel,
      insecureStorage: Boolean(settings.plainApiKey)
    }
  }

  getApiKey(): string | null {
    const settings = this.read()
    if (settings.encryptedApiKey) {
      try {
        return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64'))
      } catch {
        return null
      }
    }
    return settings.plainApiKey
  }

  update(input: ProviderSettingsUpdate): ProviderSettings {
    const current = this.read()
    const next: StoredSettings = {
      ...current,
      baseURL: input.baseURL?.trim() || current.baseURL,
      defaultModel: input.defaultModel?.trim() || current.defaultModel
    }

    if (input.apiKey !== undefined) {
      const apiKey = input.apiKey?.trim() || null
      next.encryptedApiKey = null
      next.plainApiKey = null

      if (apiKey) {
        if (safeStorage.isEncryptionAvailable()) {
          next.encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64')
        } else {
          next.plainApiKey = apiKey
        }
      }
    }

    this.write(next)
    return this.getPublicSettings()
  }

  private read(): StoredSettings {
    if (!existsSync(this.settingsPath)) {
      this.write(DEFAULT_SETTINGS)
      return { ...DEFAULT_SETTINGS }
    }

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(this.settingsPath, 'utf8')) }
    } catch {
      this.write(DEFAULT_SETTINGS)
      return { ...DEFAULT_SETTINGS }
    }
  }

  private write(settings: StoredSettings): void {
    writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 })
  }
}
