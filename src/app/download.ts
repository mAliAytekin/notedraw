import { invoke, isTauri } from '@tauri-apps/api/core'
import { FileHelpers } from 'tldraw'

export function download(name: string, data: string, type: string) {
  return downloadBlob(name, new Blob([data], { type }))
}
export async function downloadBlob(name: string, blob: Blob) {
  if (isTauri()) {
    const data = await FileHelpers.blobToDataUrl(blob)
    await invoke('export_save', { name, data: data.slice(data.indexOf(',') + 1) })
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const fileName = (title: string) => title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'not'
