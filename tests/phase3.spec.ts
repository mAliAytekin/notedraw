import { test, expect, type Page } from '@playwright/test'

interface NativeFile { path: string; encoding: string; data: string }
async function desktop(page: Page, writable = true, choose = false) {
  let token = 0, commits = 0, draft: any = null, opened = !choose
  let files: NativeFile[] = [{ path: 'Felsefe/Native.md', encoding: 'utf8', data: '# Dış not\n\nTürkçe içerik' }]
  const snapshot = () => ({ path: '/fixture/Knowledge', writable, token: String(token), files, draft, last_good: null, warnings: [] })
  await page.exposeFunction('nativeTestCommand', async (command: string, args: any) => {
    if (command === 'workspace_resume') return opened ? snapshot() : null
    if (command === 'workspace_choose') { opened = true; return snapshot() }
    if (command === 'workspace_read') return snapshot()
    if (command === 'workspace_checkpoint') { if (writable) draft = args.value; return }
    if (command === 'workspace_discard_draft') { draft = null; return }
    if (command === 'workspace_commit') {
      if (!writable) throw new Error('Salt okunur')
      if (args.plan.expected_token !== String(token)) throw new Error('DISK_CONFLICT: Disk sürümü farklı; içerik korunuyor.')
      files = args.plan.files; draft = null; token++; commits++
      return snapshot()
    }
    if (command === 'workspace_close') { opened = false; return }
    throw new Error(`Beklenmeyen IPC: ${command}`)
  })
  await page.addInitScript(() => {
    let callback = 0
    ;(window as any).isTauri = true
    ;(window as any).__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => ++callback, unregisterCallback: () => {},
      invoke: (cmd: string, args: unknown) => cmd.startsWith('plugin:event|') ? Promise.resolve(++callback) : (window as any).nativeTestCommand(cmd, args),
    }
    ;(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  })
  await page.goto('/')
  return {
    ready: async () => { await expect.poll(() => page.evaluate(() => !!window.__phase0)).toBe(true); await expect(page.locator('.save-indicator[data-state="saved"]')).toBeVisible() },
    editDisk: (content: string) => { files = files.map(file => file.path === 'Felsefe/Native.md' ? { ...file, data: content } : file); token++ },
    markdown: () => files.find(file => file.path === 'Felsefe/Native.md')!.data,
    commits: () => commits,
  }
}
async function edit(page: Page, markdown: string) {
  const card = page.getByTestId('markdown-card').first(), box = (await card.boundingBox())!
  await page.mouse.dblclick(box.x + 90, box.y + 75)
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown kaynak', exact: true }).fill(markdown)
}

test('desktop folder selection discovers Markdown, writes the source file and reopens the same note/card', async ({ page }) => {
  const disk = await desktop(page, true, true)
  await page.getByRole('button', { name: 'Workspace klasörü seç', exact: true }).click(); await disk.ready()
  await expect(page.getByRole('group', { name: 'Not: Native', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Native notunu karta ekle', exact: true }).click()
  await page.getByRole('tab', { name: 'Kaynak', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown kaynak', exact: true }).fill('# Kalıcı masaüstü notu 👋')
  await page.keyboard.press('Escape'); await disk.ready()
  expect(disk.markdown()).toBe('# Kalıcı masaüstü notu 👋')
  const noteId = await page.evaluate(() => window.__phase0!.notes.all()[0].noteId)
  await page.reload(); await disk.ready()
  await expect(page.getByTestId('markdown-card')).toContainText('Kalıcı masaüstü notu 👋')
  expect(await page.evaluate(() => window.__phase0!.notes.all()[0].noteId)).toBe(noteId)
})

test('manual disk reload and both explicit conflict choices preserve the selected version', async ({ page }) => {
  const disk = await desktop(page); await disk.ready()
  await page.getByRole('button', { name: 'Native notunu karta ekle', exact: true }).click(); await page.keyboard.press('Escape'); await disk.ready()
  disk.editDisk('# Temiz disk değişikliği')
  await page.getByRole('button', { name: 'Yenile', exact: true }).click(); await disk.ready()
  await expect(page.getByTestId('markdown-card')).toContainText('Temiz disk değişikliği')
  await edit(page, '# Yerelde bekleyen değişiklik')
  disk.editDisk('# Seçilecek disk sürümü')
  await page.getByRole('button', { name: 'Yenile', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Hangi sürüm korunsun?')
  await page.getByRole('button', { name: 'Disk sürümünü yükle', exact: true }).click(); await disk.ready()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('markdown-card')).toContainText('Seçilecek disk sürümü')
  expect(disk.markdown()).toBe('# Seçilecek disk sürümü')
  await edit(page, '# Korunacak yerel sürüm')
  disk.editDisk('# Yerine geçen dış sürüm')
  await expect(page.getByRole('dialog')).toContainText('Hangi sürüm korunsun?')
  expect(disk.markdown()).toBe('# Yerine geçen dış sürüm')
  await page.getByRole('button', { name: 'Yerel sürümü koru', exact: true }).click(); await disk.ready()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(disk.markdown()).toBe('# Korunacak yerel sürüm')
  await expect(page.getByTestId('markdown-card')).toContainText('Korunacak yerel sürüm')
})

test('a second native reader stays readonly and refreshes external Markdown without writing', async ({ page }) => {
  const disk = await desktop(page, false); await disk.ready()
  await expect(page.locator('.readonly-banner')).toContainText('başka uygulamada')
  await expect(page.getByRole('button', { name: '+ Yeni Markdown Kartı', exact: true })).toBeDisabled()
  disk.editDisk('# Dışarıdan yenilendi')
  await page.getByRole('button', { name: 'Yenile', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__phase0!.notes.all()[0].markdown)).toBe('# Dışarıdan yenilendi')
  expect(disk.commits()).toBe(0)
})
