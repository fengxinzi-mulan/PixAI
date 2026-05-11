import type { JSX } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useDropdown } from '@renderer/components/common/Dropdown'

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
  const dropdown = useDropdown()
  const selectedOption = options.find((option) => option.value === value) || options[0]

  return (
    <div className={`gallery-select ${className}`} ref={dropdown.rootRef}>
      <button
        type="button"
        className="gallery-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={dropdown.open}
        onClick={dropdown.toggle}
      >
        <span>{selectedOption?.label || ariaLabel}</span>
        <ChevronDown size={14} />
      </button>
      {dropdown.open ? (
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
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  dropdown.close()
                  onChange(option.value)
                }}
                onClick={(event) => event.stopPropagation()}
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
