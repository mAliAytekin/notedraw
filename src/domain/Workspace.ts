import { createTLStore, defaultBindingUtils, defaultShapeUtils, DocumentRecordType, PageRecordType, type TLStoreSnapshot } from 'tldraw'
import { MarkdownCardShapeUtil } from '../canvas/MarkdownCardShapeUtil'
import type { Board, BoardEnvelope } from './Board'
import type { Note } from './NoteStore'
import type { PdfAnnotation } from '../pdf/annotations'

export interface Folder { folderId: string; parentId: string | null; name: string }
export interface PdfFile { pdfId: string; name: string; data: string; pageCount: number; createdAt: string; missing?: boolean; annotations?: PdfAnnotation[] }
export interface ReaderState { pdfId: string | null; page: number; zoom: number; open: boolean; position?: { x: number; y: number }; size?: { width: number; height: number } }
export interface WorkspaceEnvelope {
  format: 'knowledge-canvas-workspace'
  schemaVersion: 1
  revision: number
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  folders: Folder[]
  boards: Board[]
  notes: Note[]
  activeBoardId: string
  pdfs: PdfFile[]
  readers: Record<string, ReaderState>
}
export type PersistedEnvelope = BoardEnvelope | WorkspaceEnvelope

export function fromBoard(value: BoardEnvelope): WorkspaceEnvelope {
  return {
    format: 'knowledge-canvas-workspace', schemaVersion: 1, revision: value.revision,
    workspaceId: `workspace:${value.board.boardId}`, title: 'Knowledge workspace',
    createdAt: value.board.createdAt, updatedAt: value.board.updatedAt,
    folders: [], boards: [{ ...value.board, folderId: null }],
    notes: value.notes.map(note => ({ ...note, folderId: null })),
    activeBoardId: value.board.boardId, pdfs: [], readers: {},
  }
}

export function emptyDocument(): TLStoreSnapshot {
  const store = createTLStore({ shapeUtils: [...defaultShapeUtils, MarkdownCardShapeUtil], bindingUtils: defaultBindingUtils })
  store.put([
    DocumentRecordType.create({ id: DocumentRecordType.createId('document'), name: 'Board' }),
    PageRecordType.create({ id: PageRecordType.createId('page'), name: 'Page 1', index: 'a1' as never }),
  ])
  const document = store.getStoreSnapshot()
  store.dispose()
  return document
}

/** Logical browser folders; paths are derived, identifiers never change on rename/move. */
export class WorkspaceStore {
  private listeners = new Set<() => void>()
  constructor(private state: WorkspaceEnvelope) {}
  get = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  replace(state: WorkspaceEnvelope) { this.state = state; this.emit() }
  update(update: Partial<WorkspaceEnvelope>, notify = true) {
    this.state = { ...this.state, ...update, updatedAt: new Date().toISOString() }
    if (notify) this.emit()
  }
  private emit() { for (const listener of this.listeners) listener() }
  assertFolder(id: string | null) {
    if (id !== null && !this.state.folders.some(folder => folder.folderId === id)) throw new Error('Hedef klasör bulunamadı.')
  }
  folderPath(id: string | null): string {
    if (!id) return '/'
    const folder = this.state.folders.find(item => item.folderId === id)
    return folder ? `${this.folderPath(folder.parentId).replace(/\/$/, '')}/${folder.name}` : '/'
  }
  descendants(id: string) {
    const ids = new Set([id])
    for (let count = 0; count < this.state.folders.length; count++) {
      for (const folder of this.state.folders) if (folder.parentId && ids.has(folder.parentId)) ids.add(folder.folderId)
    }
    return ids
  }
  private validName(name: string, parentId: string | null, except?: string) {
    const clean = name.trim()
    if (!clean || clean.length > 100 || /[\\/\u0000-\u001f]/.test(clean)) throw new Error('Ad 1–100 karakter olmalı; eğik çizgi veya kontrol karakteri içermemeli.')
    if (this.state.folders.some(item => item.folderId !== except && item.parentId === parentId && item.name.toLocaleLowerCase('tr') === clean.toLocaleLowerCase('tr'))) throw new Error('Bu klasörde aynı adlı başka bir klasör var.')
    return clean
  }
  createFolder(name: string, parentId: string | null) {
    this.assertFolder(parentId)
    const folder: Folder = { folderId: `folder:${crypto.randomUUID()}`, parentId, name: this.validName(name, parentId) }
    this.update({ folders: [...this.state.folders, folder] })
    return folder
  }
  editFolder(id: string, name: string, parentId: string | null) {
    this.assertFolder(parentId)
    if (parentId && this.descendants(id).has(parentId)) throw new Error('Klasör kendisinin veya alt klasörünün içine taşınamaz.')
    const clean = this.validName(name, parentId, id)
    this.update({ folders: this.state.folders.map(folder => folder.folderId === id ? { ...folder, name: clean, parentId } : folder) })
  }
  setDocument(boardId: string, document: TLStoreSnapshot) {
    const previous = this.state.boards.find(board => board.boardId === boardId)
    if (previous && JSON.stringify(previous.document) === JSON.stringify(document)) return
    this.update({ boards: this.state.boards.map(board => board.boardId === boardId ? { ...board, document, updatedAt: new Date().toISOString() } : board) }, false)
  }
}
