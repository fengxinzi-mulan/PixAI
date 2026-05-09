import { useEffect, type JSX } from 'react'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { Topbar } from '@renderer/components/layout/Topbar'
import { useAppStore } from '@renderer/store/app-store'

function App(): JSX.Element {
  const darkMode = useAppStore((state) => state.darkMode)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const generatingByConversation = useAppStore((state) => state.generatingByConversation)
  const generationStartedAtByConversation = useAppStore((state) => state.generationStartedAtByConversation)
  const removedGenerationIndexesByConversation = useAppStore((state) => state.removedGenerationIndexesByConversation)
  const generationClockMs = useAppStore((state) => state.generationClockMs)
  const load = useAppStore((state) => state.load)
  const toast = useAppStore((state) => state.toast)
  const activeGenerationState = activeConversationId
    ? {
        generating: Boolean(generatingByConversation[activeConversationId]),
        startedAt: generationStartedAtByConversation[activeConversationId] ?? null,
        removedIndexes: removedGenerationIndexesByConversation[activeConversationId] ?? []
      }
    : { generating: false, startedAt: null, removedIndexes: [] }

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
            activeConversationRemovedIndexes={activeGenerationState.removedIndexes}
            generationClockMs={generationClockMs}
          />
        </div>
      </div>
      {toast ? <div className="toast show">{toast}</div> : null}
    </div>
  )
}

export default App
