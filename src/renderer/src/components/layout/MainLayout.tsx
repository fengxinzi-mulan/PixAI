import { useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '@renderer/store/app-store'
import { GalleryPage } from '@renderer/components/gallery/GalleryPage'
import { PromptLibraryPage } from '@renderer/components/prompt-library/PromptLibraryPage'
import { SettingsPanel } from '@renderer/components/settings/SettingsPanel'
import { Sidebar } from '@renderer/components/sidebar/Sidebar'
import { Workspace } from '@renderer/components/workspace/Workspace'

export function MainLayout({
  activeConversationGenerating,
  activeConversationStartedAt,
  generationClockMs
}: {
  activeConversationGenerating: boolean
  activeConversationStartedAt: number | null
  generationClockMs: number
}): JSX.Element {
  const { view, settingsVisible } = useAppStore()
  const isWorkspaceView = view === 'workspace'
  const isLibraryView = view === 'gallery' || view === 'prompts'
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
      className={`main ${settingsVisible && isWorkspaceView ? '' : 'settings-hidden'} ${isLibraryView ? 'gallery-mode' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar />
      <div className="sidebar-resizer" onPointerDown={startSidebarResize} title="拖动调整会话区宽度" />
      {view === 'gallery' ? (
        <GalleryPage />
      ) : view === 'prompts' ? (
        <PromptLibraryPage />
      ) : (
        <Workspace
          activeConversationGenerating={activeConversationGenerating}
          activeConversationStartedAt={activeConversationStartedAt}
          generationClockMs={generationClockMs}
        />
      )}
      {settingsVisible && isWorkspaceView ? <SettingsPanel /> : null}
    </main>
  )
}
