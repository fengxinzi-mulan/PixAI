import { useLayoutEffect, useRef, type FormEvent, type JSX } from 'react'
import { Loader2, Sparkles, Wand2, X } from 'lucide-react'
import type { Conversation } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'

export function Composer({ conversation, generating }: { conversation: Conversation; generating: boolean }): JSX.Element {
  const { updateActiveConversation, generate, notify } = useAppStore()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const charCount = conversation.draftPrompt.length
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void generate()
  }

  useLayoutEffect(() => {
    const prompt = promptRef.current
    if (!prompt) return
    prompt.scrollTop = prompt.scrollHeight
  }, [conversation.draftPrompt])

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
          ref={promptRef}
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
