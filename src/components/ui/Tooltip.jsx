import { useEffect, useId, useRef, useState } from 'react'

/**
 * Small ? next to a label — hover shows tip on desktop; tap toggles on mobile.
 */
export function Tooltip({ label, tip }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-label={`Help: ${label}`}
        className="inline-flex h-[14px] w-[14px] shrink-0 cursor-help items-center justify-center rounded-full bg-[#333333] text-[9px] font-bold text-[#888888]"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseEnter={() => {
          if (window.matchMedia('(hover: hover)').matches) setOpen(true)
        }}
        onMouseLeave={() => {
          if (window.matchMedia('(hover: hover)').matches) setOpen(false)
        }}
      >
        ?
      </button>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[200] w-[220px] -translate-x-1/2 rounded-md border border-[#444444] bg-[#2a2a2a] px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-[#cccccc] whitespace-normal shadow-lg"
        >
          {tip}
        </span>
      ) : null}
    </span>
  )
}
