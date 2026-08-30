import { describe, expect, it } from 'vitest'
import { buildActionPlanMarkdown } from './exportMarkdown'
import type { ActionCandidate, Note, Recall, Source } from './types'

const timestamp = '2026-08-24T10:00:00.000Z'
const sources: Source[] = [
  { id: 's1', kind: 'book', title: '選んだ本', tags: ['学習'], purpose: '実践法を知る', status: 'active', createdAt: timestamp, updatedAt: timestamp },
  { id: 's2', kind: 'article', title: '選んでいない記事', tags: [], status: 'active', createdAt: timestamp, updatedAt: timestamp },
]
const notes: Note[] = [
  { id: 'n1', sourceId: 's1', content: '想起を使う。', reviewState: 'done', createdAt: timestamp, updatedAt: timestamp },
]
const actions: ActionCandidate[] = [
  { id: 'a1', sourceId: 's1', noteId: 'n1', content: '明日1回試す', status: 'candidate', createdAt: timestamp, updatedAt: timestamp },
  { id: 'a-old', sourceId: 's1', content: '旧版から引き継いだ行動', status: 'completed', createdAt: timestamp, updatedAt: timestamp },
  { id: 'a2', sourceId: 's2', noteId: 'n2', content: '含めてはいけない', status: 'candidate', createdAt: timestamp, updatedAt: timestamp },
]
const recalls: Recall[] = [
  { id: 'r1', noteId: 'n1', response: '見ずに説明した', rating: 'partial', createdAt: timestamp },
]

describe('AI用Markdown', () => {
  it('選択したメモと関連データだけを含み、7日間の制約を付ける', () => {
    const markdown = buildActionPlanMarkdown({
      goal: '仕事で1つ実践する',
      dailyMinutes: 15,
      notes,
      sources,
      actions,
      recalls,
      generatedAt: timestamp,
    })

    expect(markdown).toContain('選んだ本')
    expect(markdown).toContain('想起を使う。')
    expect(markdown).toContain('見ずに説明した')
    expect(markdown).toContain('旧版から引き継いだ行動')
    expect(markdown).toContain('1日に使える時間：15分')
    expect(markdown).toContain('Day 1〜Day 7')
    expect(markdown).toContain('優先する実践項目は最大3件')
    expect(markdown).toContain('メモにない事実や生活条件は推測しない')
    expect(markdown).not.toContain('選んでいない記事')
    expect(markdown).not.toContain('含めてはいけない')
  })
})
