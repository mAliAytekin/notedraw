import { createTLStore, defaultShapeUtils, defaultBindingUtils, DocumentRecordType, PageRecordType, createShapeId } from 'tldraw'
import { MarkdownCardShapeUtil } from '../canvas/MarkdownCardShapeUtil'
import { createEnvelope } from '../domain/Board'
import type { BoardEnvelope } from '../domain/Board'

export function envelope(revision = 1): BoardEnvelope {
  const store = createTLStore({ shapeUtils: [...defaultShapeUtils, MarkdownCardShapeUtil], bindingUtils: defaultBindingUtils })
  const pageId = PageRecordType.createId('test')
  store.put([
    DocumentRecordType.create({ id: DocumentRecordType.createId('document'), name: 'Test' }),
    PageRecordType.create({ id: pageId, name: 'Page 1', index: 'a1' as never }),
  ])
  store.put([store.schema.types.shape.create({ id: createShapeId('test'), type: 'markdown-card', parentId: pageId, index: 'a1', x: 20, y: 20, props: { w: 360, h: 320, noteId: 'note:test' } } as never)])
  const now = '2026-10-08T12:00:00Z'
  const value = createEnvelope({ boardId: 'board:test', title: 'Test', createdAt: now, updatedAt: now, document: store.getStoreSnapshot() }, [{ noteId: 'note:test', title: 'Not', markdown: '# Bilinç', revision: 1, createdAt: now, updatedAt: now }], revision)
  store.dispose()
  return value
}
