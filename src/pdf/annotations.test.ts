import { describe, expect, it } from 'vitest'
import { validPdfAnnotations, validPdfSelection, quoteExcerpt, maxPdfText, type PdfAnnotation } from './annotations'
import { validateWorkspace } from '../storage/validateWorkspace'
import { fromBoard } from '../domain/Workspace'
import { envelope } from '../tests/fixtures'

const selection = { pdfId: 'pdf:1', page: 2, text: 'Bilinç 👋', rects: [{ x: .1, y: .2, width: .3, height: .04 }] }
const mark: PdfAnnotation = { page: selection.page, text: selection.text, rects: selection.rects, annotationId: 'mark:1', kind: 'underline', createdAt: '2026-10-09T12:00:00Z' }
describe('PDF selections and workspace metadata', () => {
  it('accepts old backups and round-trips marks without changing PDF bytes', () => {
    const state = fromBoard(envelope())
    state.pdfs = [{ pdfId: 'pdf:1', name: 'okuma.pdf', pageCount: 2, data: 'data:application/pdf;base64,JVBERi0xLjQK', createdAt: state.createdAt }]
    expect(validateWorkspace(state)).toEqual(state)
    state.pdfs[0].annotations = [mark]
    expect(validateWorkspace(state)).toEqual(state)
    expect(validPdfAnnotations([mark], 2)).toBe(true)
    for (const bad of [{ ...mark, kind: 'other' }, { ...mark, page: 3 }, { ...mark, createdAt: 'bad' }, { ...mark, text: '' }, { ...mark, rects: [] }, { ...mark, rects: [{ x: .9, y: .2, width: .3, height: .04 }] }, { ...mark, rects: [{ x: NaN, y: 0, width: 1, height: .1 }] }]) {
      expect(validPdfAnnotations([bad], 2)).toBe(false)
      expect(() => validateWorkspace({ ...state, pdfs: [{ ...state.pdfs[0], annotations: [bad] }] })).toThrow()
    }
    expect(validPdfAnnotations([mark, mark], 2)).toBe(false)
  })
  it('rejects invalid drag payloads and bounds its text/geometry', () => {
    expect(validPdfSelection(selection)).toBe(true)
    for (const bad of [null, {}, { ...selection, page: 1.5 }, { ...selection, pdfId: '' }, { ...selection, text: ' '.repeat(5) }, { ...selection, text: 'a'.repeat(maxPdfText + 1) }, { ...selection, rects: Array(501).fill(selection.rects[0]) }, { ...selection, rects: [{ x: 0, y: 0, width: Infinity, height: .1 }] }]) expect(validPdfSelection(bad)).toBe(false)
  })
  it('quotes selected Markdown/wiki/HTML/math literally, preserving line breaks and Unicode', () => {
    expect(quoteExcerpt(' [[Qualia]] *bilinç*\r\n<script> $x$ 👋 ')).toBe('> \\[\\[Qualia\\]\\] \\*bilinç\\*\n> \\<script\\> \\$x\\$ 👋')
  })
})
