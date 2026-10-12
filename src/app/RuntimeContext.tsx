import { createContext } from 'react'
import type { Runtime } from './Runtime'
import type { Editor } from 'tldraw'

export const RuntimeContext = createContext<Runtime | null>(null)
export const editorRuntimes = new WeakMap<Editor, Runtime>()
