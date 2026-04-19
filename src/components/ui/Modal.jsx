import { useEffect } from 'react'

export function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[#141414] border border-[#2e2e2e] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col">
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2e2e2e] text-[#777] hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-5 pb-6 pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}
