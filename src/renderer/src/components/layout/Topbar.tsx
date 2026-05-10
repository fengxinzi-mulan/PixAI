import type { JSX } from 'react'
import { ArrowLeft, Image as ImageIcon, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react'
import { useAppStore } from '@renderer/store/app-store'
import logoUrl from '@renderer/assets/icon.png'

export function Topbar(): JSX.Element {
  const { settings, settingsVisible, view, setView, toggleSettings, createConversation } = useAppStore()
  const endpoint = `${settings?.baseURL || 'https://api.openai.com'}/v1/images/generations`

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">
          <img src={logoUrl} alt="PixAI" />
        </div>
        <div>
          <h1>PixAI</h1>
        </div>
      </div>
      <div className="endpoint">
        <span className={settings?.apiKeyStored ? 'dot good' : 'dot warn'} />
        <span>{settings?.apiKeyStored ? '接口已配置' : '等待配置 API Key'}</span>
        <code>{endpoint}</code>
      </div>
      <div className="top-actions">
        <button onClick={toggleSettings} title={settingsVisible ? '隐藏设置区' : '显示设置区'}>
          {settingsVisible ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          设置
        </button>
        <button onClick={() => setView(view === 'gallery' ? 'workspace' : 'gallery')}>
          {view === 'gallery' ? <ArrowLeft size={16} /> : <ImageIcon size={16} />}
          {view === 'gallery' ? '工作台' : '图库'}
        </button>
        <button className="primary" onClick={() => void createConversation()}>
          <Plus size={16} />
          新建会话
        </button>
      </div>
    </header>
  )
}
