import { createShapeId, toRichText, type Editor } from 'tldraw'
import { NoteStore } from '../domain/NoteStore'

export const demoNoteId = 'note:bilinc'
export const cardId = createShapeId('bilinc')
export const conceptId = createShapeId('islevselcilik')
export const arrowId = createShapeId('baglanti')

export function createDemoNotes() {
  const now = new Date().toISOString()
  return new NoteStore([{
    noteId: demoNoteId, title: 'Bilinç Problemi', revision: 0, createdAt: now, updatedAt: now,
    markdown: '# Bilinç Problemi\n\nÖznel deneyim nasıl ortaya çıkar?\n\n- Qualia ve birinci şahıs deneyimi\n- Zihin ile beden arasındaki ilişki\n- İşlevsel açıklamanın sınırları',
  }, {
    noteId: 'note:islevselcilik', title: 'İşlevselcilik', revision: 0, createdAt: now, updatedAt: now,
    markdown: '# İşlevselcilik\n\nZihinsel durumlar, yerine getirdikleri işlevle tanımlanır.\n\n> Bir sistemin ne olduğu kadar ne yaptığı da önemlidir.',
  }])
}

export function initializeCanvas(editor: Editor) {
  // React StrictMode may re-run the mount effect against the same editor/store.
  if (editor.getShape(cardId)) return
  editor.createShapes([
    { id: cardId, type: 'markdown-card', x: 140, y: 120, props: { noteId: demoNoteId, w: 360, h: 320 } },
    { id: conceptId, type: 'geo', x: 680, y: 205, props: { w: 245, h: 135, geo: 'rectangle', color: 'blue', fill: 'semi', richText: toRichText('İşlevselcilik') } },
    { id: arrowId, type: 'arrow', x: 0, y: 0, props: { start: { x: 500, y: 280 }, end: { x: 680, y: 270 }, color: 'grey' } },
  ])
  editor.createBindings([
    { type: 'arrow', fromId: arrowId, toId: cardId, props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: false, isPrecise: true } },
    { type: 'arrow', fromId: arrowId, toId: conceptId, props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: false, isPrecise: true } },
  ])
  editor.clearHistory()
}
