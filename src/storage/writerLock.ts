export async function acquireWriterLock(): Promise<{ writable: boolean; release: () => void }> {
  if (!navigator.locks) throw new Error('Bu tarayıcı güvenli tek sekme kilidini desteklemiyor. Güncel Chrome/Firefox/Safari kullanın.')
  return new Promise((resolve, reject) => {
    void navigator.locks.request('knowledge-canvas-writer', { ifAvailable: true }, async lock => {
      if (!lock) { resolve({ writable: false, release: () => {} }); return }
      let release!: () => void
      const held = new Promise<void>(done => { release = done })
      resolve({ writable: true, release })
      await held
    }).catch(reject)
  })
}
