import { describe, expect, it } from 'vitest'
import { isDueOnOrBefore, localDateKey, nextLocalDateKey } from './date'

describe('ローカル日付', () => {
  it('月末でも次のローカル日付を返す', () => {
    const date = new Date(2026, 0, 31, 23, 59, 0)
    expect(localDateKey(date)).toBe('2026-01-31')
    expect(nextLocalDateKey(date)).toBe('2026-02-01')
  })

  it('翌日になる前は復習対象にしない', () => {
    expect(isDueOnOrBefore('2026-08-25', '2026-08-24')).toBe(false)
    expect(isDueOnOrBefore('2026-08-25', '2026-08-25')).toBe(true)
    expect(isDueOnOrBefore('2026-08-25', '2026-08-26')).toBe(true)
  })
})
