import { t, useLocale, translateMessage } from '../i18n'
import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Runtime } from '../app/Runtime'
import { incomingLinks, linkText, searchNotes } from '../domain/knowledge'
import { NotePreview } from '../editor/NotePreview'

export function KnowledgePanel({ runtime, onClose }: { runtime: Runtime; onClose: () => void }) {
  useLocale()
  const notes = useSyncExternalStore(runtime.notes.subscribe, runtime.notes.all)
  const entries = useSyncExternalStore(runtime.subscribeKnowledge, runtime.getLinkCatalog)
  const [query, setQuery] = useState(''), [selected, setSelected] = useState<string>(), [error, setError] = useState<string>(), [busy, setBusy] = useState(false)
  const matches = useMemo(() => searchNotes(notes, query), [notes, query])
  const note = notes.find(note => note.noteId === selected) ?? matches[0]
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const open = async (id: string) => {
    setBusy(true); setError(undefined)
    try { await runtime.revealNote(id); onClose() } catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><section className="modal knowledge-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-title">
    <div className="popover-title"><h2 id="knowledge-title">{t("Notlarda ara")}</h2><button data-dialog-dismiss aria-label={t("Aramayı kapat")} onClick={onClose}>×</button></div>
    <label className="search-label">{t("Başlık veya içerik")}<input type="search" aria-label={t("Notlarda ara")} placeholder={t("Örn. bilinç, qualia…")} autoFocus value={query} onChange={event => { setQuery(event.target.value); setSelected(undefined) }}
      onKeyDown={event => { if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); buttons.current[0]?.focus() } }} /></label>
    <p role="status">{matches.length === 1 ? t("1 not bulundu") : t("{count} not bulundu", { count: matches.length })}</p>
    <div className="knowledge-columns">
      <div className="search-results" role="list" aria-label={t("Arama sonuçları")}>
        {matches.map((item, index) => <div role="listitem" key={item.noteId}><button ref={el => { buttons.current[index] = el }} className={item.noteId === note?.noteId ? 'selected-result' : ''} aria-pressed={item.noteId === note?.noteId} onClick={() => setSelected(item.noteId)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons.current[(index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length]?.focus() }
            if (event.key === 'Enter' && (runtime.writable || runtime.noteReferences(item.noteId).length)) { event.preventDefault(); void open(item.noteId) }
          }}><strong>{item.title || t("Adsız not")}</strong><small>{entries.find(entry => entry.noteId === item.noteId)?.path}</small><span>{item.markdown.replace(/\s+/g, ' ').slice(0, 120)}</span></button></div>)}
        {!matches.length && <p>{t("Bu aramayla eşleşen not yok.")}</p>}
      </div>
      {note && <div className="search-detail">
        <h3>{note.title}</h3><div className="markdown-content search-preview"><NotePreview markdown={note.markdown} onNavigate={id => { void open(id) }} /></div>
        <label>Wiki-link<input readOnly aria-label={t("Not bağlantısı")} value={linkText(note.noteId, entries)} onFocus={event => event.target.select()} /></label>
        <button className="primary-button" disabled={busy || (!runtime.writable && !runtime.noteReferences(note.noteId).length)} onClick={() => open(note.noteId)}>{t("Notu tuvalde göster")}</button>
        <h4>{t("Bu nota bağlantılar")}</h4>
        <div className="backlink-list" aria-label={t("Backlink listesi")}>{incomingLinks(notes, note.noteId, entries).map(source => <button key={source.noteId} disabled={busy || (!runtime.writable && !runtime.noteReferences(source.noteId).length)} onClick={() => open(source.noteId)}>{source.title}</button>)}</div>
      </div>}
    </div>
    {error && <p role="alert">{translateMessage(error)}</p>}
    <p className="keyboard-hint">{t("⌘/Ctrl+K ara · ↓/↑ sonuçlarda gezin · Enter tuvalde göster · Esc kapat")}</p>
  </section></div>
}
