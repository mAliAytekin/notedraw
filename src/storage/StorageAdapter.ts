import type { PersistedEnvelope } from '../domain/Workspace'

export interface StorageState { committed: unknown | null; draft: unknown | null }
export interface StorageAdapter {
  load(): Promise<StorageState>
  save(value: PersistedEnvelope): Promise<number>
  checkpoint(value: PersistedEnvelope): Promise<void>
  discardDraft(): Promise<void>
  replace(value: PersistedEnvelope): Promise<void>
}
