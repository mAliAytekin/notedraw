import { describe, expect, it, vi, beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'
import { AssetRecordType } from 'tldraw'
import { fromBoard } from '../domain/Workspace'
import { envelope } from '../tests/fixtures'
import { decodeWorkspace, encodeWorkspace, manifestPath, validateRelative, type DiskSnapshot } from './fileWorkspace'

beforeAll(() => vi.stubGlobal('crypto', webcrypto))
const disk = (files: DiskSnapshot['files']): DiskSnapshot => ({ path: '/test/Knowledge', writable: true, token: 'token', files, draft: null, last_good: null, warnings: [] })
function fixture() {
  const state = fromBoard(envelope(3))
  state.folders = [{ folderId: 'folder:phil', parentId: null, name: 'Felsefe' }]
  state.notes[0].folderId = 'folder:phil'; state.boards[0].folderId = 'folder:phil'
  state.pdfs = [{ pdfId: 'pdf:test', name: 'bilinç.pdf', pageCount: 2, createdAt: state.createdAt, data: 'data:application/pdf;base64,JVBERi0xLjQK' }]
  state.readers = { [state.activeBoardId]: { pdfId: 'pdf:test', page: 2, zoom: 1.25, open: true, position: { x: 300, y: 120 }, size: { width: 450, height: 400 } } }
  const asset = AssetRecordType.create({ id: AssetRecordType.createId('tiny'), type: 'image', props: { name: 'tiny.png', src: 'data:image/png;base64,iVBORw0KGgo=', w: 1, h: 1, mimeType: 'image/png', isAnimated: false } })
  state.boards[0].document.store[asset.id] = asset
  return state
}
describe('portable filesystem workspace', () => {
  it('persists PDF marks separately in the manifest without changing original PDF bytes, including missing files', async () => {
    const state = fixture(), original = await encodeWorkspace(state)
    state.pdfs[0].annotations = [{ annotationId: 'mark:1', kind: 'underline', page: 2, text: 'Bilinç', rects: [{ x: .1, y: .2, width: .3, height: .04 }], createdAt: state.createdAt }]
    const marked = await encodeWorkspace(state, original.manifest)
    const pdfPath = marked.manifest.pdfs[0].path
    expect(marked.files.find(file => file.path === pdfPath)).toEqual(original.files.find(file => file.path === pdfPath))
    expect(marked.manifest.pdfs[0].annotations).toEqual(state.pdfs[0].annotations)
    expect((await decodeWorkspace(disk(marked.files))).state.pdfs[0].annotations).toEqual(state.pdfs[0].annotations)
    const missing = await decodeWorkspace({ ...disk(marked.files.filter(file => file.path !== pdfPath)), last_good: state })
    expect(missing.state.pdfs[0]).toMatchObject({ missing: true, annotations: state.pdfs[0].annotations, data: state.pdfs[0].data })
  })
  it('round-trips UTF-8 notes, documents, real assets/PDF bytes and reader geometry with no Markdown in boards or manifest', async () => {
    const state = fixture(), encoded = await encodeWorkspace(state)
    expect(encoded.files.find(file => file.path.endsWith('.md'))!.data).toBe(state.notes[0].markdown)
    expect(JSON.stringify(encoded.manifest)).not.toContain(state.notes[0].markdown)
    expect(encoded.files.find(file => file.path.endsWith('.board.json'))!.data).not.toContain('data:image')
    expect(encoded.files.find(file => file.path.endsWith('.board.json'))!.data).not.toContain(state.notes[0].markdown)
    const loaded = await decodeWorkspace({ ...disk(encoded.files), last_good: state })
    expect(loaded.state).toEqual({ ...state, pdfs: state.pdfs.map(pdf => ({ ...pdf, missing: undefined })) })
    expect(loaded.needsCommit).toBe(false)
  })
  it('discovers nested external Markdown, uses filenames as titles and preserves filenames/identifiers on first save', async () => {
    const snapshot = disk([{ path: 'Felsefe/Ontoloji/Qualia.md', encoding: 'utf8', data: '# İÇERİK BAŞLIĞI\n\n👋' }])
    const loaded = await decodeWorkspace(snapshot)
    expect(loaded.state.notes[0]).toMatchObject({ title: 'Qualia', markdown: snapshot.files[0].data })
    expect(loaded.state.folders.map(folder => folder.name)).toEqual(['Felsefe', 'Ontoloji'])
    const encoded = await encodeWorkspace(loaded.state, loaded.manifest)
    expect(encoded.manifest.notes[0].path).toBe(snapshot.files[0].path)
    const reopened = await decodeWorkspace(disk(encoded.files))
    expect(reopened.state.notes[0].noteId).toBe(loaded.state.notes[0].noteId)
  })
  it('external edits update revision, preserve independent title and missing notes retain card references', async () => {
    const state = fixture(), encoded = await encodeWorkspace(state), notePath = encoded.manifest.notes[0].path
    const edited = encoded.files.map(file => file.path === notePath ? { ...file, data: '# Diskte değişen başlık' } : file)
    const loaded = await decodeWorkspace(disk(edited))
    expect(loaded.state.notes[0]).toMatchObject({ noteId: state.notes[0].noteId, title: state.notes[0].title, revision: state.notes[0].revision + 1, markdown: '# Diskte değişen başlık' })
    expect(loaded.needsCommit).toBe(true)
    const deleted = await decodeWorkspace(disk(encoded.files.filter(file => file.path !== notePath)))
    expect(deleted.state.notes).toEqual([])
    expect(deleted.state.boards[0].document).toEqual(state.boards[0].document)
    expect(deleted.warnings.join()).toContain('Not dosyası bulunamadı')
  })
  it('rename/move retains identity, changes physical paths and does not copy Markdown into shared cards', async () => {
    const state = fixture(), original = await encodeWorkspace(state)
    state.notes[0].title = 'Öznel deneyim'; state.notes[0].folderId = null
    state.folders[0].name = 'Araştırma'
    const moved = await encodeWorkspace(state, original.manifest)
    expect(moved.manifest.notes[0].noteId).toBe(original.manifest.notes[0].noteId)
    expect(moved.manifest.notes[0].path).toMatch(/^Öznel deneyim--.+\.md$/)
    expect(moved.manifest.boards[0].path).toMatch(/^Araştırma\//)
    expect(moved.manifest.boards[0].boardId).toBe(state.boards[0].boardId)
  })
  it('missing PDF keeps stable metadata/backup bytes, and a uniquely moved PDF reconnects without changing readers', async () => {
    const state = fixture(), encoded = await encodeWorkspace(state), pdfPath = encoded.manifest.pdfs[0].path
    const missing = await decodeWorkspace({ ...disk(encoded.files.filter(file => file.path !== pdfPath)), last_good: state })
    expect(missing.state.pdfs[0]).toMatchObject({ pdfId: 'pdf:test', data: state.pdfs[0].data, missing: true })
    expect(missing.state.readers).toEqual(state.readers)
    const pending = await encodeWorkspace(missing.state, missing.manifest)
    expect(pending.files.some(file => file.path === pdfPath)).toBe(false)
    const moved = await decodeWorkspace({ ...disk(encoded.files.map(file => file.path === pdfPath ? { ...file, path: 'assets/moved.pdf' } : file)), last_good: state })
    expect(moved.state.pdfs[0].missing).toBeUndefined()
    expect(moved.manifest!.pdfs[0].path).toBe('assets/moved.pdf')
    expect(moved.state.readers).toEqual(state.readers)
  })
  it('rejects unknown schemas, traversal, path collisions, broken board IDs and missing assets without mutation', async () => {
    const state = fixture(), encoded = await encodeWorkspace(state)
    for (const path of ['../note.md', '/root.md', 'a/../b.md', 'a\\b.md', '.hidden/note.md', 'C:/a.md']) expect(() => validateRelative(path)).toThrow()
    const bad = structuredClone(encoded.manifest); bad.notes[0].path = '../outside.md'
    await expect(decodeWorkspace(disk(encoded.files.map(file => file.path === manifestPath ? { ...file, data: JSON.stringify(bad) } : file)))).rejects.toThrow('geçersiz')
    await expect(decodeWorkspace(disk(encoded.files.filter(file => file.path !== encoded.manifest.assets[0].path)))).rejects.toThrow('Görsel dosyası bulunamadı')
    const newer = { ...encoded.manifest, schemaVersion: 99 }
    await expect(decodeWorkspace(disk(encoded.files.map(file => file.path === manifestPath ? { ...file, data: JSON.stringify(newer) } : file)))).rejects.toThrow('desteklenmiyor')
    expect(state.notes[0].markdown).toBe('# Bilinç')
  })
})
