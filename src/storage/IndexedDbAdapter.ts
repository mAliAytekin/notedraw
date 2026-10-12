import type { PersistedEnvelope } from '../domain/Workspace'
import type { StorageAdapter, StorageState } from './StorageAdapter'

export const databaseName = 'knowledge-canvas'
const storeName = 'workspace'
const revisionOf = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('revision' in value) || !Number.isSafeInteger(value.revision)) {
    throw new Error('Kayıt sürümü okunamıyor; mevcut veri korunuyor.')
  }
  return value.revision as number
}

export class IndexedDbAdapter implements StorageAdapter {
  private database: Promise<IDBDatabase>
  constructor(name = databaseName) {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(storeName)
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB açılamadı.'))
      request.onblocked = () => reject(new Error('Veritabanı başka bir sekme tarafından engelleniyor.'))
    })
  }

  async load(): Promise<StorageState> {
    const db = await this.database
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const committed = store.get('committed'), draft = store.get('draft')
      tx.oncomplete = () => resolve({ committed: committed.result ?? null, draft: draft.result ?? null })
      tx.onabort = () => reject(tx.error ?? new Error('Kayıt okunamadı.'))
      tx.onerror = () => { /* onabort is authoritative */ }
    })
  }

  private async write(action: (store: IDBObjectStore, fail: (error: Error) => void) => void) {
    const db = await this.database
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      let failure: Error | undefined
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Kayıt tamamlanamadı.'))
      tx.onerror = () => { /* transaction abort rejects */ }
      try { action(tx.objectStore(storeName), error => { failure = error; tx.abort() }) }
      catch (error) { failure = error as Error; tx.abort() }
    })
  }

  async save(value: PersistedEnvelope) {
    let committedRevision = value.revision
    await this.write((store, fail) => {
      const request = store.get('committed')
      request.onsuccess = () => {
        try {
          const previous = request.result
          if (previous && revisionOf(previous) >= value.revision) {
            committedRevision = revisionOf(previous)
            return
          }
          store.put(value, 'committed')
          const draft = store.get('draft')
          draft.onsuccess = () => {
            try { if (draft.result && revisionOf(draft.result) <= value.revision) store.delete('draft') }
            catch (error) { fail(error as Error) }
          }
        } catch (error) { fail(error as Error) }
      }
    })
    return committedRevision
  }

  async checkpoint(value: PersistedEnvelope) {
    await this.write((store, fail) => {
      const committed = store.get('committed'), draft = store.get('draft')
      draft.onsuccess = () => {
        try {
          const savedRevision = committed.result ? revisionOf(committed.result) : -1
          const draftRevision = draft.result ? revisionOf(draft.result) : -1
          if (value.revision > Math.max(savedRevision, draftRevision)) store.put(value, 'draft')
        } catch (error) { fail(error as Error) }
      }
    })
  }

  discardDraft() { return this.write(store => { store.delete('draft') }) }
  replace(value: PersistedEnvelope) {
    return this.write(store => { store.put(value, 'committed'); store.delete('draft') })
  }
}
