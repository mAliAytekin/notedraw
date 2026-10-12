import { t, useLocale, getLocale, translateMessage } from '../i18n'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FileHelpers, Tldraw, useValue, type Editor, type TLUiOverrides } from 'tldraw'
import { MarkdownCardShapeUtil } from '../canvas/MarkdownCardShapeUtil'
import { pdfSelectionMime } from '../pdf/annotations'
import { NotesContext } from '../domain/NotesContext'
import type { NoteStore } from '../domain/NoteStore'
import type { WorkspaceEnvelope } from '../domain/Workspace'
import { validateWorkspace } from '../storage/validateWorkspace'
import { Explorer } from '../explorer/Explorer'
import { validateEnvelope } from '../storage/validateEnvelope'
import { download } from './download'
import { getRuntime, Runtime } from './Runtime'
import { TauriAdapter } from '../storage/TauriAdapter'
import { DesktopControls } from './DesktopControls'
import { RuntimeContext } from './RuntimeContext'
import { KnowledgePanel } from '../explorer/KnowledgePanel'
import { useModalAccessibility } from './useModalAccessibility'
import { performanceProbe, resetPerformanceProbe, startPerformanceProbe } from './performanceProbe'
import { downloadBlob, fileName } from './download'
import { exportBoard } from '../canvas/exportBoard'

const PdfReader = lazy(() => import('../pdf/PdfReader').then(module => ({ default: module.PdfReader })))
const shapeUtils = [MarkdownCardShapeUtil]
const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
const videoTypes: string[] = []
const assets = {
  upload: async (_: unknown, file: File) => {
    if (!imageTypes.includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('PNG/JPEG/WebP/GIF/AVIF görseli seçin (en fazla 10 MB).')
    return { src: await FileHelpers.blobToDataUrl(file) }
  },
}
const components = { MainMenu: null, PageMenu: null, ContextMenu: null, ActionsMenu: null }
const canvasAssetUrls = { translations: { tr: `${import.meta.env.BASE_URL}translations/tr.json`, en: `${import.meta.env.BASE_URL}translations/en.json` } }
const overrides: TLUiOverrides = {
  actions: (_, actions) => Object.fromEntries(Object.entries(actions).filter(([id]) => !id.startsWith('export-') && id !== 'insert-embed')),
}

declare global {
  interface Window { __phase0?: { editor: Editor; notes: NoteStore; runtime: Runtime; metrics: typeof performanceProbe; resetMetrics: typeof resetPerformanceProbe } }
}

export function App({ adapter, onWorkspaceClose, onRuntime }: { adapter?: TauriAdapter; onWorkspaceClose?: () => void; onRuntime?: (runtime: Runtime) => void } = {}) {
  const locale = useLocale()
  useModalAccessibility()
  const [runtime, setRuntime] = useState<Runtime>()
  const [searchOpen, setSearchOpen] = useState(false)
  const [dropError, setDropError] = useState<string>()
  const [, rerender] = useState(0)
  const [mountVersion, setMountVersion] = useState(0)
  const [showExplorer, setShowExplorer] = useState(() => {
    try { return localStorage.getItem('knowledge-canvas-explorer') !== 'hidden' } catch { return true }
  })
  const changeExplorer = (visible: boolean) => {
    setShowExplorer(visible)
    try { localStorage.setItem('knowledge-canvas-explorer', visible ? 'visible' : 'hidden') } catch { /* session-only preference */ }
  }
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('knowledge-canvas-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    let cancelled = false
    void getRuntime(adapter).then(value => { if (!cancelled) setRuntime(value) })
    return () => { cancelled = true }
  }, [adapter])
  useEffect(() => { if (runtime) onRuntime?.(runtime) }, [runtime, onRuntime])
  useEffect(() => {
    if (!runtime) return
    const key = (event: KeyboardEvent) => {
      if (!event.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey && !document.querySelector('[role="dialog"]')) {
        event.preventDefault(); event.stopImmediatePropagation(); runtime.editor?.complete(); setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', key, true)
    const stopProbe = startPerformanceProbe()
    return () => { document.removeEventListener('keydown', key, true); stopProbe() }
  }, [runtime])
  const onMount = useCallback((editor: Editor) => {
    if (!runtime) return
    const cleanup = runtime.attach(editor)
    editor.user.updateUserPreferences({ colorScheme: theme, locale: getLocale() })
    if (import.meta.env.MODE === 'test') window.__phase0 = { editor, notes: runtime.notes, runtime, metrics: performanceProbe, resetMetrics: resetPerformanceProbe }
    setMountVersion(version => version + 1)
    return () => { cleanup(); if (import.meta.env.MODE === 'test') delete window.__phase0 }
    // Theme changes are applied directly, without remounting the canvas.
  }, [runtime])

  useEffect(() => { runtime?.editor?.user.updateUserPreferences({ locale }) }, [runtime, locale, mountVersion])

  if (!runtime) return <div className="load-screen" role="status">{t("Notlar ve tuval açılıyor…")}</div>
  if (runtime.error || (runtime.recoveryDraft && runtime.writable)) {
    return <RecoveryScreen runtime={runtime} onReady={() => rerender(count => count + 1)} />
  }
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    runtime.editor?.user.updateUserPreferences({ colorScheme: next })
    try { localStorage.setItem('knowledge-canvas-theme', next) } catch { /* session-only preference */ }
  }
  return <RuntimeContext.Provider value={runtime}><NotesContext.Provider value={runtime.notes}>
    <main className="workspace" data-theme={theme} onKeyDownCapture={event => {
      if ((event.target as HTMLElement).closest('.workspace-toolbar, .explorer, .modal, .desktop-bar')) runtime.editor?.markEventAsHandled(event)
    }}>
      <header className="app-header">
        <div className="brand"><span className="brand-icon">K</span><div><h1>Knowledge Canvas</h1><p>{t("Düşünceler arasında bağ kur.")}</p></div></div>
        {mountVersion > 0 && runtime.saver ? <WorkspaceToolbar runtime={runtime} theme={theme} toggleTheme={toggleTheme} showExplorer={showExplorer} toggleExplorer={() => changeExplorer(!showExplorer)} openSearch={() => { runtime.editor?.complete(); setSearchOpen(true) }} /> : <span>{t("Tuval hazırlanıyor…")}</span>}
      </header>
      {mountVersion > 0 && runtime.adapter instanceof TauriAdapter && <DesktopControls runtime={runtime} onClose={onWorkspaceClose} />}
      {runtime.adapter instanceof TauriAdapter && import.meta.env.PROD && !import.meta.env.VITE_TLDRAW_LICENSE_KEY && <div className="readonly-banner" role="status">{t("Paketlenmiş uygulamanın tuvali için masaüstünü kapsayan tldraw lisans anahtarı gerekli. Geliştirme sürümünü npm run desktop:dev ile açabilirsiniz.")}</div>}
      {!runtime.writable && <div className="readonly-banner" role="status">{runtime.adapter instanceof TauriAdapter ? t("Bu workspace başka uygulamada düzenleniyor. Bu pencere salt okunur. Diğer uygulamayı kapattıktan sonra") : t("Bu workspace başka sekmede düzenleniyor. Bu sekme salt okunur. Diğer sekmeyi kapattıktan sonra")} <button onClick={() => window.location.reload()}>{t("yeniden aç")}</button>.</div>}
      {dropError && <div className="workspace-error" role="alert">{translateMessage(dropError)}<button onClick={() => setDropError(undefined)} aria-label={t('Hata mesajını kapat')}>×</button></div>}
      <div className="workspace-body">
        {mountVersion > 0 && showExplorer && <Explorer runtime={runtime} onClose={() => changeExplorer(false)} />}
        <section className="canvas" aria-label={t("Bilgi tuvali")} onDragOverCapture={event => {
          if (!event.dataTransfer.types.includes(pdfSelectionMime)) return
          event.preventDefault(); event.stopPropagation()
          event.dataTransfer.dropEffect = runtime.writable && !runtime.editor?.getInstanceState().isReadonly && !(event.target as HTMLElement).closest('.pdf-panel') ? 'copy' : 'none'
        }} onDropCapture={event => {
          if (!event.dataTransfer.types.includes(pdfSelectionMime)) return
          event.preventDefault(); event.stopPropagation()
          if (!runtime.writable || !runtime.editor || runtime.editor.getInstanceState().isReadonly || (event.target as HTMLElement).closest('.pdf-panel')) return
          try {
            const raw = event.dataTransfer.getData(pdfSelectionMime)
            if (raw.length > 150_000) throw new Error(t('Geçerli bir PDF metni seçin.'))
            runtime.addPdfExcerpt(JSON.parse(raw), runtime.editor.screenToPage({ x: event.clientX, y: event.clientY }))
            setDropError(undefined)
          } catch (error) { setDropError(error instanceof SyntaxError ? t('Geçerli bir PDF metni seçin.') : error instanceof Error ? error.message : String(error)) }
        }} onDragOver={event => {
          if (event.dataTransfer.types.includes('application/x-knowledge-note') && runtime.writable) event.preventDefault()
        }} onDrop={event => {
          const noteId = event.dataTransfer.getData('application/x-knowledge-note')
          if (noteId && runtime.writable) {
            event.preventDefault(); event.stopPropagation()
            runtime.addCard(noteId, runtime.editor!.screenToPage({ x: event.clientX, y: event.clientY }))
          }
        }}>
        <Tldraw locale={locale} assetUrls={canvasAssetUrls} licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined} shapeUtils={shapeUtils} onMount={onMount} assets={assets} components={components} overrides={overrides}
          acceptedImageMimeTypes={imageTypes} acceptedVideoMimeTypes={videoTypes} maxAssetSize={10 * 1024 * 1024} />
          {mountVersion > 0 && <PdfPanel runtime={runtime} />}
        </section>
      </div>
      <footer className="app-footer"><span><strong>{t("Tek tık")}</strong>{t(" seç · ")}<strong>{t("Sürükle")}</strong>{t(" taşı · ")}<strong>{t("Çift tık")}</strong>{t(" yaz")}</span><span>{runtime.adapter instanceof TauriAdapter ? t("Gerçek workspace dosyaları") : t("Tarayıcıda yerel kayıt")} · <strong>Esc</strong>{t(" bitir · ")}<strong>A</strong>{t(" ok · ")}<strong>D</strong>{t(" çizim")}</span></footer>
      {searchOpen && <KnowledgePanel runtime={runtime} onClose={() => setSearchOpen(false)} />}
    </main>
  </NotesContext.Provider></RuntimeContext.Provider>
}

function WorkspaceToolbar({ runtime, theme, toggleTheme, showExplorer, toggleExplorer, openSearch }: { runtime: Runtime; theme: 'light' | 'dark'; toggleTheme: () => void; showExplorer: boolean; toggleExplorer: () => void; openSearch: () => void }) {
  useLocale()
  const workspace = useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.get)
  const canvasReadonly = useValue('workspace operation lock', () => runtime.editor!.getInstanceState().isReadonly, [runtime])
  const saver = runtime.saver!
  const status = useSyncExternalStore(saver.subscribe, saver.getStatus)
  const notes = useSyncExternalStore(runtime.notes.subscribe, runtime.notes.all)
  const referenced = useValue('referenced notes', () => new Set(runtime.editor!.getCurrentPageShapes().filter(s => s.type === 'markdown-card').map(s => s.props.noteId)), [runtime])
  const [showNotes, setShowNotes] = useState(false)
  const [pending, setPending] = useState<WorkspaceEnvelope>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const attempt = async (operation: () => Promise<void>) => {
    setError(undefined); setBusy(true)
    try { await operation() } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  const exportBackup = () => attempt(async () => {
    runtime.editor?.complete()
    if (runtime.writable) {
      try { await runtime.flush() }
      catch { setError(t("Tarayıcı kaydı tamamlanamadı; bellekteki güncel içerik yedeğe aktarıldı. Kayıt hatası devam ediyor.")) }
    }
    const backup = validateEnvelope(runtime.capture(saver.getStatus().revision))
    await download('knowledge-canvas.board-backup.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
  })
  return <>
    <div className="workspace-toolbar">
      <LanguageSwitcher />
      <div className="save-indicator" role="status" data-state={status.state}>
        <span className="save-dot" />{!runtime.writable ? t("Salt okunur") : ({ saved: t("Kaydedildi"), dirty: t("Değişiklik var"), saving: t("Kaydediliyor…"), error: t("Kayıt hatası") })[status.state]}
      </div>
      {status.state === 'error' && <button onClick={() => attempt(() => saver.flush())}>{t("Tekrar dene")}</button>}
      <button aria-label={t("Workspace gezginini aç/kapat")} aria-expanded={showExplorer} aria-controls="workspace-explorer" title={showExplorer ? t("Workspace bölümünü gizle") : t("Workspace bölümünü aç")} onClick={toggleExplorer}>☷ Workspace {showExplorer ? '‹' : '›'}</button>
      <button className="primary-button" disabled={canvasReadonly || busy} onClick={() => attempt(async () => { runtime.addCard() })}>{t("+ Yeni Markdown Kartı")}</button>
      <button aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}>{t("Notlar ({count})", { count: notes.length })}</button>
      <button aria-keyshortcuts="Control+k Meta+k" onClick={openSearch}>{t("Notlarda ara")}</button>
      <button disabled={busy} onClick={() => attempt(async () => {
        const blob = await exportBoard(runtime.editor!, 'png')
        await downloadBlob(`${fileName(runtime.activeBoard.title)}.png`, blob)
      })}>{t("PNG indir")}</button>
      <button disabled={busy} onClick={() => attempt(async () => {
        const blob = await exportBoard(runtime.editor!, 'svg')
        await downloadBlob(`${fileName(runtime.activeBoard.title)}.svg`, blob)
      })}>{t("SVG indir")}</button>
      <button disabled={busy} title={t("Mevcut board ve notlar. Klasörler, diğer board'lar ve PDF'ler için workspace yedeğini kullanın.")} onClick={exportBackup}>{t("Board yedeği indir")}</button>
      <button disabled={busy} onClick={() => attempt(async () => {
        runtime.editor?.complete()
        if (runtime.writable) { try { await runtime.flush() } catch { setError(t("Kayıt hatası sürüyor; bellekteki workspace yedeğe aktarıldı.")) } }
        const backup = validateWorkspace(runtime.captureWorkspace(saver.getStatus().revision))
        await download('knowledge-canvas.workspace-backup.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
      })}>{t("Workspace yedeği indir")}</button>
      <button disabled={!runtime.writable || busy} onClick={() => input.current?.click()}>{t("Yedek yükle")}</button>
      <button disabled={canvasReadonly || busy} onClick={() => pdfInput.current?.click()}>{t("PDF aç")}</button>
      {workspace.pdfs.length > 0 && <>
        <select aria-label={t("Workspace PDF seç")} value={runtime.reader.pdfId ?? ''} onChange={event => { if (event.target.value) runtime.updateReader({ pdfId: event.target.value, open: true, page: 1, zoom: 1 }) }}><option value="">{t("PDF seç…")}</option>{workspace.pdfs.map(pdf => <option key={pdf.pdfId} value={pdf.pdfId}>{pdf.name}</option>)}</select>
        {runtime.reader.pdfId && !runtime.reader.open && <button onClick={() => runtime.updateReader({ open: true })}>{t("PDF göster")}</button>}
      </>}
      <input ref={pdfInput} type="file" accept=".pdf,application/pdf" hidden aria-label={t("PDF dosyası seç")} onChange={event => {
        const file = event.target.files?.[0], boardId = runtime.activeBoard.boardId
        event.target.value = ''
        if (file) void attempt(async () => {
          const { readPdfFile } = await import('../pdf/pdfEngine')
          const pdf = await readPdfFile(file)
          runtime.addPdf(pdf, boardId)
        })
      }} />
      <button aria-label={t("Temayı değiştir")} onClick={toggleTheme}>{theme === 'light' ? '☾' : '☀'}</button>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label={t("Board yedeği seç")} onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void attempt(async () => {
          if (file.size > 100 * 1024 * 1024) throw new Error(t("Yedek dosyası 100 MB sınırını aşıyor."))
          const validated = validateWorkspace(JSON.parse(await file.text()))
          runtime.editor?.complete()
          setPending(validated)
        })
      }} />
    </div>
    {(error || status.error) && <div className="workspace-error" role="alert">{translateMessage(error || status.error)}<button onClick={() => setError(undefined)} aria-label={t("Hata mesajını kapat")}>×</button></div>}
    {showNotes && <aside className="notes-popover" aria-label={t("Saklanan notlar")}>
      <div className="popover-title"><strong>{t("Notlar")}</strong><button onClick={() => setShowNotes(false)} aria-label={t("Not listesini kapat")}>×</button></div>
      <p>{t("Kart silinse de not burada kalır.")}</p>
      {notes.map(note => <div className="saved-note" key={note.noteId}><div><strong>{note.title || t("Adsız not")}</strong><small>{referenced.has(note.noteId) ? t("Tuvalde") : t("Saklanan not")}</small></div>
        <button disabled={!runtime.writable} aria-label={t("{name} notunu tuvale ekle", { name: note.title || t("Adsız not") })} onClick={() => { runtime.addCard(note.noteId); setShowNotes(false) }}>{t("+ Ekle")}</button></div>)}
    </aside>}
    {pending && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <h2 id="import-title">{t("Mevcut workspace değiştirilsin mi?")}</h2>
      <p>{t("“{name}” yedeğinde {boards} board, {folders} klasör, {notes} not ve {pdfs} PDF var. Mevcut workspace bu yedekle değiştirilecek. Aynı kimliklere sahip mevcut içerikler de değiştirilecek.", { name: pending.title, boards: pending.boards.length, folders: pending.folders.length, notes: pending.notes.length, pdfs: pending.pdfs.length })}</p>
      <p>{t("Kopya almak istersen vazgeçip “Workspace yedeği indir” kullanabilirsin.")}</p>
      <div className="modal-actions"><button data-dialog-dismiss disabled={busy} onClick={() => setPending(undefined)}>{t("Vazgeç")}</button>
        <button className="primary-button" disabled={busy} onClick={() => attempt(async () => {
          runtime.editor!.updateInstanceState({ isReadonly: true })
          try { await runtime.importBackup(pending); setPending(undefined) }
          finally { runtime.editor!.updateInstanceState({ isReadonly: !runtime.writable }) }
        })}>{t("Yedeği yükle ve değiştir")}</button></div>
    </section></div>}
    {busy && <div className="operation-indicator" role="status">{t("İşlem sürüyor…")}</div>}
  </>
}

function PdfPanel({ runtime }: { runtime: Runtime }) {
  useLocale()
  useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.get)
  return runtime.reader.open ? <Suspense fallback={<span className="operation-indicator" role="status">{t("PDF okuyucu açılıyor…")}</span>}><PdfReader runtime={runtime} /></Suspense> : null
}

function RecoveryScreen({ runtime, onReady }: { runtime: Runtime; onReady: () => void }) {
  useLocale()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<WorkspaceEnvelope>()
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(undefined)
    try { await action(); onReady() } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  return <main className="load-screen"><section className="recovery-panel"><LanguageSwitcher />
    <h1>{runtime.error ? t("Kayıt güvenle açılamadı") : t("Daha yeni bir taslak bulundu")}</h1>
    <p>{translateMessage(runtime.error) || t("Son tam kayıttan sonra düzenlenmiş bir taslak var. İçeriği kurtarabilir veya son tam kaydı açabilirsiniz.")}</p>
    {(error || !runtime.writable) && <p role="alert">{translateMessage(error) || t("Bu sekme salt okunur. Kurtarma için diğer yazan sekmeyi kapatıp yeniden açın.")}</p>}
    <div className="recovery-actions">
      <button disabled={busy} onClick={() => run(() => download('knowledge-canvas-recovery.json', JSON.stringify(runtime.raw, null, 2), 'application/json'))}>{t("Ham kaydı indir")}</button>
      {!runtime.error && <>
        <button disabled={busy || !runtime.writable} onClick={() => run(() => runtime.recover(false))}>{t("Son tam kaydı aç")}</button>
        <button className="primary-button" disabled={busy || !runtime.writable} onClick={() => run(() => runtime.recover(true))}>{t("Taslağı kurtar")}</button>
      </>}
      {runtime.error && <label className="file-label">{t("Geçerli yedek seç")}<input type="file" accept=".json" disabled={busy || !runtime.writable} onChange={event => {
        const file = event.target.files?.[0]
        if (file) void run(async () => { setPending(validateWorkspace(JSON.parse(await file.text()))) })
      }} /></label>}
      <button onClick={() => window.location.reload()}>{t("Yeniden dene")}</button>
    </div>
    {pending && <div className="recovery-confirm"><p>{t("Mevcut bozuk kayıt, “{name}” workspace yedeğiyle değiştirilecek. Devam etmeden önce ham kaydı indirebilirsiniz.", { name: pending.title })}</p>
      <button disabled={busy} onClick={() => run(() => runtime.restoreDamaged(pending))}>{t("Yedekle değiştir")}</button><button onClick={() => setPending(undefined)}>{t("Vazgeç")}</button></div>}
  </section></main>
}
