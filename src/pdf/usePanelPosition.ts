import { useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import type { ReaderState } from '../domain/Workspace'

type Point = { x: number; y: number }
type Layout = Point & { width: number; height: number }
export type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type Action = 'move' | ResizeEdge

/** Screen coordinates stay independent of tldraw's camera and sidebar width. */
export function usePanelPosition(boardId: string, reader: ReaderState, save: (update: Partial<ReaderState>) => void) {
  const panel = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState<DOMRect>()
  const [moving, setMoving] = useState<{ boardId: string; layout: Layout }>()
  const drag = useRef<{ pointerId: number; start: Point; origin: Layout; layout: Layout; boardId: string; action: Action } | undefined>(undefined)

  useLayoutEffect(() => {
    const parent = panel.current?.parentElement
    if (!parent) return
    const measure = () => setBounds(parent.getBoundingClientRect())
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const maxWidth = Math.max(0, (bounds?.width ?? 436) - 16)
  const maxHeight = Math.max(0, (bounds?.height ?? 348) - 16)
  const minWidth = Math.min(320, maxWidth), minHeight = Math.min(260, maxHeight)
  const clamp = (layout: Layout): Layout => {
    const width = Math.max(minWidth, Math.min(layout.width, maxWidth))
    const height = Math.max(minHeight, Math.min(layout.height, maxHeight))
    if (!bounds) return { ...layout, width, height }
    return {
      x: Math.max(bounds.left + 8, Math.min(layout.x, bounds.right - width - 8)),
      y: Math.max(bounds.top + 8, Math.min(layout.y, bounds.bottom - height - 8)), width, height,
    }
  }
  const width = reader.size?.width ?? Math.min(420, Math.max(minWidth, (bounds?.width ?? 875) * .48))
  const height = reader.size?.height ?? Math.max(260, (bounds?.height ?? 348) - 88)
  const layout = clamp((moving?.boardId === boardId ? moving.layout : undefined) ?? {
    x: (bounds?.right ?? 0) - width - 18, y: (bounds?.top ?? 0) + 18,
    ...reader.position, width, height,
  })
  const resize = (origin: Layout, edge: ResizeEdge, dx: number, dy: number): Layout => {
    const rect = clamp(origin)
    let left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height
    if (edge.includes('w')) left = Math.max((bounds?.left ?? 0) + 8, Math.min(left + dx, right - minWidth))
    if (edge.includes('e')) right = Math.max(left + minWidth, Math.min(right + dx, (bounds?.right ?? right + dx + 8) - 8))
    if (edge.includes('n')) top = Math.max((bounds?.top ?? 0) + 8, Math.min(top + dy, bottom - minHeight))
    if (edge.includes('s')) bottom = Math.max(top + minHeight, Math.min(bottom + dy, (bounds?.bottom ?? bottom + dy + 8) - 8))
    return { x: left, y: top, width: right - left, height: bottom - top }
  }
  const commit = (value: Layout, action: Action) => save({
    position: { x: value.x, y: value.y },
    ...(action === 'move' ? {} : { size: { width: value.width, height: value.height } }),
  })
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, action: Action) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: layout, layout, boardId, action }
  }
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId || current.boardId !== boardId) return
    const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y
    current.layout = current.action === 'move'
      ? clamp({ ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy })
      : resize(current.origin, current.action, dx, dy)
    setMoving({ boardId, layout: current.layout })
  }
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = undefined
    if (current.boardId === boardId) commit(clamp(current.layout), current.action)
    setMoving(undefined)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const cancel = () => { drag.current = undefined; setMoving(undefined) }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, action: Action) => {
    const delta: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
    const direction = delta[event.key]
    if (!direction) return
    event.preventDefault(); event.stopPropagation()
    const step = event.shiftKey ? 20 : 10
    const dx = direction.x * step, dy = direction.y * step
    commit(action === 'move' ? clamp({ ...layout, x: layout.x + dx, y: layout.y + dy }) : resize(layout, action, dx, dy), action)
  }
  const handlers = (action: Action) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => onPointerDown(event, action),
    onPointerMove, onPointerUp, onPointerCancel: cancel, onLostPointerCapture: cancel,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, action),
  })
  return {
    panel,
    style: { left: layout.x, top: layout.y, width: layout.width, height: layout.height, visibility: bounds ? 'visible' as const : 'hidden' as const },
    handle: handlers('move'), resizeHandle: (edge: ResizeEdge) => handlers(edge),
  }
}
