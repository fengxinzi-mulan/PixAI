export function getSessionRowView(
  conversationId: string,
  activeConversationId: string | null,
  generatingByConversation: Record<string, boolean>
): { className: string; generating: boolean } {
  const active = conversationId === activeConversationId
  const generating = Boolean(generatingByConversation[conversationId])
  return {
    className: ['session', active ? 'active' : '', generating ? 'generating' : ''].filter(Boolean).join(' '),
    generating
  }
}
