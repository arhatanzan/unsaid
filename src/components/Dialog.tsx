import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return <dialog ref={ref} className={`journal-dialog ${wide ? 'wide-dialog' : ''}`} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}>
    <button className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
    <h2 id="dialog-title">{title}</h2>
    {children}
  </dialog>
}
