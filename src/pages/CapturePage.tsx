import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createId, db } from '../db'
import { nextLocalDateKey } from '../date'
import { loadDraft, removeDraft, saveDraft } from '../draft'

export function CapturePage() {
  const { sourceId, noteId } = useParams()
  const navigate = useNavigate()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initializedFor = useRef('')
  const [locator, setLocator] = useState('')
  const [content, setContent] = useState('')
  const [actionText, setActionText] = useState('')
  const [draftRestored, setDraftRestored] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const record = useLiveQuery(async () => {
    if (noteId) {
      const note = await db.notes.get(noteId)
      if (!note) return { note: undefined, source: undefined, action: undefined }
      const [source, action] = await Promise.all([
        db.sources.get(note.sourceId),
        db.actionCandidates.where('noteId').equals(note.id).first(),
      ])
      return { note, source, action }
    }
    return { note: undefined, source: sourceId ? await db.sources.get(sourceId) : undefined, action: undefined }
  }, [sourceId, noteId])

  useEffect(() => {
    if (!record?.source) return
    const routeKey = noteId ?? `new:${record.source.id}`
    if (initializedFor.current === routeKey) return
    initializedFor.current = routeKey
    const draft = loadDraft(record.source.id, noteId)
    if (draft) {
      setLocator(draft.locator)
      setContent(draft.content)
      setActionText(draft.action)
      setDraftRestored(Boolean(draft.locator || draft.content || draft.action))
    } else {
      setLocator(record.note?.locator ?? '')
      setContent(record.note?.content ?? '')
      setActionText(record.action?.content ?? '')
    }
    setInitialized(true)
  }, [record, noteId])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const minimum = Math.max(280, window.innerHeight * 0.45)
    textarea.style.height = `${Math.max(minimum, textarea.scrollHeight)}px`
  }, [content, initialized])

  useEffect(() => {
    if (!initialized || !record?.source) return
    const write = () => saveDraft({
      sourceId: record.source!.id,
      noteId,
      locator,
      content,
      action: actionText,
    })
    const timer = window.setTimeout(write, 180)
    return () => {
      window.clearTimeout(timer)
      write()
    }
  }, [initialized, record?.source, noteId, locator, content, actionText])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!record?.source) return
    if (!content.trim()) {
      setError('自分の言葉で説明した本文を入力してください。')
      textareaRef.current?.focus()
      return
    }

    setBusy(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const savedNoteId = record.note?.id ?? createId('note')
      const actionId = record.action?.id ?? (actionText.trim() ? createId('action') : undefined)
      await db.transaction('rw', [db.notes, db.actionCandidates, db.sources], async () => {
        await db.notes.put({
          id: savedNoteId,
          sourceId: record.source!.id,
          locator: locator.trim() || undefined,
          content: content.trim(),
          actionCandidateId: actionText.trim() ? actionId : undefined,
          reviewDueDate: record.note?.reviewDueDate ?? nextLocalDateKey(new Date(now)),
          reviewState: record.note?.reviewState ?? 'pending',
          createdAt: record.note?.createdAt ?? now,
          updatedAt: now,
          legacyId: record.note?.legacyId,
          legacyKind: record.note?.legacyKind,
        })
        if (actionText.trim() && actionId) {
          await db.actionCandidates.put({
            id: actionId,
            sourceId: record.source!.id,
            noteId: savedNoteId,
            content: actionText.trim(),
            status: record.action?.status ?? 'candidate',
            completedAt: record.action?.completedAt,
            createdAt: record.action?.createdAt ?? now,
            updatedAt: now,
            legacyId: record.action?.legacyId,
          })
        } else if (record.action) {
          await db.actionCandidates.update(record.action.id, { status: 'dismissed', updatedAt: now })
        }
        await db.sources.update(record.source!.id, { updatedAt: now })
      })
      removeDraft(record.source.id, noteId)
      navigate(`/sources/${record.source.id}`, { replace: true })
    } catch (reason) {
      setBusy(false)
      setError(reason instanceof Error ? reason.message : '保存に失敗しました。')
    }
  }

  if (!record) return <div className="page page--editor"><div className="skeleton-card" /></div>
  if (!record.source) {
    return <div className="page empty-state"><h1>記録先が見つかりません</h1><Link to="/library">ライブラリへ</Link></div>
  }

  return (
    <div className="page page--editor page--narrow">
      <header className="capture-heading">
        <Link to={`/sources/${record.source.id}`} className="back-link">← 戻る</Link>
        <span className="eyebrow">{record.note ? 'メモを編集' : '読後30〜90秒'}</span>
        <h1>{record.source.title}</h1>
      </header>

      {draftRestored && (
        <p className="alert alert--info" role="status">
          端末に残っていた下書きを復元しました。
        </p>
      )}

      <form id="capture-form" className="capture-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">章・見出し・範囲 <span className="optional">任意</span></span>
          <input value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="例：第3章、導入〜まとめ" />
        </label>

        <div className="recall-prompt">
          <span aria-hidden="true">◌</span>
          <p><strong>本文を閉じ、見ずに</strong><br />自分の言葉で説明してください。</p>
        </div>

        <label className="field field--main-note">
          <span className="field__label">自分の言葉で説明 <span className="required">必須</span></span>
          <textarea
            ref={textareaRef}
            className="main-note-input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="覚えていること、理解したことを自由に書く…"
            aria-describedby="writing-hints"
          />
        </label>

        <details className="writing-hints" id="writing-hints">
          <summary>書き方のヒント</summary>
          <ul>
            <li>一番大事だと思ったことは？</li>
            <li>誰かに説明するなら、どう言う？</li>
            <li>自分の経験とどこがつながった？</li>
          </ul>
        </details>

        <label className="field">
          <span className="field__label">試すこと <span className="optional">任意・1つだけ</span></span>
          <input value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="例：明日の会議で質問を1つする" />
        </label>
        <p className="autosave-note">入力内容はこの端末へ自動で下書き保存されます。</p>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
      </form>

      <div className="sticky-save">
        <button className="button button--primary button--large button--full" type="submit" form="capture-form" disabled={busy}>
          {busy ? '保存中…' : 'メモを保存'}
        </button>
      </div>
    </div>
  )
}
