import { useMemo, useState } from 'react'
import { datedFilename, downloadJson } from '../backup'
import { getLegacyInputCounts, migrateLegacyData } from '../migration'
import type { LegacyData } from '../types'

interface MigrationDialogProps {
  legacy: LegacyData
  onLater: () => void
  onComplete: () => void
}

const LABELS: Record<string, string> = {
  books: '本',
  chapterNotes: '章メモ',
  preReadingQuestions: '読む前の問い',
  readingCycles: '読書サイクル',
  actionItems: '行動候補',
  journalEntries: 'ジャーナル',
  readingTimerLogs: '読書時間',
  readingTimerState: 'タイマー状態',
}

export function MigrationDialog({ legacy, onLater, onComplete }: MigrationDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const counts = useMemo(() => getLegacyInputCounts(legacy), [legacy])

  const migrate = async () => {
    setBusy(true)
    setError('')
    try {
      downloadJson(legacy, datedFilename('active-reading-legacy-backup', 'json'))
      await migrateLegacyData(legacy)
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '移行に失敗しました。')
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="migration-title">
        <span className="eyebrow">初回のみ</span>
        <h2 id="migration-title">旧版の記録が見つかりました</h2>
        <p>
          先に旧形式のJSONを端末へ保存し、その後v2へコピーします。
          旧LocalStorageは削除しません。
        </p>
        <dl className="count-grid">
          {Object.entries(counts).filter(([, count]) => count > 0).map(([key, count]) => (
            <div key={key}>
              <dt>{LABELS[key] ?? key}</dt>
              <dd>{count}件</dd>
            </div>
          ))}
        </dl>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button--ghost" onClick={onLater} disabled={busy}>
            後で
          </button>
          <button type="button" className="button button--primary" onClick={migrate} disabled={busy}>
            {busy ? '移行しています…' : 'バックアップして移行'}
          </button>
        </div>
      </section>
    </div>
  )
}
