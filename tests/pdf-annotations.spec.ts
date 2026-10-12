import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { pdfFixture } from './helpers/pdf'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true)
  await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible()
}
async function open(page: Page) {
  await page.goto('/'); await ready(page)
  await page.getByLabel('PDF dosyası seç').setInputFiles({ name: 'reading.pdf', mimeType: 'application/pdf', buffer: pdfFixture() })
  await expect(page.locator('.textLayer')).toContainText('Qualia and consciousness')
  await rendered(page)
}
async function rendered(page: Page) { await expect(page.locator('.pdf-annotations')).toBeAttached() }
async function select(page: Page, native = false) {
  const text = page.locator('.textLayer span').first()
  if (native) await text.dblclick({ position: { x: 15, y: 12 } })
  else await text.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).not.toBe('')
}
async function state(page: Page) { return page.evaluate(() => window.__phase0!.runtime.captureWorkspace(window.__phase0!.runtime.saver!.getStatus().revision)) }

test('clicking PDF marks removes only the chosen kind, persists deletion and preserves native text selection', async ({ page }) => {
  await open(page); await select(page)
  const before = await state(page)
  for (const label of ['Vurgula', 'Altını çiz', 'Üstünü çiz']) await button(page, label).click()
  await button(page, 'PDF yakınlaştır').click(); await rendered(page)
  const menu = page.getByRole('region', { name: 'PDF işaretlerini düzenle', exact: true })
  const text = page.locator('.textLayer span').first()
  await text.click({ position: { x: 25, y: 15 } })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Vurgulamayı kaldır', exact: true })).toBeVisible()
  await button(page, 'İşaret menüsünü kapat').click(); await expect(menu).toHaveCount(0)
  await text.dblclick({ position: { x: 25, y: 15 } })
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('Qualia')
  await expect(menu).toHaveCount(0)
  await page.evaluate(() => window.getSelection()!.removeAllRanges())
  await text.click({ position: { x: 25, y: 15 } }); await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Vurgulamayı kaldır', exact: true }).click()
  await expect(page.locator('[data-testid="pdf-annotation"][data-kind="highlight"]')).toHaveCount(0)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(2)
  await menu.getByRole('button', { name: 'Alt çizgiyi kaldır', exact: true }).click()
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(1)
  await button(page, 'Sonraki PDF sayfası').click(); await rendered(page); await expect(menu).toHaveCount(0)
  await button(page, 'Önceki PDF sayfası').click(); await rendered(page); await expect(menu).toHaveCount(0)
  await ready(page); await page.reload(); await ready(page); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Dil / Language' }).selectOption('en')
  await text.click({ position: { x: 25, y: 15 } })
  await expect(button(page, 'Remove strikethrough')).toBeVisible()
  await page.screenshot({ path: 'test-results/pdf-remove-mark.png' })
  await button(page, 'Remove strikethrough').click()
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Edit PDF marks', exact: true })).toHaveCount(0)
  await ready(page); await page.reload(); await ready(page); await rendered(page)
  const after = await state(page)
  expect(after.pdfs[0].annotations).toEqual([])
  expect(after.pdfs[0].data).toBe(before.pdfs[0].data)
  expect(after.notes).toEqual(before.notes)
})

test('native PDF selection marks survive zoom, page changes, reload and workspace backup; removal keeps original bytes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
  await expect(button(page, 'Vurgula')).toBeDisabled()
  const before = await state(page)
  await select(page, true)
  const accel = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.press(`${accel}+c`)
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Qualia')
  for (const label of ['Vurgula', 'Altını çiz', 'Üstünü çiz']) {
    await expect(button(page, label)).toBeEnabled(); await button(page, label).click()
  }
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(3)
  await button(page, 'Üstünü çiz').click() // duplicate operation is idempotent
  expect((await state(page)).pdfs[0].annotations).toHaveLength(3)
  const marks = (await state(page)).pdfs[0].annotations!
  const highlight = (await page.locator('.pdf-annotations rect').boundingBox())!
  expect((await state(page)).notes).toEqual(before.notes)
  await button(page, 'PDF yakınlaştır').click(); await rendered(page)
  await expect(button(page, 'Vurgula')).toBeDisabled()
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(3)
  const enlarged = (await page.locator('.pdf-annotations rect').boundingBox())!
  expect(enlarged.width).toBeCloseTo(highlight.width * 1.25, 1)
  expect(enlarged.height).toBeCloseTo(highlight.height * 1.25, 1)
  expect((await state(page)).pdfs[0].annotations).toEqual(marks)
  await button(page, 'Sonraki PDF sayfası').click(); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(0)
  await select(page); await button(page, 'Altını çiz').click()
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(1)
  await button(page, 'Önceki PDF sayfası').click(); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(3)
  await ready(page); await page.reload(); await ready(page); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(3)
  const download = page.waitForEvent('download'); await button(page, 'Workspace yedeği indir').click()
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'))
  expect(backup.pdfs[0].annotations).toHaveLength(4)
  expect(backup.pdfs[0].data).toBe(before.pdfs[0].data)
  await page.locator('.pdf-mark-list summary').click()
  await page.getByRole('button', { name: /İşaretlemeyi kaldır:/ }).first().click()
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(2)
  await page.getByLabel('Board yedeği seç').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await button(page, 'Yedeği yükle ve değiştir').click()
  await expect(page.getByRole('dialog')).toHaveCount(0); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Dil / Language' }).selectOption('en')
  await expect(button(page, 'Highlight')).toBeVisible()
  await expect(button(page, 'Underline')).toBeVisible()
  await expect(button(page, 'Strikethrough')).toBeVisible()
  await expect(button(page, 'Drag to canvas')).toBeVisible()
  expect((await state(page)).pdfs[0].data).toBe(before.pdfs[0].data)
  await page.screenshot({ path: 'test-results/pdf-annotations-marks.png' })
})

test('dragging PDF text creates one Markdown card at the canvas world position; click offers the same extraction', async ({ page }) => {
  await open(page)
  await page.evaluate(() => { window.__phase0!.editor.setCamera({ x: 110, y: -70, z: 1.25 }) })
  await select(page)
  await expect(button(page, 'Tuvale sürükle')).toBeEnabled()
  const before = await state(page), target = { x: 530, y: 450 }
  const point = await page.evaluate(target => window.__phase0!.editor.screenToPage(target), target)
  const background = page.locator('.tl-background'), bounds = (await background.boundingBox())!
  await button(page, 'Tuvale sürükle').dragTo(background, { targetPosition: { x: target.x - bounds.x, y: target.y - bounds.y } })
  await expect.poll(async () => (await state(page)).notes.length).toBe(before.notes.length + 1)
  const after = await state(page), excerpt = after.notes.find(note => !before.notes.some(old => old.noteId === note.noteId))!
  expect(excerpt.markdown).toBe('> Qualia and consciousness\n\nKaynak: reading\\.pdf · Sayfa 1')
  const shape = Object.values(after.boards.find(board => board.boardId === after.activeBoardId)!.document.store).find(record => record.typeName === 'shape' && record.type === 'markdown-card' && record.props.noteId === excerpt.noteId)!
  if (shape.typeName !== 'shape') throw new Error('Missing excerpt card')
  expect(shape.x).toBeCloseTo(point.x - 180, 0); expect(shape.y).toBeCloseTo(point.y - 160, 0)
  expect(after.pdfs).toEqual(before.pdfs)
  await page.keyboard.press('Escape'); await select(page); await button(page, 'Tuvale sürükle').click()
  expect((await state(page)).notes).toHaveLength(before.notes.length + 2)
  await ready(page); await page.reload(); await ready(page); await rendered(page)
  expect((await state(page)).notes).toHaveLength(before.notes.length + 2)
  await page.screenshot({ path: 'test-results/pdf-annotations.png' })
})

test('native text drag uses the PDF payload; invalid drops and read-only sessions cannot alter notes or marks', async ({ page, context }) => {
  await open(page); await select(page)
  const before = await state(page)
  const selectedBounds = (await page.locator('.textLayer span').first().boundingBox())!
  await page.mouse.move(selectedBounds.x + selectedBounds.width / 2, selectedBounds.y + selectedBounds.height / 2)
  await page.mouse.down()
  // Chrome distinguishes dragging a previous text selection from selecting text using a short hold.
  await page.waitForTimeout(250)
  await page.mouse.move(530, 450, { steps: 12 }); await page.mouse.up()
  await expect.poll(async () => (await state(page)).notes.length).toBe(before.notes.length + 1)
  await page.keyboard.press('Escape'); await select(page)
  const data = await page.evaluateHandle(() => new DataTransfer())
  await page.locator('.textLayer span').first().dispatchEvent('dragstart', { dataTransfer: data })
  expect(await data.evaluate(dt => dt.getData('application/x-knowledge-pdf-selection'))).toContain('Qualia and consciousness')
  const canvas = page.getByRole('region', { name: 'Bilgi tuvali' })
  await canvas.dispatchEvent('drop', { dataTransfer: data, clientX: 530, clientY: 450 })
  expect((await state(page)).notes).toHaveLength(before.notes.length + 2)
  await data.evaluate(dt => dt.setData('application/x-knowledge-pdf-selection', '{invalid'))
  await canvas.dispatchEvent('drop', { dataTransfer: data, clientX: 530, clientY: 450 })
  await expect(page.getByRole('alert')).toContainText('Geçerli bir PDF metni seçin.')
  expect((await state(page)).notes).toHaveLength(before.notes.length + 2)
  await data.dispose()
  await page.keyboard.press('Escape'); await select(page); await button(page, 'Altını çiz').click(); await ready(page)
  const other = await context.newPage(); await other.goto('/'); await ready(other); await rendered(other)
  await expect(other.locator('.readonly-banner')).toBeVisible()
  await select(other)
  for (const name of ['Vurgula', 'Altını çiz', 'Üstünü çiz', 'Tuvale sürükle']) await expect(button(other, name)).toBeDisabled()
  const readonly = await state(other)
  const external = await other.evaluateHandle(() => {
    const dt = new DataTransfer(), runtime = window.__phase0!.runtime
    dt.setData('application/x-knowledge-pdf-selection', JSON.stringify({ pdfId: runtime.reader.pdfId, page: 1, text: 'Read only', rects: [{ x: .1, y: .1, width: .2, height: .03 }] })); return dt
  })
  await other.getByRole('region', { name: 'Bilgi tuvali' }).dispatchEvent('drop', { dataTransfer: external, clientX: 530, clientY: 450 })
  expect((await state(other)).notes).toEqual(readonly.notes)
  expect((await state(other)).pdfs).toEqual(readonly.pdfs)
  await other.evaluate(() => window.getSelection()!.removeAllRanges())
  await other.locator('.textLayer span').first().click({ position: { x: 25, y: 12 } })
  await expect(other.getByRole('region', { name: 'PDF işaretlerini düzenle', exact: true })).toHaveCount(0)
  await other.locator('.pdf-mark-list summary').click()
  await expect(other.getByRole('button', { name: /İşaretlemeyi kaldır:/ })).toBeDisabled()
  await external.dispose(); await other.close()
})

test('multi-line selections keep separate marks and literal Markdown excerpts in the board folder; marks are shared by PDF', async ({ page }) => {
  await page.goto('/'); await ready(page)
  await button(page, '+ Klasör').click(); await page.getByLabel('Öğe adı', { exact: true }).fill('Araştırma'); await button(page, 'Kaydet').click()
  await page.getByRole('group', { name: 'Klasör: Araştırma', exact: true }).getByRole('button', { name: 'Araştırma', exact: true }).click()
  await button(page, '+ Board').click(); await page.getByLabel('Öğe adı', { exact: true }).fill('PDF araştırması'); await button(page, 'Kaydet').click()
  await page.getByLabel('PDF dosyası seç').setInputFiles({ name: 'literal.pdf', mimeType: 'application/pdf', buffer: pdfFixture(undefined, '[[target]] *literal*\n<script> $x$') })
  await rendered(page)
  await page.locator('.textLayer').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  await expect(button(page, 'Vurgula')).toBeEnabled(); await button(page, 'Vurgula').click()
  const marked = await state(page), annotation = marked.pdfs[0].annotations![0]
  expect(annotation.rects).toHaveLength(2)
  await button(page, 'Tuvale sürükle').click()
  const note = (await state(page)).notes.find(note => note.title.startsWith('PDF alıntısı'))!
  expect(note.folderId).toBe(marked.boards.find(board => board.boardId === marked.activeBoardId)!.folderId)
  expect(note.markdown).toContain('\\[\\[target\\]\\] \\*literal\\*')
  expect(note.markdown).toContain('\\<script\\> \\$x\\$')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('markdown-card').locator('.wiki-link')).toHaveCount(0)
  await expect(page.getByTestId('markdown-card').locator('.katex')).toHaveCount(0)
  await button(page, '+ Board').click(); await page.getByLabel('Öğe adı', { exact: true }).fill('Aynı PDF'); await button(page, 'Kaydet').click()
  await page.getByLabel('Workspace PDF seç', { exact: true }).selectOption(marked.pdfs[0].pdfId); await rendered(page)
  await expect(page.getByTestId('pdf-annotation')).toHaveCount(1)
  expect((await state(page)).pdfs[0].annotations![0]).toEqual(annotation)
})
