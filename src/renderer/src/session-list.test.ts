import { describe, expect, it } from 'vitest'
import { getSessionRowView } from './session-list'

describe('session list view state', () => {
  it('marks only conversations with unfinished generation as loading', () => {
    const generatingByConversation = { active: 2, idle: 0 }

    expect(getSessionRowView('active', 'active', generatingByConversation)).toEqual({
      className: 'session active generating',
      generating: true
    })
    expect(getSessionRowView('idle', 'active', generatingByConversation)).toEqual({
      className: 'session',
      generating: false
    })
  })
})
