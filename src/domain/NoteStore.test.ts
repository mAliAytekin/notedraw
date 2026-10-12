import { expect, it } from 'vitest'
import { NoteStore } from './NoteStore'

it('keeps a stable snapshot for no-op edits and advances revision only on content changes', () => {
  const demoNoteId = 'note:test'
  const notes = new NoteStore([{ noteId: demoNoteId, title: 'Bilinç Problemi', markdown: '# Bilinç Problemi', revision: 0, createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' }])
  const original = notes.get(demoNoteId)!
  notes.updateMarkdown(demoNoteId, original.markdown)
  expect(notes.get(demoNoteId)).toBe(original)
  notes.updateMarkdown(demoNoteId, '# Yeni düşünce')
  expect(notes.get(demoNoteId)?.revision).toBe(original.revision + 1)
  expect(original.markdown).toContain('Bilinç Problemi')
})
