import type { ActionCandidate, Note, Recall, Source } from './types'

export interface MarkdownExportInput {
  goal: string
  dailyMinutes: number
  notes: Note[]
  sources: Source[]
  actions: ActionCandidate[]
  recalls: Recall[]
  generatedAt?: string
}

function clean(value: string | undefined, fallback = 'なし'): string {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function sourceKindLabel(kind: Source['kind']): string {
  return { book: '本', article: '記事', other: 'その他' }[kind]
}

function recallRatingLabel(rating: Recall['rating']): string {
  return {
    recalled: '思い出せた',
    partial: '一部',
    forgotten: '忘れていた',
  }[rating]
}

export function buildActionPlanMarkdown(input: MarkdownExportInput): string {
  const selectedIds = new Set(input.notes.map((note) => note.id))
  const selectedSourceIds = new Set(input.notes.map((note) => note.sourceId))
  const sourceMap = new Map(
    input.sources
      .filter((source) => selectedSourceIds.has(source.id))
      .map((source) => [source.id, source]),
  )
  const actionsByNote = new Map<string, ActionCandidate[]>()
  for (const action of input.actions) {
    if (!action.noteId || !selectedIds.has(action.noteId)) continue
    const entries = actionsByNote.get(action.noteId) ?? []
    entries.push(action)
    actionsByNote.set(action.noteId, entries)
  }
  const recallsByNote = new Map<string, Recall[]>()
  for (const recall of input.recalls) {
    if (!selectedIds.has(recall.noteId)) continue
    const entries = recallsByNote.get(recall.noteId) ?? []
    entries.push(recall)
    recallsByNote.set(recall.noteId, entries)
  }
  const sourceActions = input.actions.filter(
    (action) => !action.noteId && selectedSourceIds.has(action.sourceId),
  )

  const noteSections = input.notes.map((note, index) => {
    const source = sourceMap.get(note.sourceId)
    const actionLines = (actionsByNote.get(note.id) ?? [])
      .map((action) => `- ${action.content}（状態：${action.status === 'completed' ? '完了' : '候補'}）`)
    const recallLines = (recallsByNote.get(note.id) ?? [])
      .map((recall) => [
        `- 想起回答：${clean(recall.response)}`,
        `  - 自己評価：${recallRatingLabel(recall.rating)}`,
      ].join('\n'))
    return [
      `## メモ ${index + 1}：${clean(source?.title, '資料不明')}`,
      '',
      `- 種類：${source ? sourceKindLabel(source.kind) : '不明'}`,
      `- 著者：${clean(source?.author)}`,
      `- URL：${clean(source?.url)}`,
      `- タグ：${source?.tags.length ? source.tags.join(', ') : 'なし'}`,
      `- この資料から知りたいこと：${clean(source?.purpose)}`,
      `- 章・見出し・範囲：${clean(note.locator)}`,
      `- 記録日時：${note.createdAt}`,
      '',
      '### 読後メモ',
      '',
      clean(note.content, '（本文なし）'),
      '',
      '### 行動候補',
      '',
      actionLines.length ? actionLines.join('\n') : '- なし',
      '',
      '### 翌日想起',
      '',
      recallLines.length ? recallLines.join('\n') : '- 未実施',
    ].join('\n')
  })

  const sourceActionSection = sourceActions.length
    ? [
        '',
        '## 資料に紐づく旧版の行動候補',
        '',
        ...sourceActions.map((action) => {
          const source = sourceMap.get(action.sourceId)
          return `- ${clean(source?.title, '資料不明')}：${action.content}（状態：${action.status === 'completed' ? '完了' : '候補'}）`
        }),
      ]
    : []

  return [
    '# Active Reading：7日間行動計画 作成依頼',
    '',
    '## 今回の条件',
    '',
    `- 今回の目的：${input.goal.trim()}`,
    `- 1日に使える時間：${input.dailyMinutes}分`,
    '- 実践期間：7日間',
    `- 出力作成日時：${input.generatedAt ?? new Date().toISOString()}`,
    '',
    '# 選択した読書メモ',
    '',
    ...noteSections,
    ...sourceActionSection,
    '',
    '# AIへの指示',
    '',
    '上記のメモだけを根拠として、実践できる7日間の行動計画を作成してください。次の形式と制約を守ってください。',
    '',
    '1. 7日後の到達目標を、観察可能な形で1つ示す。',
    '2. 優先する実践項目は最大3件に絞る。',
    '3. その中から最も推奨する実践を1件、理由とともに明示する。',
    '4. Day 1〜Day 7について、各日の行動・所要時間・完了条件を示す。',
    '5. 想定される障害を挙げ、既存の行動をトリガーにした「もし〜したら、そのとき〜する」形式のif-thenプランを作る。',
    '6. Day 7に答える振り返り質問を示す。',
    '7. メモにない事実や生活条件は推測しない。計画上どうしても仮定が必要な場合は「仮定」と明記する。',
    '8. 1日に使える時間を超えない。',
  ].join('\n')
}
