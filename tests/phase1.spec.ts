import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const accel = process.platform === 'darwin' ? 'Meta' : 'Control'
const card = (page: Page) => page.getByTestId('markdown-card').first()
const source = (page: Page) => page.getByRole('textbox', { name: 'Markdown kaynak', exact: true })
const rich = (page: Page) => page.getByRole('textbox', { name: 'Markdown notunu düzenle' })
const saved = (page: Page) => page.locator('.save-indicator[data-state="saved"]')

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true)
  await expect(saved(page)).toBeVisible()
}
async function openCard(page: Page) {
  const box = (await card(page).boundingBox())!
  await page.mouse.dblclick(box.x + 90, box.y + 75)
  await expect(page.getByRole('tab', { name: 'Kaynak', exact: true })).toBeVisible()
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const runtime = window.__phase0!.runtime
    return runtime.capture(runtime.saver!.getStatus().revision)
  })
}
async function uploadBackup(page: Page, data: unknown) {
  await page.getByLabel('Board yedeği seç').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
}
async function downloadBackup(page: Page) {
  const promise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Board yedeği indir', exact: true }).click()
  const download = await promise
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

test.beforeEach(async ({ page }) => { await page.goto('/'); await ready(page) })

test('autosave restores Markdown, independent name, card geometry and bound arrows after reload', async ({ page }) => {
  await openCard(page)
  await page.getByRole('textbox', { name: 'Not adı', exact: true }).fill('Qualia araştırması')
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  const text = '# Bilinç ve öznel deneyim\n\nTürkçe: ışık, çığ, şüphe.\n\n```ts\nconst qualia = "renk"\n```'
  await source(page).fill(text)
  await page.keyboard.press('Escape')
  const box = (await card(page).boundingBox())!
  await page.mouse.move(box.x + 80, box.y + 20)
  await page.mouse.down(); await page.mouse.move(box.x + 145, box.y + 50, { steps: 10 }); await page.mouse.up()
  const moved = (await card(page).boundingBox())!
  await page.mouse.move(moved.x + moved.width, moved.y + moved.height)
  await page.mouse.down(); await page.mouse.move(moved.x + moved.width + 40, moved.y + moved.height + 30, { steps: 10 }); await page.mouse.up()
  const before = await snapshot(page)
  await expect.poll(async () => (await page.evaluate(() => window.__phase0!.runtime.adapter.load())).committed).toMatchObject({ notes: before.notes })
  await expect(saved(page)).toBeVisible()
  await page.reload(); await ready(page)
  const after = await snapshot(page)
  expect(after.notes).toEqual(before.notes)
  expect(after.board.boardId).toBe(before.board.boardId)
  expect(after.board.document.store).toEqual(before.board.document.store)
  expect(after.notes.find(note => note.noteId === 'note:bilinc')?.markdown).toBe(text)
  expect(after.notes.find(note => note.noteId === 'note:bilinc')?.title).toBe('Qualia araştırması')
})

test('unsupported Markdown remains exact source, unsafe HTML/links do not execute, source undo stays local', async ({ page }) => {
  await openCard(page)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  const text = '# Deneyim\n\n<!-- korunacak yorum -->\n\n[[İşlevselcilik]]\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>window.__unsafe = true</script>\n\n[tehlikeli](javascript:alert(1))'
  await source(page).fill(text)
  await page.getByRole('tab', { name: 'Biçimli', exact: true }).click()
  await expect(source(page)).toHaveValue(text)
  await expect(page.locator('.syntax-notice')).toContainText('Kaynak metin korunuyor')
  await page.getByRole('tab', { name: 'Önizleme', exact: true }).click()
  expect(await page.evaluate(() => '__unsafe' in window)).toBe(false)
  expect(await page.locator('.card-editor-shell a').getAttribute('href')).not.toContain('javascript:')
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await expect(source(page)).toHaveValue(text)
  await source(page).focus()
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.type('Kaynak modu metin undo', { delay: 5 })
  await page.keyboard.press(`${accel}+z`)
  await expect(source(page)).not.toHaveValue('Kaynak modu metin undo')
  await expect(card(page)).toHaveCount(1)
  // Restore the fixture, then confirm that reopening also chooses safe source mode.
  await source(page).fill(text)
  await page.keyboard.press('Escape')
  await expect(saved(page)).toBeVisible()
  await page.reload(); await ready(page)
  await openCard(page)
  await expect(source(page)).toHaveValue(text)
  await expect(rich(page)).toHaveCount(0)
})

test('a deleted card note is retained, backed up, and can be restored from the note list', async ({ page }) => {
  const box = (await card(page).boundingBox())!
  await page.mouse.click(box.x + 80, box.y + 70)
  await page.keyboard.press('Delete')
  await expect(card(page)).toHaveCount(0)
  const backup = await downloadBackup(page)
  expect(backup.notes.some((note: { noteId: string }) => note.noteId === 'note:bilinc')).toBe(true)
  await page.getByRole('button', { name: /^Notlar \(/ }).click()
  await expect(page.getByLabel('Saklanan notlar')).toContainText('Bilinç Problemi')
  await page.getByRole('button', { name: 'Bilinç Problemi notunu tuvale ekle', exact: true }).click()
  await expect(card(page)).toHaveCount(1)
  await expect(rich(page)).toContainText('Öznel deneyim')
  const note = (await snapshot(page)).notes.find(note => note.noteId === 'note:bilinc')!
  const promise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Notu Markdown indir', exact: true }).click()
  const file = await promise
  expect(file.suggestedFilename()).toBe('Bilinç Problemi.md')
  expect(await readFile((await file.path())!, 'utf8')).toBe(note.markdown)
})

test('image bytes and all notes survive backup replacement and reload', async ({ page }) => {
  const fileChooser = page.waitForEvent('filechooser')
  await page.getByTestId('tools.asset').click()
  await (await fileChooser).setFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=', 'base64') })
  await expect.poll(async () => (await snapshot(page)).board.document.store).toMatchObject({})
  await expect.poll(() => page.evaluate(() => window.__phase0!.editor.getCurrentPageShapes().filter(shape => shape.type === 'image').length)).toBe(1)
  const backup = await downloadBackup(page)
  const asset = Object.values(backup.board.document.store).find((record: any) => record.typeName === 'asset') as any
  expect(asset.props.src).toMatch(/^data:image\/png;base64,/)
  await page.mouse.click(1040, 570)
  await page.keyboard.press(`${accel}+a`); await page.keyboard.press('Delete')
  await expect(card(page)).toHaveCount(0)
  await uploadBackup(page, backup)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Yedeği yükle ve değiştir', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(card(page)).toHaveCount(1)
  const restored = await snapshot(page)
  expect(restored.notes).toEqual(backup.notes)
  expect(restored.board.document.store).toEqual(backup.board.document.store)
  await page.reload(); await ready(page)
  expect((await snapshot(page)).board.document.store).toEqual(backup.board.document.store)
})

test('malformed/newer backups and cancel leave current notes and scene intact', async ({ page }) => {
  const original = await snapshot(page)
  await uploadBackup(page, { bad: true })
  await expect(page.getByRole('alert')).toContainText('geçersiz')
  expect((await snapshot(page)).notes).toEqual(original.notes)
  expect((await snapshot(page)).board.document).toEqual(original.board.document)
  await uploadBackup(page, { ...original, schemaVersion: 99 })
  await expect(page.getByRole('alert')).toContainText('desteklenmiyor')
  await uploadBackup(page, original)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click()
  expect((await snapshot(page)).notes).toEqual(original.notes)
  expect((await snapshot(page)).board.document).toEqual(original.board.document)
})

test('failed commit retains dirty content and durable draft; retry commits it', async ({ page }) => {
  await page.evaluate(() => { window.__phase0!.runtime.adapter.save = async () => { throw new Error('Test kayıt hatası') } })
  await openCard(page)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await source(page).fill('# Hata sonrası korunacak not')
  await expect(page.locator('.save-indicator')).toHaveAttribute('data-state', 'error')
  const state = await page.evaluate(async () => ({ status: window.__phase0!.runtime.saver!.getStatus(), storage: await window.__phase0!.runtime.adapter.load() }))
  expect(state.status.revision).toBeGreaterThan(state.status.committedRevision)
  expect(state.storage.draft).toMatchObject({ notes: expect.arrayContaining([expect.objectContaining({ markdown: '# Hata sonrası korunacak not' })]) })
  const recoveryBackup = await downloadBackup(page)
  expect(recoveryBackup.notes.some((note: { markdown: string }) => note.markdown === '# Hata sonrası korunacak not')).toBe(true)
  await expect(page.locator('.save-indicator')).toHaveAttribute('data-state', 'error')
  await page.evaluate(() => { const adapter = window.__phase0!.runtime.adapter; adapter.save = Object.getPrototypeOf(adapter).save.bind(adapter) })
  await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(saved(page)).toBeVisible()
  await page.reload(); await ready(page)
  await expect(card(page)).toContainText('Hata sonrası korunacak not')
})

test('reload offers the newer durable draft and restores it explicitly', async ({ page }) => {
  await page.evaluate(() => { window.__phase0!.runtime.adapter.save = async () => { throw new Error('Test commit kesintisi') } })
  await openCard(page)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await source(page).fill('# Kurtarılabilir taslak')
  await expect(page.locator('.save-indicator')).toHaveAttribute('data-state', 'error')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Daha yeni bir taslak bulundu', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Taslağı kurtar', exact: true }).click()
  await ready(page)
  await expect(card(page)).toContainText('Kurtarılabilir taslak')
  await page.reload(); await ready(page)
  await expect(card(page)).toContainText('Kurtarılabilir taslak')
})

test('second tab is readonly, cannot delete or edit; gains ownership after writer closes', async ({ page, context }) => {
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.locator('.readonly-banner')).toBeVisible()
  await expect(second.getByRole('button', { name: '+ Yeni Markdown Kartı', exact: true })).toBeDisabled()
  const box = (await card(second).boundingBox())!
  await second.mouse.dblclick(box.x + 90, box.y + 75)
  await expect(rich(second)).toHaveCount(0)
  await second.keyboard.press('Delete')
  await expect(card(second)).toHaveCount(1)
  await page.close()
  await second.reload(); await ready(second)
  await expect(second.locator('.readonly-banner')).toHaveCount(0)
  await second.getByRole('button', { name: '+ Yeni Markdown Kartı', exact: true }).click()
  await expect(second.getByTestId('markdown-card')).toHaveCount(2)
})

test('missing notes display a recoverable placeholder; an empty saved board is never reseeded', async ({ page }) => {
  const backup = await snapshot(page)
  backup.notes = []
  await uploadBackup(page, backup)
  await page.getByRole('button', { name: 'Yedeği yükle ve değiştir', exact: true }).click()
  await expect(card(page)).toContainText('Not bulunamadı')
  await page.reload(); await ready(page)
  await expect(card(page)).toContainText('Not bulunamadı')
  await page.mouse.click(1040, 570)
  await page.keyboard.press(`${accel}+a`); await page.keyboard.press('Delete')
  await expect(card(page)).toHaveCount(0)
  await downloadBackup(page)
  await page.reload(); await ready(page)
  await expect(card(page)).toHaveCount(0)
  expect((await snapshot(page)).notes).toEqual([])
  await page.getByRole('button', { name: '+ Yeni Markdown Kartı', exact: true }).click()
  await expect(card(page)).toHaveCount(1)
  const centered = await page.evaluate(() => {
    const editor = window.__phase0!.editor
    const center = editor.getViewportPageBounds().center
    const shape = editor.getCurrentPageShapes().find(shape => shape.type === 'markdown-card')!
    return { x: shape.x + (shape.props as { w: number }).w / 2, y: shape.y + (shape.props as { h: number }).h / 2, center: { x: center.x, y: center.y } }
  })
  expect(centered.x).toBeCloseTo(centered.center.x)
  expect(centered.y).toBeCloseTo(centered.center.y)
})

test('a newer stored schema is not overwritten and raw recovery export stays available', async ({ page }) => {
  const corrupt = { ...await snapshot(page), schemaVersion: 99, revision: 99 }
  await page.evaluate(serialized => new Promise<void>((resolve, reject) => {
    const value = JSON.parse(serialized)
    const open = indexedDB.open('knowledge-canvas', 1)
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('workspace', 'readwrite')
      tx.objectStore('workspace').put(value, 'committed')
      tx.objectStore('workspace').delete('draft')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
  }), JSON.stringify(corrupt))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kayıt güvenle açılamadı', exact: true })).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ham kaydı indir', exact: true }).click()
  const file = await download
  expect(JSON.parse(await readFile((await file.path())!, 'utf8')).committed).toEqual(corrupt)
})

test('supported source opens rich-text without initialization overwrite; theme survives reload', async ({ page }) => {
  await openCard(page)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  const text = '# Türkçe not\n\n**Kalın** ve *italik*.\n\n1. Önce\n2. Sonra\n\n> Öznel deneyim\n\n```ts\nconst bilinç = "öznel"\n```\n\n[Kaynak](https://example.com)'
  await source(page).fill(text)
  const revision = (await snapshot(page)).notes.find(note => note.noteId === 'note:bilinc')!.revision
  await page.getByRole('tab', { name: 'Biçimli', exact: true }).click()
  await expect(rich(page).locator('h1')).toHaveText('Türkçe not')
  await expect(rich(page).locator('pre')).toContainText('const bilinç = "öznel"')
  await expect(rich(page).locator('ol li')).toHaveCount(2)
  const note = (await snapshot(page)).notes.find(note => note.noteId === 'note:bilinc')!
  expect(note.markdown).toBe(text)
  expect(note.revision).toBe(revision)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Temayı değiştir', exact: true }).click()
  await expect(page.locator('.workspace')).toHaveAttribute('data-theme', 'dark')
  await downloadBackup(page)
  await page.reload(); await ready(page)
  await expect(page.locator('.workspace')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: 'test-results/phase1-dark.png' })
})
