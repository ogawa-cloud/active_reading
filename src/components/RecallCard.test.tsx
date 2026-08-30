import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import type { Note, Source } from '../types'
import { RecallCard } from './RecallCard'

const timestamp = '2026-08-24T00:00:00.000Z'
const source: Source = {
  id: 'recall-source',
  kind: 'article',
  title: '想起対象の記事',
  tags: [],
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp,
}
const note: Note = {
  id: 'recall-note',
  sourceId: source.id,
  content: '回答前には隠す元メモ',
  reviewDueDate: '2026-08-25',
  reviewState: 'pending',
  createdAt: timestamp,
  updatedAt: timestamp,
}

beforeEach(async () => {
  await db.open()
  await Promise.all([db.notes.clear(), db.recalls.clear()])
  await db.notes.put(note)
})

afterEach(async () => {
  await Promise.all([db.notes.clear(), db.recalls.clear()])
})

describe('翌日想起カード', () => {
  it('回答前は元メモを隠し、回答後の自己評価を保存する', async () => {
    const user = userEvent.setup()
    render(<RecallCard note={note} source={source} />)

    expect(screen.queryByText('回答前には隠す元メモ')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('思い出したこと'), '自分の一文')
    await user.click(screen.getByRole('button', { name: '元メモと比べる' }))
    expect(screen.getByText('回答前には隠す元メモ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '一部' }))

    await waitFor(async () => expect(await db.recalls.count()).toBe(1))
    expect((await db.recalls.toArray())[0]).toMatchObject({ response: '自分の一文', rating: 'partial' })
    expect((await db.notes.get(note.id))?.reviewState).toBe('done')
  })
})
