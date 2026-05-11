import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Check, X } from 'lucide-react'

export type EditableOption = {
  value: string
  label: string
}

export function normalizeEditableOptions(options: Array<string | EditableOption>): EditableOption[] {
  const seen = new Set<string>()
  const normalized: EditableOption[] = []
  for (const option of options) {
    const value = typeof option === 'string' ? option.trim() : option.value.trim()
    const label = typeof option === 'string' ? value : option.label.trim() || value
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    normalized.push({ value, label })
  }
  return normalized
}

export function canCreateEditableOption(input: string, options: EditableOption[], allowCreate: boolean): boolean {
  const value = input.trim()
  if (!allowCreate || !value) return false
  const normalizedValue = value.toLowerCase()
  return !options.some((option) => {
    const optionValue = option.value.trim().toLowerCase()
    const optionLabel = option.label.trim().toLowerCase()
    return optionValue.includes(normalizedValue) || optionLabel.includes(normalizedValue)
  })
}

export function toggleEditableMultiValue(values: string[], value: string): string[] {
  const normalized = value.trim()
  if (!normalized) return values
  const exists = values.some((item) => item.trim().toLowerCase() === normalized.toLowerCase())
  return exists ? values.filter((item) => item.trim().toLowerCase() !== normalized.toLowerCase()) : [...values, normalized]
}

export function EditableSelect({
  value,
  options,
  ariaLabel,
  placeholder,
  allowCreate = false,
  className = '',
  onChange
}: {
  value: string
  options: Array<string | EditableOption>
  ariaLabel: string
  placeholder?: string
  allowCreate?: boolean
  className?: string
  onChange: (value: string) => void
}): JSX.Element {
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const normalizedOptions = useMemo(() => normalizeEditableOptions(options), [options])
  const filteredOptions = useMemo(() => filterEditableOptions(normalizedOptions, inputValue), [inputValue, normalizedOptions])
  const canCreate = canCreateEditableOption(inputValue, normalizedOptions, allowCreate)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useCloseOnOutsidePointer(rootRef, open, () => setOpen(false))

  const commit = (nextValue: string) => {
    const normalized = nextValue.trim()
    if (!normalized) return
    onChange(normalized)
    setInputValue(normalized)
    setOpen(false)
  }

  return (
    <div className={`editable-select ${className}`} ref={rootRef}>
      <input
        className="input-control editable-select-input"
        value={inputValue}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setInputValue(event.target.value)
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
            if (canCreate || normalizedOptions.some((option) => option.value.toLowerCase() === inputValue.trim().toLowerCase())) {
              event.preventDefault()
              commit(inputValue)
            }
          }
        }}
      />
      {open ? (
        <div className="editable-select-menu" role="listbox" aria-label={ariaLabel}>
          {canCreate ? (
            <button type="button" className="editable-select-option create" onClick={() => commit(inputValue)}>
              <span>新增「{inputValue.trim()}」</span>
            </button>
          ) : null}
          {filteredOptions.map((option) => {
            const selected = option.value.toLowerCase() === value.trim().toLowerCase()
            return (
              <button
                key={option.value}
                type="button"
                className={`editable-select-option ${selected ? 'selected' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => commit(option.value)}
              >
                <span>{option.label}</span>
                {selected ? <Check size={13} /> : null}
              </button>
            )
          })}
          {filteredOptions.length === 0 && !canCreate ? <div className="editable-select-empty">暂无匹配选项</div> : null}
        </div>
      ) : null}
    </div>
  )
}

export function EditableMultiSelect({
  values,
  options,
  ariaLabel,
  placeholder,
  allowCreate = false,
  className = '',
  onChange
}: {
  values: string[]
  options: Array<string | EditableOption>
  ariaLabel: string
  placeholder?: string
  allowCreate?: boolean
  className?: string
  onChange: (values: string[]) => void
}): JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const normalizedOptions = useMemo(() => normalizeEditableOptions(options), [options])
  const filteredOptions = useMemo(
    () => filterEditableOptions(normalizedOptions, inputValue).filter((option) => !containsEditableValue(values, option.value)),
    [inputValue, normalizedOptions, values]
  )
  const canCreate = canCreateEditableOption(inputValue, normalizedOptions, allowCreate) && !containsEditableValue(values, inputValue)

  useCloseOnOutsidePointer(rootRef, open, () => setOpen(false))

  const add = (nextValue: string) => {
    const normalized = nextValue.trim()
    if (!normalized) return
    if (!containsEditableValue(values, normalized)) onChange([...values, normalized])
    setInputValue('')
    setOpen(true)
  }

  const remove = (nextValue: string) => {
    onChange(values.filter((item) => item.trim().toLowerCase() !== nextValue.trim().toLowerCase()))
  }

  return (
    <div className={`editable-multi-select ${className}`} ref={rootRef}>
      <div className="editable-multi-select-input" onMouseDown={() => setOpen(true)}>
        {values.map((item) => (
          <button key={item} type="button" className="tag-pill" onClick={() => remove(item)} title="点击移除">
            <span>{item}</span>
            <X size={12} />
          </button>
        ))}
        <input
          className="editable-multi-select-text"
          value={inputValue}
          aria-label={ariaLabel}
          placeholder={values.length === 0 ? placeholder : ''}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setInputValue(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
              if (canCreate || normalizedOptions.some((option) => option.value.toLowerCase() === inputValue.trim().toLowerCase())) {
                event.preventDefault()
                add(inputValue)
              }
            } else if (event.key === 'Backspace' && !inputValue && values.length > 0) {
              remove(values[values.length - 1])
            }
          }}
        />
      </div>
      {open ? (
        <div className="editable-multi-select-menu" role="listbox" aria-label={ariaLabel}>
          {canCreate ? (
            <button type="button" className="editable-multi-select-option create" onClick={() => add(inputValue)}>
              <span>新增「{inputValue.trim()}」</span>
            </button>
          ) : null}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="editable-multi-select-option"
              role="option"
              aria-selected={false}
              onClick={() => add(option.value)}
            >
              <span>{option.label}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && !canCreate ? <div className="editable-select-empty">暂无匹配选项</div> : null}
        </div>
      ) : null}
    </div>
  )
}

function filterEditableOptions(options: EditableOption[], query: string): EditableOption[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return options
  return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery))
}

function containsEditableValue(values: string[], value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return Boolean(normalized) && values.some((item) => item.trim().toLowerCase() === normalized)
}

function useCloseOnOutsidePointer(
  rootRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, rootRef])
}
