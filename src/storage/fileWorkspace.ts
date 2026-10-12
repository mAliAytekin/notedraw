import { emptyDocument, type Folder, type PdfFile, type WorkspaceEnvelope } from '../domain/Workspace'
import type { Board } from '../domain/Board'
import type { Note } from '../domain/NoteStore'
import { validateWorkspace } from './validateWorkspace'

export const manifestPath = '.knowledge-canvas/workspace.json'
export interface DiskFile { path: string; encoding: 'utf8' | 'base64'; data: string }
export interface DiskSnapshot { path: string; writable: boolean; token: string; files: DiskFile[]; draft: unknown | null; last_good: unknown | null; warnings: string[] }
type StoredNote = Omit<Note, 'markdown'> & { path: string; contentHash: string }
type StoredBoard = Omit<Board, 'document'> & { path: string; contentHash: string }
type StoredPdf = Omit<PdfFile, 'data'> & { path: string }
export interface FileManifest extends Omit<WorkspaceEnvelope, 'format' | 'notes' | 'boards' | 'pdfs' | 'folders'> {
  format: 'knowledge-canvas-files'
  notes: StoredNote[]
  boards: StoredBoard[]
  pdfs: StoredPdf[]
  folders: (Folder & { path: string })[]
  assets: { path: string; mimeType: string; boardId: string; assetId: string }[]
}
export interface DecodedWorkspace { state: WorkspaceEnvelope; manifest?: FileManifest; needsCommit: boolean; warnings: string[] }

export function validateRelative(path: string, metadata = false) {
  if (typeof path !== 'string' || !path || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..' || (!metadata && part.startsWith('.')))) throw new Error(`Workspace dosya yolu geçersiz: ${path}`)
  return path
}
const safeName = (name: string) => name.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+|[. ]+$/g, '').trim().slice(0, 70) || 'Adsız'
const suffix = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-36)
export async function contentHash(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
const directory = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
const join = (parent: string, name: string) => parent ? `${parent}/${name}` : name
function blank(title: string): WorkspaceEnvelope {
  const now = new Date().toISOString(), boardId = `board:${crypto.randomUUID()}`
  return { format: 'knowledge-canvas-workspace', schemaVersion: 1, workspaceId: `workspace:${crypto.randomUUID()}`, title, revision: 0, createdAt: now, updatedAt: now, folders: [], notes: [], boards: [{ boardId, title: 'Yeni board', folderId: null, createdAt: now, updatedAt: now, document: emptyDocument() }], activeBoardId: boardId, pdfs: [], readers: {} }
}

/** Markdown lives only in .md; documents contain relative asset paths, never duplicate note bodies. */
export async function encodeWorkspace(state: WorkspaceEnvelope, previous?: FileManifest) {
  validateWorkspace(state)
  const files: DiskFile[] = [], used = new Set<string>(['assets', '.knowledge-canvas'])
  const reserve = (path: string) => {
    validateRelative(path)
    const key = path.normalize('NFC').toLowerCase()
    if (used.has(key)) throw new Error(`Dosya adı çakışıyor: ${path}`)
    used.add(key); return path
  }
  const folderPaths = new Map<string, string>()
  const folderPath = (id: string | null | undefined): string => {
    if (!id) return ''
    if (folderPaths.has(id)) return folderPaths.get(id)!
    const folder = state.folders.find(folder => folder.folderId === id)!
    const old = previous?.folders.find(item => item.folderId === id)
    const parent = folderPath(folder.parentId)
    let path = old && old.name === folder.name && old.parentId === folder.parentId && directory(old.path) === parent ? old.path : join(parent, safeName(folder.name))
    if (used.has(path.normalize('NFC').toLowerCase())) path = join(parent, `${safeName(folder.name)}--${suffix(id)}`)
    folderPaths.set(id, reserve(path)); return path
  }
  const folders = state.folders.map(folder => ({ ...folder, path: folderPath(folder.folderId) }))
  const pathFor = (item: Note | Board, id: string, ext: string, old?: StoredNote | StoredBoard) => reserve(old && old.title === item.title && (old.folderId ?? null) === (item.folderId ?? null) && directory(old.path) === folderPath(item.folderId) ? old.path : join(folderPath(item.folderId), `${safeName(item.title)}--${suffix(id)}${ext}`))
  const notes: StoredNote[] = []
  for (const { markdown, ...note } of state.notes) {
    const path = pathFor({ ...note, markdown }, note.noteId, '.md', previous?.notes.find(item => item.noteId === note.noteId))
    files.push({ path, encoding: 'utf8', data: markdown })
    notes.push({ ...note, path, contentHash: await contentHash(markdown) })
  }
  const assets: FileManifest['assets'] = [], boards: StoredBoard[] = []
  for (const { document, ...board } of state.boards) {
    const diskDocument = structuredClone(document)
    for (const record of Object.values(diskDocument.store)) {
      if (record.typeName !== 'asset' || record.type !== 'image') continue
      const src = record.props.src!
      const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(src)
      if (!match) throw new Error('Görsel byte verisi kaydedilemiyor.')
      const ext = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1]
      const path = reserve(`assets/${suffix(board.boardId)}-${suffix(record.id)}.${ext}`)
      assets.push({ path, mimeType: match[1], boardId: board.boardId, assetId: record.id })
      files.push({ path, encoding: 'base64', data: match[2] }); record.props.src = path
    }
    const path = pathFor({ ...board, document }, board.boardId, '.board.json', previous?.boards.find(item => item.boardId === board.boardId))
    const data = JSON.stringify({ format: 'knowledge-canvas-document', schemaVersion: 1, boardId: board.boardId, document: diskDocument }, null, 2)
    files.push({ path, encoding: 'utf8', data }); boards.push({ ...board, path, contentHash: await contentHash(data) })
  }
  const pdfs: StoredPdf[] = []
  for (const { data, ...pdf } of state.pdfs) {
    const old = previous?.pdfs.find(item => item.pdfId === pdf.pdfId)
    const path = reserve(old?.path ?? `assets/${safeName(pdf.name.replace(/\.pdf$/i, ''))}--${suffix(pdf.pdfId)}.pdf`)
    pdfs.push({ ...pdf, path })
    if (!pdf.missing) files.push({ path, encoding: 'base64', data: data.split(',')[1] })
  }
  const manifest: FileManifest = { ...state, format: 'knowledge-canvas-files', notes, boards, folders, pdfs, assets }
  files.push({ path: manifestPath, encoding: 'utf8', data: JSON.stringify(manifest, null, 2) })
  return { files, directories: folders.map(folder => folder.path), manifest }
}

export async function decodeWorkspace(snapshot: DiskSnapshot): Promise<DecodedWorkspace> {
  const files = new Map<string, DiskFile>()
  for (const file of snapshot.files) {
    validateRelative(file.path, file.path === manifestPath)
    if (files.has(file.path)) throw new Error('Yinelenen disk dosya yolu.')
    files.set(file.path, file)
  }
  const warnings = [...snapshot.warnings]
  const manifestFile = files.get(manifestPath)
  let state = blank(snapshot.path.split('/').pop() || 'Knowledge workspace'), manifest: FileManifest | undefined, needsCommit = !manifestFile
  const folderPaths = new Map<string, string>()
  const tracked = new Set<string>()
  if (manifestFile) {
    const input = JSON.parse(manifestFile.data)
    if (!input || input.format !== 'knowledge-canvas-files' || input.schemaVersion !== 1 || !['folders', 'notes', 'boards', 'pdfs', 'assets'].every(key => Array.isArray(input[key]))) throw new Error('Workspace manifest formatı veya sürümü desteklenmiyor; dosyalar korunuyor.')
    manifest = input as FileManifest
    const seen = new Set<string>()
    for (const item of [...manifest.folders, ...manifest.notes, ...manifest.boards, ...manifest.pdfs, ...manifest.assets]) {
      validateRelative(item.path)
      const key = item.path.normalize('NFC').toLowerCase()
      if (seen.has(key)) throw new Error(`Manifest dosya yolu çakışıyor: ${item.path}`)
      seen.add(key)
    }
    const { assets: _assets, ...metadata } = manifest
    state = { ...metadata, format: 'knowledge-canvas-workspace', folders: manifest.folders.map(({ path, ...folder }) => { folderPaths.set(path, folder.folderId); return folder }), notes: [], boards: [], pdfs: [] }
    const lastGood = snapshot.last_good ? validateWorkspace(snapshot.last_good) : undefined
    for (const { path, contentHash: previousHash, ...note } of manifest.notes) {
      tracked.add(path)
      if (!/\.md$/i.test(path)) throw new Error('Not dosyası .md olmalı.')
      const file = files.get(path)
      if (!file) { warnings.push(`Not dosyası bulunamadı: ${path}; kart referansları korunuyor.`); needsCommit = true; continue }
      if (file.encoding !== 'utf8') throw new Error('Markdown UTF-8 olmalı.')
      const changed = await contentHash(file.data) !== previousHash
      state.notes.push({ ...note, markdown: file.data, revision: note.revision + (changed ? 1 : 0), updatedAt: changed ? new Date().toISOString() : note.updatedAt })
      needsCommit ||= changed
    }
    for (const { path, contentHash: previousHash, ...board } of manifest.boards) {
      if (!/\.board\.json$/i.test(path)) throw new Error('Board dosyası .board.json olmalı.')
      const file = files.get(path)
      if (!file) { warnings.push(`Board dosyası bulunamadı: ${path}`); needsCommit = true; continue }
      const parsed = JSON.parse(file.data)
      if (parsed.format !== 'knowledge-canvas-document' || parsed.schemaVersion !== 1 || parsed.boardId !== board.boardId || !parsed.document?.store) throw new Error(`Board dosyası geçersiz: ${path}`)
      for (const record of Object.values(parsed.document.store) as any[]) {
        if (record.typeName !== 'asset' || record.type !== 'image') continue
        const asset = manifest.assets.find(asset => asset.boardId === board.boardId && asset.assetId === record.id && asset.path === record.props.src)
        if (!asset) throw new Error('Board görsel referansı manifestte yok.')
        const bytes = files.get(asset.path)
        if (!bytes || bytes.encoding !== 'base64') throw new Error(`Görsel dosyası bulunamadı: ${asset.path}`)
        record.props.src = `data:${asset.mimeType};base64,${bytes.data}`
      }
      const changed = await contentHash(file.data) !== previousHash
      state.boards.push({ ...board, document: parsed.document, updatedAt: changed ? new Date().toISOString() : board.updatedAt })
      needsCommit ||= changed
    }
    for (const pdf of manifest.pdfs) {
      let bytes = files.get(pdf.path)
      const previous = lastGood?.pdfs.find(item => item.pdfId === pdf.pdfId)
      if (!bytes && previous) {
        const candidates = snapshot.files.filter(file => file.encoding === 'base64' && /\.pdf$/i.test(file.path) && file.data === previous.data.split(',')[1] && !manifest!.pdfs.some(pdf => pdf.path === file.path))
        if (candidates.length === 1) { pdf.path = candidates[0].path; bytes = candidates[0]; warnings.push(`Taşınan PDF yeniden bağlandı: ${pdf.path}`); needsCommit = true }
      }
      const { path, ...metadata } = pdf
      if (!path.startsWith('assets/') || !/\.pdf$/i.test(path)) throw new Error('PDF yolu assets/ altında olmalı.')
      if (!bytes) {
        if (!previous) throw new Error(`PDF bulunamadı ve kurtarma kopyası yok: ${path}`)
        state.pdfs.push({ ...metadata, data: previous.data, missing: true }); warnings.push(`PDF dosyası bulunamadı: ${path}. Son kayıttan geri yüklenebilir.`)
      } else {
        if (bytes.encoding !== 'base64') throw new Error('PDF byte kodlaması geçersiz.')
        state.pdfs.push({ ...metadata, data: `data:application/pdf;base64,${bytes.data}`, missing: undefined })
        needsCommit ||= !!pdf.missing
      }
    }
    if (!state.boards.length) { state.boards = blank(state.title).boards; needsCommit = true }
    if (!state.boards.some(board => board.boardId === state.activeBoardId)) state.activeBoardId = state.boards[0].boardId
    state.readers = Object.fromEntries(Object.entries(state.readers).filter(([id]) => state.boards.some(board => board.boardId === id)))
  }
  const folderFor = (path: string): string | null => {
    if (!path) return null
    if (folderPaths.has(path)) return folderPaths.get(path)!
    const parentId = folderFor(directory(path)), name = path.split('/').pop()!
    const folderId = `folder:${crypto.randomUUID()}`
    state.folders.push({ folderId, name, parentId }); folderPaths.set(path, folderId); needsCommit = true
    return folderId
  }
  const now = new Date().toISOString()
  for (const file of snapshot.files) {
    if (file.encoding !== 'utf8' || !/\.md$/i.test(file.path) || tracked.has(file.path)) continue
    state.notes.push({ noteId: `note:${crypto.randomUUID()}`, title: file.path.split('/').pop()!.replace(/\.md$/i, ''), folderId: folderFor(directory(file.path)), markdown: file.data, revision: 0, createdAt: now, updatedAt: now })
    // Preserve discovered filenames, including UTF-8, when the first manifest is written.
    manifest ??= { ...state, format: 'knowledge-canvas-files', folders: [], notes: [], boards: [], pdfs: [], assets: [] }
    const { markdown: _markdown, ...note } = state.notes[state.notes.length - 1]
    manifest.notes.push({ ...note, path: file.path, contentHash: await contentHash(file.data) })
    needsCommit = true
  }
  if (manifest) for (const [path, folderId] of folderPaths) if (!manifest.folders.some(folder => folder.folderId === folderId)) manifest.folders.push({ ...state.folders.find(folder => folder.folderId === folderId)!, path })
  return { state: validateWorkspace(state), manifest, needsCommit, warnings }
}
