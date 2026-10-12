import { test, expect } from '@playwright/test'

const accel = process.platform === 'darwin' ? 'Meta' : 'Control'
test('switching language preserves the active editor, notes and canvas; preference survives reload', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true)
  await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible()
  const bounds = (await page.getByTestId('markdown-card').first().boundingBox())!
  await page.mouse.dblclick(bounds.x + 80, bounds.y + 75)
  const rich = page.getByRole('textbox', { name: 'Markdown notunu düzenle', exact: true })
  await rich.click(); await page.keyboard.press(`${accel}+End`)
  await page.keyboard.insertText(' Dil değişiminde korunur.')
  await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible()
  const before = await page.evaluate(() => {
    const state = window.__phase0!
    ;(window as typeof window & { languageEditor?: unknown; languageRich?: unknown }).languageEditor = state.editor
    ;(window as typeof window & { languageRich?: unknown }).languageRich = document.querySelector('.tiptap')
    return { notes: state.notes.all(), document: state.runtime.activeBoard.document, revision: state.runtime.saver!.getStatus().revision }
  })
  await page.getByRole('combobox', { name: 'Dil / Language' }).selectOption('en')
  await expect(page.getByRole('button', { name: '+ New Markdown Card', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Folder', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Rich text', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Edit Markdown note', exact: true })).toContainText('Dil değişiminde korunur.')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => {
    const state = window.__phase0!, remembered = window as typeof window & { languageEditor?: unknown; languageRich?: unknown }
    return remembered.languageEditor === state.editor && remembered.languageRich === document.querySelector('.tiptap')
  })).toBe(true)
  expect(await page.evaluate(() => window.__phase0!.editor.user.getLocale())).toBe('en')
  expect(await page.evaluate(() => ({ notes: window.__phase0!.notes.all(), document: window.__phase0!.runtime.activeBoard.document, revision: window.__phase0!.runtime.saver!.getStatus().revision }))).toEqual(before)
  await page.getByRole('button', { name: '+ Folder', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Item name' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Dil / Language' })).toHaveValue('en')
  await expect(page.getByTestId('markdown-card').first()).toContainText('Dil değişiminde korunur.')
  await page.getByRole('button', { name: 'Search notes', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('korunur')
  await expect(page.getByRole('dialog')).toContainText('1 note found')
  await expect(page.getByRole('button', { name: 'Show note on canvas' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', { name: 'Dil / Language' }).selectOption('tr')
  await expect(page.getByRole('button', { name: 'Notlarda ara', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
})

test('language propagates to a read-only tab and PDF menus without changing PDF data or reading position', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true)
  // The reader's PDF is deliberately missing: the error/restore UI also translates.
  await page.evaluate(() => {
    const state = window.__phase0!, runtime = state.runtime
    runtime.addPdf({ pdfId: 'pdf:language', name: 'Özgün PDF.pdf', pageCount: 2, data: 'data:application/pdf;base64,JVBERi0=', missing: true, createdAt: new Date().toISOString() }, runtime.activeBoard.boardId)
    runtime.updateReader({ page: 2, zoom: 1.25 })
  })
  await expect(page.getByLabel('PDF okuma paneli')).toBeVisible()
  await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible()
  const before = await page.evaluate(() => ({ pdfs: window.__phase0!.runtime.workspace.get().pdfs, reader: window.__phase0!.runtime.reader }))
  const other = await context.newPage(); await other.goto('/')
  await expect(other.locator('.readonly-banner')).toBeVisible()
  await page.getByRole('combobox', { name: 'Dil / Language' }).selectOption('en')
  await expect(other.getByRole('combobox', { name: 'Dil / Language' })).toHaveValue('en')
  await expect(other.locator('.readonly-banner')).toContainText('read-only')
  await expect(page.getByLabel('PDF reading panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move PDF panel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resize PDF panel from bottom right corner' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'PDF page', exact: true })).toHaveValue('2')
  await expect(page.getByLabel('PDF zoom', { exact: true })).toHaveText('125%')
  await expect(page.getByRole('button', { name: 'Restore PDF from last save' })).toBeVisible()
  await expect(page.getByLabel('Open PDF', { exact: true })).toContainText('Özgün PDF.pdf')
  expect(await page.evaluate(() => ({ pdfs: window.__phase0!.runtime.workspace.get().pdfs, reader: window.__phase0!.runtime.reader }))).toEqual(before)
  await other.close()
})
