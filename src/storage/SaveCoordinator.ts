import type { BoardEnvelope } from '../domain/Board'
import type { PersistedEnvelope } from '../domain/Workspace'
import type { StorageAdapter } from './StorageAdapter'

export interface SaveStatus { state: 'saved' | 'dirty' | 'saving' | 'error'; revision: number; committedRevision: number; error?: string }

/** One write queue for drafts, commits, flushes and replacements. */
export class SaveCoordinator<T extends PersistedEnvelope = BoardEnvelope> {
  private tail: Promise<unknown> = Promise.resolve()
  private saveTimer?: ReturnType<typeof setTimeout>
  private draftTimer?: ReturnType<typeof setTimeout>
  private listeners = new Set<() => void>()
  private status: SaveStatus
  private revision: number
  private disposed = false
  private reloadNeedsResolution = false

  constructor(private adapter: StorageAdapter, private capture: (revision: number) => T, revision: number) {
    this.revision = revision
    this.status = { state: 'saved', revision, committedRevision: revision }
  }
  getStatus = () => this.status
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(status: SaveStatus) { this.status = status; for (const listener of this.listeners) listener() }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation)
    this.tail = result.catch(() => {})
    return result
  }

  changed() {
    if (this.disposed) return
    this.revision++
    this.update({ ...this.status, state: this.status.state === 'error' ? 'error' : 'dirty', revision: this.revision })
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => { void this.flush().catch(() => {}) }, 600)
    // Throttle rather than debounce: continuous typing still produces drafts.
    if (!this.draftTimer) this.draftTimer = setTimeout(() => {
      this.draftTimer = undefined
      void this.checkpoint().catch(() => {})
    }, 80)
  }

  async checkpoint() {
    try {
      const snapshot = this.capture(this.revision)
      await this.enqueue(() => this.adapter.checkpoint(snapshot))
    } catch (error) { this.fail(error); throw error }
  }

  private fail(error: unknown) {
    this.update({ ...this.status, state: 'error', revision: this.revision, error: error instanceof Error ? error.message : String(error) })
  }

  async flush() {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    clearTimeout(this.draftTimer)
    this.draftTimer = undefined
    return this.enqueue(async () => {
      if (this.reloadNeedsResolution) {
        const error = new Error('DISK_CONFLICT: Yenile işlemi tamamlanmadı; sürüm seçimini yeniden yapın. Yerel içerik korunuyor.')
        this.fail(error); throw error
      }
      // Capture inside the queue so pending changes cannot be overwritten by an older job.
      while (this.status.committedRevision < this.revision) {
        this.update({ ...this.status, state: 'saving', error: undefined })
        try {
          const snapshot = this.capture(this.revision)
          const committedRevision = await this.adapter.save(snapshot)
          if (committedRevision !== snapshot.revision) throw new Error('Kayıt sürümü çakıştı; içerik bellekte korunuyor.')
          this.update({ state: committedRevision === this.revision ? 'saved' : 'dirty', revision: this.revision, committedRevision })
        } catch (error) { this.fail(error); throw error }
      }
    })
  }

  async replace(snapshot: T, apply: (value: T) => void) {
    await this.flush()
    await this.enqueue(async () => {
      const revision = this.revision + 1
      const replacement = { ...snapshot, revision }
      try {
        await this.adapter.replace(replacement)
        apply(replacement)
        this.revision = revision
        this.update({ state: 'saved', revision, committedRevision: revision })
      } catch (error) { this.fail(error); throw error }
    })
  }

  /** External reload/conflict resolution shares the same queue as pending commits. */
  async reload(load: () => Promise<T>, apply: (value: T) => void, keepLocal = false) {
    clearTimeout(this.saveTimer); clearTimeout(this.draftTimer)
    this.saveTimer = undefined; this.draftTimer = undefined
    return this.enqueue(async () => {
      try {
        const remote = await load()
        const revision = Math.max(this.revision, remote.revision) + 1
        if (keepLocal) {
          const snapshot = this.capture(revision)
          const committed = await this.adapter.save(snapshot)
          if (committed !== revision) throw new Error('Kayıt sürümü yeniden çakıştı; içerik korunuyor.')
        } else {
          await this.adapter.discardDraft()
          apply(remote)
        }
        this.revision = keepLocal ? revision : Math.max(this.revision, remote.revision)
        this.reloadNeedsResolution = false
        this.update({ state: 'saved', revision: this.revision, committedRevision: this.revision })
      } catch (error) { this.reloadNeedsResolution = true; this.fail(error); throw error }
    })
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.saveTimer)
    clearTimeout(this.draftTimer)
    this.listeners.clear()
  }
}
