import { createShapeId, getSnapshot, loadSnapshot, type Editor, type TLShape } from 'tldraw'
import type { BoardEnvelope } from '../domain/Board'
import { createEnvelope } from '../domain/Board'
import { emptyDocument, fromBoard, WorkspaceStore, type WorkspaceEnvelope, type PdfFile, type ReaderState } from '../domain/Workspace'
import { NoteStore } from '../domain/NoteStore'
import { IndexedDbAdapter } from '../storage/IndexedDbAdapter'
import { TauriAdapter } from '../storage/TauriAdapter'
import type { StorageAdapter } from '../storage/StorageAdapter'
import { SaveCoordinator } from '../storage/SaveCoordinator'
import { acquireWriterLock } from '../storage/writerLock'
import { validateWorkspace } from '../storage/validateWorkspace'
import { createDemoNotes, initializeCanvas } from './demo'
import { catalog, type KnowledgeNote, type NoteSummary } from '../domain/knowledge'
import type { Folder } from '../domain/Workspace'
import { editorRuntimes } from './RuntimeContext'
import { maxPdfMarks, validPdfSelection, quoteExcerpt, escapeExcerpt, type PdfSelection, type PdfMarkKind } from '../pdf/annotations'
import { t } from '../i18n'

export class Runtime {
  readonly notes = new NoteStore()
  constructor(readonly adapter: StorageAdapter = new IndexedDbAdapter()) {}
  workspace!: WorkspaceStore
  writable = false
  error?: string
  initial?: WorkspaceEnvelope
  recoveryDraft?: WorkspaceEnvelope
  raw: unknown
  editor?: Editor
  saver?: SaveCoordinator<WorkspaceEnvelope>
  private applying = false
  private seed = false
  private needsMigration = false
  private lastDocument = ''
  private detachTimer?: ReturnType<typeof setTimeout>
  private cleanup?: () => void
  private releaseLock = () => {}
  private transitions: Promise<unknown> = Promise.resolve()
  private transitionCount = 0
  private cameras = new Map<string, { x: number; y: number; z: number }>()
  private catalogNotes?: NoteSummary[]
  private catalogFolders?: Folder[]
  private catalogSnapshot: KnowledgeNote[] = []
  getLinkCatalog = () => {
    const notes = this.notes.catalog(), folders = this.workspace.get().folders
    if (notes !== this.catalogNotes || folders !== this.catalogFolders) {
      this.catalogNotes = notes; this.catalogFolders = folders
      this.catalogSnapshot = catalog(notes, folders)
    }
    return this.catalogSnapshot
  }
  subscribeKnowledge = (listener: () => void) => {
    const notes = this.notes.subscribe(listener), workspace = this.workspace.subscribe(listener)
    return () => { notes(); workspace() }
  }

  async boot() {
    try {
      const lock = this.adapter instanceof TauriAdapter ? { writable: this.adapter.writable, release: () => {} } : await acquireWriterLock()
      this.writable = lock.writable; this.releaseLock = lock.release
      const stored = await this.adapter.load()
      this.raw = stored
      const committed = stored.committed ? validateWorkspace(stored.committed) : undefined
      const draft = stored.draft ? validateWorkspace(stored.draft) : undefined
      this.initial = committed
      this.needsMigration = (!!stored.committed && (stored.committed as { format: string }).format === 'knowledge-canvas-board') || (this.adapter instanceof TauriAdapter && this.adapter.needsCommit)
      if (draft && draft.revision > (committed?.revision ?? -1)) this.recoveryDraft = draft
      this.seed = !committed
      const now = new Date().toISOString()
      const state = committed ?? fromBoard(createEnvelope({ boardId: `board:${crypto.randomUUID()}`, title: 'Kavram haritası', createdAt: now, updatedAt: now, document: emptyDocument() }, createDemoNotes().all(), 0))
      this.applyState(state)
      window.addEventListener('pagehide', this.onPageHide)
      document.addEventListener('visibilitychange', this.onVisibility)
    } catch (error) { this.error = error instanceof Error ? error.message : String(error) }
    return this
  }
  private applyState(state: WorkspaceEnvelope) {
    this.notes.replace(state.notes)
    if (this.workspace) this.workspace.replace(state)
    else this.workspace = new WorkspaceStore(state)
    this.notes.setFolderProvider(() => this.workspace.get().folders)
  }
  get activeBoard() { const state = this.workspace.get(); return state.boards.find(board => board.boardId === state.activeBoardId)! }
  private onVisibility = () => { if (document.visibilityState === 'hidden') this.checkpointBestEffort() }
  private onPageHide = () => this.checkpointBestEffort()
  private checkpointBestEffort() {
    if (this.writable && this.saver) { this.checkDocumentChanges(); void this.saver.checkpoint().catch(() => {}) }
  }
  private checkDocumentChanges() {
    if (!this.editor || this.applying) return
    const document = getSnapshot(this.editor.store).document
    const fingerprint = JSON.stringify(document)
    if (fingerprint === this.lastDocument) return
    this.lastDocument = fingerprint
    if (this.writable) { this.workspace.setDocument(this.activeBoard.boardId, document); this.saver?.changed() }
  }
  flush() { this.checkDocumentChanges(); return this.saver!.flush() }
  get hasUnsavedChanges() { this.checkDocumentChanges(); return !!this.saver && this.saver.getStatus().state !== 'saved' }

  async recover(useDraft: boolean) {
    if (!this.writable) throw new Error('Taslak kurtarma için yazan sekme gerekiyor.')
    if (useDraft && this.recoveryDraft) {
      await this.adapter.replace(this.recoveryDraft)
      this.initial = this.recoveryDraft; this.applyState(this.initial); this.seed = false
    } else await this.adapter.discardDraft()
    this.recoveryDraft = undefined
  }
  async restoreDamaged(input: unknown) {
    if (!this.writable) throw new Error('Bu sekme salt okunur.')
    const replacement = validateWorkspace(input)
    await this.adapter.replace(replacement)
    this.initial = replacement; this.applyState(replacement); this.seed = false
    this.error = undefined; this.recoveryDraft = undefined
  }
  captureWorkspace = (revision: number): WorkspaceEnvelope => {
    if (!this.workspace) throw new Error('Workspace hazır değil.')
    if (this.editor && !this.applying) this.workspace.setDocument(this.activeBoard.boardId, getSnapshot(this.editor.store).document)
    return { ...this.workspace.get(), notes: this.notes.all(), revision, updatedAt: new Date().toISOString() }
  }
  /** Phase 1 single-board export remains available. Workspace backup is the complete backup. */
  capture = (revision: number): BoardEnvelope => {
    const state = this.captureWorkspace(revision)
    return createEnvelope(state.boards.find(board => board.boardId === state.activeBoardId)!, state.notes, revision)
  }
  private hydrate() {
    if (!this.editor) return
    this.applying = true
    try {
      this.editor.complete()
      loadSnapshot(this.editor.store, { document: this.activeBoard.document })
      this.editor.clearHistory()
      this.editor.setCamera(this.cameras.get(this.activeBoard.boardId) ?? { x: 0, y: 0, z: 1 })
      this.lastDocument = JSON.stringify(getSnapshot(this.editor.store).document)
    } finally { this.applying = false }
  }
  attach = (editor: Editor) => {
    clearTimeout(this.detachTimer)
    if (this.editor !== editor || !this.saver) {
      this.cleanup?.(); this.editor = editor
      editorRuntimes.set(editor, this)
      if (this.seed) {
        initializeCanvas(editor)
        this.workspace.setDocument(this.activeBoard.boardId, getSnapshot(editor.store).document)
        this.seed = false
      } else this.hydrate()
      editor.updateInstanceState({ isReadonly: !this.writable })
      editor.registerExternalAssetHandler('url', null); editor.registerExternalContentHandler('embed', null)
      this.lastDocument = JSON.stringify(getSnapshot(editor.store).document)
      this.saver ??= new SaveCoordinator(this.adapter, this.captureWorkspace, this.initial?.revision ?? 0)
      const onChange = () => { if (!this.applying && this.writable) this.saver!.changed() }
      const removeNotes = this.notes.subscribe(onChange)
      const removeWorkspace = this.workspace.subscribe(onChange)
      const removeStore = editor.store.listen(() => this.checkDocumentChanges(), { scope: 'document' })
      this.cleanup = () => { removeNotes(); removeWorkspace(); removeStore() }
      if ((!this.initial || this.needsMigration) && this.writable) { this.saver.changed(); this.needsMigration = false }
    }
    return () => { this.detachTimer = setTimeout(() => { this.cleanup?.(); this.editor = undefined }, 0) }
  }
  private requireWriter() { if (!this.writable || !this.editor || this.transitionCount) throw new Error('Bu sekme şu anda düzenleyemiyor.') }
  private transition(operation: () => Promise<void> | void) {
    if (!this.writable || !this.editor) return Promise.reject(new Error('Bu sekme salt okunur.'))
    this.transitionCount++
    this.editor.complete(); this.editor.updateInstanceState({ isReadonly: true })
    const result = this.transitions.then(async () => { await this.flush(); await operation(); await this.flush() })
    this.transitions = result.catch(() => {})
    return result.finally(() => {
      this.transitionCount--
      if (!this.transitionCount) this.editor?.updateInstanceState({ isReadonly: !this.writable })
    })
  }
  switchBoard(boardId: string) {
    if (!this.writable) {
      if (!this.workspace.get().boards.some(board => board.boardId === boardId)) return Promise.reject(new Error('Board bulunamadı.'))
      this.workspace.update({ activeBoardId: boardId }); this.hydrate()
      return Promise.resolve()
    }
    return this.transition(() => {
      if (!this.workspace.get().boards.some(board => board.boardId === boardId)) throw new Error('Board bulunamadı.')
      this.cameras.set(this.activeBoard.boardId, this.editor!.getCamera())
      this.workspace.update({ activeBoardId: boardId }); this.hydrate()
    })
  }
  createBoard(title: string, folderId: string | null) {
    return this.transition(() => {
      this.workspace.assertFolder(folderId)
      const now = new Date().toISOString(), boardId = `board:${crypto.randomUUID()}`
      this.workspace.update({ boards: [...this.workspace.get().boards, { boardId, title: title.trim() || 'Yeni board', folderId, createdAt: now, updatedAt: now, document: emptyDocument() }], activeBoardId: boardId })
      this.hydrate()
    })
  }
  editBoard(boardId: string, title: string, folderId: string | null) {
    this.requireWriter(); this.workspace.assertFolder(folderId)
    this.workspace.update({ boards: this.workspace.get().boards.map(board => board.boardId === boardId ? { ...board, title: title.trim() || 'Adsız board', folderId, updatedAt: new Date().toISOString() } : board) })
  }
  deleteBoard(boardId: string) {
    return this.transition(() => {
      let boards = this.workspace.get().boards.filter(board => board.boardId !== boardId)
      if (!boards.length) {
        const now = new Date().toISOString()
        boards = [{ boardId: `board:${crypto.randomUUID()}`, title: 'Yeni board', folderId: null, createdAt: now, updatedAt: now, document: emptyDocument() }]
      }
      const active = boards.some(board => board.boardId === this.activeBoard.boardId) ? this.activeBoard.boardId : boards[0].boardId
      const readers = Object.fromEntries(Object.entries(this.workspace.get().readers).filter(([id]) => boards.some(board => board.boardId === id)))
      this.workspace.update({ boards, activeBoardId: active, readers }); this.hydrate()
    })
  }
  createFolder(name: string, parentId: string | null) { this.requireWriter(); this.workspace.createFolder(name, parentId) }
  editFolder(id: string, name: string, parentId: string | null) {
    this.requireWriter(); this.editor!.complete()
    const before = this.getLinkCatalog(), descendants = this.workspace.descendants(id)
    const affected = new Set(this.notes.all().filter(note => note.folderId && descendants.has(note.folderId)).map(note => note.noteId))
    this.workspace.editFolder(id, name, parentId)
    this.notes.rewriteReferences(before, this.getLinkCatalog(), affected)
    this.notes.replace(this.notes.all().map(note => this.notes.get(note.noteId)!))
  }
  createNote(title: string, folderId: string | null) {
    this.requireWriter(); this.workspace.assertFolder(folderId)
    const note = this.notes.create(title.trim() || 'Yeni not'); this.notes.move(note.noteId, folderId)
    return note
  }
  editNote(id: string, title: string, folderId: string | null) {
    this.requireWriter(); this.editor!.complete(); this.workspace.assertFolder(folderId); this.notes.rename(id, title); this.notes.move(id, folderId)
  }
  noteReferences(noteId: string) {
    return this.workspace.get().boards.flatMap(board => Object.values(board.boardId === this.activeBoard.boardId && this.editor ? getSnapshot(this.editor.store).document.store : board.document.store).filter((record): record is TLShape => record.typeName === 'shape' && record.type === 'markdown-card' && record.props.noteId === noteId).map(record => ({ boardId: board.boardId, boardTitle: board.title, shapeId: record.id })))
  }
  deleteNote(noteId: string) { this.requireWriter(); this.editor!.complete(); this.notes.delete(noteId) }
  deleteFolder(folderId: string) {
    return this.transition(() => {
      const ids = this.workspace.descendants(folderId), state = this.workspace.get()
      let boards = state.boards.filter(board => !board.folderId || !ids.has(board.folderId))
      if (!boards.length) {
        const now = new Date().toISOString()
        boards = [{ boardId: `board:${crypto.randomUUID()}`, title: 'Yeni board', folderId: null, createdAt: now, updatedAt: now, document: emptyDocument() }]
      }
      const activeBoardId = boards.some(board => board.boardId === state.activeBoardId) ? state.activeBoardId : boards[0].boardId
      const deleted = new Set(this.notes.all().filter(note => note.folderId && ids.has(note.folderId)).map(note => note.noteId))
      const before = this.getLinkCatalog()
      this.notes.rewriteReferences(before, before, deleted, true)
      this.notes.replace(this.notes.all().filter(note => !deleted.has(note.noteId)).map(note => this.notes.get(note.noteId)!))
      const readers = Object.fromEntries(Object.entries(state.readers).filter(([id]) => boards.some(board => board.boardId === id)))
      this.workspace.update({ folders: state.folders.filter(folder => !ids.has(folder.folderId)), boards, activeBoardId, readers })
      this.hydrate()
    })
  }
  addCard(noteId?: string, point?: { x: number; y: number }) {
    this.requireWriter()
    const editor = this.editor!; editor.complete()
    const note = noteId ? this.notes.get(noteId) : this.notes.create()
    if (!note) return
    const center = point ?? editor.getViewportPageBounds().center, id = createShapeId()
    editor.markHistoryStoppingPoint('create-markdown-card')
    editor.createShape({ id, type: 'markdown-card', x: center.x - 180, y: center.y - 160, props: { noteId: note.noteId, w: 360, h: 320 } })
    editor.select(id); editor.setEditingShape(id); editor.setCurrentTool('select.editing_shape')
  }
  async revealNote(noteId: string) {
    const references = this.noteReferences(noteId)
    const reference = references.find(ref => ref.boardId === this.activeBoard.boardId) ?? references[0]
    if (reference) {
      if (reference.boardId !== this.activeBoard.boardId) await this.switchBoard(reference.boardId)
      this.editor!.complete(); this.editor!.select(reference.shapeId)
      this.editor!.zoomToSelection({ animation: { duration: 200 } })
      this.editor!.getContainer().focus()
    } else {
      this.addCard(noteId)
    }
  }
  async importBackup(input: unknown) {
    const validated = validateWorkspace(input)
    // A complete backup includes PDF bytes, so importing it restores missing disk files too.
    validated.pdfs = validated.pdfs.map(pdf => ({ ...pdf, missing: undefined }))
    return this.transition(async () => {
      await this.saver!.replace(validated, replacement => {
        this.applying = true
        try { this.initial = replacement; this.applyState(replacement); this.cameras.clear() }
        finally { this.applying = false }
        this.hydrate()
      })
    })
  }
  async reloadDesktop(keepLocal = false) {
    if (!(this.adapter instanceof TauriAdapter) || !this.editor || this.transitionCount) throw new Error('Workspace şu anda yenilenemiyor.')
    this.checkDocumentChanges(); this.editor.complete()
    this.transitionCount++; this.editor.updateInstanceState({ isReadonly: true })
    try {
      if (!this.writable) {
        this.applyState(await this.adapter.reload()); this.hydrate()
      } else {
        await this.saver!.reload(() => (this.adapter as TauriAdapter).reload(), state => {
          this.applying = true
          try { this.applyState(state); this.initial = state; this.cameras.clear() }
          finally { this.applying = false }
          this.hydrate()
        }, keepLocal)
        if (this.adapter.needsCommit) { this.saver!.changed(); await this.flush() }
      }
    } finally { this.transitionCount--; this.editor.updateInstanceState({ isReadonly: !this.writable }) }
  }
  restoreMissingPdf(pdfId: string) {
    this.requireWriter()
    this.workspace.update({ pdfs: this.workspace.get().pdfs.map(pdf => pdf.pdfId === pdfId ? { ...pdf, missing: undefined } : pdf) })
  }
  private pdfForSelection(selection: unknown) {
    if (!validPdfSelection(selection)) throw new Error(t('Geçerli bir PDF metni seçin.'))
    const pdf = this.workspace.get().pdfs.find(pdf => pdf.pdfId === selection.pdfId)
    if (!pdf || pdf.missing || selection.page > pdf.pageCount) throw new Error(t('PDF seçimi artık geçerli değil; metni yeniden seçin.'))
    return pdf
  }
  addPdfAnnotation(selection: PdfSelection, kind: PdfMarkKind) {
    this.requireWriter()
    const pdf = this.pdfForSelection(selection)
    if (!['highlight', 'underline', 'strike'].includes(kind)) throw new Error(t('Geçersiz PDF işaretleme türü.'))
    const annotations = pdf.annotations ?? []
    if (annotations.length >= maxPdfMarks) throw new Error(t('Bu PDF için işaretleme sınırına ulaşıldı.'))
    if (annotations.some(mark => mark.kind === kind && mark.page === selection.page && mark.text === selection.text && JSON.stringify(mark.rects) === JSON.stringify(selection.rects))) return
    const mark = { annotationId: `annotation:${crypto.randomUUID()}`, kind, page: selection.page, text: selection.text, rects: structuredClone(selection.rects), createdAt: new Date().toISOString() }
    this.workspace.update({ pdfs: this.workspace.get().pdfs.map(item => item.pdfId === pdf.pdfId ? { ...item, annotations: [...annotations, mark] } : item) })
  }
  removePdfAnnotation(pdfId: string, annotationId: string) {
    this.requireWriter()
    this.workspace.update({ pdfs: this.workspace.get().pdfs.map(pdf => pdf.pdfId === pdfId ? { ...pdf, annotations: (pdf.annotations ?? []).filter(mark => mark.annotationId !== annotationId) } : pdf) })
  }
  addPdfExcerpt(selection: unknown, point?: { x: number; y: number }) {
    this.requireWriter()
    const pdf = this.pdfForSelection(selection), excerpt = selection as PdfSelection
    const title = t('PDF alıntısı · {name} · s. {page}', { name: pdf.name, page: excerpt.page }).slice(0, 200)
    const source = t('Kaynak: {name} · Sayfa {page}', { name: escapeExcerpt(pdf.name), page: excerpt.page })
    const note = this.notes.create(title, `${quoteExcerpt(excerpt.text)}\n\n${source}`)
    if (this.activeBoard.folderId) this.notes.move(note.noteId, this.activeBoard.folderId)
    this.addCard(note.noteId, point)
    return note
  }
  get reader(): ReaderState { return this.workspace.get().readers[this.activeBoard.boardId] ?? { pdfId: null, page: 1, zoom: 1, open: false } }
  addPdf(pdf: PdfFile, boardId = this.activeBoard.boardId) {
    this.requireWriter()
    const state = this.workspace.get()
    if (!state.boards.some(board => board.boardId === boardId)) throw new Error('PDF açılırken hedef board silindi; workspace değiştirilmedi.')
    this.workspace.update({ pdfs: [...state.pdfs, pdf], readers: { ...state.readers, [boardId]: { ...state.readers[boardId], pdfId: pdf.pdfId, page: 1, zoom: 1, open: true } } })
  }
  updateReader(update: Partial<ReaderState>) {
    const state = this.workspace.get(), reader = { ...this.reader, ...update }
    const pdf = this.workspace.get().pdfs.find(item => item.pdfId === reader.pdfId)
    reader.page = Math.max(1, Math.min(reader.page, pdf?.pageCount ?? 1))
    reader.zoom = Math.max(0.25, Math.min(3, reader.zoom))
    this.workspace.update({ readers: { ...state.readers, [state.activeBoardId]: reader } })
  }
  destroy() {
    this.cleanup?.(); this.saver?.dispose(); this.releaseLock()
    window.removeEventListener('pagehide', this.onPageHide); document.removeEventListener('visibilitychange', this.onVisibility)
  }
}

let boot: Promise<Runtime> | undefined
let runtime: Runtime | undefined
export function getRuntime(adapter?: StorageAdapter) {
  if (adapter && runtime?.adapter !== adapter) { runtime?.destroy(); runtime = undefined; boot = undefined }
  if (!boot) { runtime = new Runtime(adapter); boot = runtime.boot() }
  return boot
}
if (import.meta.hot) import.meta.hot.dispose(() => runtime?.destroy())
