import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type JSX } from 'react'
import { X } from 'lucide-react'
import type { PromptTemplate, PromptTemplateInput } from '@renderer/prompt-library'
import { IMAGE_QUALITIES, formatImageQuality, getDefaultImageSize, getImageSizeOptions } from '@shared/image-options'
import { GallerySelect, type GallerySelectOption } from '@renderer/components/gallery/GallerySelect'
import { EditableMultiSelect, EditableSelect } from '@renderer/components/common/EditableSelect'

const ratioOptions: Array<GallerySelectOption<PromptTemplate['ratio']>> = [
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '21:9', label: '21:9' },
  { value: '9:21', label: '9:21' }
]

const qualityOptions: Array<GallerySelectOption<PromptTemplate['quality']>> = IMAGE_QUALITIES.map((quality) => ({
  value: quality,
  label: formatImageQuality(quality)
}))

export function PromptTemplateEditorModal({
  initialValue,
  title,
  categoryOptions,
  tagOptions,
  onSave,
  onClose
}: {
  initialValue: PromptTemplateInput
  title: string
  categoryOptions: string[]
  tagOptions: string[]
  onSave: (value: PromptTemplateInput) => Promise<void> | void
  onClose: () => void
}): JSX.Element {
  const [form, setForm] = useState<PromptTemplateInput>(initialValue)
  const [errors, setErrors] = useState<Partial<Record<'title' | 'category' | 'prompt', string>>>({})

  useEffect(() => {
    setForm(initialValue)
    setErrors({})
  }, [initialValue])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const suggestedTags = useMemo(
    () => Array.from(new Set(tagOptions.map((tag) => tag.trim()).filter(Boolean))),
    [tagOptions]
  )
  const suggestedCategories = useMemo(
    () => Array.from(new Set(categoryOptions.map((item) => item.trim()).filter(Boolean))),
    [categoryOptions]
  )
  const resolutionOptions = useMemo(() => getImageSizeOptions(form.ratio), [form.ratio])

  const submit = async () => {
    const nextErrors = validatePromptTemplateInput(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    await onSave({
      ...form,
      tags: form.tags.filter(Boolean),
      resolution: normalizeResolution(form.ratio, form.resolution)
    })
  }

  const updateRatio = (ratio: PromptTemplate['ratio']) => {
    setForm((current) => {
      const currentResolutionValid = getImageSizeOptions(ratio).some((option) => option.value === current.resolution)
      return {
        ...current,
        ratio,
        resolution: currentResolutionValid ? current.resolution : getDefaultImageSize(ratio)
      }
    })
  }

  const content = (
    <div
      className="modal open"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-panel prompt-editor-panel">
        <div className="modal-head">
          <span>{title}</span>
          <div className="mini-controls">
            <button title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="prompt-editor-body">
          <label className="field">
            <span>标题 *</span>
            <input
              className="input-control"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            {errors.title ? <span className="field-error">{errors.title}</span> : null}
          </label>
          <div className="prompt-editor-row">
            <label className="field">
              <span>比例</span>
              <GallerySelect
                value={form.ratio}
                options={ratioOptions}
                ariaLabel="比例"
                className="settings-select"
                onChange={(ratio) => updateRatio(ratio)}
              />
            </label>
            <label className="field">
              <span>分辨率</span>
              <GallerySelect
                value={form.resolution}
                options={resolutionOptions.map((option) => ({ value: option.value, label: option.label }))}
                ariaLabel="分辨率"
                className="settings-select"
                onChange={(resolution) => setForm((current) => ({ ...current, resolution }))}
              />
            </label>
            <label className="field">
              <span>质量</span>
              <GallerySelect
                value={form.quality}
                options={qualityOptions}
                ariaLabel="质量"
                className="settings-select"
                onChange={(quality) => setForm((current) => ({ ...current, quality }))}
              />
            </label>
          </div>
          <div className="prompt-editor-top-row">
            <div className="field">
              <span>分类 *</span>
              <EditableSelect
                value={form.category}
                options={suggestedCategories}
                ariaLabel="分类选择"
                placeholder="可输入或选择分类"
                allowCreate
                onChange={(category) => setForm((current) => ({ ...current, category }))}
              />
              {errors.category ? <span className="field-error">{errors.category}</span> : null}
            </div>
            <div className="field">
              <span>标签</span>
              <EditableMultiSelect
                values={form.tags}
                options={suggestedTags}
                ariaLabel="标签多选"
                placeholder="输入标签并回车，或从下拉中选择"
                allowCreate
                onChange={(tags) => setForm((current) => ({ ...current, tags }))}
              />
            </div>
          </div>
          <label className="field">
            <span>说明</span>
            <textarea
              className="prompt-editor-textarea"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>提示词 *</span>
            <textarea
              className="prompt-editor-textarea"
              value={form.prompt}
              onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
            />
            {errors.prompt ? <span className="field-error">{errors.prompt}</span> : null}
          </label>
          <div className="prompt-editor-actions">
            <button type="button" className="primary" onClick={() => void submit()}>
              保存
            </button>
            <button type="button" onClick={onClose}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

function normalizeResolution(ratio: PromptTemplate['ratio'], value: string): string {
  return getImageSizeOptions(ratio).some((option) => option.value === value) ? value : getDefaultImageSize(ratio)
}

function validatePromptTemplateInput(input: PromptTemplateInput): Partial<Record<'title' | 'category' | 'prompt', string>> {
  const errors: Partial<Record<'title' | 'category' | 'prompt', string>> = {}
  if (!input.title.trim()) errors.title = '请填写标题'
  if (!input.category.trim()) errors.category = '请填写分类'
  if (!input.prompt.trim()) errors.prompt = '请填写提示词'
  return errors
}
