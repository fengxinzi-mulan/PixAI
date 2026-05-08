/// <reference types="vite/client" />

import type { PixAIAPI } from '@shared/types'

declare global {
  interface Window {
    pixai: PixAIAPI
  }
}
