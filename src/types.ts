export type SourceKind = 'book' | 'article' | 'other'
export type SourceStatus = 'active' | 'completed' | 'archived'
export type ReviewState = 'pending' | 'done' | 'skipped' | 'none'
export type RecallRating = 'recalled' | 'partial' | 'forgotten'
export type ActionStatus = 'candidate' | 'completed' | 'dismissed'

export interface Source {
  id: string
  kind: SourceKind
  title: string
  author?: string
  url?: string
  tags: string[]
  purpose?: string
  status: SourceStatus
  createdAt: string
  updatedAt: string
  legacyId?: string
}

export interface Note {
  id: string
  sourceId: string
  locator?: string
  content: string
  actionCandidateId?: string
  reviewDueDate?: string
  reviewState: ReviewState
  createdAt: string
  updatedAt: string
  legacyId?: string
  legacyKind?: 'chapterNote' | 'readingCycle'
}

export interface Recall {
  id: string
  noteId: string
  response: string
  rating: RecallRating
  createdAt: string
}

export interface ActionCandidate {
  id: string
  sourceId: string
  noteId?: string
  content: string
  status: ActionStatus
  completedAt?: string
  createdAt: string
  updatedAt: string
  legacyId?: string
}

export interface LegacyArchive {
  id: string
  category:
    | 'preReadingQuestion'
    | 'readingCycle'
    | 'journalEntry'
    | 'readingTimerLog'
    | 'readingTimerState'
    | 'legacyAction'
    | 'unknown'
  title: string
  sourceId?: string
  payload: unknown
  createdAt: string
}

export interface AppMeta {
  key: string
  value: unknown
}

export interface BackupV2 {
  schemaVersion: 2
  exportedAt: string
  sources: Source[]
  notes: Note[]
  recalls: Recall[]
  actionCandidates: ActionCandidate[]
  legacyArchive: LegacyArchive[]
  appMeta: AppMeta[]
}

export interface LegacyData {
  books?: unknown[]
  preReadingQuestions?: unknown[]
  chapterNotes?: unknown[]
  actionItems?: unknown[]
  readingCycles?: unknown[]
  journalEntries?: unknown[]
  readingTimerLogs?: unknown[]
  readingTimerState?: unknown
  [key: string]: unknown
}

export interface CollectionCounts {
  sources: number
  notes: number
  recalls: number
  actionCandidates: number
  legacyArchive: number
}
