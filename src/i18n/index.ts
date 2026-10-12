import { useSyncExternalStore } from 'react'
import english from './en.json'

export type Locale = 'tr' | 'en'
export type TranslationKey = keyof typeof english
const storageKey = 'knowledge-canvas-language'
const listeners = new Set<() => void>()
const sourceByEnglish = new Map(Object.entries(english).map(([source, translated]) => [translated, source as TranslationKey]))
const readLocale = (): Locale => {
  try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'tr' } catch { return 'tr' }
}
let locale = readLocale()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getLocale = () => locale

function applyLocale(next: Locale) {
  locale = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach(listener => listener())
}
applyLocale(locale)
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) applyLocale(readLocale())
})

export function setLocale(next: Locale) {
  if (next !== 'tr' && next !== 'en') return
  try { localStorage.setItem(storageKey, next) } catch { /* keep the session preference */ }
  applyLocale(next)
}
export function useLocale() { return useSyncExternalStore(subscribe, getLocale, () => 'tr' as Locale) }
export function t(key: TranslationKey, values: Record<string, string | number> = {}) {
  const template = locale === 'en' ? english[key] : key
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] === undefined ? placeholder : String(values[name]))
}

// Domain/SDK errors stay intact if no explicit translation is available.
export function translateMessage(message: string | undefined): string | undefined {
  if (!message) return message
  const source = Object.hasOwn(english, message) ? message as TranslationKey : sourceByEnglish.get(message)
  if (source) return t(source)
  if (message.startsWith('Error: ')) return `Error: ${translateMessage(message.slice(7))}`
  for (const [prefix, key, parameter] of [
    ['Desteklenmeyen Markdown: ', 'Desteklenmeyen Markdown: {type}', 'type'],
    ['Unsupported Markdown: ', 'Desteklenmeyen Markdown: {type}', 'type'],
    ['PDF açılamadı: ', 'PDF açılamadı: {error}', 'error'],
    ['Could not open PDF: ', 'PDF açılamadı: {error}', 'error'],
    ['Sayfa gösterilemedi: ', 'Sayfa gösterilemedi: {error}', 'error'],
    ['Could not display page: ', 'Sayfa gösterilemedi: {error}', 'error'],
  ] as const) {
    if (message.startsWith(prefix)) return t(key, { [parameter]: message.slice(prefix.length) })
  }
  return message
}
