import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db'
import { formatDisplayDate } from '../date'

export function SourceDetailPage() {
  const { sourceId = '' } = useParams()
  const data = useLiveQuery(async () => {
    const [source, notes, actions] = await Promise.all([
      db.sources.get(sourceId),
      db.notes.where('sourceId').equals(sourceId).reverse().sortBy('createdAt'),
      db.actionCandidates.where('sourceId').equals(sourceId).toArray(),
    ])
    return { source, notes, actions }
  }, [sourceId])

  if (!data) return <div className="page"><div className="skeleton-card" /></div>
  if (!data.source) {
    return <div className="page empty-state"><h1>資料が見つかりません</h1><Link to="/library">ライブラリへ</Link></div>
  }

  const { source } = data
  const actionMap = new Map(data.actions.map((action) => [action.noteId, action]))
  const sourceActions = data.actions.filter((action) => !action.noteId)

  return (
    <div className="page">
      <header className="source-detail-header">
        <div>
          <span className="eyebrow">{source.kind === 'book' ? '本' : source.kind === 'article' ? '記事' : 'その他'}</span>
          <h1>{source.title}</h1>
          {source.author && <p>{source.author}</p>}
        </div>
        <Link className="button button--ghost button--compact" to={`/sources/${source.id}/edit`}>編集</Link>
      </header>

      {(source.purpose || source.tags.length > 0 || source.url) && (
        <section className="card source-meta-card">
          {source.purpose && <div><span>知りたいこと</span><p>{source.purpose}</p></div>}
          {source.tags.length > 0 && <div className="tag-list">{source.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
          {source.url && <a href={source.url} target="_blank" rel="noreferrer">元のページを開く ↗</a>}
        </section>
      )}

      <Link className="button button--primary button--large button--full" to={`/capture/${source.id}`}>この資料を記録する</Link>

      <section className="section-block">
        <div className="section-heading"><h2>メモ</h2><span className="muted">{data.notes.length}件</span></div>
        <div className="note-list">
          {data.notes.map((note) => {
            const action = actionMap.get(note.id)
            return (
              <Link to={`/notes/${note.id}/edit`} className="card saved-note" key={note.id}>
                <span className="note-preview__meta">{formatDisplayDate(note.createdAt)}</span>
                <h3>{note.locator || '範囲指定なし'}</h3>
                <p className="preserve-lines">{note.content}</p>
                {action && <p className="action-line"><span>試すこと</span>{action.content}</p>}
              </Link>
            )
          })}
          {data.notes.length === 0 && <div className="empty-state"><p>まだメモがありません。</p></div>}
        </div>
      </section>

      {sourceActions.length > 0 && (
        <section className="section-block">
          <div className="section-heading"><h2>旧版からの行動候補</h2><span className="muted">{sourceActions.length}件</span></div>
          <div className="card source-action-list">
            {sourceActions.map((action) => (
              <div key={action.id}>
                <span className={`status-pill${action.status === 'completed' ? ' status-pill--done' : ''}`}>
                  {action.status === 'completed' ? '完了' : '候補'}
                </span>
                <p className="preserve-lines">{action.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
