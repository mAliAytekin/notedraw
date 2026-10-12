import { invoke } from '@tauri-apps/api/core'
import type { PersistedEnvelope, WorkspaceEnvelope } from '../domain/Workspace'
import type { StorageAdapter, StorageState } from './StorageAdapter'
import { decodeWorkspace, encodeWorkspace, type DiskSnapshot, type FileManifest } from './fileWorkspace'
import { validateWorkspace } from './validateWorkspace'

export class TauriAdapter implements StorageAdapter {
  readonly path: string
  readonly writable: boolean
  warnings: string[] = []
  needsCommit = false
  private token: string
  private manifest?: FileManifest
  private loaded: Promise<StorageState>
  constructor(snapshot: DiskSnapshot, private call: typeof invoke = invoke) {
    this.path = snapshot.path; this.writable = snapshot.writable; this.token = snapshot.token
    this.loaded = this.decode(snapshot)
  }
  private async decode(snapshot: DiskSnapshot): Promise<StorageState> {
    const decoded = await decodeWorkspace(snapshot)
    this.manifest = decoded.manifest; this.needsCommit = decoded.needsCommit; this.warnings = decoded.warnings
    return { committed: decoded.state, draft: snapshot.draft }
  }
  load() { return this.loaded }
  async reload(): Promise<WorkspaceEnvelope> {
    const snapshot = await this.call<DiskSnapshot>('workspace_read')
    // Update the baseline only after a complete, validated read succeeds.
    const decoded = await decodeWorkspace(snapshot)
    this.token = snapshot.token; this.manifest = decoded.manifest; this.needsCommit = decoded.needsCommit; this.warnings = decoded.warnings
    this.loaded = Promise.resolve({ committed: decoded.state, draft: snapshot.draft })
    return decoded.state
  }
  private async commit(input: PersistedEnvelope) {
    const state = validateWorkspace(input)
    const encoded = await encodeWorkspace(state, this.manifest)
    const snapshot = await this.call<DiskSnapshot>('workspace_commit', { plan: { files: encoded.files, directories: encoded.directories, backup: state, expected_token: this.token } })
    this.token = snapshot.token
    this.loaded = this.decode(snapshot)
    const stored = await this.loaded
    return (stored.committed as WorkspaceEnvelope).revision
  }
  save(value: PersistedEnvelope) { return this.commit(value) }
  async replace(value: PersistedEnvelope) { await this.commit(value) }
  checkpoint(value: PersistedEnvelope) { return this.call<void>('workspace_checkpoint', { value }) }
  discardDraft() { return this.call<void>('workspace_discard_draft') }
  close() { return this.call<void>('workspace_close') }
}
