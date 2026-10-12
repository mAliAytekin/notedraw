import { t, useLocale, translateMessage, type TranslationKey } from '../i18n'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent } from 'react'
import { useValue } from 'tldraw'
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import type { Runtime } from '../app/Runtime'
import { loadPdf } from './pdfEngine'
import { usePanelPosition, type ResizeEdge } from './usePanelPosition'
import { usePdfSelection } from './usePdfSelection'
import { pdfSelectionMime, type PdfMarkKind } from './annotations'
import './pdf.css'

const resizeEdges: { edge: ResizeEdge; label: TranslationKey }[] = [
  { edge: 'n', label: 'PDF panelini üst kenardan boyutlandır' }, { edge: 'e', label: 'PDF panelini sağ kenardan boyutlandır' },
  { edge: 's', label: 'PDF panelini alt kenardan boyutlandır' }, { edge: 'w', label: 'PDF panelini sol kenardan boyutlandır' },
  { edge: 'ne', label: 'PDF panelini sağ üst köşeden boyutlandır' }, { edge: 'nw', label: 'PDF panelini sol üst köşeden boyutlandır' },
  { edge: 'se', label: 'PDF panelini sağ alt köşeden boyutlandır' }, { edge: 'sw', label: 'PDF panelini sol alt köşeden boyutlandır' },
]
const markLabels: Record<PdfMarkKind, TranslationKey> = { highlight: 'Vurgula', underline: 'Altını çiz', strike: 'Üstünü çiz' }
const removeLabels: Record<PdfMarkKind, TranslationKey> = { highlight: 'Vurgulamayı kaldır', underline: 'Alt çizgiyi kaldır', strike: 'Üst çizgiyi kaldır' }

export function PdfReader({ runtime }: { runtime: Runtime }) {
  useLocale()
  const workspace = useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.get)
  const reader = runtime.reader
  const position = usePanelPosition(workspace.activeBoardId, reader, update => runtime.updateReader(update))
  const pdf = workspace.pdfs.find(item => item.pdfId === reader.pdfId)
  const [loaded, setLoaded] = useState<{ document: PDFDocumentProxy; pdfId: string; data: string }>()
  const [rendered, setRendered] = useState<{ document: PDFDocumentProxy; page: number; zoom: number }>()
  const [clickedMarks, setClickedMarks] = useState<{ document: PDFDocumentProxy; page: number; zoom: number; ids: string[] }>()
  const clickStart = useRef<{ x: number; y: number }>(undefined)
  const readonly = useValue('PDF annotation lock', () => !runtime.writable || !!runtime.editor?.getInstanceState().isReadonly, [runtime])
  const [error, setError] = useState<string>()
  const [rendering, setRendering] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, scale: 1 })
  const ready = !!pdf && !pdf.missing && loaded?.pdfId === pdf.pdfId && loaded?.data === pdf.data && rendered?.document === loaded?.document && rendered?.page === reader.page && rendered?.zoom === reader.zoom && !rendering
  const { selection, capture } = usePdfSelection(layer, pdf?.pdfId, reader.page, reader.zoom, ready)
  useEffect(() => { setClickedMarks(undefined) }, [loaded, reader.page, reader.zoom, readonly])
  useEffect(() => { if (selection) setClickedMarks(undefined) }, [selection])
  const editableMarks = ready && !readonly && !selection && clickedMarks?.document === loaded?.document && clickedMarks?.page === reader.page && clickedMarks?.zoom === reader.zoom ? pdf?.annotations?.filter(mark => clickedMarks.ids.includes(mark.annotationId)) ?? [] : []
  const dragging = useRef(false)
  const action = (run: () => void) => { try { run(); setError(undefined) } catch (error) { setError(error instanceof Error ? error.message : String(error)) } }
  const startDrag = (event: DragEvent, native = false) => {
    const selected = native ? capture() : selection
    if (!selected || readonly) { event.preventDefault(); return }
    event.stopPropagation(); runtime.editor?.markEventAsHandled(event)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(pdfSelectionMime, JSON.stringify(selected))
    event.dataTransfer.setData('text/plain', selected.text)
    dragging.current = true
  }
  useEffect(() => {
    if (!pdf || !reader.open) return
    if (pdf.missing) { setLoaded(undefined); setRendering(false); setError(t("PDF dosyası workspace içinde bulunamadı. Son kayıttaki kopyayı geri yükleyebilir veya dosyayı yerine koyup Yenile kullanabilirsiniz.")); return }
    let cancelled = false
    setLoaded(undefined); setError(undefined); setRendering(true)
    const task = loadPdf(pdf.data)
    void task.promise.then(document => {
      if (!cancelled) setLoaded({ document, pdfId: pdf.pdfId, data: pdf.data })
    }).catch(error => { if (!cancelled) { setError(t("PDF açılamadı: {error}", { error: error.message })); setRendering(false) } })
    return () => { cancelled = true; void task.destroy() }
  }, [pdf?.pdfId, pdf?.data, pdf?.missing, reader.open])
  useEffect(() => {
    if (!loaded || loaded.pdfId !== pdf?.pdfId || loaded.data !== pdf.data || pdf.missing) return
    let cancelled = false, renderTask: RenderTask | undefined, text: TextLayer | undefined
    setRendering(true); setError(undefined)
    void (async () => {
      const page = await loaded.document.getPage(reader.page)
      if (cancelled) return
      const viewport = page.getViewport({ scale: reader.zoom })
      const element = canvas.current!, textContainer = layer.current!
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.floor(viewport.width * ratio); element.height = Math.floor(viewport.height * ratio)
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`
      textContainer.replaceChildren()
      textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
      setDimensions({ width: viewport.width, height: viewport.height, scale: viewport.scale })
      if (scroll.current) { scroll.current.scrollTop = 0; scroll.current.scrollLeft = 0 }
      renderTask = page.render({ canvas: element, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
      text = new TextLayer({ textContentSource: page.streamTextContent(), container: textContainer, viewport })
      await Promise.all([renderTask.promise, text.render()])
      if (!cancelled) { setRendered({ document: loaded.document, page: reader.page, zoom: reader.zoom }); setRendering(false) }
    })().catch(error => { if (!cancelled) { setError(t("Sayfa gösterilemedi: {error}", { error: error.message })); setRendering(false) } })
    return () => { cancelled = true; renderTask?.cancel(); text?.cancel() }
  }, [loaded, pdf?.pdfId, pdf?.data, pdf?.missing, reader.page, reader.zoom])
  if (!pdf || !reader.open) return null
  return <aside ref={position.panel} style={position.style} className="pdf-panel" aria-label={t("PDF okuma paneli")} data-pdf-id={pdf.pdfId}
    onKeyDownCapture={runtime.editor?.markEventAsHandled} onKeyUpCapture={runtime.editor?.markEventAsHandled}
    onPointerDown={runtime.editor?.markEventAsHandled} onPointerUp={runtime.editor?.markEventAsHandled}
    onCopy={event => event.stopPropagation()} onCut={event => event.stopPropagation()} onPaste={event => event.stopPropagation()}
    onKeyDown={event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (event.key === 'Escape') { event.preventDefault(); runtime.updateReader({ open: false }) }
    if (event.shiftKey || !window.getSelection()?.isCollapsed) return
    if (event.key === 'ArrowRight') { event.preventDefault(); runtime.updateReader({ page: reader.page + 1 }) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); runtime.updateReader({ page: reader.page - 1 }) }
  }}>
    <div className="pdf-heading"><button className="pdf-drag-handle" aria-label={t("PDF panelini taşı")} title={t("Sürükleyerek taşı · Ok tuşlarıyla konumlandır")} {...position.handle}><span aria-hidden="true">⠿</span> {t("PDF OKUMA")} <span className="pdf-drag-hint">{t("Sürükle")}</span></button><button aria-label={t("PDF panelini kapat")} onClick={() => runtime.updateReader({ open: false })}>×</button></div>
    <select aria-label={t("Açık PDF")} value={pdf.pdfId} onChange={event => runtime.updateReader({ pdfId: event.target.value, page: 1, zoom: 1, open: true })}>{workspace.pdfs.map(pdf => <option key={pdf.pdfId} value={pdf.pdfId}>{pdf.name}</option>)}</select>
    <div className="pdf-controls">
      <button aria-label={t("Önceki PDF sayfası")} disabled={reader.page <= 1} onClick={() => runtime.updateReader({ page: reader.page - 1 })}>‹</button>
      <label><input type="number" aria-label={t("PDF sayfası")} min={1} max={pdf.pageCount} value={reader.page} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) runtime.updateReader({ page: Math.round(event.target.valueAsNumber) }) }} /> / {pdf.pageCount}</label>
      <button aria-label={t("Sonraki PDF sayfası")} disabled={reader.page >= pdf.pageCount} onClick={() => runtime.updateReader({ page: reader.page + 1 })}>›</button>
      <span className="pdf-control-divider" />
      <button aria-label={t("PDF uzaklaştır")} disabled={reader.zoom <= .25} onClick={() => runtime.updateReader({ zoom: Math.round((reader.zoom - .25) * 100) / 100 })}>−</button>
      <output aria-label={t("PDF yakınlaştırma")}>{Math.round(reader.zoom * 100)}%</output>
      <button aria-label={t("PDF yakınlaştır")} disabled={reader.zoom >= 3} onClick={() => runtime.updateReader({ zoom: Math.round((reader.zoom + .25) * 100) / 100 })}>＋</button>
    </div>
    <div className="pdf-selection-tools" role="toolbar" aria-label={t('PDF metin araçları')}>
      {(Object.keys(markLabels) as PdfMarkKind[]).map(kind => <button key={kind} disabled={!selection || readonly} onPointerDown={event => event.preventDefault()} onClick={() => selection && action(() => runtime.addPdfAnnotation(selection, kind))}>{t(markLabels[kind])}</button>)}
      <button disabled={!selection || readonly} draggable={!!selection && !readonly} onDragStart={event => startDrag(event)} onDragEnd={() => { setTimeout(() => { dragging.current = false }, 0) }} onClick={() => { if (selection && !dragging.current) action(() => runtime.addPdfExcerpt(selection)) }} title={t('Tuvale sürükle veya tıklayarak kart ekle')}>{t('Tuvale sürükle')}</button>
      <small>{t('PDF metnini seç; işaretle veya tuvale taşı.')} {t('İşarete tıklayarak kaldırabilirsin.')}</small>
    </div>
    {rendering && <p className="pdf-status" role="status">{t("PDF hazırlanıyor…")}</p>}
    {error && <p className="pdf-status" role="alert">{translateMessage(error)}</p>}
    {pdf.missing && runtime.writable && <button onClick={() => runtime.restoreMissingPdf(pdf.pdfId)}>{t("PDF’yi son kayıttan geri yükle")}</button>}
    <div className="pdf-scroll" ref={scroll} tabIndex={0} aria-label={t("PDF sayfa içeriği")}>
      <div className="pdf-page" style={{ width: dimensions.width, height: dimensions.height, '--total-scale-factor': dimensions.scale } as CSSProperties}
        onPointerDown={event => { clickStart.current = { x: event.clientX, y: event.clientY }; setClickedMarks(undefined) }}
        onClick={event => {
          const start = clickStart.current
          if (!ready || readonly || event.detail !== 1 || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5 || !window.getSelection()?.isCollapsed) { setClickedMarks(undefined); return }
          // Keep the SVG pointer-transparent so native text selection/drag still works.
          const bounds = layer.current!.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width, y = (event.clientY - bounds.top) / bounds.height
          const hits = pdf.annotations?.filter(mark => mark.page === reader.page && mark.rects.some(rect => x >= rect.x - 3 / bounds.width && x <= rect.x + rect.width + 3 / bounds.width && y >= rect.y - 3 / bounds.height && y <= rect.y + rect.height + 3 / bounds.height)) ?? []
          setClickedMarks({ document: loaded!.document, page: reader.page, zoom: reader.zoom, ids: hits.map(mark => mark.annotationId) })
        }}>
        <canvas ref={canvas} aria-label={t("PDF sayfa {page}", { page: reader.page })} />
        <div ref={layer} className="textLayer" onDragStart={event => startDrag(event, true)} onDragEnd={() => { dragging.current = false }} />
        {ready && <svg className="pdf-annotations" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">{pdf.annotations?.filter(mark => mark.page === reader.page).map(mark => <g key={mark.annotationId} data-testid="pdf-annotation" data-kind={mark.kind}>{mark.rects.map((rect, index) => mark.kind === 'highlight' ? <rect key={index} {...rect} fill="#ffda4a" opacity=".4" /> : <line key={index} x1={rect.x} x2={rect.x + rect.width} y1={rect.y + rect.height * (mark.kind === 'underline' ? .95 : .5)} y2={rect.y + rect.height * (mark.kind === 'underline' ? .95 : .5)} stroke={mark.kind === 'underline' ? '#16805b' : '#d24a4a'} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</g>)}</svg>}
      </div>
    </div>
    {editableMarks.length > 0 && <section className="pdf-mark-actions" aria-label={t('PDF işaretlerini düzenle')}>
      <header><strong>{t('İşaretlemeyi kaldır')}</strong><button aria-label={t('İşaret menüsünü kapat')} onClick={() => setClickedMarks(undefined)}>×</button></header>
      <p title={editableMarks[0].text}>{editableMarks[0].text.slice(0, 120)}</p>
      {editableMarks.map(mark => <button key={mark.annotationId} onClick={() => action(() => runtime.removePdfAnnotation(pdf.pdfId, mark.annotationId))}>{t(removeLabels[mark.kind])}</button>)}
    </section>}
    {!!pdf.annotations?.some(mark => mark.page === reader.page) && <details className="pdf-mark-list"><summary>{t('Bu sayfadaki işaretler ({count})', { count: pdf.annotations.filter(mark => mark.page === reader.page).length })}</summary><ul>{pdf.annotations.filter(mark => mark.page === reader.page).map(mark => <li key={mark.annotationId}><span title={mark.text}>{t(markLabels[mark.kind])} · {mark.text.slice(0, 80)}</span><button disabled={readonly} aria-label={t('İşaretlemeyi kaldır: {text}', { text: mark.text.slice(0, 80) })} onClick={() => action(() => runtime.removePdfAnnotation(pdf.pdfId, mark.annotationId))}>×</button></li>)}</ul></details>}
    <div className="pdf-footer">{t("Ekrana sabit · Tuvalden bağımsız · ")}{runtime.writable ? t("Okuma konumu kaydedilir") : t("Salt okunur oturum")}</div>
    {resizeEdges.map(({ edge, label }) => <button key={edge} className={`pdf-resize-handle pdf-resize-${edge}`} aria-label={t(label)} title={t("Sürükleyerek boyutlandır · Ok tuşlarıyla ayarla")} {...position.resizeHandle(edge)}>{edge === 'se' && <span aria-hidden="true">◢</span>}</button>)}
  </aside>
}
