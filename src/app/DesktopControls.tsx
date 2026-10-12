import { t, useLocale, translateMessage } from '../i18n'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Runtime } from './Runtime'
import { TauriAdapter } from '../storage/TauriAdapter'
import { download } from './download'

export function DesktopControls({ runtime, onClose }: { runtime: Runtime; onClose?: () => void }) {
  useLocale()
  const adapter = runtime.adapter as TauriAdapter
  useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.get)
  const status = useSyncExternalStore(runtime.saver!.subscribe, runtime.saver!.getStatus)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [conflict, setConflict] = useState(false)
  useEffect(() => { if (status.error?.includes('DISK_CONFLICT')) setConflict(true) }, [status.error])
  const attempt = async (action: () => Promise<void>) => {
    setBusy(true); setError(undefined)
    try { await action() } catch (error) { setError(String(error)) }
    finally { setBusy(false) }
  }
  return <>
    <div className="desktop-bar">
      <span title={adapter.path}><strong>Workspace</strong> {adapter.path}</span>
      <button disabled={busy} onClick={() => {
        if (runtime.writable && runtime.hasUnsavedChanges) { runtime.editor?.complete(); setConflict(true) }
        else void attempt(() => runtime.reloadDesktop())
      }}>{t("Yenile")}</button>
      <button disabled={busy} onClick={() => attempt(async () => { if (runtime.writable) await runtime.flush(); await adapter.close(); onClose?.() })}>{t("Workspace değiştir")}</button>
    </div>
    {(adapter.warnings.length > 0 || error) && <div className="desktop-warnings" role="status">{translateMessage(error) || adapter.warnings.map(warning => translateMessage(warning)).join(' · ')}</div>}
    {conflict && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="disk-conflict-title">
      <h2 id="disk-conflict-title">{t("Hangi sürüm korunsun?")}</h2>
      <p>{t("Yerel değişiklikler veya diskte farklı bir sürüm var. Otomatik birleştirme yapılmaz. Disk sürümünü yüklemek kaydedilmemiş yerel değişiklikleri kaldırır. Yerel sürümü korumak disk sürümünü değiştirir; değişen dosyaların önceki kopyaları workspace içindeki kurtarma klasöründe saklanır.")}</p>
      <div className="modal-actions">
        <button data-dialog-dismiss disabled={busy} onClick={() => setConflict(false)}>{t("Vazgeç")}</button>
        <button disabled={busy} onClick={() => attempt(() => download('knowledge-canvas-local-version.json', JSON.stringify(runtime.captureWorkspace(status.revision), null, 2), 'application/json'))}>{t("Yerel yedeği indir")}</button>
        <button disabled={busy} onClick={() => attempt(async () => { await runtime.reloadDesktop(false); setConflict(false) })}>{t("Disk sürümünü yükle")}</button>
        <button className="primary-button" disabled={busy} onClick={() => attempt(async () => { await runtime.reloadDesktop(true); setConflict(false) })}>{t("Yerel sürümü koru")}</button>
      </div>{error && <p role="alert">{translateMessage(error)}</p>}
    </section></div>}
  </>
}
