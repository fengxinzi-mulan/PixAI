import { useEffect, useState, type JSX } from 'react'
import { Settings } from 'lucide-react'
import { IMAGE_QUALITIES, IMAGE_RATIOS } from '@shared/image-options'
import type { ImageQuality, ImageRatio } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'

const ratios: ImageRatio[] = IMAGE_RATIOS
const qualities: ImageQuality[] = IMAGE_QUALITIES

export function SettingsPanel(): JSX.Element {
  const { settings, conversations, activeConversationId, updateActiveConversation, updateSettings } = useAppStore()
  const conversation = conversations.find((item) => item.id === activeConversationId) || null
  const [baseURL, setBaseURL] = useState(settings?.baseURL || 'https://api.openai.com')
  const [defaultModel, setDefaultModel] = useState(settings?.defaultModel || 'gpt-image-2')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    if (settings) {
      setBaseURL(settings.baseURL)
      setDefaultModel(settings.defaultModel)
    }
  }, [settings])

  if (!conversation) return <aside className="inspector" />

  return (
    <aside className="inspector">
      <div className="config-stack">
        <section className="panel">
          <h3>
            服务配置
            <span className={`pill ${settings?.apiKeyStored ? 'good' : 'warn'}`}>{settings?.apiKeyStored ? '已配置' : '未配置'}</span>
          </h3>
          <label className="field">
            <span>Base URL</span>
            <input className="input-control" value={baseURL} onChange={(event) => setBaseURL(event.target.value)} />
          </label>
          <label className="field">
            <span>API Key</span>
            <input
              className="input-control"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder={settings?.apiKeyStored ? '已保存，留空不修改' : 'sk-...'}
            />
          </label>
          <label className="field">
            <span>默认模型</span>
            <input className="input-control" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} />
          </label>
          {settings?.insecureStorage ? <div className="status-error">当前系统无法加密，API Key 已降级保存在本地设置文件中。</div> : null}
          <button
            className="primary full"
            onClick={() => {
              void updateSettings({ baseURL, defaultModel, apiKey: apiKey.trim() ? apiKey : undefined })
              setApiKey('')
            }}
          >
            <Settings size={15} />
            保存服务配置
          </button>
        </section>
        <section className="panel">
          <h3>当前会话参数</h3>
          <label className="field">
            <span>模型</span>
            <input
              className="input-control"
              value={conversation.model}
              onChange={(event) => void updateActiveConversation({ model: event.target.value })}
            />
          </label>
          <div className="field">
            <span>图片比例</span>
            <div className="segmented">
              {ratios.map((ratio) => (
                <button
                  key={ratio}
                  className={conversation.ratio === ratio ? 'on' : ''}
                  onClick={() => void updateActiveConversation({ ratio })}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>质量</span>
            <div className="segmented">
              {qualities.map((quality) => (
                <button
                  key={quality}
                  className={conversation.quality === quality ? 'on' : ''}
                  onClick={() => void updateActiveConversation({ quality })}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>生成数量</span>
            <input
              className="input-control"
              type="number"
              min={1}
              max={10}
              value={conversation.n}
              onChange={(event) => void updateActiveConversation({ n: Number(event.target.value) })}
            />
          </label>
          <ToggleRow
            label="自动写入历史"
            checked={conversation.autoSaveHistory}
            onChange={() => void updateActiveConversation({ autoSaveHistory: !conversation.autoSaveHistory })}
          />
          <ToggleRow
            label="失败详情保留"
            checked={conversation.keepFailureDetails}
            onChange={() => void updateActiveConversation({ keepFailureDetails: !conversation.keepFailureDetails })}
          />
        </section>
      </div>
    </aside>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }): JSX.Element {
  return (
    <button className="toggle-row" onClick={onChange}>
      <span>{label}</span>
      <span className={`switch ${checked ? '' : 'off'}`} />
    </button>
  )
}
