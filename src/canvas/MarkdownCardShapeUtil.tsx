import { t, useLocale } from '../i18n'
import {
  ShapeUtil, Rectangle2d, HTMLContainer, T, resizeBox,
  createShapePropsMigrationSequence, useEditor, useValue,
  type TLShape, type TLResizeInfo, type SvgExportContext,
} from 'tldraw'
import { useNote } from '../domain/NotesContext'
import { CardEditor } from '../editor/CardEditor'
import { NotePreview } from '../editor/NotePreview'
import { RuntimeContext, editorRuntimes } from '../app/RuntimeContext'
import { cardRendered } from '../app/performanceProbe'

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'markdown-card': { w: number; h: number; noteId: string }
  }
}

export type MarkdownCardShape = TLShape<'markdown-card'>

export class MarkdownCardShapeUtil extends ShapeUtil<MarkdownCardShape> {
  static override type = 'markdown-card' as const
  static override props = { w: T.nonZeroNumber, h: T.nonZeroNumber, noteId: T.string }
  // Initial schema: append versioned migrations here when props change.
  static override migrations = createShapePropsMigrationSequence({ sequence: [] })

  getDefaultProps(): MarkdownCardShape['props'] {
    return { w: 360, h: 320, noteId: '' }
  }
  override canEdit() { return true }
  override canResize() { return true }
  override canBind() { return true }
  override canScroll() { return true }
  override isAspectRatioLocked() { return false }
  getGeometry(shape: MarkdownCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }
  override onResize(shape: MarkdownCardShape, info: TLResizeInfo<MarkdownCardShape>) {
    return resizeBox(shape, info, { minWidth: 240, minHeight: 180 })
  }
  component(shape: MarkdownCardShape) { return <MarkdownCard shape={shape} /> }
  override toSvg(shape: MarkdownCardShape, ctx: SvgExportContext) {
    const runtime = editorRuntimes.get(this.editor)
    if (!runtime) throw new Error('Markdown kartının not kaynağı bulunamadı; export durduruldu.')
    const note = runtime.notes.get(shape.props.noteId)
    return <foreignObject className="tl-export-embed-styles" width={shape.props.w} height={shape.props.h}>
      <div className="workspace" data-theme={ctx.isDarkMode ? 'dark' : 'light'} style={{ width: shape.props.w, height: shape.props.h, display: 'block', position: 'relative' }}>
        <div className="markdown-card" style={{ width: shape.props.w, height: shape.props.h, position: 'relative' }}>
          <div className="card-label"><span>↗ MARKDOWN</span><span>{note?.title || t("Not bulunamadı")}</span></div>
          <RuntimeContext.Provider value={runtime}><div className="card-preview markdown-content">{note ? <NotePreview markdown={note.markdown} exporting /> : <p className="missing-note">{t("Not bulunamadı. Referans: {id}", { id: shape.props.noteId })}</p>}</div></RuntimeContext.Provider>
        </div>
      </div>
    </foreignObject>
  }
  getIndicatorPath(shape: MarkdownCardShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function MarkdownCard({ shape }: { shape: MarkdownCardShape }) {
  useLocale()
  cardRendered(shape.props.noteId)
  const canvas = useEditor()
  const editing = useValue('editing note', () => canvas.getEditingShapeId() === shape.id, [canvas, shape.id])
  const note = useNote(shape.props.noteId)
  return (
    <HTMLContainer
      className={`markdown-card ${editing ? 'is-editing' : ''}`}
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: editing ? 'all' : 'none' }}
      data-testid="markdown-card"
      data-shape-id={shape.id}
    >
      <div className="card-label"><span>↗ MARKDOWN</span><span>{editing ? t("Düzenleniyor") : t("Çift tıkla · düzenle")}</span></div>
      {!note ? <p className="missing-note">{t("Not bulunamadı. Referans: {id}", { id: shape.props.noteId })}</p>
        : editing ? <CardEditor key={note.noteId} note={note} />
        : <div className="card-preview markdown-content"><NotePreview markdown={note.markdown} /></div>}
    </HTMLContainer>
  )
}
