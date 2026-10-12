import { describe, expect, it } from 'vitest'
import { NoteStore, type Note } from './NoteStore'
import { catalog, incomingLinks, linkText, resolveLink, rewriteLinks, searchNotes, wikiLinks, containsMath } from './knowledge'

const note = (id: string, title: string, markdown = '', folderId: string | null = null): Note => ({ noteId: `note:${id}`, title, markdown, folderId, revision: 0, createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' })
const folders = [{ folderId: 'folder:a', name: 'Felsefe', parentId: null }, { folderId: 'folder:b', name: 'AI', parentId: null }]

describe('search and canonical wiki links', () => {
  it('matches every query term across titles and bodies with Turkish/case/diacritic tolerance', () => {
    const notes = [note('a', 'İşlevselcilik', 'Bilinç ve öznel deneyim'), note('b', 'Oyun', 'Bilinci simüle et')]
    expect(searchNotes(notes, 'ISLEV BILINC').map(note => note.noteId)).toEqual(['note:a'])
    expect(searchNotes(notes, 'ÖZNEL')).toEqual([notes[0]])
    expect(searchNotes(notes, '')).toEqual(notes)
  })
  it('distinguishes ambiguous names, qualified paths and stable IDs', () => {
    const entries = catalog([note('a', 'Bilinç', '', 'folder:a'), note('b', 'Bilinç', '', 'folder:b')], folders)
    expect(resolveLink('Bilinç', entries).status).toBe('ambiguous')
    expect(resolveLink('/Felsefe/Bilinç.md', entries)).toMatchObject({ status: 'resolved', note: { noteId: 'note:a' } })
    expect(resolveLink('note:b', entries)).toMatchObject({ status: 'resolved', note: { noteId: 'note:b' } })
    expect(resolveLink('Yok', entries).status).toBe('missing')
    expect(linkText('note:a', entries)).toBe('[[Felsefe/Bilinç]]')
  })
  it('ignores code, escaped brackets, ordinary links, HTML and math when finding or rewriting wiki links', () => {
    const source = '[[Bilinç|Öznel]]\n\n`[[Bilinç]]`\n\n```md\n[[Bilinç]]\n```\n\n\\[[Bilinç]]\n\n[x](https://example.com/[[Bilinç]])\n\n<div>[[Bilinç]]</div>\n\n$[[Bilinç]]$'
    expect(wikiLinks(source).map(link => link.target)).toEqual(['Bilinç'])
    const before = catalog([note('a', 'Bilinç')], []), after = catalog([note('a', 'Deneyim')], [])
    expect(rewriteLinks(source, before, after, new Set(['note:a']))).toBe(source.replace('[[Bilinç|Öznel]]', '[[Deneyim|Öznel]]'))
  })
  it('renames every shared reference once, preserves aliases/IDs, updates backlink results and keeps catalog stable on body edits', () => {
    const store = new NoteStore([note('a', 'Bilinç'), note('b', 'Kaynak', '[[Bilinç]] ve [[Bilinç|Deneyim]] ve [[note:a|sabit]]')])
    const initial = store.catalog(); store.updateMarkdown('note:a', 'Yeni içerik'); expect(store.catalog()).toBe(initial)
    store.rename('note:a', 'Qualia')
    expect(store.get('note:b')?.markdown).toBe('[[Qualia]] ve [[Qualia|Deneyim]] ve [[note:a|sabit]]')
    expect(incomingLinks(store.all(), 'note:a', catalog(store.all(), []))).toEqual([store.get('note:b')])
    expect(store.get('note:b')?.revision).toBe(1)
  })
  it('preserves frontmatter literally while updating body links', () => {
    const source = '---\ntitle: "[[Bilinç]]"\n---\n\n[[Bilinç]]'
    expect(wikiLinks(source)).toHaveLength(1)
    expect(rewriteLinks(source, catalog([note('a', 'Bilinç')], []), catalog([note('a', 'Qualia')], []), new Set(['note:a']))).toBe('---\ntitle: "[[Bilinç]]"\n---\n\n[[Qualia]]')
  })
  it('keeps wiki aliases and deletion markers escaped inside Markdown table cells', () => {
    const before = catalog([note('a', 'Bilinç')], []), after = catalog([note('a', 'Qualia')], [])
    const source = '| Link |\n|---|\n| [[Bilinç\\|Öznel]] |\n| [[Bilinç]] |'
    expect(wikiLinks(source)).toHaveLength(2)
    expect(rewriteLinks(source, before, after, new Set(['note:a']))).toBe('| Link |\n|---|\n| [[Qualia\\|Öznel]] |\n| [[Qualia]] |')
    expect(rewriteLinks(source, before, before, new Set(['note:a']), true)).toBe('| Link |\n|---|\n| [[note:a\\|Öznel]] |\n| [[note:a\\|Bilinç]] |')
  })
  it('moves qualified links with folders and leaves deleted references bound to missing IDs instead of a new same-name note', () => {
    const store = new NoteStore([note('a', 'Bilinç', '', 'folder:a'), note('b', 'Kaynak', '[[Felsefe/Bilinç]]')]); store.setFolderProvider(() => folders)
    store.move('note:a', 'folder:b'); expect(store.get('note:b')?.markdown).toBe('[[AI/Bilinç]]')
    store.delete('note:a'); expect(store.get('note:b')?.markdown).toBe('[[note:a|AI/Bilinç]]')
    const replacement = store.create('Bilinç'); store.move(replacement.noteId, 'folder:b')
    expect(resolveLink(wikiLinks(store.get('note:b')!.markdown)[0].target, catalog(store.all(), folders)).status).toBe('missing')
  })
  it('uses an ID link for same-path duplicates and reserved characters', () => {
    const entries = catalog([note('a', 'Zihin'), note('b', 'Zihin'), note('c', 'A [B] | C')], [])
    expect(linkText('note:a', entries)).toBe('[[note:a|Zihin]]')
    expect(resolveLink(wikiLinks(linkText('note:c', entries))[0].target, entries).status).toBe('resolved')
  })
  it('keeps existing links bound when creation or rename introduces a duplicate title', () => {
    const store = new NoteStore([note('a', 'Zihin'), note('b', 'Kaynak', '[[Zihin]]')])
    const other = store.create('Başka'); store.rename(other.noteId, 'Zihin')
    expect(store.get('note:b')?.markdown).toBe('[[note:a|Zihin]]')
    const created = new NoteStore([note('a', 'Zihin'), note('b', 'Kaynak', '[[Zihin]]')])
    created.create('Zihin'); expect(created.get('note:b')?.markdown).toBe('[[note:a|Zihin]]')
  })
  it('recognizes block and inline math but ignores fenced and inline code', () => {
    expect(containsMath('$$\nE = mc^2\n$$')).toBe(true)
    expect(containsMath('Bir $x^2$ örneği')).toBe(true)
    expect(containsMath('`$x$`\n\n```tex\n$$\nx\n$$\n```')).toBe(false)
  })
})
