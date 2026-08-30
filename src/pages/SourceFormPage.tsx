import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createId, db } from '../db'
import type { SourceKind, SourceStatus } from '../types'

function parseTags(value: string): string[] {
  return [...new Set(value.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean))]
}

export function SourceFormPage() {
  const { sourceId } = useParams()
  const navigate = useNavigate()
  const existing = useLiveQuery(() => sourceId ? db.sources.get(sourceId) : undefined, [sourceId])
  const [kind, setKind] = useState<SourceKind>('book')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [purpose, setPurpose] = useState('')
  const [status, setStatus] = useState<SourceStatus>('active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!existing) return
    setKind(existing.kind)
    setTitle(existing.title)
    setAuthor(existing.author ?? '')
    setUrl(existing.url ?? '')
    setTags(existing.tags.join(', '))
    setPurpose(existing.purpose ?? '')
    setStatus(existing.status)
  }, [existing])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('タイトルを入力してください。')
      return
    }
    setBusy(true)
    const now = new Date().toISOString()
    const id = existing?.id ?? createId('source')
    await db.sources.put({
      id,
      kind,
      title: title.trim(),
      author: author.trim() || undefined,
      url: url.trim() || undefined,
      tags: parseTags(tags),
      purpose: purpose.trim() || undefined,
      status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      legacyId: existing?.legacyId,
    })
    navigate(existing ? `/sources/${id}` : `/capture/${id}`, { replace: true })
  }

  return (
    <div className="page page--narrow">
      <div className="page-heading">
        <span className="eyebrow">{existing ? '資料を編集' : 'まず1件だけ'}</span>
        <h1>{existing ? '資料情報' : '資料を登録'}</h1>
        <p>タイトル以外は後から追加できます。</p>
      </div>

      <form className="form-card" onSubmit={submit}>
        <fieldset className="segmented-fieldset">
          <legend>種類</legend>
          <div className="segmented-control">
            {([
              ['book', '本'],
              ['article', '記事'],
              ['other', 'その他'],
            ] as const).map(([value, label]) => (
              <label key={value} className={kind === value ? 'is-selected' : ''}>
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">タイトル <span className="required">必須</span></span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="本や記事のタイトル" />
        </label>
        <label className="field">
          <span className="field__label">著者</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="任意" />
        </label>
        <label className="field">
          <span className="field__label">URL</span>
          <input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" />
        </label>
        <label className="field">
          <span className="field__label">タグ</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="仕事, 心理学（カンマ区切り）" />
        </label>
        <label className="field">
          <span className="field__label">この資料から何を知りたい？</span>
          <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} rows={3} placeholder="目的は1問だけ。空欄でもかまいません。" />
        </label>
        {existing && (
          <label className="field">
            <span className="field__label">状態</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as SourceStatus)}>
              <option value="active">使用中</option>
              <option value="completed">読了</option>
              <option value="archived">アーカイブ</option>
            </select>
          </label>
        )}
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        <div className="button-row">
          <Link className="button button--ghost" to={existing ? `/sources/${existing.id}` : '/'}>キャンセル</Link>
          <button className="button button--primary" type="submit" disabled={busy}>
            {busy ? '保存中…' : existing ? '保存' : '登録して記録へ'}
          </button>
        </div>
      </form>
    </div>
  )
}
