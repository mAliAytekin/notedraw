import type { TLStoreSnapshot } from 'tldraw'
import type { Note } from './NoteStore'

export interface Board {
  folderId?: string | null
  boardId: string
  title: string
  createdAt: string
  updatedAt: string
  document: TLStoreSnapshot
}

/** Native document asset records include stable IDs, MIME metadata and data URL bytes. */
export interface BoardEnvelope {
  format: 'knowledge-canvas-board'
  schemaVersion: 1
  revision: number
  board: Board
  notes: Note[]
}

export const createEnvelope = (board: Board, notes: Note[], revision: number): BoardEnvelope => ({
  format: 'knowledge-canvas-board', schemaVersion: 1, revision, board, notes,
})
