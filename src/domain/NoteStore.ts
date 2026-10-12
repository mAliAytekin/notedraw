import { catalog, rewriteLinks, type NoteSummary } from './knowledge'
import type { Folder } from './Workspace'

export interface Note {
  folderId?: string | null
  noteId: string
  title: string
  markdown: string
  revision: number
  createdAt: string
  updatedAt: string
}

/** Canonical note state. Canvas history deliberately does not own note text. */
export class NoteStore {
  private notes = new Map<string, Note>()
  private listeners = new Set<() => void>()
  private snapshot: Note[] = []
  private summaries: NoteSummary[] = []
  private folders = (): Folder[] => []

  constructor(notes: Note[] = []) {
    for (const note of notes) this.notes.set(note.noteId, { ...note })
    this.snapshot = [...this.notes.values()]
    this.updateSummaries()
  }

  get = (noteId: string): Note | undefined => this.notes.get(noteId)
  all = (): Note[] => this.snapshot
  catalog = () => this.summaries
  setFolderProvider(provider: () => Folder[]) { this.folders = provider }
  private updateSummaries() {
    const next = this.snapshot.map(({ noteId, title, folderId }) => ({ noteId, title, folderId }))
    if (JSON.stringify(next) !== JSON.stringify(this.summaries)) this.summaries = next
  }
  rewriteReferences(before: ReturnType<typeof catalog>, after: ReturnType<typeof catalog>, changed: Set<string>, deleted = false) {
    const now = new Date().toISOString()
    for (const note of this.notes.values()) {
      const markdown = rewriteLinks(note.markdown, before, after, changed, deleted)
      if (markdown !== note.markdown) this.notes.set(note.noteId, { ...note, markdown, revision: note.revision + 1, updatedAt: now })
    }
  }
  private editIdentity(noteId: string, update: Partial<Note>) {
    const note = this.notes.get(noteId)
    if (!note) return
    const before = catalog(this.snapshot, this.folders())
    this.notes.set(noteId, { ...note, ...update, revision: note.revision + 1, updatedAt: new Date().toISOString() })
    this.rewriteReferences(before, catalog([...this.notes.values()], this.folders()), new Set([noteId]))
    this.emit()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  updateMarkdown(noteId: string, markdown: string) {
    const note = this.notes.get(noteId)
    if (!note) throw new Error(`Not bulunamadı: ${noteId}`)
    if (note.markdown === markdown) return
    this.notes.set(noteId, {
      ...note, markdown, revision: note.revision + 1, updatedAt: new Date().toISOString(),
    })
    this.emit()
  }

  rename(noteId: string, title: string) {
    const note = this.notes.get(noteId)
    if (!note || note.title === title) return
    this.editIdentity(noteId, { title })
  }

  create(title = 'Yeni not', markdown = '') {
    const before = catalog(this.snapshot, this.folders())
    const now = new Date().toISOString()
    const note: Note = { noteId: `note:${crypto.randomUUID()}`, title, markdown, folderId: null, revision: 0, createdAt: now, updatedAt: now }
    this.notes.set(note.noteId, note)
    this.rewriteReferences(before, catalog([...this.notes.values()], this.folders()), new Set())
    this.emit()
    return note
  }

  replace(notes: Note[]) {
    this.notes = new Map(notes.map(note => [note.noteId, { ...note }]))
    this.emit()
  }

  move(noteId: string, folderId: string | null) {
    const note = this.notes.get(noteId)
    if (!note || (note.folderId ?? null) === folderId) return
    this.editIdentity(noteId, { folderId })
  }

  delete(noteId: string) {
    if (!this.notes.has(noteId)) return
    const before = catalog(this.snapshot, this.folders())
    this.rewriteReferences(before, before, new Set([noteId]), true)
    this.notes.delete(noteId); this.emit()
  }

  private emit() {
    this.snapshot = [...this.notes.values()]
    this.updateSummaries()
    for (const listener of this.listeners) listener()
  }
}
