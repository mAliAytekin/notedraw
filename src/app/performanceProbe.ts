// Enabled only in the test build, never for production.
export const performanceProbe = { cardRenders: {} as Record<string, number>, activeEditors: 0, maxEditors: 0, inputFrames: [] as number[] }
export function cardRendered(noteId: string) {
  if (import.meta.env.MODE === 'test') performanceProbe.cardRenders[noteId] = (performanceProbe.cardRenders[noteId] ?? 0) + 1
}
export function editorMounted() {
  if (import.meta.env.MODE !== 'test') return () => {}
  performanceProbe.activeEditors++; performanceProbe.maxEditors = Math.max(performanceProbe.maxEditors, performanceProbe.activeEditors)
  return () => { performanceProbe.activeEditors-- }
}
export function resetPerformanceProbe() {
  performanceProbe.cardRenders = {}; performanceProbe.inputFrames = []; performanceProbe.maxEditors = performanceProbe.activeEditors
}
export function startPerformanceProbe() {
  if (import.meta.env.MODE !== 'test') return () => {}
  const record = () => { const start = performance.now(); requestAnimationFrame(() => performanceProbe.inputFrames.push(performance.now() - start)) }
  document.addEventListener('input', record, true)
  return () => document.removeEventListener('input', record, true)
}
