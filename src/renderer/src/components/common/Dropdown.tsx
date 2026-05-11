import { useEffect, useRef, useState, type RefObject } from 'react'

export type DropdownState = {
  open: boolean
  rootRef: RefObject<HTMLDivElement | null>
  toggle: () => void
  close: () => void
}

export function useDropdown(): DropdownState {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

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

  return {
    open,
    rootRef,
    toggle: () => setOpen((value) => !value),
    close: () => setOpen(false)
  }
}
