import { db, type ActiveReadingDatabase } from './db'
import { toDateTime } from './date'
import type {
  ActionCandidate,
  CollectionCounts,
  LegacyArchive,
  LegacyData,
  Note,
  Source,
  SourceStatus,
} from './types'

export const LEGACY_MIGRATION_META_KEY = 'migration:v2'
export const LEGACY_STORAGE_KEYS = [
  'books',
  'preReadingQuestions',
  'chapterNotes',
  'actionItems',
  'readingCycles',
  'journalEntries',
  'readingTimerLogs',
] as const

type AnyRecord = Record<string, unknown>

const EMPTY_COUNTS: CollectionCounts = {
  sources: 0,
  notes: 0,
  recalls: 0,
  actionCandidates: 0,
  legacyArchive: 0,
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRecord
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function bool(value: unknown): boolean {
  return value === true
}

function recordId(prefix: string, record: AnyRecord, index: number): string {
  const rawId = text(record.id) || String(index)
  return `${prefix}-${encodeURIComponent(rawId)}`
}

function legacyTimestamp(record: AnyRecord, fallback?: unknown): string {
  return toDateTime(record.updatedAt ?? record.createdAt ?? fallback)
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function incomingIsNewer(
  current: { createdAt: string; updatedAt?: string } | undefined,
  incoming: { createdAt: string; updatedAt?: string },
): boolean {
  if (!current) return true
  const currentTime = Date.parse(current.updatedAt ?? current.createdAt) || 0
  const incomingTime = Date.parse(incoming.updatedAt ?? incoming.createdAt) || 0
  return incomingTime >= currentTime
}

function mapSourceStatus(value: unknown): SourceStatus {
  if (value === 'completed') return 'completed'
  if (value === 'archived') return 'archived'
  return 'active'
}

function chapterLocator(record: AnyRecord): string | undefined {
  const number = text(record.chapterNumber)
  const title = text(record.chapterTitle)
  const parts = [number ? `第${number}章` : '', title].filter(Boolean)
  return parts.join('：') || undefined
}

function chapterContent(record: AnyRecord): string {
  const sections = [
    ['重要なこと', text(record.important)],
    ['記憶に残すこと', text(record.memory)],
    ['活かし方', text(record.application)],
  ].filter(([, value]) => Boolean(value))

  if (sections.length === 0) return '（旧メモに本文はありません）'
  return sections.map(([heading, value]) => `### ${heading}\n${value}`).join('\n\n')
}

function cycleActionContent(ifThenValue: unknown): string {
  const ifThen = asRecord(ifThenValue)
  const situation = text(ifThen.situation)
  const action = text(ifThen.action)
  const place = text(ifThen.place)
  if (!action) return ''
  const trigger = situation || '決めたきっかけが起きた'
  return `もし「${trigger}」なら、「${action}」する${place ? `（場所：${place}）` : ''}`
}

function sourceForLegacyBook(
  rawBookId: unknown,
  sourceMap: Map<string, string>,
  sources: Source[],
): string {
  const oldId = text(rawBookId) || 'unknown'
  const existing = sourceMap.get(oldId)
  if (existing) return existing

  const sourceId = `legacy-source-orphan-${encodeURIComponent(oldId)}`
  sourceMap.set(oldId, sourceId)
  sources.push({
    id: sourceId,
    kind: 'other',
    title: oldId === 'unknown' ? '旧データ（資料不明）' : `旧データ（資料ID: ${oldId}）`,
    tags: ['旧データ'],
    status: 'archived',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    legacyId: oldId,
  })
  return sourceId
}

export function readLegacyFromLocalStorage(storage: Storage = localStorage): LegacyData {
  const result: LegacyData = {}
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = storage.getItem(key)
    if (!raw) continue
    try {
      result[key] = JSON.parse(raw)
    } catch {
      result[key] = []
    }
  }
  const timerState = storage.getItem('readingTimerState')
  if (timerState) {
    try {
      result.readingTimerState = JSON.parse(timerState)
    } catch {
      result.readingTimerState = timerState
    }
  }
  return result
}

export function hasLegacyData(value: LegacyData): boolean {
  return LEGACY_STORAGE_KEYS.some((key) => asArray(value[key]).length > 0)
    || (value.readingTimerState !== undefined && value.readingTimerState !== null)
}

export function getLegacyInputCounts(value: LegacyData): Record<string, number> {
  return {
    books: asArray(value.books).length,
    chapterNotes: asArray(value.chapterNotes).length,
    preReadingQuestions: asArray(value.preReadingQuestions).length,
    readingCycles: asArray(value.readingCycles).length,
    actionItems: asArray(value.actionItems).length,
    journalEntries: asArray(value.journalEntries).length,
    readingTimerLogs: asArray(value.readingTimerLogs).length,
    readingTimerState: value.readingTimerState == null ? 0 : 1,
  }
}

export interface MigrationOptions {
  database?: ActiveReadingDatabase
  markComplete?: boolean
}

export async function migrateLegacyData(
  legacy: LegacyData,
  options: MigrationOptions = {},
): Promise<CollectionCounts> {
  const database = options.database ?? db
  const markComplete = options.markComplete ?? true
  const sources: Source[] = []
  const notes: Note[] = []
  const actions: ActionCandidate[] = []
  const archives: LegacyArchive[] = []
  const sourceMap = new Map<string, string>()

  asArray(legacy.books).forEach((value, index) => {
    const record = asRecord(value)
    const oldId = text(record.id) || String(index)
    const id = recordId('legacy-source', record, index)
    const timestamp = legacyTimestamp(record, record.startDate)
    const category = text(record.category)
    sourceMap.set(oldId, id)
    sources.push({
      id,
      kind: 'book',
      title: text(record.title) || '無題の旧資料',
      author: text(record.author) || undefined,
      tags: category ? [category] : [],
      status: mapSourceStatus(record.status),
      createdAt: toDateTime(record.createdAt ?? record.startDate),
      updatedAt: timestamp,
      legacyId: oldId,
    })
  })

  asArray(legacy.chapterNotes).forEach((value, index) => {
    const record = asRecord(value)
    const sourceId = sourceForLegacyBook(record.bookId, sourceMap, sources)
    const timestamp = legacyTimestamp(record)
    notes.push({
      id: recordId('legacy-note-chapter', record, index),
      sourceId,
      locator: chapterLocator(record),
      content: chapterContent(record),
      reviewState: 'none',
      createdAt: toDateTime(record.createdAt),
      updatedAt: timestamp,
      legacyId: text(record.id) || String(index),
      legacyKind: 'chapterNote',
    })
  })

  asArray(legacy.preReadingQuestions).forEach((value, index) => {
    const record = asRecord(value)
    const sourceId = sourceForLegacyBook(record.bookId, sourceMap, sources)
    archives.push({
      id: recordId('legacy-archive-question', record, index),
      category: 'preReadingQuestion',
      title: '旧版の読む前の問い',
      sourceId,
      payload: value,
      createdAt: toDateTime(record.createdAt),
    })
  })

  asArray(legacy.readingCycles).forEach((value, index) => {
    const record = asRecord(value)
    const sourceId = sourceForLegacyBook(record.bookId, sourceMap, sources)
    const cycleId = text(record.id) || String(index)
    const timestamp = legacyTimestamp(record, record.date)
    const insight = text(record.insight)
    const actionContent = cycleActionContent(record.ifThen)
    const noteId = insight ? recordId('legacy-note-cycle', record, index) : undefined
    const actionId = actionContent ? recordId('legacy-action-cycle', record, index) : undefined
    const ifThen = asRecord(record.ifThen)

    if (noteId) {
      notes.push({
        id: noteId,
        sourceId,
        locator: text(record.date) ? `読書サイクル ${text(record.date)}` : '旧版の読書サイクル',
        content: insight,
        actionCandidateId: actionId,
        reviewState: 'none',
        createdAt: toDateTime(record.createdAt ?? record.date),
        updatedAt: timestamp,
        legacyId: cycleId,
        legacyKind: 'readingCycle',
      })
    }

    if (actionId) {
      actions.push({
        id: actionId,
        sourceId,
        noteId,
        content: actionContent,
        status: bool(ifThen.executed) ? 'completed' : 'candidate',
        completedAt: bool(ifThen.executed)
          ? toDateTime(ifThen.executedDate ?? record.updatedAt ?? record.createdAt)
          : undefined,
        createdAt: toDateTime(record.createdAt ?? record.date),
        updatedAt: timestamp,
        legacyId: cycleId,
      })
    }

    archives.push({
      id: recordId('legacy-archive-cycle', record, index),
      category: 'readingCycle',
      title: `旧版の読書サイクル${text(record.date) ? `（${text(record.date)}）` : ''}`,
      sourceId,
      payload: value,
      createdAt: toDateTime(record.createdAt ?? record.date),
    })
  })

  asArray(legacy.actionItems).forEach((value, index) => {
    const record = asRecord(value)
    const sourceId = sourceForLegacyBook(record.bookId, sourceMap, sources)
    const executionNote = text(record.note)
    const content = text(record.content) || '（旧版の行動候補・内容なし）'
    const timestamp = legacyTimestamp(record, record.doneDate)
    actions.push({
      id: recordId('legacy-action-item', record, index),
      sourceId,
      content: executionNote ? `${content}\n\n実行メモ：${executionNote}` : content,
      status: bool(record.isDone) ? 'completed' : 'candidate',
      completedAt: bool(record.isDone)
        ? toDateTime(record.doneDate ?? record.updatedAt ?? record.createdAt)
        : undefined,
      createdAt: toDateTime(record.createdAt),
      updatedAt: timestamp,
      legacyId: text(record.id) || String(index),
    })
    archives.push({
      id: recordId('legacy-archive-action', record, index),
      category: 'legacyAction',
      title: '旧版の行動候補',
      sourceId,
      payload: value,
      createdAt: toDateTime(record.createdAt),
    })
  })

  asArray(legacy.journalEntries).forEach((value, index) => {
    const record = asRecord(value)
    archives.push({
      id: recordId('legacy-archive-journal', record, index),
      category: 'journalEntry',
      title: `旧版ジャーナル${text(record.date) ? `（${text(record.date)}）` : ''}`,
      payload: value,
      createdAt: toDateTime(record.createdAt ?? record.date),
    })
  })

  asArray(legacy.readingTimerLogs).forEach((value, index) => {
    const record = asRecord(value)
    const sourceId = sourceForLegacyBook(record.bookId, sourceMap, sources)
    archives.push({
      id: recordId('legacy-archive-timer-log', record, index),
      category: 'readingTimerLog',
      title: `旧版の読書時間${text(record.date) ? `（${text(record.date)}）` : ''}`,
      sourceId,
      payload: value,
      createdAt: toDateTime(record.createdAt ?? record.date),
    })
  })

  if (legacy.readingTimerState !== undefined && legacy.readingTimerState !== null) {
    const record = asRecord(legacy.readingTimerState)
    archives.push({
      id: 'legacy-archive-timer-state',
      category: 'readingTimerState',
      title: '旧版のタイマー状態',
      payload: legacy.readingTimerState,
      createdAt: legacyTimestamp(record),
    })
  }

  const finalSources = dedupeById(sources)
  const finalNotes = dedupeById(notes)
  const finalActions = dedupeById(actions)
  const finalArchives = dedupeById(archives)

  await database.transaction(
    'rw',
    [
      database.sources,
      database.notes,
      database.actionCandidates,
      database.legacyArchive,
      database.appMeta,
    ],
    async () => {
      for (const source of finalSources) {
        if (incomingIsNewer(await database.sources.get(source.id), source)) {
          await database.sources.put(source)
        }
      }
      for (const note of finalNotes) {
        if (incomingIsNewer(await database.notes.get(note.id), note)) {
          await database.notes.put(note)
        }
      }
      for (const action of finalActions) {
        if (incomingIsNewer(await database.actionCandidates.get(action.id), action)) {
          await database.actionCandidates.put(action)
        }
      }
      for (const archive of finalArchives) {
        if (incomingIsNewer(await database.legacyArchive.get(archive.id), archive)) {
          await database.legacyArchive.put(archive)
        }
      }
      if (markComplete && !(await database.appMeta.get(LEGACY_MIGRATION_META_KEY))) {
        await database.appMeta.put({
          key: LEGACY_MIGRATION_META_KEY,
          value: {
            version: 2,
            completedAt: new Date().toISOString(),
            inputCounts: getLegacyInputCounts(legacy),
          },
        })
      }
    },
  )

  return {
    ...EMPTY_COUNTS,
    sources: finalSources.length,
    notes: finalNotes.length,
    actionCandidates: finalActions.length,
    legacyArchive: finalArchives.length,
  }
}

export function isLegacyBackup(value: unknown): value is LegacyData {
  const record = asRecord(value)
  return LEGACY_STORAGE_KEYS.some((key) => Array.isArray(record[key]))
}
