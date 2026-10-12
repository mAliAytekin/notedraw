import { createTLStore, defaultShapeUtils, defaultBindingUtils, type TLRecord, type TLStoreSnapshot } from 'tldraw'
import { MarkdownCardShapeUtil } from '../canvas/MarkdownCardShapeUtil'
import type { BoardEnvelope } from '../domain/Board'
import type { Note } from '../domain/NoteStore'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value))
function invalid(): never { throw new Error('Yedek/kayıt biçimi geçersiz. Mevcut veri korunuyor.') }

export function validateEnvelope(input: unknown): BoardEnvelope {
  if (!object(input) || input.format !== 'knowledge-canvas-board') invalid()
  if (input.schemaVersion !== 1) throw new Error('Bu veri sürümü desteklenmiyor. Daha yeni bir uygulama gerekebilir; veri değiştirilmedi.')
  if (!revision(input.revision) || !object(input.board) || !Array.isArray(input.notes)) invalid()
  const board = input.board
  if (!text(board.boardId) || !board.boardId || !text(board.title) || !timestamp(board.createdAt) || !timestamp(board.updatedAt)) invalid()
  const noteIds = new Set<string>()
  for (const note of input.notes) {
    if (!object(note) || !text(note.noteId) || !note.noteId || noteIds.has(note.noteId) || !text(note.title) || !text(note.markdown) || !revision(note.revision) || !timestamp(note.createdAt) || !timestamp(note.updatedAt)) invalid()
    noteIds.add(note.noteId)
  }
  if (!object(board.document) || !object(board.document.store) || !object(board.document.schema)) invalid()
  const document = structuredClone(board.document) as unknown as TLStoreSnapshot
  const temp = createTLStore({ shapeUtils: [...defaultShapeUtils, MarkdownCardShapeUtil], bindingUtils: defaultBindingUtils })
  try {
    const result = temp.schema.migrateStoreSnapshot(document)
    if (result.type !== 'success') throw new Error('Tuval şema sürümü desteklenmiyor.')
    const records = Object.values(result.value)
    for (const [id, record] of Object.entries(result.value)) {
      if (!object(record) || record.id !== id || !temp.scopedTypes.document.has(record.typeName)) invalid()
      temp.schema.validateRecord(temp, record as TLRecord, 'initialize', null)
    }
    if (records.filter(record => record.typeName === 'document').length !== 1 || records.filter(record => record.typeName === 'page').length !== 1) invalid()
    const recordIds = new Set(records.map(record => record.id))
    const byId = new Map(records.map(record => [record.id, record]))
    for (const record of records) {
      if (record.typeName === 'shape') {
        const seen = new Set([record.id])
        let parent = byId.get(record.parentId)
        while (parent?.typeName === 'shape') {
          if (seen.has(parent.id)) invalid()
          seen.add(parent.id)
          parent = byId.get(parent.parentId)
        }
        if (!parent || parent.typeName !== 'page') invalid()
        if (record.type === 'embed' || record.type === 'video') throw new Error('Bu fazda video ve embed desteklenmiyor.')
        if (record.type === 'markdown-card' && (record.props.w <= 0 || record.props.h <= 0 || !record.props.noteId)) invalid()
        if (record.type === 'image' && !recordIds.has(record.props.assetId!)) invalid()
      }
      if (record.typeName === 'binding' && (byId.get(record.fromId)?.typeName !== 'shape' || byId.get(record.toId)?.typeName !== 'shape')) invalid()
      if (record.typeName === 'asset') {
        // Raster images only. Persist actual bytes; blob/remote URLs cannot survive backup/reload.
        if (record.type !== 'image' || !record.props.src || !/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.props.src)) {
          throw new Error('Yalnız baytları yedeğe dahil edilmiş PNG/JPEG/WebP/GIF/AVIF görseller destekleniyor.')
        }
      }
    }
    temp.put(records)
    return {
      format: 'knowledge-canvas-board', schemaVersion: 1, revision: input.revision as number,
      board: { boardId: board.boardId as string, title: board.title as string, createdAt: board.createdAt as string, updatedAt: board.updatedAt as string, document: { store: result.value, schema: temp.schema.serialize() } },
      notes: structuredClone(input.notes) as Note[],
    }
  } finally { temp.dispose() }
}
