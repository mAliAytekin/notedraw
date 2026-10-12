import { t, useLocale } from '../i18n'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { useEffect } from 'react'
import { useEditor as useCanvasEditor } from 'tldraw'
import type { Note } from '../domain/NoteStore'
import { useNotes } from '../domain/NotesContext'
import { noteExtensions } from './extensions'
import { editorMounted } from '../app/performanceProbe'

export function InlineNoteEditor({ note }: { note: Note }) {
  const locale = useLocale()
  useEffect(editorMounted, [])
  const notes = useNotes()
  const canvas = useCanvasEditor()
  const editor = useEditor({
    extensions: noteExtensions(),
    content: note.markdown,
    contentType: 'markdown',
    autofocus: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': t("Markdown notunu düzenle"),
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => notes.updateMarkdown(note.noteId, editor.getMarkdown()),
  }, [note.noteId, notes])

  useEffect(() => { if (editor) editor.view.dom.setAttribute("aria-label", t("Markdown notunu düzenle")) }, [editor, locale])

  // Focus synchronously after mounting. Tiptap's delayed autofocus can steal
  // focus from the separate note-name input immediately after a card opens.
  useEffect(() => {
    if (!editor) return
    const frame = requestAnimationFrame(() => {
      const shell = editor.view.dom.closest('.card-editor-shell')
      if (!shell || (shell.contains(document.activeElement) && document.activeElement !== editor.view.dom)) return
      editor.commands.setTextSelection(editor.state.doc.content.size)
      editor.view.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [editor])

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      heading: editor?.isActive('heading', { level: 2 }) ?? false,
      list: editor?.isActive('bulletList') ?? false,
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      table: editor?.isActive('table') ?? false,
    }),
  })

  // The native wheel listener must run before tldraw's container listener.
  // Leave the browser's default scroll intact, including at card boundaries.
  useEffect(() => {
    if (!editor) return
    const scroll = editor.view.dom.closest('.card-scroll')
    if (!scroll) return
    const handleWheel = (event: Event) => event.stopPropagation()
    scroll.addEventListener('wheel', handleWheel, { passive: true })
    return () => scroll.removeEventListener('wheel', handleWheel)
  }, [editor])

  if (!editor) return null
  return (
    <div
      className="inline-editor"
      onPointerDown={canvas.markEventAsHandled}
      onPointerUp={canvas.markEventAsHandled}
      // tldraw's native container listeners precede React's bubble handlers.
      // Mark in capture phase without preventing ProseMirror/native text input.
      onKeyDownCapture={canvas.markEventAsHandled}
      onKeyUpCapture={canvas.markEventAsHandled}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          canvas.complete()
          canvas.getContainer().focus()
        }
      }}
    >
      <div className="format-toolbar" role="toolbar" aria-label={t("Not biçimi")}>
        <button aria-label={t("Başlık")} aria-pressed={active?.heading}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button aria-label={t("Kalın")} aria-pressed={active?.bold}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button aria-label={t("İtalik")} aria-pressed={active?.italic} onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button aria-label={t("Madde listesi")} aria-pressed={active?.list}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>{t("☷ Liste")}</button>
        <button aria-label={t("Numaralı liste")} onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
        <button aria-label={t("Alıntı")} onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>❞</button>
        <button aria-label={t("Kod bloğu")} onPointerDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}>&lt;/&gt;</button>
        <button aria-label={t("Bağlantı")} onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            const url = window.prompt(t("Bağlantı adresi (https://, http:// veya mailto:)"), editor.getAttributes('link').href || '')
            if (url === '') editor.chain().focus().unsetLink().run()
            else if (url && /^(https?:\/\/|mailto:)/i.test(url)) editor.chain().focus().setLink({ href: url }).run()
          }}>↗</button>
        <button aria-label={t("Tablo ekle")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()}>▦</button>
        {active?.table && <>
          <button aria-label={t("Tabloya satır ekle")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}>{t("+ Satır")}</button>
          <button aria-label={t("Tabloya sütun ekle")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}>{t("+ Sütun")}</button>
          <button aria-label={t("Tablo satırını sil")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()}>{t("− Satır")}</button>
          <button aria-label={t("Tablo sütununu sil")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()}>{t("− Sütun")}</button>
          <button aria-label={t("Tabloyu sil")} onPointerDown={event => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>{t("− Tablo")}</button>
        </>}
        <span>{t("Esc · bitir")}</span>
      </div>
      <div className="card-scroll">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
