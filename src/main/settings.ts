import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { safeStorage } from 'electron'
import { DEFAULT_MODEL } from '@shared/image-options'
import type { ProviderSettings, ProviderSettingsUpdate } from '@shared/types'

type SettingsFile = {
  baseURL: string
  defaultModel: string
  encryptedApiKey?: string
  plainApiKey?: string
  insecureStorage?: boolean
}

const defaultSettings: SettingsFile = {
  baseURL: 'https://api.openai.com',
  defaultModel: DEFAULT_MODEL,
  insecureStorage: false
}

export class SettingsStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  getPublicSettings(): ProviderSettings {
    const settings = this.read()
    return {
      baseURL: settings.baseURL,
      defaultModel: settings.defaultModel,
      apiKeyStored: Boolean(settings.encryptedApiKey || settings.plainApiKey),
      insecureStorage: Boolean(settings.insecureStorage)
    }
  }

  getApiKey(): string | null {
    const settings = this.read()
    if (settings.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64'))
    }
    return settings.plainApiKey || null
  }

  update(input: ProviderSettingsUpdate): ProviderSettings {
    const current = this.read()
    const next: SettingsFile = {
      ...current,
      ...(input.baseURL !== undefined ? { baseURL: input.baseURL.trim().replace(/\/+$/, '') || defaultSettings.baseURL } : {}),
      ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel.trim() || DEFAULT_MODEL } : {})
    }

    if (input.apiKey !== undefined) {
      const key = input.apiKey?.trim() || ''
      delete next.encryptedApiKey
      delete next.plainApiKey
      next.insecureStorage = false
      if (key && safeStorage.isEncryptionAvailable()) {
        next.encryptedApiKey = safeStorage.encryptString(key).toString('base64')
      } else if (key) {
        next.plainApiKey = key
        next.insecureStorage = true
      }
    }

    this.write(next)
    return this.getPublicSettings()
  }

  private read(): SettingsFile {
    if (!existsSync(this.filePath)) return defaultSettings
    try {
      return { ...defaultSettings, ...JSON.parse(readFileSync(this.filePath, 'utf8')) }
    } catch {
      return defaultSettings
    }
  }

  private write(settings: SettingsFile): void {
    writeFileSync(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  }
}
