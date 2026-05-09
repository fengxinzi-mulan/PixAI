import type { JSX } from 'react'
import { useAppStore } from '@renderer/store/app-store'
import { CanvasArea } from './CanvasArea'
import { Composer } from './Composer'

export function Workspace({
  activeConversationGenerating,
  activeConversationStartedAt,
  activeConversationRemovedIndexes,
  generationClockMs
}: {
  activeConversationGenerating: boolean
  activeConversationStartedAt: number | null
  activeConversationRemovedIndexes: number[]
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
            removedIndexes={activeConversationRemovedIndexes}
            generationClockMs={generationClockMs}
          />
        </>
      ) : (
        <div className="empty-state">暂无会话</div>
      )}
    </section>
  )
}
