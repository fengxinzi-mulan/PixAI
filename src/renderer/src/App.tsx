import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  type WheelEvent
} from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  Image as ImageIcon,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { Conversation, GenerationRun, ImageHistoryItem, ImageQuality, ImageRatio } from '@shared/types'
import { elapsedMs, formatDuration } from '@shared/duration'
import { IMAGE_QUALITIES, IMAGE_RATIOS } from '@shared/image-options'
import { useAppStore } from '@renderer/store/app-store'
import {
  clampPreviewZoom,
  formatPreviewZoom,
  getInitialPreviewZoom,
  getInitialPreviewZoomForArea,
  getPreviewMetadataRows,
  getPreviewZoomAfterWheel
} from './image-preview'
import { getSessionRowView } from './session-list'
import { getThemeToggleView } from './theme-toggle'
import { getWorkspaceRunGridSlots } from './workspace-placeholders'
import { getWorkspaceResultSummarySegments } from './workspace-summary'

const ratios: ImageRatio[] = IMAGE_RATIOS
const qualities: ImageQuality[] = IMAGE_QUALITIES
const previewFitOptions = { widthRatio: 0.68, heightRatio: 0.86, maxWidth: 820, maxHeight: 820 }
const previewArtPadding = 36

function getPreviewFitZoom(
  imageSize: { width: number; height: number },
  artSize: { width: number; height: number } | null
): number {
  if (artSize) {
    return getInitialPreviewZoomForArea(artSize.width, artSize.height, imageSize.width, imageSize.height, previewArtPadding)
  }
  return getInitialPreviewZoom(window.innerWidth, window.innerHeight, imageSize.width, imageSize.height, previewFitOptions)
}

function App(): JSX.Element {
  const darkMode = useAppStore((state) => state.darkMode)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const generatingByConversation = useAppStore((state) => state.generatingByConversation)
  const generationStartedAtByConversation = useAppStore((state) => state.generationStartedAtByConversation)
  const canceledGenerationIndexesByConversation = useAppStore((state) => state.canceledGenerationIndexesByConversation)
  const generationClockMs = useAppStore((state) => state.generationClockMs)
  const load = useAppStore((state) => state.load)
  const toast = useAppStore((state) => state.toast)
  const activeGenerationState = activeConversationId
    ? {
        generating: Boolean(generatingByConversation[activeConversationId]),
        startedAt: generationStartedAtByConversation[activeConversationId] ?? null,
        canceledIndexes: canceledGenerationIndexesByConversation[activeConversationId] ?? []
      }
    : { generating: false, startedAt: null, canceledIndexes: [] }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={darkMode ? 'app-root dark' : 'app-root'}>
      <div className="shell">
        <div className="app-frame">
          <Topbar />
          <MainLayout
            activeConversationGenerating={activeGenerationState.generating}
            activeConversationStartedAt={activeGenerationState.startedAt}
            activeConversationCanceledIndexes={activeGenerationState.canceledIndexes}
            generationClockMs={generationClockMs}
          />
        </div>
      </div>
      {toast ? <div className="toast show">{toast}</div> : null}
    </div>
  )
}

function Topbar(): JSX.Element {
  const { settings, settingsVisible, view, setView, toggleSettings, createConversation } = useAppStore()
  const endpoint = `${settings?.baseURL || 'https://api.openai.com'}/v1/images/generations`
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">
          <ImageIcon size={18} />
        </div>
        <div>
          <h1>PixAI</h1>
          <span>多会话图片生成工作台</span>
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

function MainLayout({
  activeConversationGenerating,
  activeConversationStartedAt,
  activeConversationCanceledIndexes,
  generationClockMs
}: {
  activeConversationGenerating: boolean
  activeConversationStartedAt: number | null
  activeConversationCanceledIndexes: number[]
  generationClockMs: number
}): JSX.Element {
  const { view, settingsVisible } = useAppStore()
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(window.localStorage.getItem('pixai-sidebar-width'))
    return Number.isFinite(saved) && saved >= 180 && saved <= 380 ? saved : 244
  })

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(380, Math.max(180, startWidth + moveEvent.clientX - startX))
      setSidebarWidth(nextWidth)
      window.localStorage.setItem('pixai-sidebar-width', String(nextWidth))
    }
    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  return (
    <main
      className={`main ${settingsVisible ? '' : 'settings-hidden'} ${view === 'gallery' ? 'gallery-mode' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar />
      <div className="sidebar-resizer" onPointerDown={startSidebarResize} title="拖动调整会话区宽度" />
      {view === 'gallery' ? (
        <GalleryPage />
      ) : (
        <Workspace
          activeConversationGenerating={activeConversationGenerating}
          activeConversationStartedAt={activeConversationStartedAt}
          activeConversationCanceledIndexes={activeConversationCanceledIndexes}
          generationClockMs={generationClockMs}
        />
      )}
      {settingsVisible && view !== 'gallery' ? <SettingsPanel /> : null}
    </main>
  )
}

function Sidebar(): JSX.Element {
  const {
    conversations,
    activeConversationId,
    darkMode,
    loading,
    generatingByConversation,
    setActiveConversation,
    deleteConversation,
    toggleTheme
  } = useAppStore()
  const themeToggle = getThemeToggleView(darkMode)
  return (
    <aside className="sidebar">
      <div className="section-title">
        <span>会话</span>
        {loading ? <Loader2 className="spin" size={15} /> : null}
      </div>
      <div className="session-list">
        {conversations.map((conversation) => {
          const row = getSessionRowView(conversation.id, activeConversationId, generatingByConversation)
          return (
            <button
              key={conversation.id}
              className={row.className}
              onClick={() => void setActiveConversation(conversation.id)}
            >
              <div className="session-line">
                <span className="draft session-draft" title={conversation.draftPrompt || conversation.title}>
                  {conversation.draftPrompt || conversation.title}
                </span>
                <span className="session-loading-slot">
                  {row.generating ? <Loader2 className="session-loading spin" size={13} aria-label="生成中" /> : null}
                </span>
                <span
                  className="icon-only danger session-delete"
                  title="删除会话"
                  onClick={(event) => {
                    event.stopPropagation()
                    void deleteConversation(conversation.id)
                  }}
                >
                  <Trash2 size={13} />
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="app-footer">
        <div className="version-line">
          <span>PixAI</span>
          <span>v0.1.0</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme}>
          <span>{themeToggle.label}</span>
          <span className={themeToggle.switchClassName} />
        </button>
      </div>
    </aside>
  )
}

function Workspace({
  activeConversationGenerating,
  activeConversationStartedAt,
  activeConversationCanceledIndexes,
  generationClockMs
}: {
  activeConversationGenerating: boolean
  activeConversationStartedAt: number | null
  activeConversationCanceledIndexes: number[]
  generationClockMs: number
}): JSX.Element {
  const { conversations, activeConversationId, runsByConversation } = useAppStore()
  const conversation = conversations.find((item) => item.id === activeConversationId) || null
  const runs = activeConversationId ? runsByConversation[activeConversationId] || [] : []
  return (
    <section className="workspace">
      {conversation ? (
        <>
          <Composer conversation={conversation} generating={activeConversationGenerating} />
          <CanvasArea
            runs={runs}
            generationStartedAt={activeConversationStartedAt}
            generating={activeConversationGenerating}
            canceledIndexes={activeConversationCanceledIndexes}
            generationClockMs={generationClockMs}
          />
        </>
      ) : (
        <div className="empty-state">暂无会话</div>
      )}
    </section>
  )
}

function Composer({ conversation, generating }: { conversation: Conversation; generating: boolean }): JSX.Element {
  const { updateActiveConversation, generate, notify } = useAppStore()
  const charCount = conversation.draftPrompt.length
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void generate()
  }
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-head">
        <div className="composer-tools">
          <span className="pill good">
            <Sparkles size={13} />
            文生图
          </span>
          <span className="pill">已保存</span>
        </div>
        <button type="button" onClick={() => void updateActiveConversation({ draftPrompt: '' })}>
          <X size={15} />
          清空
        </button>
      </div>
      <div className="prompt-box">
        <textarea
          value={conversation.draftPrompt}
          onChange={(event) => void updateActiveConversation({ draftPrompt: event.target.value })}
          placeholder="描述你想生成的画面，例如：一座明亮的玻璃温室，清晨薄雾漂浮在植物之间，浅绿色与奶白色，自然摄影质感。"
        />
        <div className="prompt-foot">
          <span className="hint">{charCount} 字符 · {conversation.model} · {conversation.ratio} · {conversation.quality}</span>
          <div className="mini-controls">
            <button type="button" onClick={() => notify('草稿已自动保存')}>
              已保存
            </button>
            <button className="primary generate-button" disabled={generating || !conversation.draftPrompt.trim()}>
              {generating ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
              {generating ? '生成中...' : '生成图片'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function CanvasArea({
  runs,
  generationStartedAt,
  generating,
  canceledIndexes,
  generationClockMs
}: {
  runs: GenerationRun[]
  generationStartedAt: number | null
  generating: boolean
  canceledIndexes: number[]
  generationClockMs: number
}): JSX.Element {
  const { conversations, activeConversationId } = useAppStore()
  const refreshConversationResults = useAppStore((state) => state.refreshConversationResults)
  const current = conversations.find((item) => item.id === activeConversationId)
  const items = runs.flatMap((run) => run.items.map((item) => ({ item, run })))
  const activeRun = generating ? runs.find((run) => run.status === 'running') : null
  const generationElapsedMs = generationStartedAt != null ? elapsedMs(generationStartedAt, generationClockMs) : null
  const runGridSlots = generating && current
    ? getWorkspaceRunGridSlots(current.n, activeRun?.items ?? [], canceledIndexes)
    : []
  const generatingCount = runGridSlots.filter((slot) => slot.type === 'placeholder').length
  const summarySegments = getWorkspaceResultSummarySegments(items.map(({ item }) => item), generatingCount)
  const previewItems = items.map(({ item }) => item).filter((item) => item.status === 'succeeded')

  useEffect(() => {
    if (!generating || !current) return
    void refreshConversationResults(current.id)
    const timer = window.setInterval(() => {
      void refreshConversationResults(current.id)
    }, 900)
    return () => window.clearInterval(timer)
  }, [current, generating, refreshConversationResults])

  return (
    <section className="canvas-area">
      <div className="history-head">
        <div className="history-title">
          <ImageIcon size={16} />
          当前工作区
        </div>
        <div className="workspace-summary" aria-label="工作区结果统计">
          {generationElapsedMs != null && generating ? (
            <span className="summary-chip active">当前任务 {formatDuration(generationElapsedMs)}</span>
          ) : null}
          {summarySegments.map((segment) => (
            <span key={segment.key} className={`summary-chip ${segment.tone}`}>
              {segment.label} <strong>{segment.value}</strong>{segment.suffix ? ` ${segment.suffix}` : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="preview-grid">
        {generating && current
          ? runGridSlots.map((slot) => (
              slot.type === 'placeholder' ? (
                <GeneratingTile
                  key={`pending-${slot.requestIndex}`}
                  conversationId={current.id}
                  requestIndex={slot.requestIndex}
                  generationElapsedMs={generationElapsedMs}
                />
              ) : (
                <ImageTile key={slot.item.id} item={slot.item} previewItems={previewItems} />
              )
            ))
          : null}
        {items.length === 0 && !generating ? <div className="empty-state grid-empty">生成后的图片会显示在这里</div> : null}
        {(generating && activeRun ? items.filter(({ run }) => run.id !== activeRun.id) : items).map(({ item }) => (
          <ImageTile key={item.id} item={item} previewItems={previewItems} />
        ))}
      </div>
    </section>
  )
}

function GeneratingTile({
  conversationId,
  requestIndex,
  generationElapsedMs
}: {
  conversationId: string
  requestIndex: number
  generationElapsedMs: number | null
}): JSX.Element {
  const { cancelGeneration } = useAppStore()
  const [hovered, setHovered] = useState(false)
  const seconds = generationElapsedMs == null ? 0 : Math.floor(generationElapsedMs / 1000)
  return (
    <article
      className="art-card loading generating-card"
      aria-label="生成中"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Loader2 className="art-spinner spin" size={24} />
      <div className="generating-meta">
        <span>{`已耗时 ${seconds}s`}</span>
        {hovered ? (
          <button
            type="button"
            className="cancel-chip"
            onClick={(event) => {
              event.stopPropagation()
              void cancelGeneration(conversationId, requestIndex)
            }}
          >
            取消
          </button>
        ) : null}
      </div>
    </article>
  )
}

function SettingsPanel(): JSX.Element {
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

function GalleryPage(): JSX.Element {
  const {
    history,
    query,
    sort,
    favoritesOnly,
    setQuery,
    reloadHistory,
    setSort,
    setFavoritesOnly,
    setView,
    deleteHistory
  } = useAppStore()
  return (
    <section className="gallery-page">
      <div className="gallery-hero">
        <div>
          <h2>图库</h2>
          <p>集中浏览、检索和管理所有会话的生成历史。</p>
        </div>
        <button onClick={() => setView('workspace')}>
          <ArrowLeft size={16} />
          返回工作台
        </button>
      </div>
      <div className="gallery-tools">
        <div className="search-wrap">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              void reloadHistory({ query: event.target.value })
            }}
            placeholder="搜索 prompt、模型或参数"
          />
        </div>
        <button onClick={() => void setSort(sort === 'newest' ? 'oldest' : 'newest')}>排序：{sort === 'newest' ? '最近' : '较早'}</button>
        <button className={favoritesOnly ? 'active-soft' : ''} onClick={() => void setFavoritesOnly(!favoritesOnly)}>
          <Star size={15} />
          {favoritesOnly ? '全部历史' : '只看收藏'}
        </button>
      </div>
      <div className="gallery-grid">
        {history.length === 0 ? <div className="empty-state grid-empty">暂无匹配历史</div> : null}
        {history.map((item) => (
          <HistoryCard key={item.id} item={item} onDelete={() => void deleteHistory(item.id)} />
        ))}
      </div>
    </section>
  )
}

function HistoryCard({ item, onDelete }: { item: ImageHistoryItem; onDelete: () => void }): JSX.Element {
  const { reuseHistory, toggleFavorite } = useAppStore()
  return (
    <article className="history-card">
      <div className={`thumb ${item.status === 'failed' ? 'fail' : ''}`}>
        {item.status === 'succeeded' && item.filePath ? <img src={window.pixai.image.url(item.id)} alt="" /> : null}
      </div>
      <div className="history-info">
        <strong>{item.status === 'failed' ? '生成失败' : '生成结果'}</strong>
        <p>{item.prompt}</p>
        <div className="history-actions">
          {item.durationMs != null ? <span className="pill tiny">用时 {formatDuration(item.durationMs)}</span> : null}
          <button className={`pill tiny ${item.favorite ? 'good' : ''}`} onClick={() => void toggleFavorite(item)}>
            收藏
          </button>
          <button className="pill tiny" onClick={() => void reuseHistory(item)}>
            回填
          </button>
          <button className="pill tiny" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>
    </article>
  )
}

function ImageTile({ item, previewItems }: { item: ImageHistoryItem; previewItems: ImageHistoryItem[] }): JSX.Element {
  const { deleteHistory, toggleFavorite, notify } = useAppStore()
  const [previewOpen, setPreviewOpen] = useState(false)
  const src = useMemo(() => (item.status === 'succeeded' ? window.pixai.image.url(item.id) : ''), [item.id, item.status])
  const openPreview = () => {
    if (item.status === 'succeeded') setPreviewOpen(true)
  }

  if (item.status === 'failed') {
    return (
      <article className="art-card failed">
        <div className="art-tools">
          <button
            title="删除"
            onClick={(event) => {
              event.stopPropagation()
              void deleteHistory(item.id)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="fail-content">
          <strong>{item.errorMessage || '生成失败'}</strong>
          {item.errorDetails ? <details><summary>查看错误详情</summary><code>{item.errorDetails}</code></details> : null}
        </div>
      </article>
    )
  }

  return (
    <article
      className="art-card image-card"
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPreview()
        }
      }}
    >
      <img src={src} alt={item.prompt} />
      {item.status === 'succeeded' ? null : null}
      <div className="art-tools">
        <button
          title="复制"
          onClick={(event) => {
            event.stopPropagation()
            void window.pixai.image.copy(item.id).then(() => notify('已复制到剪贴板'))
          }}
        >
          <Copy size={14} />
        </button>
        <button
          title="下载"
          onClick={(event) => {
            event.stopPropagation()
            void window.pixai.image.download(item.id).then((path) => path && notify('已保存图片'))
          }}
        >
          <Download size={14} />
        </button>
        <button
          title="收藏"
          onClick={(event) => {
            event.stopPropagation()
            void toggleFavorite(item)
          }}
        >
          <Heart className={item.favorite ? 'filled' : ''} size={14} />
        </button>
        <button
          title="删除"
          onClick={(event) => {
            event.stopPropagation()
            void deleteHistory(item.id)
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {previewOpen ? <PreviewModal initialItem={item} items={previewItems} onClose={() => setPreviewOpen(false)} /> : null}
    </article>
  )
}

function PreviewModal({
  initialItem,
  items,
  onClose
}: {
  initialItem: ImageHistoryItem
  items: ImageHistoryItem[]
  onClose: () => void
}): JSX.Element {
  const { notify } = useAppStore()
  const artRef = useRef<HTMLDivElement | null>(null)
  const [currentId, setCurrentId] = useState(initialItem.id)
  const [zoom, setZoom] = useState(1)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [artSize, setArtSize] = useState<{ width: number; height: number } | null>(null)
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId))
  const item = items[currentIndex] || initialItem
  const src = useMemo(() => window.pixai.image.url(item.id), [item.id])
  const metadataRows = useMemo(() => getPreviewMetadataRows(item), [item])
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < items.length - 1

  useEffect(() => {
    setZoom(1)
    setImageSize(null)
  }, [item.id])

  useEffect(() => {
    const element = artRef.current
    if (!element) return

    const updateSize = () => {
      setArtSize({ width: element.clientWidth, height: element.clientHeight })
    }
    updateSize()

    const ResizeObserverCtor = window.ResizeObserver
    if (!ResizeObserverCtor) return

    const observer = new ResizeObserverCtor(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && canGoPrevious) setCurrentId(items[currentIndex - 1].id)
      if (event.key === 'ArrowRight' && canGoNext) setCurrentId(items[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoNext, canGoPrevious, currentIndex, items, onClose])

  useEffect(() => {
    if (!imageSize) return
    setZoom(getPreviewFitZoom(imageSize, artSize))
  }, [artSize, imageSize])

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom((value) => getPreviewZoomAfterWheel(value, event.deltaY))
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget
    const nextImageSize = { width: target.naturalWidth, height: target.naturalHeight }
    setImageSize(nextImageSize)
    setZoom(getPreviewFitZoom(nextImageSize, artSize))
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(item.prompt || '')
    notify('已复制提示词')
  }

  return (
    <div
      className="modal open"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel">
        <div className="modal-head">
          <span>图片预览</span>
          <div className="mini-controls">
            <button onClick={() => setZoom((value) => clampPreviewZoom(value - 0.15))}>
              <ZoomOut size={15} />
            </button>
            <span className="zoom-value">{formatPreviewZoom(zoom)}</span>
            <button onClick={() => setZoom((value) => clampPreviewZoom(value + 0.15))}>
              <ZoomIn size={15} />
            </button>
            <button onClick={() => setZoom(imageSize ? getPreviewFitZoom(imageSize, artSize) : 1)}>
              重置
            </button>
            <button
              onClick={() => void window.pixai.image.copy(item.id).then(() => notify('已复制到剪贴板'))}
            >
              复制
            </button>
            <button
              onClick={() => void window.pixai.image.download(item.id).then((path) => path && notify('已保存图片'))}
            >
              下载
            </button>
            <button onClick={onClose}>关闭</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-art" ref={artRef} onWheel={handleWheel}>
            <button
              className="modal-nav previous"
              disabled={!canGoPrevious}
              onClick={() => canGoPrevious && setCurrentId(items[currentIndex - 1].id)}
              title="上一张"
            >
              <ChevronLeft size={24} />
            </button>
            <img
              src={src}
              alt={item.prompt}
              onLoad={handleImageLoad}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
            <button
              className="modal-nav next"
              disabled={!canGoNext}
              onClick={() => canGoNext && setCurrentId(items[currentIndex + 1].id)}
              title="下一张"
            >
              <ChevronRight size={24} />
            </button>
            <span className="modal-counter">{items.length ? `${currentIndex + 1}/${items.length}` : '1/1'}</span>
          </div>
          <aside className="modal-prompt">
            <div className="modal-meta">
              {metadataRows.map((row) => (
                <div key={row.label} className="modal-meta-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <div className="modal-prompt-head">
              <span>提示词</span>
              <button onClick={() => void copyPrompt()}>
                <Copy size={14} />
                复制
              </button>
            </div>
            <p>{item.prompt || '无提示词'}</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default App
