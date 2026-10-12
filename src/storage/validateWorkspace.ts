import type { WorkspaceEnvelope } from '../domain/Workspace'
import { fromBoard } from '../domain/Workspace'
import { validateEnvelope } from './validateEnvelope'
import { validPdfAnnotations } from '../pdf/annotations'

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string'
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
function invalid(): never { throw new Error('Workspace yedeği geçersiz. Mevcut veri korunuyor.') }

/** Also accepts the Phase 1 board format for an explicit, lossless migration. */
export function validateWorkspace(input: unknown): WorkspaceEnvelope {
  if (object(input) && input.format === 'knowledge-canvas-board') return fromBoard(validateEnvelope(input))
  if (!object(input) || input.format !== 'knowledge-canvas-workspace') invalid()
  if (input.schemaVersion !== 1) throw new Error('Bu workspace sürümü desteklenmiyor; veri değiştirilmedi.')
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0 || !text(input.workspaceId) || !input.workspaceId || !text(input.title) || !date(input.createdAt) || !date(input.updatedAt)) invalid()
  if (!Array.isArray(input.folders) || !Array.isArray(input.boards) || !input.boards.length || !Array.isArray(input.notes) || !Array.isArray(input.pdfs)) invalid()
  const folderIds = new Set<string>()
  for (const folder of input.folders) {
    if (!object(folder) || !text(folder.folderId) || !folder.folderId || folderIds.has(folder.folderId) || !text(folder.name) || !folder.name.trim() || folder.name.length > 100 || /[\\/\u0000-\u001f]/.test(folder.name) || !(folder.parentId === null || text(folder.parentId))) invalid()
    folderIds.add(folder.folderId)
  }
  const folders = input.folders as WorkspaceEnvelope['folders']
  const byId = new Map(folders.map(folder => [folder.folderId, folder]))
  const siblings = new Set<string>()
  for (const folder of folders) {
    const key = JSON.stringify([folder.parentId, folder.name.toLocaleLowerCase('tr')])
    if (siblings.has(key)) invalid()
    siblings.add(key)
    const seen = new Set([folder.folderId])
    let parent = folder.parentId
    while (parent !== null) {
      if (!folderIds.has(parent) || seen.has(parent)) invalid()
      seen.add(parent); parent = byId.get(parent)!.parentId
    }
  }
  const validFolder = (value: unknown) => value === null || (text(value) && folderIds.has(value))
  const boardIds = new Set<string>()
  const boards = input.boards.map((board, index) => {
    if (!object(board) || !text(board.boardId) || boardIds.has(board.boardId) || !validFolder(board.folderId)) invalid()
    boardIds.add(board.boardId)
    const checked = validateEnvelope({ format: 'knowledge-canvas-board', schemaVersion: 1, revision: input.revision, board, notes: index === 0 ? input.notes : [] }).board
    return { ...checked, folderId: board.folderId as string | null }
  })
  if (!text(input.activeBoardId) || !boardIds.has(input.activeBoardId)) invalid()
  for (const note of input.notes) if (!object(note) || !validFolder(note.folderId)) invalid()
  const pdfIds = new Set<string>()
  for (const pdf of input.pdfs) {
    if (!object(pdf) || !text(pdf.pdfId) || !pdf.pdfId || pdfIds.has(pdf.pdfId) || !text(pdf.name) || !pdf.name || !date(pdf.createdAt) || !Number.isSafeInteger(pdf.pageCount) || (pdf.pageCount as number) < 1 || !text(pdf.data) || !/^data:application\/pdf;base64,JVBER[A-Za-z0-9+/]*={0,2}$/.test(pdf.data) || pdf.data.length > 70 * 1024 * 1024) invalid()
    pdfIds.add(pdf.pdfId)
    if (pdf.missing !== undefined && typeof pdf.missing !== 'boolean') invalid()
    if (pdf.annotations !== undefined && !validPdfAnnotations(pdf.annotations, pdf.pageCount as number)) invalid()
  }
  if (!object(input.readers)) invalid()
  for (const [boardId, reader] of Object.entries(input.readers)) {
    if (!boardIds.has(boardId) || !object(reader) || !(reader.pdfId === null || (text(reader.pdfId) && pdfIds.has(reader.pdfId))) || typeof reader.open !== 'boolean' || !Number.isSafeInteger(reader.page) || (reader.page as number) < 1 || typeof reader.zoom !== 'number' || !Number.isFinite(reader.zoom) || reader.zoom < 0.25 || reader.zoom > 3) invalid()
    const pdf = input.pdfs.find(pdf => pdf.pdfId === reader.pdfId)
    if ((reader.open && !pdf) || (pdf && (reader.page as number) > pdf.pageCount)) invalid()
    if (reader.position !== undefined && (!object(reader.position) || typeof reader.position.x !== 'number' || !Number.isFinite(reader.position.x) || reader.position.x < 0 || typeof reader.position.y !== 'number' || !Number.isFinite(reader.position.y) || reader.position.y < 0)) invalid()
    if (reader.size !== undefined && (!object(reader.size) || typeof reader.size.width !== 'number' || !Number.isFinite(reader.size.width) || reader.size.width <= 0 || typeof reader.size.height !== 'number' || !Number.isFinite(reader.size.height) || reader.size.height <= 0)) invalid()
  }
  return { ...structuredClone(input), boards } as unknown as WorkspaceEnvelope
}
