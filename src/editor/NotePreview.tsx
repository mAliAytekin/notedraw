import { t, useLocale, translateMessage } from '../i18n'
import { memo, useContext, useState, useSyncExternalStore } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { RuntimeContext } from '../app/RuntimeContext'
import { remarkWiki, resolveLink, type KnowledgeNote } from '../domain/knowledge'

const noSubscribe = () => () => {}
const empty: KnowledgeNote[] = []
const emptyCatalog = () => empty
const remarkPlugins = [remarkGfm, remarkMath, remarkWiki]
const rehypePlugins = [[rehypeKatex, { trust: false, strict: 'warn', maxSize: 20, maxExpand: 1000, throwOnError: false }]] as Parameters<typeof ReactMarkdown>[0]['rehypePlugins']

export const NotePreview = memo(function NotePreview({ markdown, exporting = false, onNavigate }: { markdown: string; exporting?: boolean; onNavigate?: (noteId: string) => void }) {
  useLocale()
  const runtime = useContext(RuntimeContext)
  const entries = useSyncExternalStore(runtime?.subscribeKnowledge ?? noSubscribe, runtime?.getLinkCatalog ?? emptyCatalog, runtime?.getLinkCatalog ?? emptyCatalog)
  const [error, setError] = useState<string>()
  return <>
    <ReactMarkdown skipHtml remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={{
      a: ({ children, href, node }) => {
        const target = node?.properties['data-wiki-target']
        if (typeof target !== 'string') return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
        const resolved = resolveLink(target, entries), status = resolved.status
        const title = status === 'resolved' ? resolved.note.path : status === 'ambiguous' ? t("Aynı adlı birden çok not var; klasör yolunu kullanın.") : t("Bağlantının notu bulunamadı.")
        if (exporting) return <span className={`wiki-link ${status}`} title={title}>{children}{status !== 'resolved' && ' (?)'}</span>
        return <button className={`wiki-link ${status}`} title={title} aria-label={t("{name} bağlantısını aç{status}", { name: String(children), status: status !== "resolved" ? ` (${status === "missing" ? t("not bulunamadı") : t("belirsiz")})` : "" })}
          disabled={status !== 'resolved'} onPointerDown={event => { runtime?.editor?.markEventAsHandled(event); event.stopPropagation() }}
          onClick={event => {
            event.preventDefault(); event.stopPropagation()
            if (resolved.status === 'resolved' && onNavigate) onNavigate(resolved.note.noteId)
            else if (resolved.status === 'resolved' && runtime) void runtime.revealNote(resolved.note.noteId).catch(error => setError(String(error)))
          }}>{children}{status !== 'resolved' && <span aria-hidden="true"> (?)</span>}</button>
      },
      img: ({ alt }) => <span className="inline-image-placeholder">{t("[Görsel: {alt}]", { alt: alt || t("kaynak modunda URL") })}</span>,
    }}>{markdown}</ReactMarkdown>
    {error && <p role="alert">{translateMessage(error)}</p>}
  </>
})
