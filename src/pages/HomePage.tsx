import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { RecallCard } from '../components/RecallCard'
import { db } from '../db'
import { formatDisplayDate, isDueOnOrBefore, localDateKey } from '../date'

export function HomePage() {
  const data = useLiveQuery(async () => {
    const [sources, notes] = await Promise.all([
      db.sources.orderBy('updatedAt').reverse().toArray(),
      db.notes.orderBy('createdAt').reverse().toArray(),
    ])
    const sourceMap = new Map(sources.map((source) => [source.id, source]))
    const dueNote = [...notes]
      .filter((note) => note.reviewState === 'pending' && isDueOnOrBefore(note.reviewDueDate))
      .sort((a, b) => (a.reviewDueDate ?? '').localeCompare(b.reviewDueDate ?? ''))[0]
    return {
      sources,
      recentSources: sources.filter((source) => source.status !== 'archived').slice(0, 4),
      recentNotes: notes.slice(0, 3),
      dueNote,
      dueSource: dueNote ? sourceMap.get(dueNote.sourceId) : undefined,
      sourceMap,
    }
  }, [])

  const today = formatDisplayDate(localDateKey())

  return (
    <div className="page page--home">
      <section className="hero">
        <div>
          <span className="eyebrow">{today}</span>
          <h1>読み終えたら、<br />自分の言葉を残そう。</h1>
          <p>30〜90秒の記録で十分です。分類や段階入力はありません。</p>
        </div>
        <Link className="button button--primary button--large" to={data?.recentSources[0] ? `/capture/${data.recentSources[0].id}` : '/sources/new'}>
          {data?.recentSources[0] ? 'すぐ記録' : '最初の資料を登録'}
        </Link>
      </section>

      {data?.dueNote && <RecallCard key={data.dueNote.id} note={data.dueNote} source={data.dueSource} />}

      <section className="section-block" aria-labelledby="recent-source-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">2タップ以内</span>
            <h2 id="recent-source-title">最近の資料から記録</h2>
          </div>
          <Link to="/sources/new" className="text-link">＋ 資料を追加</Link>
        </div>

        {!data ? (
          <div className="skeleton-card" />
        ) : data.recentSources.length === 0 ? (
          <div className="empty-state">
            <p>まだ資料がありません。</p>
            <Link className="button button--secondary" to="/sources/new">資料を登録する</Link>
          </div>
        ) : (
          <div className="source-quick-list">
            {data.recentSources.map((source) => (
              <article className="source-quick-row" key={source.id}>
                <Link to={`/sources/${source.id}`} className="source-quick-row__main">
                  <span className={`source-icon source-icon--${source.kind}`} aria-hidden="true">
                    {source.kind === 'book' ? '本' : source.kind === 'article' ? '記' : '他'}
                  </span>
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.author || source.tags.join(' · ') || '登録済みの資料'}</small>
                  </span>
                </Link>
                <Link className="button button--compact button--primary" to={`/capture/${source.id}`}>
                  記録
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block" aria-labelledby="recent-note-title">
        <div className="section-heading">
          <h2 id="recent-note-title">最近のメモ</h2>
          <Link to="/library" className="text-link">すべて見る</Link>
        </div>
        <div className="note-list">
          {data?.recentNotes.map((note) => {
            const source = data.sourceMap.get(note.sourceId)
            return (
              <Link to={`/notes/${note.id}/edit`} className="note-preview" key={note.id}>
                <span className="note-preview__meta">
                  {source?.title ?? '資料不明'} · {formatDisplayDate(note.createdAt)}
                </span>
                <strong>{note.locator || '範囲指定なし'}</strong>
                <p>{note.content}</p>
              </Link>
            )
          })}
          {data && data.recentNotes.length === 0 && <p className="muted">記録すると、ここに最近のメモが並びます。</p>}
        </div>
      </section>
    </div>
  )
}
