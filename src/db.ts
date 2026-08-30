import Dexie, { type EntityTable } from 'dexie'
import type {
  ActionCandidate,
  AppMeta,
  LegacyArchive,
  Note,
  Recall,
  Source,
} from './types'

export class ActiveReadingDatabase extends Dexie {
  sources!: EntityTable<Source, 'id'>
  notes!: EntityTable<Note, 'id'>
  recalls!: EntityTable<Recall, 'id'>
  actionCandidates!: EntityTable<ActionCandidate, 'id'>
  legacyArchive!: EntityTable<LegacyArchive, 'id'>
  appMeta!: EntityTable<AppMeta, 'key'>

  constructor(name = 'ActiveReadingV2') {
    super(name)
    this.version(1).stores({
      sources: 'id, kind, status, updatedAt, *tags',
      notes: 'id, sourceId, reviewDueDate, reviewState, createdAt, updatedAt',
      recalls: 'id, noteId, createdAt',
      actionCandidates: 'id, sourceId, noteId, status, updatedAt',
      legacyArchive: 'id, category, sourceId, createdAt',
      appMeta: 'key',
    })
  }
}

export const db = new ActiveReadingDatabase()

export function createId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${randomId}`
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.appMeta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.appMeta.put({ key, value })
}

export async function clearV2Data(): Promise<void> {
  await db.transaction(
    'rw',
    [db.sources, db.notes, db.recalls, db.actionCandidates, db.legacyArchive, db.appMeta],
    async () => {
      await Promise.all([
        db.sources.clear(),
        db.notes.clear(),
        db.recalls.clear(),
        db.actionCandidates.clear(),
        db.legacyArchive.clear(),
        db.appMeta.clear(),
      ])
    },
  )
}
