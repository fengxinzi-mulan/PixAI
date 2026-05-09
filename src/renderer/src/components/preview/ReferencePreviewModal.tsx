import { useEffect, useMemo, useState, type JSX } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { ReferenceImage } from '@shared/types'

export function ReferencePreviewModal({
  initialId,
  references,
  onClose
}: {
  initialId: string
  references: ReferenceImage[]
  onClose: () => void
}): JSX.Element {
  const [currentId, setCurrentId] = useState(initialId)
  const currentIndex = Math.max(0, references.findIndex((reference) => reference.id === currentId))
  const reference = references[currentIndex] || references[0]
  const src = useMemo(() => window.pixai.reference.url(reference.id), [reference.id])
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < references.length - 1

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && canGoPrevious) setCurrentId(references[currentIndex - 1].id)
      if (event.key === 'ArrowRight' && canGoNext) setCurrentId(references[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoNext, canGoPrevious, currentIndex, onClose, references])

  return (
    <div
      className="modal open"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel reference-preview-panel">
        <div className="modal-head">
          <span>{reference.name || '参考图预览'}</span>
          <div className="mini-controls">
            <button title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="reference-preview-body">
          <button
            className="modal-nav previous"
            disabled={!canGoPrevious}
            onClick={() => canGoPrevious && setCurrentId(references[currentIndex - 1].id)}
            title="上一张"
          >
            <ChevronLeft size={24} />
          </button>
          <img src={src} alt={reference.name} />
          <button
            className="modal-nav next"
            disabled={!canGoNext}
            onClick={() => canGoNext && setCurrentId(references[currentIndex + 1].id)}
            title="下一张"
          >
            <ChevronRight size={24} />
          </button>
          <span className="modal-counter">{references.length ? `${currentIndex + 1}/${references.length}` : '1/1'}</span>
        </div>
      </div>
    </div>
  )
}
