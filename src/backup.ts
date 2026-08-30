import { z } from 'zod'
import { db, type ActiveReadingDatabase } from './db'
import type {
  ActionCandidate,
  AppMeta,
  BackupV2,
  CollectionCounts,
  LegacyArchive,
  Note,
  Recall,
  Source,
} from './types'

const optionalText = z.string().optional()

export const SourceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['book', 'article', 'other']),
  title: z.string().min(1),
  author: optionalText,
  url: optionalText,
  tags: z.array(z.string()),
  purpose: optionalText,
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  legacyId: optionalText,
})

export const NoteSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  locator: optionalText,
  content: z.string(),
  actionCandidateId: optionalText,
  reviewDueDate: optionalText,
  reviewState: z.enum(['pending', 'done', 'skipped', 'none']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  legacyId: optionalText,
  legacyKind: z.enum(['chapterNote', 'readingCycle']).optional(),
})

export const RecallSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
  response: z.string(),
  rating: z.enum(['recalled', 'partial', 'forgotten']),
  createdAt: z.string().min(1),
})

export const ActionCandidateSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  noteId: optionalText,
  content: z.string(),
  status: z.enum(['candidate', 'completed', 'dismissed']),
  completedAt: optionalText,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  legacyId: optionalText,
})

export const LegacyArchiveSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    'preReadingQuestion',
    'readingCycle',
    'journalEntry',
    'readingTimerLog',
    'readingTimerState',
    'legacyAction',
    'unknown',
  ]),
  title: z.string(),
  sourceId: optionalText,
  payload: z.unknown(),
  createdAt: z.string().min(1),
})

export const AppMetaSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
})

export const BackupV2Schema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.string().min(1),
  sources: z.array(SourceSchema),
  notes: z.array(NoteSchema),
  recalls: z.array(RecallSchema),
  actionCandidates: z.array(ActionCandidateSchema),
  legacyArchive: z.array(LegacyArchiveSchema),
  appMeta: z.array(AppMetaSchema),
})

export function parseBackupV2(value: unknown): BackupV2 {
  return BackupV2Schema.parse(value) as BackupV2
}

export async function createBackup(database: ActiveReadingDatabase = db): Promise<BackupV2> {
  const [sources, notes, recalls, actionCandidates, legacyArchive, appMeta] = await Promise.all([
    database.sources.toArray(),
    database.notes.toArray(),
    database.recalls.toArray(),
    database.actionCandidates.toArray(),
    database.legacyArchive.toArray(),
    database.appMeta.toArray(),
  ])
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    sources,
    notes,
    recalls,
    actionCandidates,
    legacyArchive,
    appMeta,
  }
}

export function backupCounts(backup: BackupV2): CollectionCounts {
  return {
    sources: backup.sources.length,
    notes: backup.notes.length,
    recalls: backup.recalls.length,
    actionCandidates: backup.actionCandidates.length,
    legacyArchive: backup.legacyArchive.length,
  }
}

function newer<T extends { id: string; createdAt: string; updatedAt?: string }>(
  current: T | undefined,
  incoming: T,
): T {
  if (!current) return incoming
  const currentTime = Date.parse(current.updatedAt ?? current.createdAt) || 0
  const incomingTime = Date.parse(incoming.updatedAt ?? incoming.createdAt) || 0
  return incomingTime >= currentTime ? incoming : current
}

function mergeRecords<T extends { id: string; createdAt: string; updatedAt?: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const merged = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) merged.set(item.id, newer(merged.get(item.id), item))
  return [...merged.values()]
}

function mergeMeta(current: AppMeta[], incoming: AppMeta[]): AppMeta[] {
  const merged = new Map(current.map((item) => [item.key, item]))
  for (const item of incoming) merged.set(item.key, item)
  return [...merged.values()]
}

export type ImportMode = 'merge' | 'replace'

export async function importBackup(
  backupValue: unknown,
  mode: ImportMode = 'merge',
  database: ActiveReadingDatabase = db,
): Promise<CollectionCounts> {
  const backup = parseBackupV2(backupValue)

  await database.transaction(
    'rw',
    [
      database.sources,
      database.notes,
      database.recalls,
      database.actionCandidates,
      database.legacyArchive,
      database.appMeta,
    ],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          database.sources.clear(),
          database.notes.clear(),
          database.recalls.clear(),
          database.actionCandidates.clear(),
          database.legacyArchive.clear(),
          database.appMeta.clear(),
        ])
      }

      const current = mode === 'merge'
        ? await Promise.all([
            database.sources.toArray(),
            database.notes.toArray(),
            database.recalls.toArray(),
            database.actionCandidates.toArray(),
            database.legacyArchive.toArray(),
            database.appMeta.toArray(),
          ])
        : [[], [], [], [], [], []] as [Source[], Note[], Recall[], ActionCandidate[], LegacyArchive[], AppMeta[]]

      await database.sources.bulkPut(mergeRecords(current[0] as Source[], backup.sources))
      await database.notes.bulkPut(mergeRecords(current[1] as Note[], backup.notes))
      await database.recalls.bulkPut(mergeRecords(current[2] as Recall[], backup.recalls))
      await database.actionCandidates.bulkPut(
        mergeRecords(current[3] as ActionCandidate[], backup.actionCandidates),
      )
      await database.legacyArchive.bulkPut(
        mergeRecords(current[4] as LegacyArchive[], backup.legacyArchive),
      )
      await database.appMeta.bulkPut(mergeMeta(current[5] as AppMeta[], backup.appMeta))
    },
  )

  return backupCounts(backup)
}

function downloadBlob(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(value: unknown, filename: string): void {
  downloadBlob(JSON.stringify(value, null, 2), 'application/json;charset=utf-8', filename)
}

export function downloadMarkdown(markdown: string, filename: string): void {
  downloadBlob(markdown, 'text/markdown;charset=utf-8', filename)
}

export function datedFilename(prefix: string, extension: 'json' | 'md'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}-${timestamp}.${extension}`
}
