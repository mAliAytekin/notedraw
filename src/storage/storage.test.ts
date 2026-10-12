import { describe, expect, it } from 'vitest'
import { IndexedDbAdapter } from './IndexedDbAdapter'
import { SaveCoordinator } from './SaveCoordinator'
import { validateEnvelope } from './validateEnvelope'
import { envelope } from '../tests/fixtures'

describe('IndexedDB and backup invariants', () => {
  it('cannot overwrite a newer committed revision and commits notes/document together', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    const newer = envelope(4), older = envelope(2)
    newer.notes[0].markdown = '# Yeni içerik'
    expect(await adapter.save(newer)).toBe(4)
    expect(await adapter.save(older)).toBe(4)
    const stored = await adapter.load()
    expect(stored.committed).toEqual(newer)
    await adapter.checkpoint(older)
    expect((await adapter.load()).draft).toBeNull()
  })
  it('retains a newer draft across older commits, then clears it only at commit', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    await adapter.save(envelope(1))
    await adapter.checkpoint(envelope(3))
    await adapter.save(envelope(2))
    expect((await adapter.load()).draft).toEqual(envelope(3))
    await adapter.save(envelope(3))
    expect((await adapter.load()).draft).toBeNull()
  })
  it('validates JSON round-trip, rejects newer schemas/malformed shapes, allows missing-note recovery', () => {
    const original = envelope()
    expect(validateEnvelope(JSON.parse(JSON.stringify(original)))).toEqual(original)
    expect(() => validateEnvelope({ ...original, schemaVersion: 99 })).toThrow('desteklenmiyor')
    const corrupt = structuredClone(original)
    const shape = Object.values(corrupt.board.document.store).find(record => record.typeName === 'shape')!
    if (shape.typeName === 'shape' && shape.type === 'markdown-card') shape.props.w = -1
    expect(() => validateEnvelope(corrupt)).toThrow()
    expect(validateEnvelope({ ...original, notes: [] }).notes).toEqual([])
  })
})

describe('serialized write coordinator', () => {
  it('waits for pending saves before loading an external generation', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const order: string[] = []
    adapter.save = async value => { order.push('save'); await held; return value.revision }
    const coordinator = new SaveCoordinator(adapter, envelope, 0)
    coordinator.changed()
    const pending = coordinator.flush()
    const reload = coordinator.reload(async () => { order.push('load'); return envelope(8) }, () => { order.push('apply') })
    await Promise.resolve()
    expect(order).toEqual(['save'])
    release(); await pending; await reload
    expect(order).toEqual(['save', 'load', 'apply'])
    expect(coordinator.getStatus()).toMatchObject({ state: 'saved', revision: 8, committedRevision: 8 })
    coordinator.dispose()
  })
  it('preserves local content and revision if clearing the old draft fails during reload', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    adapter.discardDraft = async () => { throw new Error('disk unavailable') }
    let applied = false
    const coordinator = new SaveCoordinator(adapter, envelope, 1)
    coordinator.changed()
    await expect(coordinator.reload(async () => envelope(9), () => { applied = true })).rejects.toThrow('disk unavailable')
    expect(applied).toBe(false)
    expect(coordinator.getStatus()).toMatchObject({ state: 'error', revision: 2, committedRevision: 1 })
    // The adapter may already have read a new disk token. A plain retry must not
    // write the retained local content over that generation without another choice.
    await expect(coordinator.flush()).rejects.toThrow('DISK_CONFLICT')
    adapter.discardDraft = async () => {}
    await coordinator.reload(async () => envelope(9), () => { applied = true })
    expect(applied).toBe(true)
    expect(coordinator.getStatus()).toMatchObject({ state: 'saved', revision: 9 })
    coordinator.dispose()
  })
  it('drains edits made during an asynchronous commit before reporting saved', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    const realSave = adapter.save.bind(adapter)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const calls: number[] = []
    adapter.save = async value => {
      calls.push(value.revision)
      if (calls.length === 1) await held
      return realSave(value)
    }
    const coordinator = new SaveCoordinator(adapter, envelope, 0)
    coordinator.changed()
    const flush = coordinator.flush()
    await Promise.resolve()
    expect(coordinator.getStatus().state).toBe('saving')
    coordinator.changed()
    release()
    await flush
    expect(calls).toEqual([1, 2])
    expect(coordinator.getStatus()).toEqual({ state: 'saved', revision: 2, committedRevision: 2 })
    expect((await adapter.load()).committed).toEqual(envelope(2))
    coordinator.dispose()
  })
  it('keeps dirty revision and recoverable draft after failure; retry commits it', async () => {
    const adapter = new IndexedDbAdapter(`test:${crypto.randomUUID()}`)
    const save = adapter.save.bind(adapter)
    adapter.save = async () => { throw new Error('QuotaExceededError') }
    const coordinator = new SaveCoordinator(adapter, envelope, 0)
    coordinator.changed()
    await coordinator.checkpoint()
    await expect(coordinator.flush()).rejects.toThrow('QuotaExceededError')
    expect(coordinator.getStatus()).toMatchObject({ state: 'error', revision: 1, committedRevision: 0 })
    expect((await adapter.load()).draft).toEqual(envelope(1))
    adapter.save = save
    await coordinator.flush()
    expect(coordinator.getStatus().state).toBe('saved')
    expect((await adapter.load()).draft).toBeNull()
    coordinator.dispose()
  })
})
