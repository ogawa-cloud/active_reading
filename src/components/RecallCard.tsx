import { useState } from 'react'
import { createId, db } from '../db'
import { formatDisplayDate } from '../date'
import type { Note, RecallRating, Source } from '../types'

interface RecallCardProps {
  note: Note
  source?: Source
}

export function RecallCard({ note, source }: RecallCardProps) {
  const [response, setResponse] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [postponed, setPostponed] = useState(false)
  const [busy, setBusy] = useState(false)

  if (postponed) {
    return (
      <section className="card recall-card recall-card--quiet">
        <p>復習は後にしました。新しい記録はそのまま続けられます。</p>
      </section>
    )
  }

  const skip = async () => {
    setBusy(true)
    await db.notes.update(note.id, { reviewState: 'skipped', updatedAt: new Date().toISOString() })
    setPostponed(true)
  }

  const rate = async (rating: RecallRating) => {
    setBusy(true)
    const now = new Date().toISOString()
    await db.transaction('rw', [db.recalls, db.notes], async () => {
      await db.recalls.add({
        id: createId('recall'),
        noteId: note.id,
        response: response.trim(),
        rating,
        createdAt: now,
      })
      await db.notes.update(note.id, { reviewState: 'done', updatedAt: now })
    })
  }

  return (
    <section className="card recall-card" aria-labelledby="recall-title">
      <div className="card-heading-row">
        <div>
          <span className="eyebrow">翌日の想起・任意</span>
          <h2 id="recall-title">昨日読んだ内容を、見ずに一文で説明してください</h2>
        </div>
        <span className="status-pill">1回だけ</span>
      </div>
      <p className="muted">
        {source?.title ?? '資料不明'}
        {note.locator ? ` ／ ${note.locator}` : ''}
        {note.reviewDueDate ? ` · ${formatDisplayDate(note.reviewDueDate)}` : ''}
      </p>

      {!revealed ? (
        <>
          <label className="field">
            <span className="field__label">思い出したこと</span>
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              rows={3}
              placeholder="一文で十分です"
            />
          </label>
          <div className="button-row button-row--wrap">
            <button type="button" className="button button--primary" disabled={!response.trim()} onClick={() => setRevealed(true)}>
              元メモと比べる
            </button>
            <button type="button" className="button button--ghost" onClick={() => setPostponed(true)}>
              後で
            </button>
            <button type="button" className="text-button" onClick={skip} disabled={busy}>
              スキップ
            </button>
          </div>
        </>
      ) : (
        <div className="recall-result">
          <div>
            <h3>あなたの想起</h3>
            <p className="preserve-lines">{response.trim()}</p>
          </div>
          <div className="original-note">
            <h3>元のメモ</h3>
            <p className="preserve-lines">{note.content}</p>
          </div>
          <fieldset className="rating-fieldset" disabled={busy}>
            <legend>どのくらい思い出せましたか？</legend>
            <div className="rating-buttons">
              <button type="button" onClick={() => rate('recalled')}>思い出せた</button>
              <button type="button" onClick={() => rate('partial')}>一部</button>
              <button type="button" onClick={() => rate('forgotten')}>忘れていた</button>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  )
}
