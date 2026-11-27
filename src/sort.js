/**
 * Comparators for every sort that shapes build output, shared by every Nera
 * plugin and tool (`@nera-static/plugin-utils/sort`).
 *
 * They compare UTF-16 code units, like `<` on strings, never with
 * `localeCompare`: the order is the same on every machine and in every
 * locale (uppercase before lowercase, ASCII before other letters).
 */

const asString = (value) => (typeof value === 'string' ? value : '')

/**
 * Compares two strings by code unit, for `Array.prototype.sort`. A value
 * that is not a string compares as `''`, so it sorts first.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {-1 | 0 | 1}
 */
export function byString(a, b) {
    const left = asString(a)
    const right = asString(b)
    return left < right ? -1 : left > right ? 1 : 0
}

const hrefOf = (item) => item?.meta?.href ?? item?.href

/**
 * Compares two pages (`{ meta }`) or two metas by `href`, by code unit (see
 * `byString`); a missing `href` sorts first.
 *
 * @param {{ meta?: { href?: unknown }, href?: unknown } | undefined | null} a
 * @param {{ meta?: { href?: unknown }, href?: unknown } | undefined | null} b
 * @returns {-1 | 0 | 1}
 */
export function byHref(a, b) {
    return byString(hrefOf(a), hrefOf(b))
}
