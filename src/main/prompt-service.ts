import type { PromptAssistInput } from '@shared/types'
import type { SettingsStore } from './settings'

type ResponsesApiPayload = {
  output_text?: string
  output?: Array<{
    content?: Array<{ text?: string } | string> | string
  }>
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export class PromptService {
  constructor(private readonly settings: SettingsStore) {}

  inspire(input: PromptAssistInput = {}): Promise<string> {
    return this.requestPrompt([
      '请生成一条可直接用于图像生成的中文提示词。',
      '提示词需要包含主体、场景、构图、光线、风格、细节与氛围。',
      input.hasReferenceImages ? '当前会话包含参考图，请提示保留参考图主体和风格方向。' : '',
      '只输出提示词正文，不要解释，不要加标题。'
    ].filter(Boolean).join('\n'))
  }

  enrich(input: PromptAssistInput & { prompt: string }): Promise<string> {
    const prompt = input.prompt.trim()
    if (!prompt) throw new Error('Prompt is required.')
    return this.requestPrompt([
      '请丰富并优化下面的图像生成提示词。',
      '保持用户原意和核心主体不变，跟随原提示词语言输出。',
      '补充视觉细节、镜头/构图、材质、光影、风格描述。',
      input.hasReferenceImages ? '当前会话包含参考图，请保留参考图主体和风格方向。' : '',
      '只输出优化后的提示词正文，不要解释，不要加标题。',
      '',
      prompt
    ].filter((line) => line !== '').join('\n'))
  }

  private async requestPrompt(instruction: string): Promise<string> {
    const publicSettings = this.settings.getPublicSettings()
    const apiKey = this.settings.getApiKey()
    if (!apiKey) throw new Error('API key is not configured.')

    const response = await fetch(buildResponsesEndpoint(publicSettings.baseURL), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: publicSettings.promptModel,
        input: [
          {
            role: 'system',
            content: '你是专业图像生成提示词助手，输出简洁、具体、可直接用于生成图片的提示词。'
          },
          {
            role: 'user',
            content: instruction
          }
        ],
        max_output_tokens: 700
      })
    })
    const responseText = await response.text()
    const payload = parseResponsesPayload(responseText)

    if (!response.ok) {
      throw new Error(payload.error?.message || `Prompt generation failed with HTTP ${response.status}.`)
    }

    const prompt = sanitizePromptText(extractResponseText(payload))
    if (!prompt) throw new Error('Prompt generation returned no text.')
    return prompt
  }
}

function buildResponsesEndpoint(baseURL: string): string {
  return `${baseURL.trim().replace(/\/+$/, '')}/v1/responses`
}

function parseResponsesPayload(responseText: string): ResponsesApiPayload {
  if (!responseText.trim()) return {}
  try {
    return JSON.parse(responseText) as ResponsesApiPayload
  } catch {
    return {}
  }
}

function extractResponseText(payload: ResponsesApiPayload): string {
  if (typeof payload.output_text === 'string') return payload.output_text
  for (const output of payload.output || []) {
    if (typeof output.content === 'string') return output.content
    for (const content of output.content || []) {
      if (typeof content === 'string') return content
      if (typeof content.text === 'string') return content.text
    }
  }
  return payload.choices?.find((choice) => typeof choice.message?.content === 'string')?.message?.content || ''
}

function sanitizePromptText(value: string): string {
  const trimmed = value.trim()
  const fenceMatch = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/)
  return (fenceMatch?.[1] || trimmed).trim()
}
