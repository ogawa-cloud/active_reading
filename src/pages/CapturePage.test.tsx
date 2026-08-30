import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { draftKey } from '../draft'
import { CapturePage } from './CapturePage'

const source = {
  id: 'source-test',
  kind: 'book' as const,
  title: 'テスト資料',
  tags: [],
  status: 'active' as const,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
}

beforeEach(async () => {
  await db.open()
  await Promise.all([db.sources.clear(), db.notes.clear(), db.actionCandidates.clear()])
  await db.sources.put(source)
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

afterEach(async () => {
  await Promise.all([db.sources.clear(), db.notes.clear(), db.actionCandidates.clear()])
})

function renderCapture() {
  return render(
    <MemoryRouter initialEntries={['/capture/source-test']}>
      <Routes>
        <Route path="/capture/:sourceId" element={<CapturePage />} />
        <Route path="/sources/:sourceId" element={<p>保存完了</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('読後入力画面', () => {
  it('最初から広い入力欄を表示し、本文だけで保存できる', async () => {
    const user = userEvent.setup()
    renderCapture()
    const textarea = await screen.findByLabelText(/自分の言葉で説明/)
    await waitFor(() => expect(Number.parseFloat(textarea.style.height)).toBeGreaterThanOrEqual(360))

    await user.type(textarea, '本文を見ずに、自分の言葉で説明した。')
    await user.click(screen.getByRole('button', { name: 'メモを保存' }))

    expect(await screen.findByText('保存完了')).toBeInTheDocument()
    const notes = await db.notes.toArray()
    expect(notes).toHaveLength(1)
    expect(notes[0].content).toContain('自分の言葉')
    expect(await db.actionCandidates.count()).toBe(0)
  })

  it('入力中の下書きを端末へ保存し、再表示時に復元する', async () => {
    const user = userEvent.setup()
    const first = renderCapture()
    const textarea = await screen.findByLabelText(/自分の言葉で説明/)
    await user.type(textarea, '再起動しても残る下書き')

    await waitFor(() => expect(localStorage.getItem(draftKey(source.id))).toContain('再起動しても残る下書き'))
    first.unmount()
    renderCapture()

    expect(await screen.findByDisplayValue('再起動しても残る下書き')).toBeInTheDocument()
    expect(screen.getByText('端末に残っていた下書きを復元しました。')).toBeInTheDocument()
  })
})
