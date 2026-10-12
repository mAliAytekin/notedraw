export type PdfMarkKind = 'highlight' | 'underline' | 'strike'
/** Fractions of the displayed page, independent of viewport zoom and scroll. */
export interface PdfRect { x: number; y: number; width: number; height: number }
export interface PdfSelection { pdfId: string; page: number; text: string; rects: PdfRect[] }
export interface PdfAnnotation extends Omit<PdfSelection, 'pdfId'> { annotationId: string; kind: PdfMarkKind; createdAt: string }
export const pdfSelectionMime = 'application/x-knowledge-pdf-selection'
export const maxPdfText = 20_000
export const maxPdfMarks = 2_000
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const fraction = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
export function validPdfRects(value: unknown): value is PdfRect[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every(rect => object(rect) && fraction(rect.x) && fraction(rect.y) && fraction(rect.width) && rect.width > 0 && fraction(rect.height) && rect.height > 0 && rect.x + rect.width <= 1 + 1e-6 && rect.y + rect.height <= 1 + 1e-6)
}
export function validPdfSelection(value: unknown): value is PdfSelection {
  return object(value) && typeof value.pdfId === 'string' && !!value.pdfId && Number.isSafeInteger(value.page) && (value.page as number) >= 1 && typeof value.text === 'string' && !!value.text.trim() && value.text.length <= maxPdfText && validPdfRects(value.rects)
}
export function validPdfAnnotations(value: unknown, pageCount: number): value is PdfAnnotation[] {
  if (!Array.isArray(value) || value.length > maxPdfMarks) return false
  const ids = new Set<string>()
  return value.every(mark => {
    if (!object(mark) || typeof mark.annotationId !== 'string' || !mark.annotationId || ids.has(mark.annotationId) || !['highlight', 'underline', 'strike'].includes(mark.kind as string) || typeof mark.createdAt !== 'string' || !Number.isFinite(Date.parse(mark.createdAt)) || !validPdfSelection({ ...mark, pdfId: 'checked' }) || (mark.page as number) > pageCount) return false
    ids.add(mark.annotationId); return true
  })
}

/** Literal excerpt: selected wiki/Markdown syntax must not become active links or HTML. */
export function escapeExcerpt(text: string) { return text.replace(/[\\`*_{}\[\]()#+.!<>|~=$-]/g, '\\$&') }
export function quoteExcerpt(text: string) { return escapeExcerpt(text.replace(/\r\n?/g, '\n').trim()).split('\n').map(line => `> ${line}`).join('\n') }
