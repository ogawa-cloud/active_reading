import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SourceDetailPage } from './SourceDetailPage'

const source = {
  id: 'source-detail-test',
  kind: 'book' as const,
  title: '章ごとに記録する本',
  tags: [],
  status: 'active' as const,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
}

beforeEach(async () => {
  await db.open()
  await Promise.all([db.sources.clear(), db.notes.clear(), db.actionCandidates.clear()])
  await db.sources.put(source)
})

afterEach(async () => {
  await Promise.all([db.sources.clear(), db.notes.clear(), db.actionCandidates.clear()])
})

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/sources/${source.id}`]}>
      <Routes>
        <Route path="/sources/:sourceId" element={<SourceDetailPage />} />
        <Route path="/capture/:sourceId" element={<p>新しいメモの入力画面</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('資料詳細画面', () => {
  it('まだメモがない資料は通常の記録ボタンを表示する', async () => {
    renderDetail()

    expect(await screen.findByRole('link', { name: 'この資料を記録する' })).toBeInTheDocument()
  })

  it('既存メモがある資料は次の章を追加できる', async () => {
    await db.notes.bulkPut([
      {
        id: 'note-1',
        sourceId: source.id,
        locator: '第1章',
        content: '最初の章のメモ',
        reviewState: 'pending',
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      },
      {
        id: 'note-2',
        sourceId: source.id,
        locator: '第2章',
        content: '次の章のメモ',
        reviewState: 'pending',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z',
      },
    ])
    const user = userEvent.setup()
    renderDetail()

    const addNext = await screen.findByRole('link', { name: '＋ 次の章を記録' })
    expect(screen.getByText('2件')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '第1章' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '第2章' })).toBeInTheDocument()

    await user.click(addNext)
    expect(await screen.findByText('新しいメモの入力画面')).toBeInTheDocument()
  })
})
