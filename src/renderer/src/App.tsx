import { useEffect, useMemo, useState, type FormEvent, type JSX } from 'react'
import {
  Clock,
  Copy,
  CopyPlus,
  Download,
  Eye,
  Heart,
  History,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { Conversation, ConversationUpdate, GenerationRun, ImageHistoryItem, ProviderSettings } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/lib/utils'
import { useAppStore } from '@renderer/store/app-store'

const sizeGroups = [
  {
    label: '1K',
    sizes: ['1024x1024', '1536x1024', '1024x1536']
  },
  {
    label: '2K',
    sizes: ['2048x2048', '2560x1440', '1440x2560', '2048x1152', '1152x2048']
  },
  {
    label: '4K',
    sizes: ['4096x4096', '3840x2160', '2160x3840']
  }
]
const qualities = ['auto', 'low', 'medium', 'high', 'standard', 'hd']

function App(): JSX.Element {
  const {
    view,
    settings,
    conversations,
    activeConversationId,
    runsByConversation,
    history,
    query,
    sort,
    favoritesOnly,
    loading,
    generatingIds,
    message,
    error,
    errorDetails,
    setView,
    setQuery,
    setSort,
    setFavoritesOnly,
    setActiveConversation,
    updateActiveConversation,
    load,
    generate,
    reloadHistory,
    deleteHistory,
    toggleFavorite,
    reuse,
    createConversation,
    deleteConversation
  } = useAppStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void reloadHistory()
  }, [query, sort, favoritesOnly, reloadHistory])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  )
  const activeRuns = activeConversationId ? runsByConversation[activeConversationId] || [] : []
  const isGenerating = activeConversationId ? Boolean(generatingIds[activeConversationId]) : false

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        view={view}
        loading={loading}
        onCreate={() => void createConversation()}
        onSelect={(id) => void setActiveConversation(id)}
        onDelete={(id) => {
          if (window.confirm('删除这个对话？共享历史记录会保留。')) {
            void deleteConversation(id)
          }
        }}
        onHistory={() => setView('history')}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="min-w-0 flex-1">
        {view === 'history' ? (
          <HistoryView
            items={history}
            query={query}
            sort={sort}
            favoritesOnly={favoritesOnly}
            onQuery={setQuery}
            onSort={setSort}
            onFavoritesOnly={setFavoritesOnly}
            onDelete={deleteHistory}
            onFavorite={toggleFavorite}
            onReuse={reuse}
          />
        ) : (
          <GeneratorView
            conversation={activeConversation}
            runs={activeRuns}
            settings={settings}
            generating={isGenerating}
            message={message}
            error={error}
            errorDetails={errorDetails}
            onUpdate={updateActiveConversation}
            onGenerate={generate}
            onDelete={deleteHistory}
            onFavorite={toggleFavorite}
          />
        )}
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />
    </div>
  )
}

function ConversationSidebar({
  conversations,
  activeConversationId,
  view,
  loading,
  onCreate,
  onSelect,
  onDelete,
  onHistory,
  onSettings
}: {
  conversations: Conversation[]
  activeConversationId: string | null
  view: 'generate' | 'history'
  loading: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onHistory: () => void
  onSettings: () => void
}): JSX.Element {
  return (
    <aside className="flex w-[286px] shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ImageIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">PixAI</div>
          <div className="truncate text-xs text-muted-foreground">应用内多会话生成</div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="space-y-2 border-b p-3">
        <Button className="w-full justify-start" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
        <Button variant={view === 'history' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={onHistory}>
          <History className="h-4 w-4" />
          全局历史
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-2',
                activeConversationId === conversation.id && view === 'generate' ? 'bg-secondary' : 'hover:bg-accent'
              )}
            >
              <button
                className="min-w-0 flex-1 text-left"
                type="button"
                onClick={() => onSelect(conversation.id)}
                title={conversation.title}
              >
                <div className="truncate text-sm font-medium">{conversation.title}</div>
                <div className="truncate text-xs text-muted-foreground">{conversation.model} · {conversation.size}</div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                title="删除对话"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(conversation.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Button variant="ghost" className="w-full justify-start" onClick={onSettings}>
          <Settings className="h-4 w-4" />
          设置
        </Button>
      </div>
    </aside>
  )
}

function GeneratorView({
  conversation,
  runs,
  settings,
  generating,
  message,
  error,
  errorDetails,
  onUpdate,
  onGenerate,
  onDelete,
  onFavorite
}: {
  conversation: Conversation | null
  runs: GenerationRun[]
  settings: ProviderSettings | null
  generating: boolean
  message: string | null
  error: string | null
  errorDetails: string | null
  onUpdate: (input: ConversationUpdate) => Promise<void>
  onGenerate: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onFavorite: (item: ImageHistoryItem) => Promise<void>
}): JSX.Element {
  if (!conversation) {
    return <EmptyState text="还没有对话" />
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void onGenerate()
  }

  return (
    <section className="grid h-screen grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col">
        <ScrollArea className="min-h-0 flex-1 bg-muted/20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-8 py-8">
            <div className="pb-2">
              <h1 className="truncate text-2xl font-semibold tracking-normal">{conversation.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {settings?.apiKeyStored ? `${settings.baseURL} · ${settings.defaultModel}` : '请先配置 API Key 和服务地址'}
              </p>
            </div>

            {runs.length === 0 && !generating ? (
              <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed bg-background text-sm text-muted-foreground">
                开始第一次生成后，这里会保留当前对话的生成历史。
              </div>
            ) : null}

            {runs.map((run) => (
              <RunCard key={run.id} run={run} onDelete={onDelete} onFavorite={onFavorite} />
            ))}
            {generating ? <GeneratingRun prompt={conversation.draftPrompt} /> : null}
          </div>
        </ScrollArea>

        <form className="border-t bg-background p-4" onSubmit={submit}>
          <div className="mx-auto flex max-w-5xl gap-3">
            <Textarea
              className="min-h-[72px] flex-1"
              value={conversation.draftPrompt}
              onChange={(event) => void onUpdate({ draftPrompt: event.target.value })}
              placeholder="Describe the image you want to generate"
            />
            <Button className="h-[72px] w-28" disabled={generating || !conversation.draftPrompt.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              生成
            </Button>
          </div>
          <div className="mx-auto mt-2 max-w-5xl">
            {error ? <Status tone="error" text={error} /> : null}
            {errorDetails ? <ErrorDetails details={errorDetails} /> : null}
            {message ? <Status tone="success" text={message} /> : null}
          </div>
        </form>
      </div>

      <aside className="flex min-h-0 flex-col border-l bg-card p-5">
        <h2 className="text-sm font-semibold">生成参数</h2>
        <div className="mt-5 space-y-5">
          <Field label="模型">
            <Input
              value={conversation.model}
              onChange={(event) => void onUpdate({ model: event.target.value })}
              placeholder="gpt-image-2"
            />
          </Field>
          <Field label="尺寸">
            <Select value={conversation.size} onValueChange={(value) => void onUpdate({ size: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group.label}</div>
                    {group.sizes.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="质量">
            <Select value={conversation.quality} onValueChange={(value) => void onUpdate({ quality: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="数量">
            <Input
              type="number"
              min={1}
              max={10}
              value={conversation.n}
              onChange={(event) => void onUpdate({ n: Number(event.target.value) })}
            />
          </Field>
        </div>
      </aside>
    </section>
  )
}

function RunCard({
  run,
  onDelete,
  onFavorite
}: {
  run: GenerationRun
  onDelete: (id: string) => Promise<void>
  onFavorite: (item: ImageHistoryItem) => Promise<void>
}): JSX.Element {
  return (
    <article className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-sm leading-6">{run.prompt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{new Date(run.createdAt).toLocaleString()}</span>
            <span>{run.model}</span>
            <span>{run.size || 'auto'}</span>
            <span>{run.quality || 'auto'}</span>
            <span>{run.n} 张</span>
          </div>
        </div>
      </div>

      {run.status === 'failed' ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {run.errorMessage || '生成失败'}
          <ErrorDetails details={run.errorDetails} />
        </div>
      ) : null}

      {run.items.length > 0 ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {run.items.map((item) => (
            <ImageTile key={item.id} item={item} onDelete={onDelete} onFavorite={onFavorite} />
          ))}
        </div>
      ) : null}
    </article>
  )
}

function GeneratingRun({ prompt }: { prompt: string }): JSX.Element {
  return (
    <article className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="whitespace-pre-wrap text-sm leading-6">{prompt}</p>
      <div className="mt-4 flex h-40 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        正在生成
      </div>
    </article>
  )
}

function HistoryView({
  items,
  query,
  sort,
  favoritesOnly,
  onQuery,
  onSort,
  onFavoritesOnly,
  onDelete,
  onFavorite,
  onReuse
}: {
  items: ImageHistoryItem[]
  query: string
  sort: 'newest' | 'oldest'
  favoritesOnly: boolean
  onQuery: (query: string) => void
  onSort: (sort: 'newest' | 'oldest') => void
  onFavoritesOnly: (favoritesOnly: boolean) => void
  onDelete: (id: string) => Promise<void>
  onFavorite: (item: ImageHistoryItem) => Promise<void>
  onReuse: (item: ImageHistoryItem) => Promise<void>
}): JSX.Element {
  return (
    <section className="flex h-screen min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索 prompt" />
        </div>
        <Select value={sort} onValueChange={(value) => onSort(value as 'newest' | 'oldest')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新优先</SelectItem>
            <SelectItem value="oldest">最早优先</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={favoritesOnly ? 'secondary' : 'outline'} onClick={() => onFavoritesOnly(!favoritesOnly)}>
          <Star className="h-4 w-4" />
          收藏
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-muted/25">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-6">
          {items.length === 0 ? <EmptyState text="没有匹配的历史记录" /> : null}
          {items.map((item) => (
            <ImageTile
              key={item.id}
              item={item}
              onDelete={onDelete}
              onFavorite={onFavorite}
              onReuse={onReuse}
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}

function ImageTile({
  item,
  onDelete,
  onFavorite,
  onReuse
}: {
  item: ImageHistoryItem
  onDelete: (id: string) => Promise<void>
  onFavorite: (item: ImageHistoryItem) => Promise<void>
  onReuse?: (item: ImageHistoryItem) => Promise<void>
}): JSX.Element {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [toolMessage, setToolMessage] = useState<string | null>(null)
  const imageUrl = window.pixai.image.url(item.id)
  const canUseTools = item.status === 'succeeded'

  const copyImage = async () => {
    try {
      await window.pixai.image.copy(item.id)
      setToolMessage('已复制')
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : '复制失败')
    }
  }

  const downloadImage = async () => {
    try {
      const filePath = await window.pixai.image.download(item.id)
      setToolMessage(filePath ? '已保存' : null)
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : '下载失败')
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="group relative flex aspect-square items-center justify-center bg-muted">
        {item.status === 'succeeded' ? (
          <>
            <img className="h-full w-full object-cover" src={imageUrl} alt={item.prompt} />
            <div className="absolute inset-x-2 top-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <ImageToolButton title="预览" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4" />
              </ImageToolButton>
              <ImageToolButton title="复制" onClick={() => void copyImage()}>
                <Copy className="h-4 w-4" />
              </ImageToolButton>
              <ImageToolButton title="下载" onClick={() => void downloadImage()}>
                <Download className="h-4 w-4" />
              </ImageToolButton>
            </div>
          </>
        ) : (
          <div className="w-full p-5 text-left text-sm text-red-700">
            <div className="text-center">{item.errorMessage || '生成失败'}</div>
            <ErrorDetails details={item.errorDetails} compact />
          </div>
        )}
      </div>
      <div className="space-y-3 p-3">
        {toolMessage ? <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{toolMessage}</div> : null}
        <p className="line-clamp-2 min-h-10 text-sm">{item.prompt}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {new Date(item.createdAt).toLocaleString()}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            {item.model} · {item.size || 'auto'}
          </div>
          <div className="flex shrink-0 gap-1">
            {onReuse ? (
              <Button variant="ghost" size="icon" title="重新填充参数" onClick={() => void onReuse(item)}>
                <CopyPlus className="h-4 w-4" />
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" title="收藏" onClick={() => void onFavorite(item)}>
              <Heart className={cn('h-4 w-4', item.favorite && 'fill-red-500 text-red-500')} />
            </Button>
            <Button variant="ghost" size="icon" title="删除" onClick={() => void onDelete(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {canUseTools ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="flex h-[92vh] w-[94vw] max-w-none grid-rows-none flex-col p-0">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">{item.prompt || '图片预览'}</DialogTitle>
                <div className="text-xs text-muted-foreground">
                  {item.model} · {item.size || 'auto'} · {Math.round(zoom * 100)}%
                </div>
              </div>
              <div className="mr-8 flex items-center gap-1">
                <Button variant="ghost" size="icon" title="缩小" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="放大" onClick={() => setZoom((value) => Math.min(4, value + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="复制" onClick={() => void copyImage()}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="下载" onClick={() => void downloadImage()}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
              <div className="flex min-h-full items-center justify-center">
                <img
                  className="max-h-none max-w-none rounded-md shadow-sm"
                  src={imageUrl}
                  alt={item.prompt}
                  style={{ width: `${zoom * 100}%` }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  )
}

function ImageToolButton({
  title,
  children,
  onClick
}: {
  title: string
  children: React.ReactNode
  onClick: () => void
}): JSX.Element {
  return (
    <Button
      variant="secondary"
      size="icon"
      title={title}
      className="h-8 w-8 border bg-background/90 shadow-sm backdrop-blur"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Status({ text, tone }: { text: string; tone: 'error' | 'success' }): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      )}
    >
      {text}
    </div>
  )
}

function ErrorDetails({ details, compact = false }: { details: string | null; compact?: boolean }): JSX.Element | null {
  if (!details) {
    return null
  }

  return (
    <details className={cn('mt-3 rounded-md border border-red-200 bg-white/80 text-left', compact && 'text-xs')}>
      <summary className="cursor-pointer px-3 py-2 font-medium text-red-700">查看详情</summary>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-red-100 p-3 font-mono text-xs leading-5 text-red-900">
        {details}
      </pre>
    </details>
  )
}

function EmptyState({ text }: { text: string }): JSX.Element {
  return (
    <div className="col-span-full flex h-[320px] items-center justify-center rounded-lg border border-dashed bg-background text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function SettingsDialog({
  open,
  onOpenChange,
  settings
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ProviderSettings | null
}): JSX.Element {
  const updateSettings = useAppStore((state) => state.updateSettings)
  const [baseURL, setBaseURL] = useState(settings?.baseURL || 'https://api.openai.com')
  const [defaultModel, setDefaultModel] = useState(settings?.defaultModel || 'gpt-image-2')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    if (settings) {
      setBaseURL(settings.baseURL)
      setDefaultModel(settings.defaultModel)
    }
  }, [settings])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await updateSettings({
      baseURL,
      defaultModel,
      apiKey: apiKey.trim() ? apiKey : undefined
    })
    setApiKey('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>服务设置</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Base URL">
            <Input value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="https://api.openai.com" />
          </Field>
          <Field label="API Key">
            <Input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder={settings?.apiKeyStored ? '已保存，留空不修改' : 'sk-...'}
            />
          </Field>
          <Field label="默认模型">
            <Input value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder="gpt-image-2" />
          </Field>
          {settings?.insecureStorage ? (
            <Status tone="error" text="当前系统未启用安全加密，API Key 已降级保存在本地设置文件中。" />
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default App
