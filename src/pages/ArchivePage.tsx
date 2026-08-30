import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { formatDisplayDate } from '../date'

const CATEGORY_LABELS: Record<string, string> = {
  preReadingQuestion: '読む前の問い',
  readingCycle: '読書サイクル・X投稿',
  journalEntry: 'ジャーナル・クイズ',
  readingTimerLog: '読書時間',
  readingTimerState: 'タイマー状態',
  legacyAction: '旧版の行動候補',
  unknown: 'その他',
}

export function ArchivePage() {
  const data = useLiveQuery(async () => {
    const [archives, sources] = await Promise.all([
      db.legacyArchive.orderBy('createdAt').reverse().toArray(),
      db.sources.toArray(),
    ])
    return { archives, sourceMap: new Map(sources.map((source) => [source.id, source])) }
  }, [])

  return (
    <div className="page page--narrow">
      <div className="page-heading">
        <Link className="back-link" to="/settings">← 設定</Link>
        <span className="eyebrow">編集されません</span>
        <h1>旧版アーカイブ</h1>
        <p>v2で日常的に使わない記録を、元の形のまま保持しています。</p>
      </div>
      <div className="archive-list">
        {data?.archives.map((archive) => (
          <details className="archive-item" key={archive.id}>
            <summary>
              <span><small>{CATEGORY_LABELS[archive.category] ?? archive.category} · {formatDisplayDate(archive.createdAt)}</small><strong>{archive.title}</strong>{archive.sourceId && <em>{data.sourceMap.get(archive.sourceId)?.title}</em>}</span>
              <span aria-hidden="true">＋</span>
            </summary>
            <pre>{JSON.stringify(archive.payload, null, 2)}</pre>
          </details>
        ))}
        {data && data.archives.length === 0 && <div className="empty-state"><p>旧版アーカイブはありません。</p></div>}
      </div>
    </div>
  )
}
