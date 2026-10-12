import { MarkdownManager } from '@tiptap/markdown'
import { marked, type Token } from 'marked'
import { noteExtensions } from './extensions'
import { containsMath } from '../domain/knowledge'

const manager = new MarkdownManager({ extensions: noteExtensions() })
const allowed = new Set(['space', 'heading', 'paragraph', 'text', 'strong', 'em', 'codespan', 'code', 'list', 'list_item', 'blockquote', 'link', 'br', 'escape', 'hr', 'table'])

function semantic(tokens: Token[]): unknown[] {
  return tokens.filter(token => token.type !== 'space').map(token => {
    if (!allowed.has(token.type)) throw new Error(`Desteklenmeyen Markdown: ${token.type}`)
    const t = token as Token & { tokens?: Token[]; items?: Token[]; depth?: number; href?: string; title?: string; ordered?: boolean; start?: number; lang?: string; text?: string; checked?: boolean }
    if (t.checked !== undefined) throw new Error('Görev listeleri henüz rich-text modunda desteklenmiyor.')
    if (t.type === 'text' && /\[\[|\[\^[^\]]+\]|\$[^\n$]+\$/.test(t.text || '')) throw new Error('Wiki-link, dipnot veya matematik kaynak modunda korunur.')
    if (token.type === 'table') {
      const table = token as import('marked').Tokens.Table
      return { type: 'table', align: table.align, header: table.header.map(cell => semantic(cell.tokens)), rows: table.rows.map(row => row.map(cell => semantic(cell.tokens))) }
    }
    return {
      type: t.type === 'escape' ? 'text' : t.type,
      ...(t.depth !== undefined ? { depth: t.depth } : {}),
      ...(t.href !== undefined ? { href: t.href, title: t.title || '' } : {}),
      ...(t.ordered !== undefined ? { ordered: t.ordered, ...(t.ordered ? { start: t.start || 1 } : {}) } : {}),
      ...(t.type === 'code' ? { lang: t.lang || '' } : {}),
      ...(t.items ? { items: semantic(t.items) } : t.tokens ? { tokens: semantic(t.tokens) } : { text: t.text || '' }),
    }
  })
}

export function richTextSafety(markdown: string): { safe: boolean; reason?: string } {
  try {
    if (containsMath(markdown)) throw new Error('Matematik kaynak modunda düzenlenir; KaTeX önizlemede gösterilir.')
    if (/^\s*---\s*\n/.test(markdown)) throw new Error('Metadata kaynak modunda korunur.')
    const original = semantic(marked.lexer(markdown))
    const normalized = manager.serialize(manager.parse(markdown))
    if (JSON.stringify(original) !== JSON.stringify(semantic(marked.lexer(normalized)))) throw new Error('Bu içerik rich-text dönüşümünde güvenle korunamıyor.')
    return { safe: true }
  } catch (error) {
    return { safe: false, reason: error instanceof Error ? error.message : 'Bu sözdizimi kaynak modunda korunur.' }
  }
}
