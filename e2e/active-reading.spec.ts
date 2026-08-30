import { expect, test } from '@playwright/test'

const legacy = {
  books: [{ id: 'book-1', title: '旧版から来た本', author: '旧著者', category: '学習', status: 'reading', createdAt: '2026-08-20T01:00:00.000Z' }],
  chapterNotes: [{ id: 'chapter-1', bookId: 'book-1', chapterNumber: 1, chapterTitle: '想起練習', important: '見ずに思い出す', memory: '', application: '翌日に一文書く', createdAt: '2026-08-21T01:00:00.000Z' }],
  preReadingQuestions: [],
  readingCycles: [],
  actionItems: [],
  journalEntries: [],
}

test('旧版移行からメモ選択、7日間Markdown出力まで進める', async ({ page }) => {
  await page.addInitScript((data) => {
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value))
  }, legacy)
  await page.goto('')

  await expect(page.getByRole('heading', { name: '旧版の記録が見つかりました' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'バックアップして移行' }).click()
  await downloadPromise

  await expect(page.getByText('旧版から来た本').first()).toBeVisible()
  await page.getByRole('link', { name: '記録' }).first().click()
  await expect(page.getByText('本文を閉じ、見ずに')).toBeVisible()
  await page.getByLabel(/自分の言葉で説明/).fill('思い出す練習は、読み直すだけより理解の確認になる。')
  await page.getByLabel(/試すこと/).fill('明日の朝に一文で説明する')
  if (process.env.VISUAL_QA) {
    await page.screenshot({ path: 'test-artifacts/capture-mobile.png', fullPage: true })
  }
  await page.getByRole('button', { name: 'メモを保存' }).click()

  await page.getByRole('link', { name: 'ライブラリ' }).click()
  const notes = page.locator('.selectable-note input[type="checkbox"]')
  await expect(notes).toHaveCount(2)
  await notes.nth(0).check()
  await page.getByRole('button', { name: '行動計画を作る' }).click()

  await page.getByLabel(/今回の目的/).fill('学んだ想起法を仕事の読書で試す')
  await page.getByLabel(/1日に使える時間/).fill('12')
  await page.getByRole('button', { name: 'AI用Markdownを作る' }).click()

  const output = page.getByLabel('AI用Markdown')
  await expect(output).toContainText('実践期間：7日間')
  await expect(output).toContainText('Day 1〜Day 7')
  await expect(output).toContainText('メモにない事実や生活条件は推測しない')
})

test('オフラインでも起動し、資料とメモを保存できる', async ({ page, context, browserName }) => {
  await page.goto('')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  // Playwright WebKitはオフライン中のreload自体が内部エラーになるため、
  // cold reloadはChromiumで、オフライン保存は全ブラウザで検証する。
  if (browserName !== 'webkit') await page.reload()
  await expect(page.getByRole('heading', { name: /読み終えたら/ })).toBeVisible()
  await page.getByRole('link', { name: '最初の資料を登録' }).click()
  await page.getByLabel(/タイトル/).fill('オフライン資料')
  await page.getByRole('button', { name: '登録して記録へ' }).click()
  await page.getByLabel(/自分の言葉で説明/).fill('通信がなくても記録できる。')
  await page.getByRole('button', { name: 'メモを保存' }).click()
  await expect(page.getByRole('heading', { name: 'オフライン資料' })).toBeVisible()
  await expect(page.getByText('通信がなくても記録できる。')).toBeVisible()
  await context.setOffline(false)
})
