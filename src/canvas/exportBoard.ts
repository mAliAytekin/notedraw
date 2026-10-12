import { FileHelpers, getSvgAsImage, type Editor } from 'tldraw'
import { isTauri } from '@tauri-apps/api/core'

/** WebKit misplaces positioned HTML descendants inside transformed SVGs.
 * Render each HTML card at local origin, then let an ordinary SVG image carry
 * its position/rotation. Other board shapes remain vector in the SVG output. */
export async function exportBoard(editor: Editor, format: 'png' | 'svg', rasterizeCards = isTauri()) {
  editor.complete()
  const ids = [...editor.getCurrentPageShapeIds()]
  if (!ids.length) throw new Error('Bu board boş; dışa aktarılacak şekil yok.')
  const result = await editor.getSvgElement(ids, { background: true, padding: 24 })
  if (!result) throw new Error('Board görseli oluşturulamadı.')
  const { svg, width, height } = result
  if (rasterizeCards) {
    for (const card of svg.querySelectorAll<SVGForeignObjectElement>('foreignObject.tl-export-embed-styles')) {
      const w = Number(card.getAttribute('width')), h = Number(card.getAttribute('height'))
      const local = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      local.setAttribute('width', String(w)); local.setAttribute('height', String(h)); local.setAttribute('viewBox', `0 0 ${w} ${h}`)
      for (const style of svg.querySelectorAll('style')) local.append(style.cloneNode(true))
      local.append(card.cloneNode(true))
      const png = await getSvgAsImage(new XMLSerializer().serializeToString(local), { type: 'png', width: w, height: h, pixelRatio: 2 })
      if (!png) throw new Error('Markdown kartı görsele dönüştürülemedi; dışa aktarma durduruldu.')
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      image.setAttribute('width', String(w)); image.setAttribute('height', String(h))
      image.setAttribute('href', await FileHelpers.blobToDataUrl(png))
      card.replaceWith(image)
    }
  }
  const source = new XMLSerializer().serializeToString(svg)
  if (format === 'svg') return new Blob([source], { type: 'image/svg+xml' })
  const png = await getSvgAsImage(source, { type: 'png', width, height, pixelRatio: 2 })
  if (!png) throw new Error('PNG oluşturulamadı.')
  return png
}
