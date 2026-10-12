import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { noteExtensions } from './extensions'

describe('Phase 0 Markdown content', () => {
  it('round-trips Turkish headings, paragraphs and lists semantically', () => {
    const first = new Editor({
      extensions: noteExtensions(), contentType: 'markdown',
      content: '# Bilinç Problemi\n\nÖznel deneyim: ışık, çığ, şüphe.\n\n- Qualia\n- İşlevselcilik\n\n## Açık sorular\n\n1. Neden?\n2. Nasıl?',
    })
    const second = new Editor({ extensions: noteExtensions(), contentType: 'markdown', content: first.getMarkdown() })
    expect(second.getJSON()).toEqual(first.getJSON())
    expect(second.getText()).toContain('ışık, çığ, şüphe')
    first.destroy()
    second.destroy()
  })
})
