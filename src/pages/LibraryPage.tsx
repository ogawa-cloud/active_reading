import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { formatDisplayDate } from '../date'
import type { SourceKind } from '../types'

export function LibraryPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState<SourceKind | 'all'>('all')
  const [tag, setTag] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const data = useLiveQuery(async () => {
    const [sources, notes] = await Promise.all([
      db.sources.orderBy('updatedAt').reverse().toArray(),
      db.notes.orderBy('createdAt').reverse().toArray(),
    ])
    return { sources, notes }
  }, [])

  const filtered = useMemo(() => {
    if (!data) return { sources: [], notes: [], tags: [] }
    const normalized = keyword.trim().toLocaleLowerCase('ja')
    const sourceMap = new Map(data.sources.map((source) => [source.id, source]))
    const tags = [...new Set(data.sources.flatMap((source) => source.tags))].sort((a, b) => a.localeCompare(b, 'ja'))
    const sourceMatches = (sourceId: string) => {
      const source = sourceMap.get(sourceId)
      if (!source) return false
      if (kind !== 'all' && source.kind !== kind) return false
      if (tag !== 'all' && !source.tags.includes(tag)) return false
      return true
    }
    const notes = data.notes.filter((note) => {
      const source = sourceMap.get(note.sourceId)
      if (!sourceMatches(note.sourceId)) return false
      const date = note.createdAt.slice(0, 10)
      if (from && date < from) return false
      if (to && date > to) return false
      if (!normalized) return true
      return [source?.title, source?.author, source?.tags.join(' '), note.locator, note.content]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('ja').includes(normalized))
    })
    const matchingSourceIds = new Set(notes.map((note) => note.sourceId))
    const sources = data.sources.filter((source) => {
      if (!sourceMatches(source.id)) return false
      if (!normalized) return true
      return matchingSourceIds.has(source.id)
        || [source.title, source.author, source.tags.join(' '), source.purpose]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('ja').includes(normalized))
    })
    return { sources, notes, tags, sourceMap }
  }, [data, keyword, kind, tag, from, to])

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const proceed = () => {
    const ids = [...selected]
    if (ids.length) navigate(`/plan?notes=${encodeURIComponent(ids.join(','))}`)
  }

  return (
    <div className="page">
      <div className="page-heading page-heading--with-action">
        <div><span className="eyebrow">探して、選ぶ</span><h1>ライブラリ</h1></div>
        <Link className="button button--primary button--compact" to="/sources/new">＋ 資料</Link>
      </div>

      <section className="filter-panel" aria-label="検索と絞り込み">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} type="search" placeholder="資料・メモを検索" aria-label="キーワード検索" />
        </label>
        <div className="filter-row">
          <label><span>種類</span><select value={kind} onChange={(event) => setKind(event.target.value as SourceKind | 'all')}><option value="all">すべて</option><option value="book">本</option><option value="article">記事</option><option value="other">その他</option></select></label>
          <label><span>タグ</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">すべて</option>{filtered.tags.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>開始日</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span>終了日</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><h2>資料</h2><span className="muted">{filtered.sources.length}件</span></div>
        <div className="compact-source-grid">
          {filtered.sources.map((source) => (
            <Link className="compact-source" to={`/sources/${source.id}`} key={source.id}>
              <span className={`source-icon source-icon--${source.kind}`}>{source.kind === 'book' ? '本' : source.kind === 'article' ? '記' : '他'}</span>
              <span><strong>{source.title}</strong><small>{source.tags.join(' · ') || source.author || 'タグなし'}</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block library-notes">
        <div className="section-heading"><h2>メモを選択</h2><span className="muted">{filtered.notes.length}件</span></div>
        <div className="selectable-note-list">
          {filtered.notes.map((note) => {
            const source = filtered.sourceMap?.get(note.sourceId)
            const isSelected = selected.has(note.id)
            return (
              <label className={`selectable-note${isSelected ? ' is-selected' : ''}`} key={note.id}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(note.id)} />
                <span className="custom-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                <span className="selectable-note__content">
                  <small>{source?.title ?? '資料不明'} · {formatDisplayDate(note.createdAt)}</small>
                  <strong>{note.locator || '範囲指定なし'}</strong>
                  <span>{note.content}</span>
                </span>
                <Link to={`/notes/${note.id}/edit`} className="text-link" onClick={(event) => event.stopPropagation()}>編集</Link>
              </label>
            )
          })}
          {data && filtered.notes.length === 0 && <div className="empty-state"><p>条件に合うメモがありません。</p></div>}
        </div>
      </section>

      {selected.size > 0 && (
        <div className="selection-bar">
          <button type="button" className="text-button" onClick={() => setSelected(new Set())}>選択解除</button>
          <span>{selected.size}件を選択</span>
          <button type="button" className="button button--primary" onClick={proceed}>行動計画を作る</button>
        </div>
      )}
    </div>
  )
}
