/**
 * Frontmatter dates, shared by every Nera plugin and tool
 * (`@nera-static/plugin-utils/dates`): parsing, the W3C format, the decided
 * key lists and a date comparator.
 *
 * Nothing here reads the build machine's time zone: a time without an
 * offset is read as UTC, as YAML reads an unquoted timestamp, so the same
 * site gives the same dates and the same order on every machine.
 */

// `YYYY-MM-DD`, optionally `T` or a space, `hh:mm`, optional `:ss` and
// fraction, and an optional `Z` or `±hh:mm` offset.
const DATE_STRING = new RegExp(
    '^(\\d{4})-(\\d{2})-(\\d{2})' +
    '(?:[T ](\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d+))?)?\\s*(Z|[+-]\\d{2}:\\d{2})?)?$'
)

const MINUTE = 60 * 1000

/**
 * Frontmatter keys tried for a page's published date, in order. `createdAt`
 * is left out on purpose: core fills it from the file's birth time when the
 * frontmatter has no date, and CI stamps every file the same.
 */
export const PUBLISHED_KEYS = Object.freeze(['date', 'datePublished', 'published'])

/** Frontmatter keys tried for a page's updated date, in order. */
export const UPDATED_KEYS = Object.freeze(['updated', 'updatedAt', 'lastmod', 'dateModified'])

const KEYS = { published: PUBLISHED_KEYS, updated: UPDATED_KEYS }

const validDate = (date) => (Number.isNaN(date.getTime()) ? null : date)

// The offset `±hh:mm` in milliseconds, or null when it is out of range.
function offsetOf(zone) {
    if (zone === undefined || zone === 'Z') return 0
    const hours = Number(zone.slice(1, 3))
    const minutes = Number(zone.slice(4, 6))
    if (hours > 23 || minutes > 59) return null
    return (zone[0] === '-' ? -1 : 1) * (hours * 60 + minutes) * MINUTE
}

/**
 * A frontmatter value as a `Date`, or `null` when it is not a usable date.
 *
 * Accepts a valid `Date` (core parses an unquoted frontmatter date into one)
 * or a string `YYYY-MM-DD`, optionally followed by `T` or a space and
 * `hh:mm[:ss[.fraction]]` with an optional `Z` or `±hh:mm` offset
 * (surrounding whitespace is ignored). A string without an offset is read as
 * UTC. A day or time that does not exist (`2026-02-30`, `24:00`, `09:60`) is
 * not usable; neither is any other type or form (`1.10.2026`, a number).
 *
 * @param {unknown} value
 * @returns {Date | null}
 */
export function toDate(value) {
    if (value instanceof Date) return validDate(value)
    if (typeof value !== 'string') return null
    const match = DATE_STRING.exec(value.trim())
    if (!match) return null
    const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '', zone] = match
    const parts = [year, month, day, hour, minute, second].map(Number)
    const wall = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]))
    // `Date.UTC` rolls an impossible day or time over (Feb 30 into March,
    // 24:00 into the next day); a value that does not read back is refused.
    const exists = wall.getUTCFullYear() === parts[0]
        && wall.getUTCMonth() === parts[1] - 1
        && wall.getUTCDate() === parts[2]
        && wall.getUTCHours() === parts[3]
        && wall.getUTCMinutes() === parts[4]
        && wall.getUTCSeconds() === parts[5]
    const offset = offsetOf(zone)
    if (!exists || offset === null) return null
    const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3))
    return validDate(new Date(wall.getTime() + milliseconds - offset))
}

/**
 * A date in W3C Datetime form, in UTC: `YYYY-MM-DD` for UTC midnight (an
 * unquoted `2026-10-01`), else `YYYY-MM-DDThh:mm:ssZ` without milliseconds.
 * Accepts whatever `toDate` accepts; `null` when that is not a usable date.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function formatW3C(value) {
    const date = toDate(value)
    if (!date) return null
    const iso = date.toISOString()
    if (iso.endsWith('T00:00:00.000Z')) return iso.slice(0, 10)
    return iso.replace(/\.\d{3}Z$/, 'Z')
}

// A rejected value as a warning shows it.
function show(value) {
    if (value instanceof Date) return 'an invalid date'
    return JSON.stringify(value) ?? String(value)
}

const isAbsent = (value) => value === undefined || value === null
    || (typeof value === 'string' && value.trim() === '')

/**
 * A page's published or updated date: the first key of `PUBLISHED_KEYS`
 * resp. `UPDATED_KEYS` whose value is a usable date (see `toDate`), or
 * `null` when none is. A present value that is not a date is skipped with
 * one warning (`<href>: ignoring <key> <value>, …`) and the next key is
 * tried; an absent, `null` or blank value is skipped silently. Keys after
 * the first usable one are not read.
 *
 * @param {object | undefined | null} meta the page's `meta`
 * @param {'published' | 'updated'} kind
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {Date | null}
 * @throws {TypeError} when `kind` is neither `'published'` nor `'updated'`
 */
export function pageDate(meta, kind, { warn = console.warn } = {}) {
    if (!Object.hasOwn(KEYS, kind)) {
        throw new TypeError(`pageDate: kind must be 'published' or 'updated', got ${show(kind)}`)
    }
    for (const key of KEYS[kind]) {
        const value = meta?.[key]
        if (isAbsent(value)) continue
        const date = toDate(value)
        if (date) return date
        const where = typeof meta.href === 'string' && meta.href !== '' ? meta.href : 'a page without href'
        warn(`${where}: ignoring ${key} ${show(value)}, expected a date like 2026-10-01 or 2026-10-01T09:30:00Z`)
    }
    return null
}

/**
 * A comparator by date, for `Array.prototype.sort`: `get(item)` returns the
 * item's date in any form `toDate` accepts. Oldest first, or newest first
 * with `descending`; items without a usable date go last in both
 * directions. Equal dates compare as `0`, so chain a tie-break
 * (`byDate(get)(a, b) || byHref(a, b)`) for an order that does not depend
 * on the input.
 *
 * @param {(item: any) => unknown} get
 * @param {{ descending?: boolean }} [options]
 * @returns {(a: any, b: any) => number}
 */
export function byDate(get, { descending = false } = {}) {
    if (typeof get !== 'function') {
        throw new TypeError('byDate: get must be a function that returns an item\'s date')
    }
    const direction = descending ? -1 : 1
    return (a, b) => {
        const left = toDate(get(a))
        const right = toDate(get(b))
        if (!left || !right) return (left ? 0 : 1) - (right ? 0 : 1)
        return direction * (left.getTime() - right.getTime())
    }
}
