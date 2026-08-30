import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  backupCounts,
  createBackup,
  datedFilename,
  downloadJson,
  importBackup,
  parseBackupV2,
} from '../backup'
import { clearV2Data } from '../db'
import {
  getLegacyInputCounts,
  isLegacyBackup,
  migrateLegacyData,
} from '../migration'
import type { BackupV2, LegacyData } from '../types'

type ImportPreview =
  | { kind: 'v2'; value: BackupV2; counts: Record<string, number>; filename: string }
  | { kind: 'legacy'; value: LegacyData; counts: Record<string, number>; filename: string }

const COUNT_LABELS: Record<string, string> = {
  sources: '資料',
  notes: 'メモ',
  recalls: '翌日想起',
  actionCandidates: '行動候補',
  legacyArchive: '旧版アーカイブ',
  books: '旧版の本',
  chapterNotes: '旧版の章メモ',
  preReadingQuestions: '旧版の問い',
  readingCycles: '旧版のサイクル',
  actionItems: '旧版の行動',
  journalEntries: '旧版のジャーナル',
  readingTimerLogs: '旧版の読書時間',
  readingTimerState: '旧版のタイマー状態',
}

export function SettingsPage() {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [legacyTokenExists, setLegacyTokenExists] = useState(false)

  useEffect(() => {
    setLegacyTokenExists(Boolean(localStorage.getItem('syncGitHubPAT')))
  }, [])

  const exportAll = async () => {
    setBusy(true)
    try {
      const backup = await createBackup()
      downloadJson(backup, datedFilename('active-reading-v2-backup', 'json'))
      setMessage('v2バックアップを保存しました。')
    } finally {
      setBusy(false)
    }
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    setError('')
    setMessage('')
    setReplaceConfirmed(false)
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const raw = JSON.parse(await file.text()) as unknown
      try {
        const backup = parseBackupV2(raw)
        setPreview({ kind: 'v2', value: backup, counts: { ...backupCounts(backup) }, filename: file.name })
      } catch {
        if (!isLegacyBackup(raw)) throw new Error('v2または旧版のバックアップ形式ではありません。')
        setPreview({ kind: 'legacy', value: raw, counts: getLegacyInputCounts(raw), filename: file.name })
      }
    } catch (reason) {
      setPreview(null)
      setError(reason instanceof Error ? reason.message : 'JSONを読み込めませんでした。')
    } finally {
      event.target.value = ''
    }
  }

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!preview || (mode === 'replace' && !replaceConfirmed)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'replace') {
        const safetyBackup = await createBackup()
        downloadJson(safetyBackup, datedFilename('active-reading-before-replace', 'json'))
        await clearV2Data()
      }
      if (preview.kind === 'v2') {
        await importBackup(preview.value, mode)
      } else {
        await migrateLegacyData(preview.value, { markComplete: mode === 'replace' })
      }
      setMessage(mode === 'merge'
        ? '更新日時が新しいデータを採用してマージしました。'
        : '退避バックアップを保存してから、全置換しました。')
      setPreview(null)
      setReplaceConfirmed(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'インポートに失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow">
      <div className="page-heading"><span className="eyebrow">端末内データ</span><h1>設定</h1></div>

      <section className="settings-card">
        <div><h2>JSONバックアップ</h2><p>資料・メモ・想起・行動候補・旧版アーカイブをまとめて保存します。</p></div>
        <button type="button" className="button button--primary" onClick={exportAll} disabled={busy}>バックアップを保存</button>
      </section>

      <section className="settings-card settings-card--stack">
        <div><h2>JSONを復元・移行</h2><p>v2形式と旧版形式の両方を読み込めます。まず内容と件数を表示します。</p></div>
        <label className="file-picker button button--secondary">
          JSONファイルを選ぶ
          <input type="file" accept="application/json,.json" onChange={chooseFile} />
        </label>

        {preview && (
          <div className="import-preview">
            <span className="eyebrow">{preview.kind === 'v2' ? 'v2バックアップ' : '旧版バックアップ'}</span>
            <h3>{preview.filename}</h3>
            <dl className="count-grid">
              {Object.entries(preview.counts).filter(([, count]) => count > 0).map(([key, count]) => (
                <div key={key}><dt>{COUNT_LABELS[key] ?? key}</dt><dd>{count}件</dd></div>
              ))}
            </dl>
            <button type="button" className="button button--primary button--full" onClick={() => runImport('merge')} disabled={busy}>
              新しい方を採用してマージ
            </button>
            <details className="danger-zone">
              <summary>全置換する</summary>
              <p>現在のv2データを自動バックアップしてから、選択した内容へ置き換えます。</p>
              <label className="confirm-check"><input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} /> 現在のデータが置き換わることを確認しました</label>
              <button type="button" className="button button--danger button--full" onClick={() => runImport('replace')} disabled={busy || !replaceConfirmed}>バックアップして全置換</button>
            </details>
          </div>
        )}
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {message && <p className="alert alert--success" role="status">{message}</p>}
      </section>

      <section className="settings-card">
        <div>
          <h2>旧版アーカイブ</h2>
          <p>ジャーナル、クイズ、読書時間、X投稿情報などを読み取り専用で確認できます。</p>
        </div>
        <Link className="button button--ghost" to="/archive">アーカイブを見る</Link>
      </section>

      <section className="settings-card settings-card--stack">
        <div>
          <h2>旧Gist同期について</h2>
          <p>v2はGist同期も保存済みPATも利用しません。</p>
        </div>
        {legacyTokenExists ? (
          <p className="alert alert--warning">このサイトの旧LocalStorageにPATが残っています。先にGitHub側で失効し、その後ブラウザの開発者ツールで <code>syncGitHubPAT</code> だけを削除してください。サイトデータ全消去は旧記録も消すため、バックアップ前には行わないでください。</p>
        ) : (
          <p className="muted">この端末では旧PATを検出しませんでした。</p>
        )}
        <a className="button button--ghost" href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">GitHubでトークンを失効する ↗</a>
      </section>

      <section className="about-card">
        <strong>Active Reading v2</strong>
        <span>端末保存 · オフライン対応 · AI送信なし</span>
      </section>
    </div>
  )
}
