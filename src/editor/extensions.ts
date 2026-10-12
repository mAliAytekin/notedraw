import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'

export function noteExtensions() {
  return [StarterKit.configure({ link: { openOnClick: false }, underline: false }), TableKit.configure({ table: { resizable: false } }), Markdown]
}
