import { describe, expect, it } from 'vitest'
import { emptyDocument, fromBoard, WorkspaceStore } from '../domain/Workspace'
import { validateWorkspace } from './validateWorkspace'
import { envelope } from '../tests/fixtures'
import { IndexedDbAdapter } from './IndexedDbAdapter'

describe('workspace format and logical folders', () => {
  it('migrates the Phase 1 board losslessly and saves the workspace at a newer revision', async () => {
    const board = envelope(8), adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    await adapter.save(board)
    const migrated = validateWorkspace((await adapter.load()).committed)
    expect(migrated.boards[0].document).toEqual(board.board.document)
    expect(migrated.boards[0].boardId).toBe(board.board.boardId)
    expect(migrated.notes[0].noteId).toBe(board.notes[0].noteId)
    expect(migrated.notes[0].markdown).toBe(board.notes[0].markdown)
    expect(await adapter.save({ ...migrated, revision: 9 })).toBe(9)
    expect((await adapter.load()).committed).toMatchObject({ format: 'knowledge-canvas-workspace', revision: 9 })
  })
  it('keeps identifiers through folder rename/move and rejects cycles and duplicate siblings', () => {
    const workspace = new WorkspaceStore(fromBoard(envelope()))
    const philosophy = workspace.createFolder('Felsefe', null)
    const ontology = workspace.createFolder('Ontoloji', philosophy.folderId)
    const ai = workspace.createFolder('AI', null)
    workspace.editFolder(philosophy.folderId, 'Felsefe araştırmaları', null)
    expect(workspace.folderPath(ontology.folderId)).toBe('/Felsefe araştırmaları/Ontoloji')
    workspace.editFolder(ontology.folderId, 'Zihin', ai.folderId)
    expect(workspace.folderPath(ontology.folderId)).toBe('/AI/Zihin')
    expect(() => workspace.editFolder(ai.folderId, 'AI', ontology.folderId)).toThrow('alt klasör')
    expect(() => workspace.createFolder('zihin', ai.folderId)).toThrow('aynı adlı')
    expect(workspace.get().folders.find(folder => folder.folderId === ontology.folderId)?.parentId).toBe(ai.folderId)
  })
  it('round-trips all boards, shared notes and folders; rejects invalid parents, IDs and folder cycles', () => {
    const workspace = new WorkspaceStore(fromBoard(envelope()))
    const folder = workspace.createFolder('Felsefe', null)
    const state = workspace.get()
    const value = { ...state, boards: [...state.boards, { ...state.boards[0], boardId: 'board:second', folderId: folder.folderId }] }
    expect(validateWorkspace(JSON.parse(JSON.stringify(value)))).toEqual(value)
    expect(() => validateWorkspace({ ...value, boards: [...value.boards, value.boards[0]] })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...value, activeBoardId: 'missing' })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...value, notes: [{ ...value.notes[0], folderId: 'missing' }] })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...value, folders: [{ ...folder, parentId: folder.folderId }] })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...value, schemaVersion: 99 })).toThrow('desteklenmiyor')
  })
  it('a blank board remains a valid empty document and missing notes remain recoverable', () => {
    const state = fromBoard(envelope())
    state.boards.push({ ...state.boards[0], boardId: 'board:empty', document: emptyDocument() })
    state.notes = []
    expect(validateWorkspace(state).boards).toHaveLength(2)
    expect(Object.values(state.boards[1].document.store).filter(record => record.typeName === 'shape')).toHaveLength(0)
  })
  it('reading or exporting an unchanged document does not change its metadata timestamps', () => {
    const state = fromBoard(envelope()), workspace = new WorkspaceStore(state)
    workspace.setDocument(state.activeBoardId, structuredClone(state.boards[0].document))
    expect(workspace.get()).toBe(state)
    expect(workspace.get().boards[0].updatedAt).toBe(state.boards[0].updatedAt)
  })
  it('keeps PDF bytes and per-board positions; rejects dangling PDFs, out-of-range pages and unknown boards', () => {
    const state = fromBoard(envelope())
    state.pdfs = [{ pdfId: 'pdf:test', name: 'test.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK', pageCount: 2, createdAt: state.createdAt }]
    state.readers = { [state.activeBoardId]: { pdfId: 'pdf:test', page: 2, zoom: 1.25, open: true } }
    expect(validateWorkspace(JSON.parse(JSON.stringify(state)))).toEqual(state)
    expect(() => validateWorkspace({ ...state, pdfs: [] })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...state, readers: { [state.activeBoardId]: { ...state.readers[state.activeBoardId], page: 3 } } })).toThrow('geçersiz')
    expect(() => validateWorkspace({ ...state, readers: { missing: state.readers[state.activeBoardId] } })).toThrow('geçersiz')
  })
  it('accepts older readers without panel positions and validates optional saved screen coordinates', () => {
    const state = fromBoard(envelope())
    const reader = { pdfId: null, page: 1, zoom: 1, open: false }
    state.readers = { [state.activeBoardId]: reader }
    expect(validateWorkspace(state)).toEqual(state)
    state.readers[state.activeBoardId] = { ...reader, position: { x: 360, y: 100 } }
    expect(validateWorkspace(JSON.parse(JSON.stringify(state)))).toEqual(state)
    for (const position of [null, { x: -1, y: 50 }, { x: 100, y: Infinity }, { x: '100', y: 50 }]) {
      expect(() => validateWorkspace({ ...state, readers: { [state.activeBoardId]: { ...reader, position } } })).toThrow('geçersiz')
    }
  })
  it('round-trips optional panel dimensions, accepts unsized readers and rejects malformed sizes', () => {
    const state = fromBoard(envelope())
    const reader = { pdfId: null, page: 1, zoom: 1, open: false }
    state.readers = { [state.activeBoardId]: reader }
    expect(validateWorkspace(state)).toEqual(state)
    state.readers[state.activeBoardId] = { ...reader, size: { width: 480, height: 360 } }
    expect(validateWorkspace(JSON.parse(JSON.stringify(state)))).toEqual(state)
    for (const size of [null, { width: 0, height: 360 }, { width: 480, height: -1 }, { width: Infinity, height: 360 }, { width: 480, height: NaN }, { width: '480', height: 360 }, { width: 480 }]) {
      expect(() => validateWorkspace({ ...state, readers: { [state.activeBoardId]: { ...reader, size } } })).toThrow('geçersiz')
    }
  })
})
