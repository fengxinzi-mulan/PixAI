import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type JSX } from 'react'
import { GripVertical, ImagePlus, Lightbulb, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import type { Conversation } from '@shared/types'
import { formatImageSize } from '@shared/image-options'
import { useAppStore } from '@renderer/store/app-store'
import { ReferencePreviewModal } from '@renderer/components/preview/ReferencePreviewModal'

export function Composer({ conversation, generating }: { conversation: Conversation; generating: boolean }): JSX.Element {
  const {
    updateActiveConversation,
    generate,
    importReferenceFiles,
    removeReferenceImage,
    reorderReferenceImages,
    inspirePrompt,
    enrichPrompt,
    promptAssistantRunning
  } = useAppStore()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draggedReferenceIdRef = useRef<string | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [previewReferenceId, setPreviewReferenceId] = useState<string | null>(null)
  const referenceCount = conversation.referenceImages.length
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void generate()
  }

  const clearComposer = async () => {
    for (const reference of conversation.referenceImages) {
      await removeReferenceImage(reference.id)
    }
    await updateActiveConversation({ draftPrompt: '' })
  }

  const importFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type))
    if (imageFiles.length > 0) void importReferenceFiles(imageFiles)
  }

  const handleFileInput = () => {
    const files = Array.from(fileInputRef.current?.files || [])
    importFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) return
    event.preventDefault()
    importFiles(files)
  }

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDropActive(false)
    if (isReferenceDrag(event)) return
    importFiles(Array.from(event.dataTransfer.files))
  }

  const isReferenceDrag = (event: DragEvent) => (
    event.dataTransfer.types.includes('application/x-pixai-reference') || draggedReferenceIdRef.current != null
  )

  const moveReference = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...conversation.referenceImages]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    void reorderReferenceImages(next.map((reference) => reference.id))
  }

  return (
    <form
      className={`composer ${dropActive ? 'drop-active' : ''}`}
      onSubmit={submit}
      onPaste={handlePaste}
      onDragOver={(event) => {
        if (isReferenceDrag(event)) {
          setDropActive(false)
          return
        }
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropActive(false)
      }}
      onDrop={handleDrop}
    >
      <div className="composer-head">
        <div className="composer-tools">
          <span className="pill good">
            <Sparkles size={13} />
            {referenceCount > 0 ? `图生图 · ${referenceCount} 张参考图` : '文生图'}
          </span>
          <span className="pill blue">{formatImageSize(conversation.size)}</span>
          <span className="pill">已保存</span>
        </div>
        <div className="composer-actions">
          <button
            type="button"
            className="prompt-assist-button"
            disabled={promptAssistantRunning.inspire}
            onClick={() => void inspirePrompt()}
          >
            <Lightbulb size={14} />
            <span>{promptAssistantRunning.inspire ? '生成中' : '灵感提示词'}</span>
          </button>
          <button
            type="button"
            className="prompt-assist-button"
            disabled={promptAssistantRunning.enrich || !conversation.draftPrompt.trim()}
            onClick={() => void enrichPrompt()}
          >
            <Sparkles size={14} />
            <span>{promptAssistantRunning.enrich ? '丰富中' : '丰富提示词'}</span>
          </button>
          <button className="clear-prompt-button" type="button" onClick={() => void clearComposer()}>
            <X size={15} />
            <span>清空</span>
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={handleFileInput}
      />
      {referenceCount > 0 ? (
        <div className="reference-strip" aria-label="参考图">
          <div className="reference-list">
            {conversation.referenceImages.map((reference, index) => (
              <div
                key={reference.id}
                className="reference-chip"
                draggable
                role="button"
                tabIndex={0}
                title="预览参考图"
                onClick={() => {
                  if (draggedReferenceIdRef.current) return
                  setPreviewReferenceId(reference.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setPreviewReferenceId(reference.id)
                  }
                }}
                onDragStart={(event) => {
                  event.stopPropagation()
                  draggedReferenceIdRef.current = reference.id
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('application/x-pixai-reference', reference.id)
                  setDraggingIndex(index)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (draggingIndex != null) moveReference(draggingIndex, index)
                  setDraggingIndex(null)
                }}
                onDragEnd={(event) => {
                  event.stopPropagation()
                  setDraggingIndex(null)
                  window.setTimeout(() => {
                    draggedReferenceIdRef.current = null
                  }, 0)
                }}
              >
                <GripVertical size={13} />
                <img draggable={false} src={window.pixai.reference.url(reference.id)} alt={reference.name} />
                <button
                  type="button"
                  title="删除参考图"
                  onClick={(event) => {
                    event.stopPropagation()
                    void removeReferenceImage(reference.id)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="prompt-box">
        <textarea
          ref={promptRef}
          value={conversation.draftPrompt}
          onChange={(event) => void updateActiveConversation({ draftPrompt: event.target.value })}
          placeholder="描述你想生成的画面，例如：一座明亮的玻璃温室，清晨薄雾漂浮在植物之间，浅绿色与奶白色，自然摄影质感。"
        />
        <div className="prompt-foot">
          <button className="reference-footer-button" type="button" title="添加参考图" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={17} />
            {referenceCount > 0 ? <span>{referenceCount}</span> : null}
          </button>
          <div className="mini-controls">
            <button className="primary generate-button" disabled={!conversation.draftPrompt.trim()}>
              <Wand2 size={16} />
              {generating ? '继续生成' : '生成图片'}
            </button>
          </div>
        </div>
      </div>
      {previewReferenceId ? (
        <ReferencePreviewModal
          initialId={previewReferenceId}
          references={conversation.referenceImages}
          onClose={() => setPreviewReferenceId(null)}
        />
      ) : null}
    </form>
  )
}
