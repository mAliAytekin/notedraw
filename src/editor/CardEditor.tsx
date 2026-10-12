import { t, useLocale, translateMessage } from '../i18n'
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useEditor as useCanvasEditor } from 'tldraw'
import type { Note } from '../domain/NoteStore'
import { useNotes } from '../domain/NotesContext'
import { richTextSafety } from './markdownSafety'
import { InlineNoteEditor } from './InlineNoteEditor'
import { NotePreview } from './NotePreview'
import { download, fileName } from '../app/download'
import { RuntimeContext } from '../app/RuntimeContext'
import { incomingLinks } from '../domain/knowledge'

type Mode = 'rich' | 'source' | 'preview'

export function CardEditor({ note }: { note: Note }) {
  useLocale()
  const canvas = useCanvasEditor()
  const notes = useNotes()
  const [mode, setMode] = useState<Mode>(() => richTextSafety(note.markdown).safe ? 'rich' : 'source')
  const [reason, setReason] = useState<string | undefined>(() => richTextSafety(note.markdown).reason)
  const root = useRef<HTMLDivElement>(null)
  const source = useRef<HTMLTextAreaElement>(null)
  const keyboardTab = useRef(false)
  const [name, setName] = useState(note.title)
  const [downloadError, setDownloadError] = useState<string>()
  useEffect(() => setName(note.title), [note.title])

  const switchMode = (next: Mode) => {
    if (next === 'rich') {
      const safety = richTextSafety(notes.get(note.noteId)!.markdown)
      if (!safety.safe) { setReason(safety.reason); return }
    }
    setReason(undefined)
    setMode(next)
  }
  useEffect(() => {
    const element = root.current
    const wheel = (event: WheelEvent) => event.stopPropagation()
    element?.addEventListener('wheel', wheel, { passive: true })
    if (keyboardTab.current) { root.current?.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`)?.focus(); keyboardTab.current = false }
    else if (mode === 'source') source.current?.focus()
    return () => element?.removeEventListener('wheel', wheel)
  }, [mode])

  return <div ref={root} className="card-editor-shell"
    onPointerDown={canvas.markEventAsHandled} onPointerUp={canvas.markEventAsHandled}
    onKeyDownCapture={canvas.markEventAsHandled} onKeyUpCapture={canvas.markEventAsHandled}
    onKeyDown={event => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
        event.preventDefault(); canvas.complete(); canvas.getContainer().focus()
      }
    }}>
    <div className="note-name-row"><input aria-label={t("Not adı")} value={name} maxLength={200}
      onBlur={() => { if (!name.trim()) setName(note.title) }}
      onChange={event => { setName(event.target.value); if (event.target.value.trim()) notes.rename(note.noteId, event.target.value) }} />
      <button title={t("Notu Markdown dosyası olarak indir")} aria-label={t("Notu Markdown indir")}
        onClick={() => { setDownloadError(undefined); void download(`${fileName(note.title)}.md`, note.markdown, 'text/markdown;charset=utf-8').catch(error => setDownloadError(String(error))) }}>↓ .md</button></div>
    {downloadError && <p role="alert">{translateMessage(downloadError)}</p>}
    <div className="mode-toolbar" role="tablist" aria-label={t("Markdown modu")} onKeyDown={event => {
      const modes: Mode[] = ['rich', 'source', 'preview'], index = modes.indexOf(mode)
      const next = event.key === 'ArrowRight' ? modes[(index + 1) % 3] : event.key === 'ArrowLeft' ? modes[(index + 2) % 3] : event.key === 'Home' ? 'rich' : event.key === 'End' ? 'preview' : undefined
      if (next) { event.preventDefault(); keyboardTab.current = true; switchMode(next) }
    }}>
      <button role="tab" data-mode="rich" tabIndex={mode === 'rich' ? 0 : -1} aria-selected={mode === 'rich'} onClick={() => switchMode('rich')}>{t("Biçimli")}</button>
      <button role="tab" data-mode="source" tabIndex={mode === 'source' ? 0 : -1} aria-selected={mode === 'source'} onClick={() => switchMode('source')}>{t("Kaynak")}</button>
      <button role="tab" data-mode="preview" tabIndex={mode === 'preview' ? 0 : -1} aria-selected={mode === 'preview'} onClick={() => switchMode('preview')}>{t("Önizleme")}</button>
    </div>
    {reason && <p className="syntax-notice" role="status">{translateMessage(reason)} {t("Kaynak metin korunuyor.")}</p>}
    {mode === 'rich' ? <InlineNoteEditor note={note} />
      : mode === 'source' ? <textarea ref={source} className="markdown-source" aria-label={t("Markdown kaynak")}
        spellCheck={false} value={note.markdown} key={note.noteId}
        onChange={event => notes.updateMarkdown(note.noteId, event.target.value)} />
        : <div className="card-scroll markdown-content"><NotePreview markdown={note.markdown} /></div>}
    <CardBacklinks noteId={note.noteId} />
  </div>
}

function CardBacklinks({ noteId }: { noteId: string }) {
  useLocale()
  const runtime = useContext(RuntimeContext)!
  const notes = useSyncExternalStore(runtime.notes.subscribe, runtime.notes.all)
  const entries = useSyncExternalStore(runtime.subscribeKnowledge, runtime.getLinkCatalog)
  const incoming = incomingLinks(notes, noteId, entries)
  const [error, setError] = useState<string>()
  return <details className="card-backlinks"><summary>{t("Bu nota bağlantılar ({count})", { count: incoming.length })}</summary>
    {incoming.map(note => <button key={note.noteId} onClick={() => { void runtime.revealNote(note.noteId).catch(error => setError(String(error))) }}>{note.title}</button>)}
    {error && <span role="alert">{translateMessage(error)}</span>}
  </details>
}
