import { useEffect } from 'react'

export function useModalAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null, previous: HTMLElement | null = null
    let outside: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[role="dialog"][aria-modal="true"]')) outside = event.target
    }
    const observe = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      const next = dialogs[dialogs.length - 1] ?? null
      if (next === active) return
      if (next) {
        previous = outside
        active = next
        if (!next.contains(document.activeElement)) (next.querySelector<HTMLElement>('[autofocus], input, [data-dialog-dismiss], button') ?? next).focus()
      } else { active = null; if (previous?.isConnected) previous.focus(); previous = null }
    }
    const key = (event: KeyboardEvent) => {
      if (!active || event.isComposing) return
      if (event.key === 'Escape') {
        const dismiss = active.querySelector<HTMLButtonElement>('[data-dialog-dismiss]:not(:disabled)')
        if (dismiss) { event.preventDefault(); event.stopImmediatePropagation(); dismiss.click() }
      } else if (event.key === 'Tab') {
        const controls = [...active.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length && !el.hidden)
        const first = controls[0], last = controls[controls.length - 1]
        if (!first) { event.preventDefault(); active.focus(); return }
        if (!active.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); event.stopImmediatePropagation(); (event.shiftKey ? last : first).focus()
        }
      }
    }
    const observer = new MutationObserver(observe)
    observer.observe(document.body, { subtree: true, childList: true }); observe()
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', focus, true)
    return () => { observer.disconnect(); document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', focus, true) }
  }, [])
}
