const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function localDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function nextLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('日付を解釈できませんでした。')
  }
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + 1)
  return localDateKey(date)
}

export function isDueOnOrBefore(dueDate: string | undefined, today = localDateKey()): boolean {
  if (!dueDate || !DATE_KEY_PATTERN.test(dueDate) || !DATE_KEY_PATTERN.test(today)) return false
  return dueDate <= today
}

export function formatDisplayDate(value?: string): string {
  if (!value) return '—'
  const date = DATE_KEY_PATTERN.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function toDateTime(value: unknown, fallback = '1970-01-01T00:00:00.000Z'): string {
  if (typeof value !== 'string' || !value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}
