import { createContext, useContext, useSyncExternalStore } from 'react'
import { NoteStore } from './NoteStore'

export const NotesContext = createContext<NoteStore | null>(null)

export function useNotes() {
  const store = useContext(NotesContext)
  if (!store) throw new Error('NotesContext eksik')
  return store
}

export function useNote(noteId: string) {
  const store = useNotes()
  return useSyncExternalStore(store.subscribe, () => store.get(noteId))
}
