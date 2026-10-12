import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from './extensions'
import { richTextSafety } from './markdownSafety'

const supported = [
  '# Bilinç\n\nÖznel deneyim nasıl oluşur?',
  '## Unicode\n\nTürkçe ışık çığ şüphe; 日本語 🎮. **Kalın** ve *italik*.',
  '- Qualia\n- Zihin\n  - Beden',
  '1. Önce\n2. Sonra',
  '[Kaynak](https://example.com "Başlık")',
  '> Alıntı\n> İkinci satır',
  '```ts\nconst bilinç = "öznel"\nconsole.log(bilinç)\n```',
  'Bir `inline code` ve normal paragraf.',
  '```sh\necho "$HOME"\n# [[literal]]\n```',
  '| A | B |\n|---|---|\n| x | y |',
  '| A | B |\n|:---|---:|\n| **Türkçe** | `kod` |',
]

describe('loss-aware Markdown guard', () => {
  it.each(supported)('allows supported semantics and preserves them through Tiptap: %s', source => {
    expect(richTextSafety(source)).toEqual({ safe: true })
    const first = new Editor({ extensions: noteExtensions(), content: source, contentType: 'markdown' })
    const second = new Editor({ extensions: noteExtensions(), content: first.getMarkdown(), contentType: 'markdown' })
    expect(second.getJSON()).toEqual(first.getJSON())
    first.destroy(); second.destroy()
  })
  it.each([
    '- [x] Görev', '<!-- önemli yorum -->\n\nNot', '<script>alert(1)</script>',
    '[[Bilinç]]', 'Dipnot[^1]\n\n[^1]: Kaynak', '$E=mc^2$', '![Görsel](https://example.com/image.png)',
    '---\ntitle: Başlık\n---\n\nNot',
  ])('keeps unsupported source out of rich-text: %s', source => {
    expect(richTextSafety(source).safe).toBe(false)
  })
})
