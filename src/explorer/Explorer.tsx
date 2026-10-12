import { t, useLocale, translateMessage } from '../i18n'
import { useState, useSyncExternalStore } from 'react'
import type { Runtime } from '../app/Runtime'

type Kind = 'folder' | 'board' | 'note'
type Form = { kind: Kind; id?: string; name: string; folderId: string | null }
type Deletion = { kind: Kind; id: string; name: string }

export function Explorer({ runtime, onClose }: { runtime: Runtime; onClose: () => void }) {
  useLocale()
  const state = useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.get)
  const notes = useSyncExternalStore(runtime.notes.subscribe, runtime.notes.all)
  const [form, setForm] = useState<Form>()
  const [deletion, setDeletion] = useState<Deletion>()
  const [selected, setSelected] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const folderId = state.folders.some(folder => folder.folderId === selected) ? selected : null
  const perform = async (action: () => unknown) => {
    setBusy(true); setError(undefined)
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const create = (kind: Kind) => setForm({ kind, name: '', folderId })
  const disabled = !runtime.writable || busy
  const itemActions = (kind: Kind, id: string, name: string, parentId: string | null) => <div className="tree-actions">
    {kind === 'note' && <button disabled={disabled} title={t("Notu mevcut board'a ekle")} aria-label={t("{name} notunu karta ekle", { name })} onClick={() => perform(() => runtime.addCard(id))}>＋</button>}
    <button disabled={disabled} aria-label={t(kind === "folder" ? "{name} klasörünü düzenle" : kind === "board" ? "{name} board'unu düzenle" : "{name} notunu düzenle", { name })} onClick={() => setForm({ kind, id, name, folderId: parentId })}>⋯</button>
    <button disabled={disabled} aria-label={t(kind === "folder" ? "{name} klasörünü sil" : kind === "board" ? "{name} board'unu sil" : "{name} notunu sil", { name })} onClick={() => { runtime.editor?.complete(); setDeletion({ kind, id, name }) }}>×</button>
  </div>
  const contents = (parentId: string | null, depth = 0): React.ReactNode => <>
    {state.folders.filter(folder => folder.parentId === parentId).map(folder => <div key={folder.folderId}>
      <div className={`tree-row ${folderId === folder.folderId ? 'selected-folder' : ''}`} style={{ paddingLeft: 12 + depth * 14 }} role="group" aria-label={t("Klasör: {name}", { name: folder.name })}>
        <button className="tree-disclosure" aria-label={t("{name} klasörünü aç/kapat", { name: folder.name })} aria-expanded={!collapsed.has(folder.folderId)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(folder.folderId)) next.delete(folder.folderId); else next.add(folder.folderId); return next })}>{collapsed.has(folder.folderId) ? '▸' : '▾'}</button>
        <button className="tree-label" aria-label={folder.name} onClick={() => {
          setSelected(folder.folderId)
          setCollapsed(previous => { const next = new Set(previous); next.delete(folder.folderId); return next })
        }}><span>▱</span><span>{folder.name}</span></button>
        {itemActions('folder', folder.folderId, folder.name, folder.parentId)}
      </div>
      {!collapsed.has(folder.folderId) && contents(folder.folderId, depth + 1)}
    </div>)}
    {state.boards.filter(board => (board.folderId ?? null) === parentId).map(board => <div className={`tree-row ${state.activeBoardId === board.boardId ? 'active-board' : ''}`} style={{ paddingLeft: 12 + depth * 14 }} key={board.boardId} role="group" aria-label={t("Board: {name}", { name: board.title })}>
      <button className="tree-label" aria-label={board.title} disabled={busy} aria-current={state.activeBoardId === board.boardId ? 'page' : undefined} onClick={() => perform(() => runtime.switchBoard(board.boardId))}><span>▦</span><span>{board.title}</span></button>
      {itemActions('board', board.boardId, board.title, board.folderId ?? null)}
    </div>)}
    {notes.filter(note => (note.folderId ?? null) === parentId).map(note => <div className="tree-row" style={{ paddingLeft: 12 + depth * 14 }} key={note.noteId} role="group" aria-label={t("Not: {name}", { name: note.title || t("Adsız not") })}>
      <button className="tree-label" disabled={disabled} draggable={runtime.writable} title={t("Tuvale sürükle veya tıkla")} onDragStart={event => { event.dataTransfer.setData('application/x-knowledge-note', note.noteId); event.dataTransfer.effectAllowed = 'copy' }} onClick={() => perform(() => runtime.addCard(note.noteId))}><span>↗</span><span>{note.title || t("Adsız not")}</span></button>
      {itemActions('note', note.noteId, note.title || t("Adsız not"), note.folderId ?? null)}
    </div>)}
  </>
  const references = deletion?.kind === 'note' ? runtime.noteReferences(deletion.id) : []
  const affected = deletion?.kind === 'folder' ? runtime.workspace.descendants(deletion.id) : new Set<string>()
  const affectedNotes = deletion?.kind === 'folder' ? notes.filter(note => note.folderId && affected.has(note.folderId)) : []
  const externalRefs = affectedNotes.flatMap(note => runtime.noteReferences(note.noteId)).filter(ref => !affected.has(state.boards.find(board => board.boardId === ref.boardId)?.folderId ?? ''))
  return <aside id="workspace-explorer" className="explorer" aria-label={t("Workspace gezgini")}>
    <div className="explorer-heading"><div><span>WORKSPACE</span><button aria-label={t("Workspace gezginini kapat")} title={t("Workspace bölümünü gizle")} onClick={onClose}>‹</button></div><strong>{state.title}</strong></div>
    <div className="explorer-create"><button disabled={disabled} onClick={() => create('folder')}>{t("+ Klasör")}</button><button disabled={disabled} onClick={() => create('board')}>{t("+ Board")}</button><button disabled={disabled} onClick={() => create('note')}>{t("+ Not")}</button></div>
    <button className={`root-folder ${folderId === null ? 'selected-folder' : ''}`} onClick={() => setSelected(null)}>{t("⌂ Tüm workspace")}</button>
    <div className="folder-context">{t("Yeni öğe: {path}", { path: runtime.workspace.folderPath(folderId) })}</div>
    <nav className="tree" aria-label={t("Klasörler, board'lar ve notlar")}>{contents(null)}</nav>
    <div className="explorer-footer">{t("{boards} board · {notes} not", { boards: state.boards.length, notes: notes.length })}<br />{t("Notu tuvale sürükle veya tıkla.")}</div>
    {error && <p className="explorer-error" role="alert">{translateMessage(error)}<button onClick={() => setError(undefined)}>{t("Kapat")}</button></p>}
    {form && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="entity-title" onSubmit={event => {
      event.preventDefault()
      void perform(async () => {
        if (!form.name.trim()) throw new Error(t("Ad boş olamaz."))
        if (form.kind === 'folder') {
          if (form.id) runtime.editFolder(form.id, form.name, form.folderId); else runtime.createFolder(form.name, form.folderId)
        } else if (form.kind === 'board') {
          if (form.id) runtime.editBoard(form.id, form.name, form.folderId); else await runtime.createBoard(form.name, form.folderId)
        } else {
          if (form.id) runtime.editNote(form.id, form.name, form.folderId); else runtime.createNote(form.name, form.folderId)
        }
        setForm(undefined)
      })
    }}>
      <h2 id="entity-title">{t(form.id ? "{kind} düzenle / taşı" : "{kind} oluştur", { kind: form.kind === 'folder' ? t("Klasör") : form.kind === 'board' ? t("Board") : t("Not") })}</h2>
      <label>{t("Ad")}<input autoFocus required maxLength={form.kind === 'folder' ? 100 : 200} aria-label={t("Öğe adı")} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>{form.kind === 'folder' ? t("Üst klasör") : t("Klasör")}<select aria-label={t("Hedef klasör")} value={form.folderId ?? ''} onChange={event => setForm({ ...form, folderId: event.target.value || null })}>
        <option value="">{t("/ — Workspace kökü")}</option>
        {state.folders.filter(folder => !(form.kind === 'folder' && form.id && runtime.workspace.descendants(form.id).has(folder.folderId))).map(folder => <option key={folder.folderId} value={folder.folderId}>{runtime.workspace.folderPath(folder.folderId)}</option>)}
      </select></label>
      {error && <p role="alert">{translateMessage(error)}</p>}
      <div className="modal-actions"><button data-dialog-dismiss type="button" disabled={busy} onClick={() => { setForm(undefined); setError(undefined) }}>{t("Vazgeç")}</button><button className="primary-button" disabled={busy} type="submit">{t("Kaydet")}</button></div>
    </form></div>}
    {deletion && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <h2 id="delete-title">{t("“{name}” silinsin mi?", { name: deletion.name })}</h2>
      {deletion.kind === 'board' ? <p>{t("Bu board ve çizimleri kaldırılacak. Ortak notlar korunacak. Son board silinirse boş bir board açılacak.")}</p>
        : deletion.kind === 'note' ? <><p>{t("Not kalıcı olarak silinecek. {count} kart etkileniyor; bu kartlar “Not bulunamadı” uyarısıyla kalacak.", { count: references.length })}</p><ul>{[...new Set(references.map(ref => ref.boardTitle))].map(title => <li key={title}>{title}</li>)}</ul></>
          : <><p>{t("Alt klasörleriyle birlikte {folders} klasör, {boards} board ve {notes} not silinecek.", { folders: affected.size, boards: state.boards.filter(board => board.folderId && affected.has(board.folderId)).length, notes: affectedNotes.length })}</p>{externalRefs.length > 0 && <p>{t("Diğer board'larda {count} kartın notu eksilecek: {boards}.", { count: externalRefs.length, boards: [...new Set(externalRefs.map(ref => ref.boardTitle))].join(", ") })}</p>}</>}
      <p>{t("Geri almak için önce workspace yedeği indirin.")}</p>
      <div className="modal-actions"><button data-dialog-dismiss disabled={busy} onClick={() => setDeletion(undefined)}>{t("Vazgeç")}</button><button className="danger-button" disabled={busy} onClick={() => perform(async () => {
        if (deletion.kind === 'board') await runtime.deleteBoard(deletion.id)
        else if (deletion.kind === 'folder') await runtime.deleteFolder(deletion.id)
        else runtime.deleteNote(deletion.id)
        setDeletion(undefined)
      })}>{t("Sil ve onayla")}</button></div>
    </section></div>}
  </aside>
}
