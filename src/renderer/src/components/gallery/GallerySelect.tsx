import { useEffect, useRef, useState, type JSX } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type GallerySelectOption<T extends string | number> = {
  value: T
  label: string
}

export function GallerySelect<T extends string | number>({
  value,
  options,
  ariaLabel,
  className = '',
  onChange
}: {
  value: T
  options: Array<GallerySelectOption<T>>
  ariaLabel: string
  className?: string
  onChange: (value: T) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={`gallery-select ${className}`} ref={rootRef}>
      <button
        type="button"
        className="gallery-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedOption?.label || ariaLabel}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="gallery-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={String(option.value)}
                type="button"
                className={selected ? 'selected' : ''}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check size={13} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
