import { test, expect, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const accel = process.platform === 'darwin' ? 'Meta' : 'Control'
const card = (page: Page) => page.getByTestId('markdown-card').first()
async function ready(page: Page) { await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true); await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible() }
async function edit(page: Page, markdown: string) {
  const bounds = (await card(page).boundingBox())!
  await page.mouse.dblclick(bounds.x + 80, bounds.y + 75)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown kaynak', exact: true }).fill(markdown)
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await ready(page) })

test('search finds title/body across folders and boards, keyboard navigation returns to a shared note without copying it', async ({ page }) => {
  await page.evaluate(async () => {
    const runtime = window.__phase0!.runtime
    const original = runtime.activeBoard.boardId
    const note = runtime.createNote('İşlev araması', null); runtime.notes.updateMarkdown(note.noteId, 'Öznel deneyim ve bilinç Kıyaslama\n\n[[İşlevselcilik|Hedef]]')
    await runtime.createBoard('Diğer board', null); runtime.addCard(note.noteId); runtime.editor!.complete(); await runtime.flush()
    await runtime.switchBoard(original)
  })
  await page.keyboard.press(`${accel}+k`)
  await page.getByRole('searchbox', { name: 'Notlarda ara', exact: true }).fill('ISLEV BILINC KIYASLAMA')
  await expect(page.getByRole('dialog')).toContainText('1 not bulundu')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__phase0!.editor.getSelectedShapes().find(shape => shape.type === 'markdown-card')?.props.noteId)).toBe(await page.evaluate(() => window.__phase0!.notes.all().find(note => note.title === 'İşlev araması')!.noteId))
  expect(await page.evaluate(() => window.__phase0!.notes.all().filter(note => note.title === 'İşlev araması').length)).toBe(1)
  await page.keyboard.press(`${accel}+k`)
  await page.getByRole('searchbox').fill('KIYASLAMA')
  await page.getByRole('dialog').getByRole('button', { name: 'Hedef bağlantısını aç', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Not adı', exact: true })).toHaveValue('İşlevselcilik')
})

test('wiki-link preview opens the target, backlinks update through note/folder rename and deletion remains visibly broken', async ({ page }) => {
  await edit(page, '[[İşlevselcilik|Hedef not]]\n\n`[[İşlevselcilik]]`')
  await page.keyboard.press('Escape'); await ready(page)
  await page.getByRole('button', { name: 'Hedef not bağlantısını aç', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Not adı', exact: true })).toHaveValue('İşlevselcilik')
  await expect(page.locator('.card-backlinks')).toContainText('Bu nota bağlantılar (1)')
  await page.getByRole('textbox', { name: 'Not adı', exact: true }).fill('Yeni hedef')
  await page.keyboard.press('Escape'); await ready(page)
  expect(await page.evaluate(() => window.__phase0!.notes.all()[0].markdown)).toContain('[[Yeni hedef|Hedef not]]')
  expect(await page.evaluate(() => window.__phase0!.notes.all()[0].markdown)).toContain('`[[İşlevselcilik]]`')
  await page.getByRole('button', { name: 'Yeni hedef notunu sil', exact: true }).click()
  await page.getByRole('button', { name: 'Sil ve onayla', exact: true }).click(); await ready(page)
  await expect(page.getByRole('button', { name: 'Hedef not bağlantısını aç (not bulunamadı)', exact: true })).toBeDisabled()
  await page.reload(); await ready(page)
  await expect(page.getByRole('button', { name: 'Hedef not bağlantısını aç (not bulunamadı)', exact: true })).toBeDisabled()
})

test('tables preserve alignment/formatting on mode changes and edits, then persist after reopening', async ({ page }) => {
  const markdown = '| Kavram | Değer |\n|:---|---:|\n| **Bilinç** | `42` |'
  await edit(page, markdown)
  await page.getByRole('tab', { name: 'Biçimli', exact: true }).click()
  await expect(page.locator('.tiptap table')).toContainText('Bilinç')
  await expect(page.locator('.tiptap th').last()).toHaveCSS('text-align', 'right')
  await page.locator('.tiptap td').first().click(); await page.keyboard.type(' Türkçe')
  await page.getByRole('button', { name: 'Tabloya satır ekle', exact: true }).click()
  await expect(page.locator('.tiptap tr')).toHaveCount(3)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  const stored = await page.getByRole('textbox', { name: 'Markdown kaynak', exact: true }).inputValue()
  expect(stored).toContain('Türkçe'); expect(stored).toContain('---:')
  await page.keyboard.press('Escape'); await ready(page); await page.reload(); await ready(page)
  await expect(card(page).locator('table')).toContainText('Türkçe')
})

test('qualified links follow nested folder rename/move and folder deletion leaves broken links outside that folder', async ({ page }) => {
  await page.evaluate(async () => {
    const runtime = window.__phase0!.runtime
    runtime.createFolder('Felsefe', null)
    const parent = runtime.workspace.get().folders.find(folder => folder.name === 'Felsefe')!.folderId
    runtime.createFolder('Zihin', parent)
    const child = runtime.workspace.get().folders.find(folder => folder.name === 'Zihin')!.folderId
    const target = runtime.notes.all().find(note => note.title === 'İşlevselcilik')!
    runtime.editNote(target.noteId, target.title, child)
    runtime.notes.updateMarkdown('note:bilinc', '[[Felsefe/Zihin/İşlevselcilik|Hedef]]')
    runtime.editFolder(parent, 'Bilgi', null)
    if (runtime.notes.get('note:bilinc')!.markdown !== '[[Bilgi/Zihin/İşlevselcilik|Hedef]]') throw new Error('Klasör rename bağlantıyı güncellemedi.')
    runtime.editFolder(child, 'Zihin', null)
    if (runtime.notes.get('note:bilinc')!.markdown !== '[[Zihin/İşlevselcilik|Hedef]]') throw new Error('Klasör move bağlantıyı güncellemedi.')
    await runtime.deleteFolder(child); await runtime.flush()
  })
  await expect(page.getByRole('button', { name: 'Hedef bağlantısını aç (not bulunamadı)', exact: true })).toBeDisabled()
  await page.reload(); await ready(page)
  await expect(page.getByRole('button', { name: 'Hedef bağlantısını aç (not bulunamadı)', exact: true })).toBeDisabled()
})

test('KaTeX renders inline/block math with local fonts, keeps exact source and refuses unsafe math resource commands', async ({ page }) => {
  const math = '# Matematik\n\nEnerji $E=mc^2$.\n\n$$\n\\frac{a}{b} + x^2\n$$\n\n$\\includegraphics{https://invalid.example/secret.png}$'
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('invalid.example')) requests.push(request.url()) })
  await edit(page, math); await page.getByRole('tab', { name: 'Önizleme', exact: true }).click()
  await expect(page.locator('.card-editor-shell .katex')).toHaveCount(3)
  await expect(page.locator('.card-editor-shell .katex-display')).toHaveCount(1)
  expect(await page.evaluate(async () => {
    await document.fonts.load('italic 14px KaTeX_Math', 'E')
    return document.fonts.check('italic 14px KaTeX_Math', 'E')
  })).toBe(true)
  await page.getByRole('tab', { name: 'Biçimli', exact: true }).click()
  await expect(page.locator('.syntax-notice')).toContainText('Matematik kaynak modunda')
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown kaynak', exact: true })).toHaveValue(math)
  expect(requests).toEqual([])
})

test('dialogs trap keyboard focus, Escape cancels safely and editor mode tabs support arrow keys', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Notlarda ara', exact: true })
  await trigger.click(); await expect(page.getByRole('searchbox')).toBeFocused()
  const controls = page.getByRole('dialog').locator('button:enabled, input:enabled')
  await controls.last().focus(); await page.keyboard.press('Tab'); await expect(controls.first()).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused()
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: '+ Not', exact: true }).click()
  await page.getByRole('textbox', { name: 'Öğe adı', exact: true }).fill('İptal edilecek')
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.__phase0!.notes.all().some(note => note.title === 'İptal edilecek'))).toBe(false)
  await edit(page, '# Klavye')
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).focus(); await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Önizleme', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Önizleme', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('PNG and self-contained SVG include Markdown tables/math and ordinary shapes', async ({ page }, testInfo) => {
  await edit(page, '# Export Türkçe\n\n| Kavram | Değer |\n|---|---|\n| Bilinç | 42 |\n\n$E=mc^2$')
  await page.keyboard.press('Escape'); await ready(page)
  await page.evaluate(() => {
    const editor = window.__phase0!.editor, first = editor.getCurrentPageShapes().find(shape => shape.type === 'markdown-card')!
    editor.deleteShapes([...editor.getCurrentPageShapeIds()].filter(id => id !== first.id))
    editor.updateShapes([{ id: first.id, type: 'markdown-card', x: 0, y: 0, props: { w: 400, h: 400 } }])
    editor.createShapes([{ id: 'shape:export-geo' as any, type: 'geo', x: 450, y: 100, props: { w: 120, h: 100 } }])
  })
  const svgDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'SVG indir', exact: true }).click()
  const svgPath = (await (await svgDownload).path())!, svg = await readFile(svgPath, 'utf8')
  expect(svg).toContain('Export Türkçe'); expect(svg).toContain('<table'); expect(svg).toContain('katex'); expect(svg).toContain('data:font')
  expect(svg).not.toContain('Tuvaldeki notlara erişilemiyor')
  const pngDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir', exact: true }).click()
  const pngPath = (await (await pngDownload).path())!, png = await readFile(pngPath)
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  await testInfo.attach('board.svg', { body: svg, contentType: 'image/svg+xml' }); await testInfo.attach('board.png', { body: png, contentType: 'image/png' })
  // Real decoded pixels, including non-background ink in the note region.
  const image = await page.evaluate(async data => {
    const img = new Image(); img.src = data; await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0)
    // Export uses pixelRatio=2 and 24px padding. Inspect only the note body,
    // excluding its header/borders and the ordinary shape alongside it.
    const pixels = ctx.getImageData(88, 142, 720, 700).data; let dark = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0 && pixels[i] < 100 && pixels[i + 1] < 130) dark++
    return { width: img.width, height: img.height, dark }
  }, `data:image/png;base64,${png.toString('base64')}`)
  expect(image.dark).toBeGreaterThan(500)
  await writeFile(testInfo.outputPath('export-board.png'), png); await writeFile(testInfo.outputPath('export-board.svg'), svg)
})

test('100 note cards and 200 shapes keep one editor and update only the edited note cards', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const { runtime, editor } = window.__phase0!
    editor.complete(); editor.deleteShapes([...editor.getCurrentPageShapeIds()])
    const shapes = []
    for (let i = 0; i < 100; i++) {
      const note = runtime.notes.create(`Ölçüm ${i}`, `# Not ${i}\n\nPerformans ölçümü.`)
      shapes.push({ id: `shape:perf-card-${i}` as any, type: 'markdown-card' as const, x: (i % 10) * 380, y: Math.floor(i / 10) * 340, props: { noteId: note.noteId, w: 360, h: 320 } })
    }
    for (let i = 0; i < 200; i++) shapes.push({ id: `shape:perf-geo-${i}` as any, type: 'geo' as any, x: (i % 20) * 180, y: 3450 + Math.floor(i / 20) * 90, props: {} as any })
    editor.createShapes(shapes); editor.select('shape:perf-card-0' as any); editor.zoomToSelection(); editor.setEditingShape('shape:perf-card-0' as any); editor.setCurrentTool('select.editing_shape')
  })
  await expect(page.getByRole('textbox', { name: 'Markdown notunu düzenle', exact: true })).toBeVisible()
  await ready(page)
  await page.evaluate(() => window.__phase0!.resetMetrics())
  await page.getByRole('textbox', { name: 'Markdown notunu düzenle', exact: true }).click()
  await page.keyboard.press('End')
  for (let i = 0; i < 12; i++) await page.keyboard.type(' ölçüm', { delay: 15 })
  const result = await page.evaluate(() => {
    const { metrics, editor, notes } = window.__phase0!, samples = [...metrics.inputFrames].sort((a, b) => a - b)
    return { shapes: editor.getCurrentPageShapes().length, cards: editor.getCurrentPageShapes().filter(shape => shape.type === 'markdown-card').length, activeEditors: metrics.activeEditors, maxEditors: metrics.maxEditors,
      renderedNotes: Object.keys(metrics.cardRenders).map(id => notes.get(id)?.title), renderCount: Object.values(metrics.cardRenders).reduce((a, b) => a + b, 0), samples: samples.length,
      inputToFrameMedianMs: samples[Math.floor(samples.length / 2)], inputToFrameP95Ms: samples[Math.floor(samples.length * .95)] }
  })
  expect(result).toMatchObject({ shapes: 300, cards: 100, activeEditors: 1, maxEditors: 1, renderedNotes: ['Ölçüm 0'] })
  expect(result.samples).toBeGreaterThan(10)
  console.log('PHASE4_PERFORMANCE', JSON.stringify(result))
  await writeFile(testInfo.outputPath('performance.json'), JSON.stringify(result, null, 2))
})

test('native export fallback embeds card pixels and preserves SVG position/rotation for multiple cards', async ({ page }, testInfo) => {
  const data = await page.evaluate(async () => {
    const { editor, runtime } = window.__phase0!
    editor.complete(); editor.deleteShapes([...editor.getCurrentPageShapeIds()])
    const note = runtime.notes.create('Export', '# Türkçe\n\n| A | B |\n|---|---:|\n| Not | 42 |\n\n$E=mc^2$')
    editor.createShapes([
      { id: 'shape:export-a' as any, type: 'markdown-card', x: 0, y: 0, props: { noteId: note.noteId, w: 400, h: 300 } },
      { id: 'shape:export-b' as any, type: 'markdown-card', x: 460, y: 50, rotation: Math.PI / 8, props: { noteId: note.noteId, w: 400, h: 300 } },
      { id: 'shape:export-c' as any, type: 'geo', x: 0, y: 360, props: { w: 120, h: 100 } },
    ])
    const { exportBoard } = await import('../src/canvas/exportBoard')
    const svg = await (await exportBoard(editor, 'svg', true)).text()
    const png = await (await exportBoard(editor, 'png', true)).arrayBuffer()
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const images = [...doc.querySelectorAll('image')]
    return { svg, png: Array.from(new Uint8Array(png)), cards: images.length, html: doc.querySelectorAll('foreignObject').length, transforms: images.map(image => image.parentElement?.getAttribute('transform')) }
  })
  expect(data.cards).toBe(2); expect(data.html).toBe(0)
  expect(data.svg).toContain('data:image/png'); expect(data.transforms[0]).not.toBe(data.transforms[1])
  await writeFile(testInfo.outputPath('native-fallback.svg'), data.svg)
  await writeFile(testInfo.outputPath('native-fallback.png'), Buffer.from(data.png))
})
