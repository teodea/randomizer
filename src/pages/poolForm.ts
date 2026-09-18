import type { PoolOptions } from '../mixer/engine'

/** The pool settings as the form holds them; number fields stay text until the mix is built. */
export interface PoolForm {
  removeDuplicates: boolean
  excludeExplicit: boolean
  /** Minutes; empty means no limit. */
  minMinutes: string
  /** Minutes; empty means no limit. */
  maxMinutes: string
  fixedLength: boolean
  length: string
}

export const defaultPoolForm: PoolForm = {
  removeDuplicates: false,
  excludeExplicit: false,
  minMinutes: '',
  maxMinutes: '',
  fixedLength: false,
  length: '50',
}

/** The engine options for a form, or null while a field holds something unusable. */
export function toPoolOptions(form: PoolForm): PoolOptions | null {
  const minMinutes = parseMinutes(form.minMinutes)
  const maxMinutes = parseMinutes(form.maxMinutes)
  const length = Number(form.length)
  if (minMinutes === null || maxMinutes === null) return null
  if (minMinutes !== undefined && maxMinutes !== undefined && minMinutes > maxMinutes) return null
  if (form.fixedLength && !(Number.isInteger(length) && length > 0)) return null

  return {
    removeDuplicates: form.removeDuplicates,
    excludeExplicit: form.excludeExplicit,
    minDurationMs: minMinutes === undefined ? undefined : minMinutes * 60_000,
    maxDurationMs: maxMinutes === undefined ? undefined : maxMinutes * 60_000,
    length: form.fixedLength ? length : undefined,
  }
}

/** Undefined for an empty field, null for one that isn't a usable number of minutes. */
function parseMinutes(text: string): number | undefined | null {
  if (text.trim() === '') return undefined
  const minutes = Number(text)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null
}
