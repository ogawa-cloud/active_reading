import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { datedFilename, downloadMarkdown } from '../backup'
import { db } from '../db'
import { buildActionPlanMarkdown } from '../exportMarkdown'

export function PlanPage() {
  const [searchParams] = useSearchParams()
  const noteIds = (searchParams.get('notes') ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  const stableIds = noteIds.join(',')
  const [goal, setGoal] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState('15')
  const [markdown, setMarkdown] = useState('')
  const [message, setMessage] = useState('')

  const data = useLiveQuery(async () => {
    const [noteValues, sources, actions, recalls] = await Promise.all([
      Promise.all(noteIds.map((id) => db.notes.get(id))),
      db.sources.toArray(),
      db.actionCandidates.toArray(),
      db.recalls.toArray(),
    ])
    return { notes: noteValues.filter((note) => note !== undefined), sources, actions, recalls }
  }, [stableIds])

  useEffect(() => {
    setMarkdown('')
    setMessage('')
  }, [goal, dailyMinutes, stableIds])

  const generate = (event: FormEvent) => {
    event.preventDefault()
    const minutes = Number(dailyMinutes)
    if (!data || !goal.trim() || !Number.isFinite(minutes) || minutes < 1) return
    setMarkdown(buildActionPlanMarkdown({
      goal: goal.trim(),
      dailyMinutes: Math.round(minutes),
      notes: data.notes,
      sources: data.sources,
      actions: data.actions,
      recalls: data.recalls,
    }))
    setMessage('Markdownを作成しました。内容を確認してからAIへ渡してください。')
  }

  const copy = async () => {
    await navigator.clipboard.writeText(markdown)
    setMessage('Markdownをクリップボードへコピーしました。')
  }

  if (noteIds.length === 0) {
    return (
      <div className="page empty-state">
        <h1>メモを選択してください</h1>
        <p>ライブラリで使いたいメモだけを選べます。</p>
        <Link className="button button--primary" to="/library">ライブラリへ</Link>
      </div>
    )
  }

  return (
    <div className="page page--narrow plan-page">
      <div className="page-heading">
        <span className="eyebrow">AIへ渡す前に人が決める</span>
        <h1>7日間行動計画の出力</h1>
        <p>{data?.notes.length ?? noteIds.length}件のメモを使います。アプリ内ではAI生成しません。</p>
      </div>

      <form className="form-card" onSubmit={generate}>
        <label className="field">
          <span className="field__label">今回の目的 <span className="required">必須</span></span>
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} placeholder="7日間で何を変えたいですか？" required />
        </label>
        <label className="field">
          <span className="field__label">1日に使える時間 <span className="required">必須</span></span>
          <span className="input-with-suffix">
            <input type="number" inputMode="numeric" min="1" max="1440" value={dailyMinutes} onChange={(event) => setDailyMinutes(event.target.value)} required />
            <span>分</span>
          </span>
        </label>
        <div className="fixed-period"><span>期間</span><strong>7日間（固定）</strong></div>
        <button type="submit" className="button button--primary button--full" disabled={!data || !goal.trim() || Number(dailyMinutes) < 1}>
          AI用Markdownを作る
        </button>
      </form>

      <details className="selected-note-summary">
        <summary>選択したメモを確認（{data?.notes.length ?? 0}件）</summary>
        <ol>{data?.notes.map((note) => <li key={note.id}>{note.content.slice(0, 100)}{note.content.length > 100 ? '…' : ''}</li>)}</ol>
      </details>

      {message && <p className="alert alert--success" role="status">{message}</p>}
      {markdown && (
        <section className="markdown-output" aria-labelledby="markdown-title">
          <div className="section-heading">
            <h2 id="markdown-title">出力内容</h2>
            <div className="button-row button-row--compact">
              <button type="button" className="button button--secondary button--compact" onClick={copy}>コピー</button>
              <button type="button" className="button button--ghost button--compact" onClick={() => downloadMarkdown(markdown, datedFilename('active-reading-7day-plan', 'md'))}>ファイル保存</button>
            </div>
          </div>
          <textarea value={markdown} readOnly aria-label="AI用Markdown" />
        </section>
      )}
    </div>
  )
}
