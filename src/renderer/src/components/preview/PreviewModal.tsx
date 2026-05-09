import { useEffect, useMemo, useRef, useState, type JSX, type SyntheticEvent, type WheelEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, RotateCcw, SquarePen, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { ImageHistoryItem } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { ReferencePreviewModal } from './ReferencePreviewModal'
import {
  clampPreviewZoom,
  formatPreviewZoom,
  getInitialPreviewZoom,
  getInitialPreviewZoomForArea,
  getPreviewMetadataRows,
  getPreviewZoomAfterWheel
} from '@renderer/image-preview'

const previewFitOptions = { widthRatio: 0.68, heightRatio: 0.86, maxWidth: 820, maxHeight: 820 }
const previewArtPadding = 36

function getPreviewFitZoom(
  imageSize: { width: number; height: number },
  artSize: { width: number; height: number } | null
): number {
  if (artSize) {
    return getInitialPreviewZoomForArea(artSize.width, artSize.height, imageSize.width, imageSize.height, previewArtPadding)
  }
  return getInitialPreviewZoom(window.innerWidth, window.innerHeight, imageSize.width, imageSize.height, previewFitOptions)
}

export function PreviewModal({
  initialItem,
  items,
  onClose
}: {
  initialItem: ImageHistoryItem
  items: ImageHistoryItem[]
  onClose: () => void
}): JSX.Element {
  const { addHistoryAsReference, notify } = useAppStore()
  const artRef = useRef<HTMLDivElement | null>(null)
  const [currentId, setCurrentId] = useState(initialItem.id)
  const [zoom, setZoom] = useState(1)
  const [previewReferenceId, setPreviewReferenceId] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [artSize, setArtSize] = useState<{ width: number; height: number } | null>(null)
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId))
  const item = items[currentIndex] || initialItem
  const src = useMemo(() => window.pixai.image.url(item.id), [item.id])
  const metadataRows = useMemo(() => getPreviewMetadataRows(item), [item])
  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < items.length - 1

  useEffect(() => {
    setZoom(1)
    setImageSize(null)
  }, [item.id])

  useEffect(() => {
    const element = artRef.current
    if (!element) return

    const updateSize = () => {
      setArtSize({ width: element.clientWidth, height: element.clientHeight })
    }
    updateSize()

    const ResizeObserverCtor = window.ResizeObserver
    if (!ResizeObserverCtor) return

    const observer = new ResizeObserverCtor(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && canGoPrevious) setCurrentId(items[currentIndex - 1].id)
      if (event.key === 'ArrowRight' && canGoNext) setCurrentId(items[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoNext, canGoPrevious, currentIndex, items, onClose])

  useEffect(() => {
    if (!imageSize) return
    setZoom(getPreviewFitZoom(imageSize, artSize))
  }, [artSize, imageSize])

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom((value) => getPreviewZoomAfterWheel(value, event.deltaY))
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget
    const nextImageSize = { width: target.naturalWidth, height: target.naturalHeight }
    setImageSize(nextImageSize)
    setZoom(getPreviewFitZoom(nextImageSize, artSize))
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(item.prompt || '')
    notify('已复制提示词')
  }

  const editImage = async () => {
    await addHistoryAsReference(item.id)
    onClose()
  }

  return (
    <div
      className="modal open"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel">
        <div className="modal-head">
          <span>图片预览</span>
          <div className="mini-controls">
            <button title="缩小" onClick={() => setZoom((value) => clampPreviewZoom(value - 0.15))}>
              <ZoomOut size={15} />
            </button>
            <span className="zoom-value">{formatPreviewZoom(zoom)}</span>
            <button title="放大" onClick={() => setZoom((value) => clampPreviewZoom(value + 0.15))}>
              <ZoomIn size={15} />
            </button>
            <button title="重置缩放" onClick={() => setZoom(imageSize ? getPreviewFitZoom(imageSize, artSize) : 1)}>
              <RotateCcw size={15} />
            </button>
            <button title="复制图片" onClick={() => void window.pixai.image.copy(item.id).then(() => notify('已复制到剪贴板'))}>
              <Copy size={15} />
            </button>
            <button title="下载图片" onClick={() => void window.pixai.image.download(item.id).then((path) => path && notify('已保存图片'))}>
              <Download size={15} />
            </button>
            <button title="编辑" onClick={() => void editImage()}>
              <SquarePen size={14} />
            </button>
            <button title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-art" ref={artRef} onWheel={handleWheel}>
            <button
              className="modal-nav previous"
              disabled={!canGoPrevious}
              onClick={() => canGoPrevious && setCurrentId(items[currentIndex - 1].id)}
              title="上一张"
            >
              <ChevronLeft size={24} />
            </button>
            <img
              src={src}
              alt={item.prompt}
              onLoad={handleImageLoad}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
            <button
              className="modal-nav next"
              disabled={!canGoNext}
              onClick={() => canGoNext && setCurrentId(items[currentIndex + 1].id)}
              title="下一张"
            >
              <ChevronRight size={24} />
            </button>
            <span className="modal-counter">{items.length ? `${currentIndex + 1}/${items.length}` : '1/1'}</span>
          </div>
          <aside className="modal-prompt">
            <div className="modal-meta">
              {metadataRows.map((row) => (
                <div key={row.label} className="modal-meta-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
            <div className="modal-prompt-head">
              <span>提示词</span>
              <button title="复制提示词" onClick={() => void copyPrompt()}>
                <Copy size={14} />
              </button>
            </div>
            <p>{item.prompt || '无提示词'}</p>
            {item.generationMode === 'image-to-image' && item.referenceImages.length > 0 ? (
              <div className="modal-references">
                <div className="modal-prompt-head">
                  <span>参考图</span>
                </div>
                <div className="modal-reference-grid">
                  {item.referenceImages.map((reference) => (
                    <button
                      key={reference.id}
                      type="button"
                      title="预览参考图"
                      onClick={() => setPreviewReferenceId(reference.id)}
                    >
                      <img src={window.pixai.reference.url(reference.id)} alt={reference.name} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
      {previewReferenceId ? (
        <ReferencePreviewModal
          initialId={previewReferenceId}
          references={item.referenceImages}
          onClose={() => setPreviewReferenceId(null)}
        />
      ) : null}
    </div>
  )
}
