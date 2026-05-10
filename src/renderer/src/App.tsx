import { useEffect, type JSX } from 'react'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { Topbar } from '@renderer/components/layout/Topbar'
import { useAppStore } from '@renderer/store/app-store'

function App(): JSX.Element {
  const darkMode = useAppStore((state) => state.darkMode)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const generatingByConversation = useAppStore((state) => state.generatingByConversation)
  const generationStartedAtByConversation = useAppStore((state) => state.generationStartedAtByConversation)
  const runsByConversation = useAppStore((state) => state.runsByConversation)
  const generationClockMs = useAppStore((state) => state.generationClockMs)
  const load = useAppStore((state) => state.load)
  const toast = useAppStore((state) => state.toast)
  const activeRuns = activeConversationId ? runsByConversation[activeConversationId] || [] : []
  const runningRunStartedAt = activeRuns
    .filter((run) => run.status === 'running')
    .map((run) => Date.parse(run.createdAt))
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right)[0] ?? null
  const activeGenerationState = activeConversationId
    ? {
        generating: Boolean(generatingByConversation[activeConversationId]) || activeRuns.some((run) => run.status === 'running'),
        startedAt: generationStartedAtByConversation[activeConversationId] ?? runningRunStartedAt
      }
    : { generating: false, startedAt: null }

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
            generationClockMs={generationClockMs}
          />
        </div>
      </div>
      {toast ? <div className="toast show">{toast}</div> : null}
    </div>
  )
}

export default App
