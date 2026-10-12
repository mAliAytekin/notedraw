import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Note } from './NoteStore'
import type { Folder } from './Workspace'
import type { Root, RootContent } from 'mdast'

export interface NoteSummary { noteId: string; title: string; folderId?: string | null }
export interface KnowledgeNote extends NoteSummary { path: string }
export interface WikiLink { start: number; end: number; target: string; label: string; alias: boolean; raw: string; inTable: boolean }
export type Resolution = { status: 'resolved'; note: KnowledgeNote } | { status: 'missing' | 'ambiguous' }
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
const normalize = (text: string) => text.trim().normalize('NFC').toLocaleLowerCase('tr')
const frontmatterEnd = (markdown: string) => /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(markdown)?.[0].length ?? 0
export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('tr').replaceAll('ı', 'i')

export function catalog(notes: NoteSummary[], folders: Folder[]): KnowledgeNote[] {
  const byId = new Map(folders.map(folder => [folder.folderId, folder]))
  const paths = new Map<string, string>()
  const folderPath = (id?: string | null): string => {
    if (!id) return ''
    if (paths.has(id)) return paths.get(id)!
    const folder = byId.get(id)
    if (!folder) return ''
    const parent = folderPath(folder.parentId), path = parent ? `${parent}/${folder.name}` : folder.name
    paths.set(id, path); return path
  }
  return notes.map(note => ({ ...note, path: [folderPath(note.folderId), note.title].filter(Boolean).join('/') }))
}
export function resolveLink(target: string, notes: KnowledgeNote[]): Resolution {
  const key = normalize(target.replace(/^\//, '').replace(/\.md$/i, ''))
  const found = notes.filter(note => target.startsWith('note:') ? note.noteId === target : normalize(key.includes('/') ? note.path : note.title) === key)
  return found.length === 1 ? { status: 'resolved', note: found[0] } : { status: found.length ? 'ambiguous' : 'missing' }
}

function linksInText(raw: string, offset: number, inTable = false): WikiLink[] {
  const links: WikiLink[] = []
  for (const match of raw.matchAll(/\[\[([^\[\]\n]+)\]\]/g)) {
    const before = raw.slice(0, match.index), escapes = /\\+$/.exec(before)?.[0].length ?? 0
    if (escapes % 2) continue
    const parts = match[1].replace(/\\\|/g, '|').split('|')
    if (parts.length > 2 || !parts[0].trim()) continue
    links.push({ start: offset + match.index!, end: offset + match.index! + match[0].length, target: parts[0].trim(), label: parts.length === 2 ? parts[1].trim() : parts[0].trim(), alias: parts.length === 2, raw: match[0], inTable })
  }
  return links
}
export function wikiLinks(markdown: string): WikiLink[] {
  if (!markdown.includes('[[')) return []
  const links: WikiLink[] = []
  const protectedEnd = frontmatterEnd(markdown)
  const walk = (node: Root | RootContent, inTable = false) => {
    if (['code', 'inlineCode', 'html', 'link', 'linkReference', 'image', 'math', 'inlineMath'].includes(node.type)) return
    if (node.type === 'text' && node.position) {
      const start = node.position.start.offset!, end = node.position.end.offset!
      if (start >= protectedEnd) links.push(...linksInText(markdown.slice(start, end), start, inTable))
    }
    if ('children' in node) for (const child of node.children) walk(child as RootContent, inTable || node.type === 'tableCell')
  }
  walk(parser.parse(markdown) as Root)
  return links
}
const cache = new WeakMap<Note, WikiLink[]>()
export function noteLinks(note: Note) {
  let links = cache.get(note)
  if (!links) { links = wikiLinks(note.markdown); cache.set(note, links) }
  return links
}
export function incomingLinks(notes: Note[], targetId: string, entries: KnowledgeNote[]) {
  return notes.filter(note => noteLinks(note).some(link => {
    const target = resolveLink(link.target, entries)
    return target.status === 'resolved' && target.note.noteId === targetId
  }))
}
export function linkText(noteId: string, entries: KnowledgeNote[]) {
  const note = entries.find(note => note.noteId === noteId)!
  return !/[\[\]|\n]/.test(note.path) && resolveLink(note.path, entries).status === 'resolved' ? `[[${note.path}]]` : `[[${note.noteId}|${note.title.replace(/[\[\]|\n]/g, ' ')}]]`
}
export function containsMath(markdown: string) {
  if (!markdown.includes('$')) return false
  const walk = (node: any): boolean => ['math', 'inlineMath'].includes(node.type) || !!node.children?.some(walk)
  return walk(parser.parse(markdown))
}
/** Rewrites only parsed wiki links; code, URLs, escaped brackets and other source stay exact. */
export function rewriteLinks(markdown: string, before: KnowledgeNote[], after: KnowledgeNote[], changed: Set<string>, deleted = false) {
  let result = markdown
  for (const link of wikiLinks(markdown).reverse()) {
    const resolution = resolveLink(link.target, before)
    if (resolution.status !== 'resolved') continue
    const id = resolution.note.noteId
    const updated = resolveLink(link.target, after)
    if (!changed.has(id) && (deleted || (updated.status === 'resolved' && updated.note.noteId === id))) continue
    let replacement: string
    if (deleted) replacement = `[[${id}|${link.label}]]`
    else if (link.target.startsWith('note:')) continue
    else {
      const destination = linkText(id, after)
      replacement = link.alias ? `[[${destination.slice(2, -2).split('|')[0]}|${link.label}]]` : destination
    }
    if (link.inTable || link.raw.includes('\\|')) replacement = replacement.replaceAll('|', '\\|')
    result = result.slice(0, link.start) + replacement + result.slice(link.end)
  }
  return result
}
export function searchNotes(notes: Note[], query: string) {
  const terms = searchText(query).trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return notes
  return notes.filter(note => { const haystack = searchText(`${note.title}\n${note.markdown}`); return terms.every(term => haystack.includes(term)) })
    .sort((a, b) => Number(searchText(b.title).includes(terms.join(' '))) - Number(searchText(a.title).includes(terms.join(' '))) || a.title.localeCompare(b.title, 'tr'))
}

/** Turn text-node links into safe internal anchors for ReactMarkdown. */
export function remarkWiki() {
  return (tree: Root, file: { value: unknown }) => {
    const markdown = String(file.value)
    const protectedEnd = frontmatterEnd(markdown)
    const walk = (parent: { children: any[]; type: string }) => {
      if (['link', 'linkReference', 'code', 'inlineCode', 'html', 'math', 'inlineMath'].includes(parent.type)) return
      parent.children = parent.children.flatMap(node => {
        if (node.type === 'text' && node.position) {
          const start = node.position.start.offset, raw = markdown.slice(start, node.position.end.offset)
          if (start < protectedEnd) return [node]
          const links = linksInText(raw, start), children: any[] = []; let cursor = 0
          for (const link of links) {
            const text = link.raw.replace(/\\\|/g, '|'), at = node.value.indexOf(text, cursor)
            if (at < 0) continue
            if (at > cursor) children.push({ type: 'text', value: node.value.slice(cursor, at) })
            children.push({ type: 'link', url: '#', data: { hProperties: { 'data-wiki-target': link.target } }, children: [{ type: 'text', value: link.label }] })
            cursor = at + text.length
          }
          if (!children.length) return [node]
          if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) })
          return children
        }
        if (node.children) walk(node)
        return [node]
      })
    }
    walk(tree)
  }
}
