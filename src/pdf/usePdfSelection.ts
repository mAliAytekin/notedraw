import { useCallback, useEffect, useState, type RefObject } from 'react'
import { maxPdfText, type PdfRect, type PdfSelection } from './annotations'

function readSelection(layer: HTMLElement | null, pdfId: string, page: number): PdfSelection | undefined {
  const selected = window.getSelection()
  if (!layer || !selected || selected.isCollapsed || !selected.rangeCount || !layer.contains(selected.anchorNode) || !layer.contains(selected.focusNode)) return
  const text = selected.toString().trim()
  if (!text || text.length > maxPdfText) return
  const bounds = layer.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  const rects: PdfRect[] = []
  for (let i = 0; i < selected.rangeCount; i++) {
    for (const rect of selected.getRangeAt(i).getClientRects()) {
      const left = Math.max(bounds.left, rect.left), top = Math.max(bounds.top, rect.top)
      const right = Math.min(bounds.right, rect.right), bottom = Math.min(bounds.bottom, rect.bottom)
      if (right - left < .5 || bottom - top < .5) continue
      const next = { x: (left - bounds.left) / bounds.width, y: (top - bounds.top) / bounds.height, width: (right - left) / bounds.width, height: (bottom - top) / bounds.height }
      // Range can return both a span and its text rectangle. Merge overlapping
      // rectangles on the same line, without bridging separate text columns.
      const previous = rects.find(value => Math.abs(value.y - next.y) < Math.min(value.height, next.height) * .2 && Math.abs(value.height - next.height) < Math.max(value.height, next.height) * .2 && next.x <= value.x + value.width + .002 && value.x <= next.x + next.width + .002)
      if (previous) {
        const right = Math.max(previous.x + previous.width, next.x + next.width)
        previous.x = Math.min(previous.x, next.x); previous.width = right - previous.x
      } else rects.push(next)
    }
  }
  if (!rects.length || rects.length > 500) return
  return { pdfId, page, text, rects }
}

export function usePdfSelection(layer: RefObject<HTMLDivElement | null>, pdfId: string | undefined, page: number, zoom: number, enabled: boolean) {
  const [selection, setSelection] = useState<PdfSelection>()
  const capture = useCallback(() => enabled && pdfId ? readSelection(layer.current, pdfId, page) : undefined, [layer, pdfId, page, enabled, zoom])
  useEffect(() => {
    setSelection(undefined)
    const changed = () => setSelection(capture())
    window.document.addEventListener('selectionchange', changed)
    return () => window.document.removeEventListener('selectionchange', changed)
  }, [capture])
  return { selection: enabled && selection && selection.pdfId === pdfId && selection.page === page ? selection : undefined, capture }
}
