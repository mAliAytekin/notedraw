import { t, useLocale, translateMessage } from '../i18n'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { App } from './App'
import { TauriAdapter } from '../storage/TauriAdapter'
import type { DiskSnapshot } from '../storage/fileWorkspace'
import type { Runtime } from './Runtime'
import { download } from './download'

// StrictMode must not issue two native folder/resume operations concurrently.
let resumed: Promise<DiskSnapshot | null> | undefined
export function DesktopApp() {
  useLocale()
  const [adapter, setAdapter] = useState<TauriAdapter>()
  const [runtime, setRuntime] = useState<Runtime>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [closingError, setClosingError] = useState<string>()
  const current = useRef({ runtime, adapter })
  current.current = { runtime, adapter }
  const accept = useCallback(async (snapshot: DiskSnapshot | null) => {
    if (!snapshot) return
    const adapter = new TauriAdapter(snapshot)
    await adapter.load()
    setAdapter(adapter)
  }, [])
  useEffect(() => {
    let cancelled = false
    resumed ??= invoke<DiskSnapshot | null>('workspace_resume')
    void resumed.then(snapshot => { if (!cancelled) return accept(snapshot) }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => { cancelled = true }
  }, [accept])
  useEffect(() => {
    let cancelled = false, closing = false, unlisten: (() => void) | undefined
    void getCurrentWindow().onCloseRequested(async event => {
      event.preventDefault()
      if (closing) return
      closing = true
      try {
        const { runtime, adapter } = current.current
        if (runtime?.writable && runtime.saver) await runtime.flush()
        await adapter?.close()
        await getCurrentWindow().destroy()
      } catch (error) { setClosingError(String(error)); closing = false }
    }).then(remove => { if (cancelled) remove(); else unlisten = remove }).catch(error => setError(String(error)))
    return () => { cancelled = true; unlisten?.() }
  }, [])
  const open = async (command: 'workspace_choose' | 'workspace_resume') => {
    setBusy(true); setError(undefined)
    try { await accept(await invoke<DiskSnapshot | null>(command)) }
    catch (error) { setError(String(error)) }
    finally { setBusy(false) }
  }
  const close = () => { runtime?.destroy(); setAdapter(undefined); setRuntime(undefined); resumed = undefined }
  return <>
    {adapter ? <App adapter={adapter} onWorkspaceClose={close} onRuntime={setRuntime} /> : <main className="load-screen"><section className="recovery-panel"><LanguageSwitcher />
      <h1>{t("Knowledge Canvas workspace")}</h1>
      <p>{t("Notlarınızın ve board’larınızın tutulacağı yerel klasörü seçin. Klasördeki Markdown dosyaları otomatik bulunur; yeni bir klasör boş board ile açılır.")}</p>
      {error && <p role="alert">{translateMessage(error)}</p>}
      <div className="recovery-actions"><button className="primary-button" disabled={busy} onClick={() => open('workspace_choose')}>{t("Workspace klasörü seç")}</button><button disabled={busy} onClick={() => open('workspace_resume')}>{t("Son workspace’i aç")}</button></div>
      <p>{t("Tarayıcıdaki verilerinizi taşımak için browser sürümünde workspace yedeği indirin, bu uygulamada “Yedek yükle” kullanın.")}</p>
    </section></main>}
    {closingError && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="close-error-title">
      <h2 id="close-error-title">{t("Kapatmadan önce kayıt tamamlanamadı")}</h2><p role="alert">{translateMessage(closingError)}</p><p>{t("Uygulama açık kaldı; içerik bellekte korunuyor. Dış değişiklik varsa “Yenile” ile çözebilirsiniz.")}</p>
      <div className="modal-actions"><button data-dialog-dismiss onClick={() => setClosingError(undefined)}>{t("Düzenlemeye dön")}</button><button onClick={() => { if (runtime?.saver) void download('knowledge-canvas-unsaved.json', JSON.stringify(runtime.captureWorkspace(runtime.saver.getStatus().revision), null, 2), 'application/json').catch(error => setClosingError(String(error))) }}>{t("Yerel yedeği indir")}</button><button onClick={async () => { try { if (runtime?.writable) await runtime.saver?.checkpoint() } catch { /* explicit close; backup remains available */ } await getCurrentWindow().destroy() }}>{t("Kaydetmeden kapat")}</button></div>
    </section></div>}
  </>
}
