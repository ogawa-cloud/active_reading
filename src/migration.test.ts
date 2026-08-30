import { afterEach, describe, expect, it } from 'vitest'
import { ActiveReadingDatabase } from './db'
import { migrateLegacyData } from './migration'
import type { LegacyData } from './types'

const legacy: LegacyData = {
  books: [{ id: 'b1', title: '旧い本', author: '著者', category: '心理', status: 'completed', createdAt: '2026-08-01T01:00:00Z' }],
  chapterNotes: [{ id: 'c1', bookId: 'b1', chapterNumber: 2, chapterTitle: '想起', important: '思い出すことが大切', memory: '翌日に試す', application: '一文で書く', createdAt: '2026-08-02T01:00:00Z' }],
  preReadingQuestions: [{ id: 'q1', bookId: 'b1', questions: [{ question: '何を知る？', answer: '学習法' }], createdAt: '2026-08-01T01:00:00Z' }],
  readingCycles: [{ id: 'cy1', bookId: 'b1', date: '2026-08-03', insight: '短く記録する', duration: 600, ifThen: { situation: '読み終えたら', action: '一文を書く', place: '机', executed: true, executedDate: '2026-08-04' }, xPostText: '旧X投稿', xPosted: true, createdAt: '2026-08-03T01:00:00Z' }],
  actionItems: [{ id: 'a1', bookId: 'b1', content: '毎日試す', isDone: true, doneDate: '2026-08-05', note: 'できた', createdAt: '2026-08-02T02:00:00Z' }],
  journalEntries: [{ id: 'j1', date: '2026-08-03', summary: 'まとめ', quizPairs: [{ q: '質問', a: '回答' }], createdAt: '2026-08-03T10:00:00Z' }],
  readingTimerLogs: [{ id: 't1', bookId: 'b1', date: '2026-08-03', duration: 300, createdAt: '2026-08-03T00:00:00Z' }],
  readingTimerState: { mode: 'pomodoro', elapsed: 12 },
}

let database: ActiveReadingDatabase | undefined

afterEach(async () => {
  if (database) {
    database.close()
    await database.delete()
    database = undefined
  }
})

describe('旧版データ移行', () => {
  it('全種別を移行・保管し、再実行しても重複しない', async () => {
    database = new ActiveReadingDatabase(`migration-test-${crypto.randomUUID()}`)
    const first = await migrateLegacyData(legacy, { database })
    const firstSnapshot = {
      sources: await database.sources.toArray(),
      notes: await database.notes.toArray(),
      actions: await database.actionCandidates.toArray(),
      archives: await database.legacyArchive.toArray(),
    }

    expect(first).toMatchObject({ sources: 1, notes: 2, actionCandidates: 2, legacyArchive: 6 })
    expect(firstSnapshot.notes[0].reviewState).toBe('none')
    expect(firstSnapshot.notes.some((note) => note.content.includes('### 重要なこと'))).toBe(true)
    expect(firstSnapshot.actions.filter((action) => action.status === 'completed')).toHaveLength(2)
    expect(firstSnapshot.archives.some((item) => JSON.stringify(item.payload).includes('旧X投稿'))).toBe(true)

    await migrateLegacyData(legacy, { database })
    expect(await database.sources.count()).toBe(firstSnapshot.sources.length)
    expect(await database.notes.count()).toBe(firstSnapshot.notes.length)
    expect(await database.actionCandidates.count()).toBe(firstSnapshot.actions.length)
    expect(await database.legacyArchive.count()).toBe(firstSnapshot.archives.length)
  })

  it('再インポートでは更新日時が新しいv2編集を保持する', async () => {
    database = new ActiveReadingDatabase(`migration-merge-test-${crypto.randomUUID()}`)
    await migrateLegacyData(legacy, { database })
    const source = (await database.sources.toArray())[0]
    await database.sources.update(source.id, { title: 'v2で編集した題名', updatedAt: '2030-01-01T00:00:00.000Z' })

    await migrateLegacyData(legacy, { database, markComplete: false })
    expect((await database.sources.get(source.id))?.title).toBe('v2で編集した題名')
  })
})
