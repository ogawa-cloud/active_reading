export interface NoteDraft {
  sourceId: string
  noteId?: string
  locator: string
  content: string
  action: string
  savedAt: string
}

export function draftKey(sourceId: string, noteId?: string): string {
  return `activeReadingV2:draft:${noteId ?? `new:${sourceId}`}`
}

export function loadDraft(sourceId: string, noteId?: string): NoteDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(sourceId, noteId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<NoteDraft>
    if (value.sourceId !== sourceId) return null
    return {
      sourceId,
      noteId,
      locator: typeof value.locator === 'string' ? value.locator : '',
      content: typeof value.content === 'string' ? value.content : '',
      action: typeof value.action === 'string' ? value.action : '',
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: Omit<NoteDraft, 'savedAt'>): void {
  localStorage.setItem(
    draftKey(draft.sourceId, draft.noteId),
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
  )
}

export function removeDraft(sourceId: string, noteId?: string): void {
  localStorage.removeItem(draftKey(sourceId, noteId))
}
