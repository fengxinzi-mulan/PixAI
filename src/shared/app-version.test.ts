import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { appVersion } from './app-version'

describe('appVersion', () => {
  it('matches package.json version', () => {
    expect(appVersion).toBe(packageJson.version)
  })
})
