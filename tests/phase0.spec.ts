import { test, expect, type Page } from '@playwright/test'

const cardId = 'shape:bilinc'
const card = (page: Page) => page.getByTestId('markdown-card').first()
const textbox = (page: Page) => page.getByRole('textbox', { name: 'Markdown notunu düzenle' })
const accel = process.platform === 'darwin' ? 'Meta' : 'Control'

async function openCard(page: Page) {
  const box = (await card(page).boundingBox())!
  // In preview mode pointer events intentionally go to the canvas hit-testing surface.
  await page.mouse.dblclick(box.x + 90, box.y + 75)
}

async function state(page: Page) {
  return page.evaluate(() => {
    const { editor, notes } = window.__phase0!
    const arrowBounds = editor.getShapePageBounds('shape:baglanti' as never)!
    return {
      card: editor.getShape('shape:bilinc' as never),
      shapes: editor.getCurrentPageShapes().map(({ id, type }) => ({ id, type })),
      selected: editor.getSelectedShapeIds(),
      editing: editor.getEditingShapeId(),
      note: notes.get('note:bilinc'),
      camera: editor.getCamera(),
      bindings: editor.getBindingsFromShape('shape:baglanti' as never, 'arrow'),
      arrowBounds: { x: arrowBounds.x, y: arrowBounds.y, w: arrowBounds.w, h: arrowBounds.h },
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(card(page)).toBeVisible()
  await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true)
})

test('inline editing owns selection, deletion, undo and Turkish content', async ({ page }) => {
  const before = await state(page)
  expect(before.bindings).toHaveLength(2)
  await page.screenshot({ path: 'test-results/phase0-preview.png' })
  await openCard(page)
  await expect(textbox(page)).toBeFocused()
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.type('a d r b harfleri editorde', { delay: 10 })
  await expect(textbox(page)).toHaveText('a d r b harfleri editorde')
  expect((await state(page)).shapes).toEqual(before.shapes)
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText('Türkçe: bilinç, ışık, çığ, şüphe.')
  await expect(textbox(page)).toHaveText('Türkçe: bilinç, ışık, çığ, şüphe.')
  await page.keyboard.press('Backspace')
  await expect(textbox(page)).toHaveText('Türkçe: bilinç, ışık, çığ, şüphe')
  await page.keyboard.press('ArrowLeft')
  // Wait for ProseMirror to observe the browser's asynchronous selectionchange.
  await expect.poll(() => textbox(page).evaluate(el =>
    (el as HTMLElement & { editor: import('@tiptap/core').Editor }).editor.state.selection.$head.parentOffset,
  )).toBe('Türkçe: bilinç, ışık, çığ, şüphe'.length - 1)
  await page.keyboard.press('Delete')
  await expect(textbox(page)).toHaveText('Türkçe: bilinç, ışık, çığ, şüph')
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.press('Delete')
  await expect(textbox(page)).toHaveText('')
  await page.keyboard.press(`${accel}+z`)
  await expect(textbox(page)).not.toHaveText('')
  expect((await state(page)).shapes).toEqual(before.shapes)
  expect((await state(page)).card).toEqual(before.card)

  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText('Korunan Türkçe not')
  await page.keyboard.press('Escape')
  await expect(textbox(page)).toHaveCount(0)
  await expect(card(page)).toContainText('Korunan Türkçe not')
  // A second double-click must be a new gesture, not tldraw's triple/quad click.
  await page.waitForTimeout(500)
  await openCard(page)
  await expect(textbox(page)).toHaveText('Korunan Türkçe not')
  await page.mouse.click(1050, 600)
  await expect(textbox(page)).toHaveCount(0)
  expect((await state(page)).note?.markdown).toContain('Korunan Türkçe not')
})

test('text drag selects text without moving the shape; headings and lists stay Markdown', async ({ page }) => {
  await openCard(page)
  const before = (await state(page)).card
  const heading = textbox(page).locator('h1')
  await page.screenshot({ path: 'test-results/phase0-editing.png' })
  const box = (await heading.boundingBox())!
  await page.mouse.move(box.x + 3, box.y + 14)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + 14, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().length ?? 0)).toBeGreaterThan(3)
  expect((await state(page)).card).toEqual(before)
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText('Türkçe başlık')
  await page.getByRole('button', { name: 'Başlık', exact: true }).click()
  await expect(textbox(page).locator('h2')).toHaveText('Türkçe başlık')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Madde listesi', exact: true }).click()
  await page.keyboard.insertText('Öznel deneyim')
  await expect(textbox(page).locator('li')).toContainText('Öznel deneyim')
  await page.keyboard.press('Escape')
  expect((await state(page)).note?.markdown).toMatch(/## Türkçe başlık/)
  expect((await state(page)).note?.markdown).toMatch(/- Öznel deneyim/)
})

test('move, resize, canvas undo, zoom and pan preserve arrow bindings', async ({ page }) => {
  const initialArrow = (await state(page)).arrowBounds
  const original = (await state(page)).card!
  const box = (await card(page).boundingBox())!
  await page.mouse.move(box.x + 100, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 170, box.y + 65, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await state(page)).card!.x).toBeCloseTo(original.x + 70)
  const moved = (await state(page)).card!
  expect((await state(page)).arrowBounds.x).toBeGreaterThan(initialArrow.x + 60)
  const movedArrow = (await state(page)).arrowBounds
  const resizedBox = (await card(page).boundingBox())!
  await page.mouse.move(resizedBox.x + resizedBox.width, resizedBox.y + resizedBox.height)
  await page.mouse.down()
  await page.mouse.move(resizedBox.x + resizedBox.width + 70, resizedBox.y + resizedBox.height + 40, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => ((await state(page)).card!.props as { w: number }).w).toBeCloseTo(430)
  expect((await state(page)).bindings.map(b => b.toId).sort()).toEqual([cardId, 'shape:islevselcilik'])
  expect((await state(page)).arrowBounds.x).toBeGreaterThan(movedArrow.x + 60)
  await page.keyboard.press(`${accel}+z`)
  await expect.poll(async () => (await state(page)).card!.props).toEqual(moved.props)
  await page.keyboard.press(`${accel}+z`)
  await expect.poll(async () => (await state(page)).card!.x).toBe(original.x)
  const camera = (await state(page)).camera
  await page.mouse.move(1000, 580)
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await state(page)).camera.y).not.toBe(camera.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -150)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await state(page)).camera.z).not.toBe(camera.z)
  expect((await state(page)).card).toEqual(original)
  expect((await state(page)).bindings).toHaveLength(2)
})

test('card deletion keeps its note, duplication shares content and only one editor mounts', async ({ page }) => {
  const box = (await card(page).boundingBox())!
  await page.mouse.click(box.x + 90, box.y + 75)
  await page.keyboard.press(`${accel}+d`)
  await expect(page.getByTestId('markdown-card')).toHaveCount(2)
  // Move the duplicate away using the SDK; the actual edit still uses DOM input.
  await page.evaluate(() => {
    const editor = window.__phase0!.editor
    const duplicate = editor.getCurrentPageShapes().find(s => s.type === 'markdown-card' && s.id !== 'shape:bilinc')!
    editor.updateShape({ id: duplicate.id, type: duplicate.type, x: 600, y: 400 })
  })
  await openCard(page)
  await expect(page.locator('.tiptap')).toHaveCount(1)
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText('Paylaşılan not')
  await expect(page.locator('.card-preview')).toContainText('Paylaşılan not')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('markdown-card')).toHaveCount(1)
  expect((await state(page)).note?.markdown).toContain('Paylaşılan not')
})

test('wheel scrolls the active card without moving camera', async ({ page }) => {
  await openCard(page)
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText(Array.from({ length: 45 }, (_, i) => `Satır ${i} — Türkçe deneyim`).join('\n'))
  const camera = (await state(page)).camera
  const scroller = page.locator('.card-scroll')
  await scroller.evaluate(el => { el.scrollTop = 0 })
  await scroller.hover()
  await page.mouse.wheel(0, 170)
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  expect((await state(page)).camera).toEqual(camera)
})

test('composition input and clipboard shortcuts stay in the editor', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openCard(page)
  const before = (await state(page)).card
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.insertText('Kopyalanan bilinç')
  await page.keyboard.press(`${accel}+a`)
  await page.keyboard.press(`${accel}+c`)
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Kopyalanan bilinç')
  await page.keyboard.press(`${accel}+x`)
  await expect(textbox(page)).toHaveText('')
  await page.keyboard.press(`${accel}+v`)
  await expect(textbox(page)).toHaveText('Kopyalanan bilinç')
  // Browser composition events + CDP IME insertion; not a physical OS IME test.
  await page.keyboard.press(`${accel}+a`)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: '日本語', selectionStart: 3, selectionEnd: 3 })
  await textbox(page).dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true })
  await expect(textbox(page)).toHaveCount(1)
  await cdp.send('Input.insertText', { text: '日本語' })
  await expect(textbox(page)).toContainText('日本語')
  expect((await state(page)).card).toEqual(before)
  await page.keyboard.press('Escape')
  await expect(textbox(page)).toHaveCount(0)
})

test('built-in rectangle, freehand and arrow tools remain usable', async ({ page }) => {
  await page.mouse.click(1100, 600)
  await page.keyboard.press('r')
  await page.mouse.move(700, 520)
  await page.mouse.down()
  await page.mouse.move(850, 620, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await page.keyboard.press('d')
  await page.mouse.move(920, 450)
  await page.mouse.down()
  await page.mouse.move(950, 480, { steps: 5 })
  await page.mouse.move(990, 460, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await page.keyboard.press('a')
  const box = (await card(page).boundingBox())!
  await page.mouse.move(box.x + box.width - 10, box.y + 120)
  await page.mouse.down()
  await page.mouse.move(800, 590, { steps: 12 })
  await page.mouse.up()
  const shapes = (await state(page)).shapes
  expect(shapes.filter(s => s.type === 'geo')).toHaveLength(2)
  expect(shapes.filter(s => s.type === 'draw')).toHaveLength(1)
  expect(shapes.filter(s => s.type === 'arrow')).toHaveLength(2)
  expect(await page.evaluate(() => window.__phase0!.editor.getBindingsToShape('shape:bilinc' as never, 'arrow').length)).toBe(2)
})
