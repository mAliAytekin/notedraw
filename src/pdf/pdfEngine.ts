import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PdfFile } from '../domain/Workspace'

GlobalWorkerOptions.workerSrc = workerUrl
const assetBase = `${import.meta.env.BASE_URL}pdfjs/`
export const pdfOptions = { cMapUrl: `${assetBase}cmaps/`, cMapPacked: true, standardFontDataUrl: `${assetBase}standard_fonts/`, wasmUrl: `${assetBase}wasm/`, isEvalSupported: false }
export function pdfBytes(data: string) {
  const binary = atob(data.slice(data.indexOf(',') + 1))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}
export function loadPdf(data: string) { return getDocument({ ...pdfOptions, data: pdfBytes(data) }) }

export async function readPdfFile(file: File): Promise<PdfFile> {
  if (file.size > 50 * 1024 * 1024) throw new Error('PDF dosyası en fazla 50 MB olabilir.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Geçerli bir PDF dosyası seçin.')
  const task = getDocument({ ...pdfOptions, data: bytes })
  try {
    const document = await task.promise
    const pageCount = document.numPages
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('PDF baytları okunamadı.'))
      reader.readAsDataURL(new Blob([file], { type: 'application/pdf' }))
    })
    return { pdfId: `pdf:${crypto.randomUUID()}`, name: file.name, data, pageCount, createdAt: new Date().toISOString() }
  } catch (error) { throw new Error(error instanceof Error ? `PDF açılamadı: ${error.message}` : 'PDF açılamadı.') }
  finally { await task.destroy() }
}
