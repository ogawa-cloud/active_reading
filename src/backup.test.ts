import { afterEach, describe, expect, it } from 'vitest'
import { importBackup, parseBackupV2 } from './backup'
import { ActiveReadingDatabase } from './db'
import type { BackupV2, Source } from './types'

const oldTime = '2026-01-01T00:00:00.000Z'
const newTime = '2027-01-01T00:00:00.000Z'

function source(title: string, updatedAt: string): Source {
  return {
    id: 'source-1',
    kind: 'book',
    title,
    tags: [],
    status: 'active',
    createdAt: oldTime,
    updatedAt,
  }
}

function backup(sourceValue: Source): BackupV2 {
  return {
    schemaVersion: 2,
    exportedAt: newTime,
    sources: [sourceValue],
    notes: [{ id: 'note-import', sourceId: sourceValue.id, content: '復元するメモ', reviewState: 'none', createdAt: oldTime, updatedAt: oldTime }],
    recalls: [],
    actionCandidates: [],
    legacyArchive: [],
    appMeta: [],
  }
}

let database: ActiveReadingDatabase | undefined

afterEach(async () => {
  if (database) {
    database.close()
    await database.delete()
    database = undefined
  }
})

describe('v2バックアップ', () => {
  it('Zodで形式を検証する', () => {
    expect(parseBackupV2(backup(source('正しい形式', oldTime))).schemaVersion).toBe(2)
    expect(() => parseBackupV2({ schemaVersion: 2, sources: '不正' })).toThrow()
  })

  it('マージでは更新日時が新しい既存データを保持し、不足分を追加する', async () => {
    database = new ActiveReadingDatabase(`backup-merge-${crypto.randomUUID()}`)
    await database.sources.put(source('端末側の新しい題名', newTime))

    await importBackup(backup(source('古いバックアップの題名', oldTime)), 'merge', database)

    expect((await database.sources.get('source-1'))?.title).toBe('端末側の新しい題名')
    expect((await database.notes.get('note-import'))?.content).toBe('復元するメモ')
  })

  it('全置換では既存データを除き、バックアップ内容だけにする', async () => {
    database = new ActiveReadingDatabase(`backup-replace-${crypto.randomUUID()}`)
    await database.sources.put({ ...source('消える資料', newTime), id: 'old-source' })

    await importBackup(backup(source('置換後の資料', oldTime)), 'replace', database)

    expect(await database.sources.get('old-source')).toBeUndefined()
    expect((await database.sources.get('source-1'))?.title).toBe('置換後の資料')
  })
})
